import { adminDb } from '@/lib/firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectsSnapshot = await adminDb.collection('projects').orderBy('name', 'asc').get();
    const projects = projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    const normalized = projects.map((p: any) => ({
      id: p.id,
      name: p.name,
      tlName: p.tl_name,
      assigneeName: p.assignee_name,
      devName: p.dev_name,
      status: p.status ?? 'ACTIVE',
      createdAt: p.created_at ? p.created_at.toDate().toISOString() : null,
    }));

    return NextResponse.json(normalized);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
