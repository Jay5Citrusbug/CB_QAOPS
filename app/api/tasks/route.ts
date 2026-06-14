export const dynamic = 'force-dynamic';

import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const taskListId = searchParams.get('taskListId');
    const targetUserId = searchParams.get('userId');
    const currentUserId = (session.user as any).id;
    const isAdmin = (session.user as any).role === 'ADMIN';

    // Check if query is for Task Board List
    if (taskListId) {
      let tasksQuery: FirebaseFirestore.Query = adminDb.collection('tasks').where('task_list_id', '==', taskListId);
      const tasksSnapshot = await tasksQuery.get();
      const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      // Normalize task fields to match specifications
      const normalized = tasks.map((t: any) => ({
        id: t.id,
        taskListId: t.task_list_id,
        taskNumber: t.task_number ?? 1000,
        title: t.title,
        description: t.description || '',
        notes: t.notes || '',
        status: t.status ?? 'To Do',
        priority: t.priority ?? 'Medium',
        dueDate: t.due_date ? (t.due_date.toDate ? t.due_date.toDate().toISOString() : String(t.due_date)) : null,
        assignedTo: t.assigned_to ?? null,
        createdBy: t.created_by,
        createdAt: t.created_at ? (t.created_at.toDate ? t.created_at.toDate().toISOString() : String(t.created_at)) : null,
        completedAt: t.completed_at ? (t.completed_at.toDate ? t.completed_at.toDate().toISOString() : String(t.completed_at)) : null,
        completedBy: t.completed_by ?? null,
        steps: t.steps ?? []
      }));

      // Sort by creation time descending
      normalized.sort((a: any, b: any) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });

      return NextResponse.json(normalized);
    }

    // --- Legacy personal tasks logic for backward compatibility ---
    let tasksQuery: FirebaseFirestore.Query = adminDb.collection('tasks');

    if (!(isAdmin && !targetUserId)) {
      const uid = isAdmin && targetUserId ? targetUserId : currentUserId;
      tasksQuery = tasksQuery.where('user_id', '==', uid);
    }
    
    const tasksSnapshot = await tasksQuery.get();
    const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    tasks.sort((a, b) => {
      const aTime = a.created_at?.toDate ? a.created_at.toDate().getTime() : 0;
      const bTime = b.created_at?.toDate ? b.created_at.toDate().getTime() : 0;
      return bTime - aTime;
    });

    const taskIds = tasks.map((t: any) => t.id);
    let steps: any[] = [];
    
    if (taskIds.length > 0) {
      const chunks = [];
      for (let i = 0; i < taskIds.length; i += 10) {
        chunks.push(taskIds.slice(i, i + 10));
      }
      
      const stepPromises = chunks.map(chunk => 
        adminDb.collection('task_steps').where('task_id', 'in', chunk).get()
      );
      
      const stepSnapshots = await Promise.all(stepPromises);
      stepSnapshots.forEach(snap => {
        snap.docs.forEach(doc => steps.push({ id: doc.id, ...doc.data() as any }));
      });

      steps.sort((a, b) => {
        const aTime = a.created_at?.toDate ? a.created_at.toDate().getTime() : 0;
        const bTime = b.created_at?.toDate ? b.created_at.toDate().getTime() : 0;
        return aTime - bTime;
      });
    }

    const normalized = tasks.map((t: any) => ({
      id: t.id,
      title: t.title,
      status: t.status ?? 'PENDING',
      isImportant: t.is_important ?? false,
      myDay: t.my_day ?? false,
      notes: t.notes ?? null,
      dueDate: t.due_date ? t.due_date.toDate().toISOString() : null,
      remindAt: t.remind_at ? t.remind_at.toDate().toISOString() : null,
      repeat: t.repeat ?? null,
      userId: t.user_id,
      createdAt: t.created_at ? t.created_at.toDate().toISOString() : null,
      steps: steps
        .filter((s) => s.task_id === t.id)
        .map((s) => ({ id: s.id, title: s.title, isCompleted: s.is_completed ?? false })),
    }));

    return NextResponse.json(normalized);
  } catch (error: any) {
    console.error('[API Tasks GET] Failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, taskListId, description, priority, dueDate, assignedTo } = body;

    if (!title || !title.trim() || !taskListId) {
      return NextResponse.json({ error: 'Title and Task List ID are required' }, { status: 400 });
    }

    // Auto-increment task number (find max in tasks and add 1)
    const tasksSnapshot = await adminDb.collection('tasks').get();
    let maxNumber = 1000;
    tasksSnapshot.docs.forEach(doc => {
      const num = doc.data().task_number || doc.data().taskNumber;
      if (num && typeof num === 'number' && num > maxNumber) {
        maxNumber = num;
      }
    });
    const taskNumber = maxNumber + 1;

    const newTask = {
      task_list_id: taskListId,
      task_number: taskNumber,
      title: title.trim(),
      description: description || '',
      notes: '',
      status: 'To Do',
      priority: priority || 'Medium',
      due_date: dueDate ? admin.firestore.Timestamp.fromDate(new Date(dueDate)) : null,
      assigned_to: assignedTo || null,
      created_by: session.user.email,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      completed_at: null,
      completed_by: null,
      steps: [], // Inline steps array
    };

    const docRef = await adminDb.collection('tasks').add(newTask);

    // Track activity
    await adminDb.collection('task_activities').add({
      task_id: docRef.id,
      action: 'Task Created',
      old_value: null,
      new_value: title.trim(),
      performed_by: session.user.email,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    revalidatePath('/dashboard');
    revalidatePath('/task-board');

    return NextResponse.json({
      id: docRef.id,
      ...newTask,
      created_at: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[API Tasks POST] Failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
