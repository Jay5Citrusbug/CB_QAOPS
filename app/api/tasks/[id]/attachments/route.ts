export const dynamic = 'force-dynamic';

import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { uploadFile } from '@/lib/upload-helper';

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
    const taskDoc = await adminDb.collection('tasks').doc(id).get();
    if (!taskDoc.exists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    const taskData = taskDoc.data() || {};
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

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Max limit: 10MB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File size exceeds maximum limit of 10MB' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { url: fileUrl } = await uploadFile(buffer, file.name, file.type, 'tasks');

    const newAttachment = {
      task_id: id,
      file_name: file.name,
      file_path: fileUrl,
      file_size: file.size,
      uploaded_by: session.user.email,
      uploaded_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('task_attachments').add(newAttachment);

    // Track activity log
    await adminDb.collection('task_activities').add({
      task_id: id,
      action: 'Attachment Added',
      old_value: null,
      new_value: file.name,
      performed_by: session.user.email,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      id: docRef.id,
      fileName: file.name,
      filePath: fileUrl,
      fileSize: file.size,
      uploadedBy: session.user.email,
      uploadedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[API Task Attachments POST] Failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
