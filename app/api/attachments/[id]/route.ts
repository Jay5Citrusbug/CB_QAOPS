export const dynamic = 'force-dynamic';

import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
    const attachmentRef = adminDb.collection('task_attachments').doc(id);
    const attachmentDoc = await attachmentRef.get();

    if (!attachmentDoc.exists) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const attachmentData = attachmentDoc.data() || {};
    const userEmail = session.user.email;
    const userRole = (session.user as any).role || 'USER';
    const isQaLead = userRole === 'ADMIN' || userRole === 'TL';

    // Permissions check: only uploader or QA Lead can delete attachments
    if (attachmentData.uploaded_by !== userEmail && !isQaLead) {
      return NextResponse.json({ error: 'Forbidden: Cannot delete other team members\' files' }, { status: 403 });
    }

    const batch = adminDb.batch();

    // 1. Delete physical file from disk
    const filePath = attachmentData.file_path;
    if (filePath) {
      const fullDiskPath = path.join(process.cwd(), 'public', filePath);
      try {
        if (fs.existsSync(fullDiskPath)) {
          fs.unlinkSync(fullDiskPath);
        }
      } catch (err) {
        console.error('[API Attachment DELETE] Disk file unlink failed:', fullDiskPath, err);
      }
    }

    // 2. Delete attachment record
    batch.delete(attachmentRef);

    // 3. Log activity
    batch.set(adminDb.collection('task_activities').doc(), {
      task_id: attachmentData.task_id,
      action: 'Attachment Deleted',
      old_value: attachmentData.file_name,
      new_value: null,
      performed_by: userEmail,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('[API Attachment DELETE] Failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
