export const dynamic = 'force-dynamic';

import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

import { revalidatePath } from 'next/cache';

export async function POST(
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
    const doc = await taskRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const taskData = doc.data() || {};
    const userEmail = session.user.email;
    const userRole = (session.user as any).role || 'USER';
    const isQaLead = userRole === 'ADMIN' || userRole === 'TL';

    // Fetch parent task list to verify visibility
    if (taskData.task_list_id) {
      const listDoc = await adminDb.collection('task_lists').doc(taskData.task_list_id).get();
      if (!listDoc.exists) {
        return NextResponse.json({ error: 'Task board list not found' }, { status: 404 });
      }
      const listData = listDoc.data() || {};
      const listSharedWith = listData.shared_with || [];
      const hasAccess = listData.created_by === userEmail || isQaLead || listSharedWith.includes(userEmail);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden: You do not have access to this task board' }, { status: 403 });
      }
    }
    const completedAt = admin.firestore.FieldValue.serverTimestamp();

    const batch = adminDb.batch();
    
    batch.update(taskRef, {
      status: 'Completed',
      completed_at: completedAt,
      completed_by: userEmail,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    batch.set(adminDb.collection('task_activities').doc(), {
      task_id: id,
      action: 'Task Completed',
      old_value: 'To Do',
      new_value: 'Completed',
      performed_by: userEmail,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    revalidatePath('/dashboard');
    revalidatePath('/task-board');

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('[API Task Complete POST] Failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
