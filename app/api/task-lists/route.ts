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

    const userEmail = session.user.email as string;
    const userRole = (session.user as any).role || 'USER';
    const isQaLead = userRole === 'ADMIN' || userRole === 'TL';

    // Fetch lists and tasks
    const [listsSnapshot, tasksSnapshot] = await Promise.all([
      adminDb.collection('task_lists').get(),
      adminDb.collection('tasks').get()
    ]);

    const lists = listsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
    const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const responseData = lists.map((list: any) => {
      const listTasks = tasks.filter((t: any) => t.task_list_id === list.id || t.taskListId === list.id);
      const totalTasks = listTasks.length;
      const completedTasks = listTasks.filter((t: any) => t.status === 'Completed').length;
      const pendingTasks = listTasks.filter((t: any) => t.status === 'To Do').length;
      
      const overdueTasks = listTasks.filter((t: any) => {
        if (t.status !== 'To Do') return false;
        if (!t.due_date) return false;
        const dueDate = t.due_date.toDate ? t.due_date.toDate() : new Date(t.due_date);
        return dueDate < today;
      }).length;

      const sharedWith: string[] = list.shared_with ?? [];

      return {
        id: list.id,
        name: list.name,
        description: list.description || '',
        sharedWith,
        created_by: list.created_by,
        created_at: list.created_at ? (list.created_at.toDate ? list.created_at.toDate().toISOString() : String(list.created_at)) : null,
        totalTasks,
        completedTasks,
        pendingTasks,
        overdueTasks
      };
    });

    // Visibility rules:
    // - Creator always sees their own list
    // - ADMIN and TL see all lists
    // - Users in sharedWith array can see the list
    // - DEV role sees only lists they are explicitly invited to (or created themselves)
    const filteredLists = responseData.filter((list: any) => {
      if (list.created_by === userEmail) return true;
      if (isQaLead) return true;
      return list.sharedWith.includes(userEmail);
    });

    return NextResponse.json(filteredLists);
  } catch (error: any) {
    console.error('[API Task Lists GET] Failed:', error);
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
    const { name, description, sharedWith } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'List Name is required' }, { status: 400 });
    }

    const newList = {
      name: name.trim(),
      description: description || '',
      shared_with: Array.isArray(sharedWith) ? sharedWith : [],
      created_by: session.user.email,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('task_lists').add(newList);

    revalidatePath('/dashboard');
    revalidatePath('/task-board');

    return NextResponse.json({
      id: docRef.id,
      ...newList,
      created_at: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[API Task Lists POST] Failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
