export const dynamic = 'force-dynamic';

import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

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
    const body = await request.json();
    const { name, description, sharedWith } = body;

    const listRef = adminDb.collection('task_lists').doc(id);
    const doc = await listRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Task list not found' }, { status: 404 });
    }

    const listData = doc.data() || {};
    const userEmail = session.user.email;
    const userRole = (session.user as any).role || 'USER';
    const isQaLead = userRole === 'ADMIN' || userRole === 'TL';
    const existingSharedWith = listData.shared_with || [];

    // Permissions check: only creator, QA Lead, or shared member can update lists
    if (listData.created_by !== userEmail && !isQaLead && !existingSharedWith.includes(userEmail)) {
      return NextResponse.json({ error: 'Forbidden: Cannot edit other team members\' lists' }, { status: 403 });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (sharedWith !== undefined) updates.shared_with = Array.isArray(sharedWith) ? sharedWith : [];
    updates.updated_at = admin.firestore.FieldValue.serverTimestamp();

    await listRef.update(updates);

    revalidatePath('/dashboard');
    revalidatePath('/task-board');

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('[API Task List PUT] Failed:', error);
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
    const listRef = adminDb.collection('task_lists').doc(id);
    const doc = await listRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Task list not found' }, { status: 404 });
    }

    const listData = doc.data() || {};
    const userEmail = session.user.email;
    const userRole = (session.user as any).role || 'USER';
    const isQaLead = userRole === 'ADMIN' || userRole === 'TL';
    const sharedWith = listData.shared_with || [];

    // Permissions check: only creator, QA Lead, or shared member can delete lists
    if (listData.created_by !== userEmail && !isQaLead && !sharedWith.includes(userEmail)) {
      return NextResponse.json({ error: 'Forbidden: Cannot delete other team members\' lists' }, { status: 403 });
    }

    // Cascading delete tasks under this list
    const tasksSnapshot = await adminDb.collection('tasks')
      .where('task_list_id', '==', id)
      .get();

    const batch = adminDb.batch();

    for (const taskDoc of tasksSnapshot.docs) {
      batch.delete(taskDoc.ref);
      
      // Cascade delete task activities and attachments
      const [activitiesSnapshot, attachmentsSnapshot] = await Promise.all([
        adminDb.collection('task_activities').where('task_id', '==', taskDoc.id).get(),
        adminDb.collection('task_attachments').where('task_id', '==', taskDoc.id).get()
      ]);

      activitiesSnapshot.docs.forEach(act => batch.delete(act.ref));
      attachmentsSnapshot.docs.forEach(att => batch.delete(att.ref));
    }

    // Delete the task list itself
    batch.delete(listRef);

    await batch.commit();

    revalidatePath('/dashboard');
    revalidatePath('/task-board');

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('[API Task List DELETE] Failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
