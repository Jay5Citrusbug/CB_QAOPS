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

    const usersSnapshot = await adminDb.collection('users').orderBy('name', 'asc').get();
    
    const seenEmails = new Set<string>();
    const users: any[] = [];
    
    for (const doc of usersSnapshot.docs) {
      const email = (doc.data().email || '').toLowerCase().trim();
      if (!email) continue;
      if (!seenEmails.has(email)) {
        seenEmails.add(email);
        users.push({
          id: doc.id,
          name: doc.data().name || '',
          email: doc.data().email || '',
          role: doc.data().role || 'USER',
        });
      }
    }

    return NextResponse.json(users);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
