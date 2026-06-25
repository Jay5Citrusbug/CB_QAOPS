export const dynamic = 'force-dynamic';

import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { revalidatePath } from 'next/cache';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const taskRef = adminDb.collection('tasks').doc(id);
    const taskDoc = await taskRef.get();
    if (!taskDoc.exists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const task = taskDoc.data() || {};
    const taskListId = task.task_list_id;
    if (taskListId) {
      const listDoc = await adminDb.collection('task_lists').doc(taskListId).get();
      if (!listDoc.exists) {
        return NextResponse.json({ error: 'Task board list not found' }, { status: 404 });
      }
      const listData = listDoc.data() || {};
      const listSharedWith = listData.shared_with || [];
      const userEmail = session.user.email as string;
      const userRole = (session.user as any).role || 'USER';
      const isQaLead = userRole === 'ADMIN' || userRole === 'TL';

      const hasAccess = listData.created_by === userEmail || isQaLead || listSharedWith.includes(userEmail);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden: You do not have access to this task board' }, { status: 403 });
      }
    }

    // Fetch attachments and activities
    const [attachmentsSnapshot, activitiesSnapshot] = await Promise.all([
      adminDb.collection('task_attachments').where('task_id', '==', id).get(),
      adminDb.collection('task_activities').where('task_id', '==', id).get()
    ]);

    const attachments = attachmentsSnapshot.docs.map(doc => ({
      id: doc.id,
      fileName: doc.data().file_name,
      filePath: doc.data().file_path,
      fileSize: doc.data().file_size,
      uploadedBy: doc.data().uploaded_by,
      uploadedAt: doc.data().uploaded_at ? (doc.data().uploaded_at.toDate ? doc.data().uploaded_at.toDate().toISOString() : String(doc.data().uploaded_at)) : null,
    }));

    const activities = activitiesSnapshot.docs.map(doc => ({
      id: doc.id,
      action: doc.data().action,
      oldValue: doc.data().old_value,
      newValue: doc.data().new_value,
      performedBy: doc.data().performed_by,
      createdAt: doc.data().created_at ? (doc.data().created_at.toDate ? doc.data().created_at.toDate().toISOString() : String(doc.data().created_at)) : null,
    }));

    // Sort activities chronologically by time ascending
    activities.sort((a: any, b: any) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });

    const normalized = {
      id: taskDoc.id,
      taskListId: task.task_list_id,
      taskNumber: task.task_number ?? 1000,
      title: task.title,
      description: task.description || '',
      notes: task.notes || '',
      status: task.status ?? 'To Do',
      priority: task.priority ?? 'Medium',
      dueDate: task.due_date ? (task.due_date.toDate ? task.due_date.toDate().toISOString() : String(task.due_date)) : null,
      assignedTo: task.assigned_to ?? null,
      createdBy: task.created_by,
      createdAt: task.created_at ? (task.created_at.toDate ? task.created_at.toDate().toISOString() : String(task.created_at)) : null,
      completedAt: task.completed_at ? (task.completed_at.toDate ? task.completed_at.toDate().toISOString() : String(task.completed_at)) : null,
      completedBy: task.completed_by ?? null,
      steps: task.steps ?? [],
      attachments,
      activities
    };

    return NextResponse.json(normalized);
  } catch (error: any) {
    console.error('[API Task GET] Failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const taskRef = adminDb.collection('tasks').doc(id);
    const taskDoc = await taskRef.get();
    if (!taskDoc.exists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const oldData = taskDoc.data() || {};
    const body = await request.json();
    const { title, description, notes, priority, dueDate, assignedTo, steps } = body;

    const userEmail = session.user.email;
    const userRole = (session.user as any).role || 'USER';
    const isQaLead = userRole === 'ADMIN' || userRole === 'TL';

    // Fetch parent task list to verify collaborative board permissions
    let hasListAccess = false;
    if (oldData.task_list_id) {
      const listDoc = await adminDb.collection('task_lists').doc(oldData.task_list_id).get();
      if (listDoc.exists) {
        const listData = listDoc.data() || {};
        const listSharedWith = listData.shared_with || [];
        hasListAccess = listData.created_by === userEmail || isQaLead || listSharedWith.includes(userEmail);
      }
    }

    // Permissions check: only creator, assignee, QA Lead, or shared board member can edit tasks
    if (oldData.created_by !== userEmail && oldData.assigned_to !== userEmail && !isQaLead && !hasListAccess) {
      return NextResponse.json({ error: 'Forbidden: Cannot edit other team members\' tasks' }, { status: 403 });
    }

    const updates: any = {};
    const batch = adminDb.batch();

    // Log individual updates to activities
    if (title !== undefined && title.trim() !== oldData.title) {
      updates.title = title.trim();
      batch.set(adminDb.collection('task_activities').doc(), {
        task_id: id,
        action: 'Task Updated',
        old_value: oldData.title,
        new_value: title.trim(),
        performed_by: userEmail,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    if (description !== undefined && description !== oldData.description) {
      updates.description = description;
      batch.set(adminDb.collection('task_activities').doc(), {
        task_id: id,
        action: 'Task Updated',
        old_value: oldData.description || 'No Description',
        new_value: description || 'Cleared Description',
        performed_by: userEmail,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    if (notes !== undefined && notes !== oldData.notes) {
      updates.notes = notes;
      batch.set(adminDb.collection('task_activities').doc(), {
        task_id: id,
        action: 'Task Updated',
        old_value: oldData.notes || 'No Notes',
        new_value: notes || 'Cleared Notes',
        performed_by: userEmail,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    if (priority !== undefined && priority !== oldData.priority) {
      updates.priority = priority;
      batch.set(adminDb.collection('task_activities').doc(), {
        task_id: id,
        action: 'Task Updated',
        old_value: oldData.priority,
        new_value: priority,
        performed_by: userEmail,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    if (dueDate !== undefined) {
      const oldDueStr = oldData.due_date ? (oldData.due_date.toDate ? oldData.due_date.toDate().toISOString().split('T')[0] : String(oldData.due_date).split('T')[0]) : 'None';
      const newDueStr = dueDate ? dueDate.split('T')[0] : 'None';
      if (oldDueStr !== newDueStr) {
        updates.due_date = dueDate ? admin.firestore.Timestamp.fromDate(new Date(dueDate)) : null;
        batch.set(adminDb.collection('task_activities').doc(), {
          task_id: id,
          action: 'Task Updated',
          old_value: oldDueStr,
          new_value: newDueStr,
          performed_by: userEmail,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    if (isQaLead && assignedTo !== undefined && assignedTo !== oldData.assigned_to) {
      updates.assigned_to = assignedTo || null;
      batch.set(adminDb.collection('task_activities').doc(), {
        task_id: id,
        action: 'Task Assigned',
        old_value: oldData.assigned_to || 'Unassigned',
        new_value: assignedTo || 'Unassigned',
        performed_by: userEmail,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    if (steps !== undefined) {
      updates.steps = steps;
    }

    updates.updated_at = admin.firestore.FieldValue.serverTimestamp();
    batch.update(taskRef, updates);

    await batch.commit();

    revalidatePath('/dashboard');
    revalidatePath('/task-board');

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('[API Task PUT] Failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const taskRef = adminDb.collection('tasks').doc(id);
    const taskDoc = await taskRef.get();
    if (!taskDoc.exists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const taskData = taskDoc.data() || {};
    const userEmail = session.user.email;
    const userRole = (session.user as any).role || 'USER';
    const isQaLead = userRole === 'ADMIN' || userRole === 'TL';

    // Fetch parent task list to verify collaborative board permissions
    let hasListAccess = false;
    if (taskData.task_list_id) {
      const listDoc = await adminDb.collection('task_lists').doc(taskData.task_list_id).get();
      if (listDoc.exists) {
        const listData = listDoc.data() || {};
        const listSharedWith = listData.shared_with || [];
        hasListAccess = listData.created_by === userEmail || isQaLead || listSharedWith.includes(userEmail);
      }
    }

    // Permissions check: only creator, QA Lead, or shared board member can delete tasks
    if (taskData.created_by !== userEmail && !isQaLead && !hasListAccess) {
      return NextResponse.json({ error: 'Forbidden: Cannot delete other team members\' tasks' }, { status: 403 });
    }

    const batch = adminDb.batch();

    // Query and delete activities & attachments
    const [activitiesSnapshot, attachmentsSnapshot] = await Promise.all([
      adminDb.collection('task_activities').where('task_id', '==', id).get(),
      adminDb.collection('task_attachments').where('task_id', '==', id).get()
    ]);

    activitiesSnapshot.docs.forEach(act => batch.delete(act.ref));
    
    // Delete physical files from disk and delete records
    attachmentsSnapshot.docs.forEach(att => {
      const filePath = att.data().file_path;
      if (filePath) {
        const fullDiskPath = path.join(process.cwd(), 'public', filePath);
        try {
          if (fs.existsSync(fullDiskPath)) {
            fs.unlinkSync(fullDiskPath);
          }
        } catch (diskErr) {
          console.error('[API Task DELETE] Failed to delete file on disk:', fullDiskPath, diskErr);
        }
      }
      batch.delete(att.ref);
    });

    batch.delete(taskRef);

    await batch.commit();

    revalidatePath('/dashboard');
    revalidatePath('/task-board');

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('[API Task DELETE] Failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
