export const dynamic = 'force-dynamic';

import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Max limit: 25MB
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File size exceeds maximum limit of 25MB' }, { status: 400 });
    }

    // Allowed extensions check
    const ext = path.extname(file.name).toLowerCase().replace('.', '');
    const allowedExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'png', 'jpg', 'jpeg', 'zip'];
    if (!allowedExts.includes(ext)) {
      return NextResponse.json({ error: `File extension .${ext} is not allowed` }, { status: 400 });
    }

    // Local workspace directory to save files
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate safe unique filename
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFileName = `${Date.now()}-${sanitizedName}`;
    const diskPath = path.join(uploadsDir, uniqueFileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(diskPath, buffer);

    const fileUrl = `/uploads/${uniqueFileName}`;

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
