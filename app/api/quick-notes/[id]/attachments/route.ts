export const dynamic = 'force-dynamic';

import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { uploadFile, deleteFile } from '@/lib/upload-helper';

// POST /api/quick-notes/[id]/attachments — upload file to a note
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
    const userId = (session.user as any).id;

    const docRef = adminDb.collection('quick_notes').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const noteData = doc.data() as any;
    if (noteData.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase().replace('.', '') || 'unknown';

    const buffer = Buffer.from(await file.arrayBuffer());
    const { url: fileUrl } = await uploadFile(buffer, file.name, file.type, 'notes');
    const attachmentId = `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const newAttachment = {
      id: attachmentId,
      fileName: file.name,
      filePath: fileUrl,
      fileSize: file.size,
      fileExt: ext,
      uploadedAt: new Date().toISOString(),
    };

    const existingAttachments: any[] = noteData.attachments ?? [];
    await docRef.update({
      attachments: [...existingAttachments, newAttachment],
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, attachment: newAttachment });
  } catch (error: any) {
    console.error('[Quick Notes Attachments POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/quick-notes/[id]/attachments?attachmentId=xxx — remove a file from a note
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
    const userId = (session.user as any).id;
    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get('attachmentId');

    if (!attachmentId) {
      return NextResponse.json({ error: 'attachmentId is required' }, { status: 400 });
    }

    const docRef = adminDb.collection('quick_notes').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const noteData = doc.data() as any;
    if (noteData.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const attachments: any[] = noteData.attachments ?? [];
    const target = attachments.find((a: any) => a.id === attachmentId);

    if (target?.filePath) {
      await deleteFile(target.filePath);
    }

    const updated = attachments.filter((a: any) => a.id !== attachmentId);
    await docRef.update({
      attachments: updated,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Quick Notes Attachments DELETE]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
