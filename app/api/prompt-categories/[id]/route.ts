export const dynamic = 'force-dynamic';

import { adminDb } from '@/lib/firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

// PUT /api/prompt-categories/[id] - Update a category
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
    const { name, description } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    await adminDb.collection('prompt_categories').doc(id).update({
      name: name.trim(),
      description: description ?? '',
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Prompt Category PUT]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/prompt-categories/[id] - Delete a category and all its prompts
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

    // Start a transaction or batch to delete category and associated prompts
    const batch = adminDb.batch();

    // 1. Delete category
    const catRef = adminDb.collection('prompt_categories').doc(id);
    batch.delete(catRef);

    // 2. Query and delete all prompts belonging to this category
    const promptsSnap = await adminDb
      .collection('prompts')
      .where('category_id', '==', id)
      .get();

    promptsSnap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Prompt Category DELETE]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
