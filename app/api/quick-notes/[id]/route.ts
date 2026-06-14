export const dynamic = 'force-dynamic';

import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

// PUT /api/quick-notes/[id] — update a note
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
    const userId = (session.user as any).id;

    const docRef = adminDb.collection('quick_notes').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const data = doc.data() as any;
    if (data.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const updates: any = { updated_at: admin.firestore.FieldValue.serverTimestamp() };

    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.description !== undefined) updates.description = body.description;

    await docRef.update(updates);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Quick Notes PUT]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/quick-notes/[id] — delete a note and its attachments
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

    const docRef = adminDb.collection('quick_notes').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const data = doc.data() as any;
    if (data.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete physical attachment files if any
    const fs = require('fs');
    const path = require('path');
    const attachments: any[] = data.attachments ?? [];
    for (const att of attachments) {
      if (att.filePath) {
        const fullPath = path.join(process.cwd(), 'public', att.filePath);
        try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch {}
      }
    }

    await docRef.delete();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Quick Notes DELETE]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
