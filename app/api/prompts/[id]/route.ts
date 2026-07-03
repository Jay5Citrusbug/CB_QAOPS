export const dynamic = 'force-dynamic';

import { adminDb } from '@/lib/firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

// PUT /api/prompts/[id] - Update a prompt
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
    const { title, prompt } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Prompt title is required' }, { status: 400 });
    }
    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt content is required' }, { status: 400 });
    }

    await adminDb.collection('prompts').doc(id).update({
      title: title.trim(),
      prompt: prompt.trim(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Prompt PUT]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/prompts/[id] - Delete a prompt
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

    await adminDb.collection('prompts').doc(id).delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Prompt DELETE]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
