export const dynamic = 'force-dynamic';

import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

// GET /api/prompt-categories - Fetch all categories
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const snap = await adminDb.collection('prompt_categories').get();
    const categories = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name,
        description: d.description ?? '',
        createdBy: d.created_by ?? '',
        createdAt: d.created_at ? (d.created_at.toDate ? d.created_at.toDate().toISOString() : new Date(d.created_at).toISOString()) : null,
        order: d.order ?? 0,
      };
    });

    // Sort by order ascending, fallback to name
    categories.sort((a, b) => {
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json(categories);
  } catch (error: any) {
    console.error('[Prompt Categories GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/prompt-categories - Create a new category
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const { name, description } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const categoriesSnap = await adminDb.collection('prompt_categories').get();
    const order = categoriesSnap.size;

    const now = admin.firestore.FieldValue.serverTimestamp();
    const docRef = await adminDb.collection('prompt_categories').add({
      name: name.trim(),
      description: description ?? '',
      created_by: userId,
      created_at: now,
      order,
    });

    return NextResponse.json({ id: docRef.id, success: true });
  } catch (error: any) {
    console.error('[Prompt Categories POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
