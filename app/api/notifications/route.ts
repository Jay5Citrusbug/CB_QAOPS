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
    const userId = (session.user as any).id;

    const snapshot = await adminDb.collection('notifications')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const notifications = snapshot.docs.map(doc => {
      const data = doc.data();
      let cDate = null;
      if (data.createdAt && typeof data.createdAt.toDate === 'function') {
        cDate = data.createdAt.toDate().toISOString();
      } else if (data.createdAt) {
        cDate = String(data.createdAt);
      }
      return {
        id: doc.id,
        userId: data.userId,
        message: data.message,
        read: !!data.read,
        createdAt: cDate,
      };
    });

    return NextResponse.json(notifications);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any).id;

    const snapshot = await adminDb.collection('notifications')
      .where('userId', '==', userId)
      .where('read', '==', false)
      .get();

    const batch = adminDb.batch();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { read: true });
    });
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
