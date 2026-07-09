export const dynamic = 'force-dynamic';

import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

// GET /api/prompts - Fetch prompts, optionally filtered by categoryId
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');

    let query: any = adminDb.collection('prompts');
    if (categoryId) {
      query = query.where('category_id', '==', categoryId);
    }

    const snap = await query.get();
    const prompts = snap.docs.map((doc: any) => {
      const d = doc.data();
      return {
        id: doc.id,
        categoryId: d.category_id,
        title: d.title,
        prompt: d.prompt,
        createdBy: d.created_by ?? '',
        createdAt: d.created_at ? (d.created_at.toDate ? d.created_at.toDate().toISOString() : new Date(d.created_at).toISOString()) : null,
        order: d.order ?? 0,
      };
    });

    // Sort by order ascending, fallback to title
    prompts.sort((a: any, b: any) => {
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.title.localeCompare(b.title);
    });

    return NextResponse.json(prompts);
  } catch (error: any) {
    console.error('[Prompts GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/prompts - Create a new prompt in a category
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const { categoryId, title, prompt } = body;

    if (!categoryId) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }
    if (!title?.trim()) {
      return NextResponse.json({ error: 'Prompt title is required' }, { status: 400 });
    }
    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt content is required' }, { status: 400 });
    }

    // Verify category exists
    const categoryDoc = await adminDb.collection('prompt_categories').doc(categoryId).get();
    if (!categoryDoc.exists) {
      return NextResponse.json({ error: 'Invalid category ID' }, { status: 400 });
    }

    const promptsSnap = await adminDb.collection('prompts').where('category_id', '==', categoryId).get();
    const order = promptsSnap.size;

    const now = admin.firestore.FieldValue.serverTimestamp();
    const docRef = await adminDb.collection('prompts').add({
      category_id: categoryId,
      title: title.trim(),
      prompt: prompt.trim(),
      created_by: userId,
      created_at: now,
      order,
    });

    return NextResponse.json({ id: docRef.id, success: true });
  } catch (error: any) {
    console.error('[Prompts POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
