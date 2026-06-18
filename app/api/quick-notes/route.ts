export const dynamic = 'force-dynamic';

import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

// GET /api/quick-notes — fetch all notes for current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    const snap = await adminDb
      .collection('quick_notes')
      .where('user_id', '==', userId)
      .get();

    const notes = snap.docs.map((doc) => {
      const d = doc.data() as any;
      return {
        id: doc.id,
        title: d.title,
        description: d.description ?? '',
        attachments: d.attachments ?? [],
        isFavorited: d.is_favorited ?? false,
        createdAt: d.created_at ? d.created_at.toDate().toISOString() : null,
        updatedAt: d.updated_at ? d.updated_at.toDate().toISOString() : null,
      };
    });

    notes.sort((a, b) => {
      const at = a.updatedAt ?? a.createdAt ?? '';
      const bt = b.updatedAt ?? b.createdAt ?? '';
      return bt.localeCompare(at);
    });

    return NextResponse.json(notes);
  } catch (error: any) {
    console.error('[Quick Notes GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/quick-notes — create a new note
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const { title, description } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const docRef = await adminDb.collection('quick_notes').add({
      user_id: userId,
      title: title.trim(),
      description: description ?? '',
      attachments: [],
      is_favorited: false,
      created_at: now,
      updated_at: now,
    });

    return NextResponse.json({ id: docRef.id, success: true });
  } catch (error: any) {
    console.error('[Quick Notes POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
