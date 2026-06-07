export const dynamic = 'force-dynamic';

import { adminDb } from '@/lib/firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if ((session?.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const usersSnapshot = await adminDb.collection('users').orderBy('created_at', 'desc').get();
    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    // Normalise field names to match what the frontend expects
    const normalized = users.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role ?? 'USER',
      projectId: u.project_id ?? null,
      createdAt: u.created_at ? u.created_at.toDate().toISOString() : null,
    }));

    return NextResponse.json(normalized);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
