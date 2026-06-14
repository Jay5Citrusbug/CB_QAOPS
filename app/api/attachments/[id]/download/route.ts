export const dynamic = 'force-dynamic';

import { adminDb } from '@/lib/firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { id } = await params;
    const attachmentDoc = await adminDb.collection('task_attachments').doc(id).get();
    if (!attachmentDoc.exists) {
      return new Response('Attachment not found', { status: 404 });
    }

    const data = attachmentDoc.data() || {};
    const filePath = data.file_path;
    const fileName = data.file_name;

    if (!filePath) {
      return new Response('File path missing', { status: 404 });
    }

    const fullDiskPath = path.join(process.cwd(), 'public', filePath);
    if (!fs.existsSync(fullDiskPath)) {
      return new Response('Physical file not found on disk', { status: 404 });
    }

    const fileBuffer = fs.readFileSync(fullDiskPath);

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (error: any) {
    console.error('[API Attachment Download GET] Failed:', error);
    return new Response(error.message || 'Internal Server Error', { status: 500 });
  }
}
