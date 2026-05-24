import { adminDb } from '@/lib/firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    const docRef = adminDb.collection('projects').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = docSnap.data() as any;

    return NextResponse.json({
      id: docSnap.id,
      name: project.name,
      tlName: project.tl_name,
      assigneeName: project.assignee_name,
      devName: project.dev_name,
      status: project.status ?? 'ACTIVE',
      createdAt: project.created_at ? project.created_at.toDate().toISOString() : null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
