export const dynamic = 'force-dynamic';

import { adminDb } from '@/lib/firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ids } = body;
    
    if (!Array.isArray(ids)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const batch = adminDb.batch();
    ids.forEach((id, index) => {
      const ref = adminDb.collection('prompts').doc(id);
      batch.update(ref, { order: index });
    });

    await batch.commit();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Prompts Reorder POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
