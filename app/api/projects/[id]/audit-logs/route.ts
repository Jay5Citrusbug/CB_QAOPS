import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const snapshot = await adminDb.collection('audit_logs')
      .where('project_id', '==', projectId)
      .get();

    const logs = snapshot.docs.map(doc => {
      const data = doc.data();
      let ts = null;
      if (data.timestamp && typeof data.timestamp.toDate === 'function') {
        ts = data.timestamp.toDate().toISOString();
      } else if (data.timestamp) {
        ts = String(data.timestamp);
      }
      return {
        id: doc.id,
        user: data.user || 'System',
        action: data.action || '',
        timestamp: ts,
        details: data.details || {},
      };
    });

    // Sort by timestamp descending
    logs.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

    return NextResponse.json(logs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
