import { adminDb } from '@/lib/firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');
    const currentUserId = (session.user as any).id;
    const isAdmin = (session.user as any).role === 'ADMIN';

    let tasksQuery: FirebaseFirestore.Query = adminDb.collection('tasks');

    if (!(isAdmin && !targetUserId)) {
      const uid = isAdmin && targetUserId ? targetUserId : currentUserId;
      tasksQuery = tasksQuery.where('user_id', '==', uid);
    }
    
    const tasksSnapshot = await tasksQuery.get();
    const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    tasks.sort((a, b) => {
      const aTime = a.created_at?.toDate ? a.created_at.toDate().getTime() : 0;
      const bTime = b.created_at?.toDate ? b.created_at.toDate().getTime() : 0;
      return bTime - aTime;
    });

    const taskIds = tasks.map((t: any) => t.id);
    let steps: any[] = [];
    
    if (taskIds.length > 0) {
      // Firestore 'in' queries are limited to 10 items.
      const chunks = [];
      for (let i = 0; i < taskIds.length; i += 10) {
        chunks.push(taskIds.slice(i, i + 10));
      }
      
      const stepPromises = chunks.map(chunk => 
        adminDb.collection('task_steps').where('task_id', 'in', chunk).get()
      );
      
      const stepSnapshots = await Promise.all(stepPromises);
      stepSnapshots.forEach(snap => {
        snap.docs.forEach(doc => steps.push({ id: doc.id, ...doc.data() as any }));
      });

      steps.sort((a, b) => {
        const aTime = a.created_at?.toDate ? a.created_at.toDate().getTime() : 0;
        const bTime = b.created_at?.toDate ? b.created_at.toDate().getTime() : 0;
        return aTime - bTime;
      });
    }

    const normalized = tasks.map((t: any) => ({
      id: t.id,
      title: t.title,
      status: t.status ?? 'PENDING',
      isImportant: t.is_important ?? false,
      myDay: t.my_day ?? false,
      notes: t.notes ?? null,
      dueDate: t.due_date ? t.due_date.toDate().toISOString() : null,
      remindAt: t.remind_at ? t.remind_at.toDate().toISOString() : null,
      repeat: t.repeat ?? null,
      userId: t.user_id,
      createdAt: t.created_at ? t.created_at.toDate().toISOString() : null,
      steps: steps
        .filter((s) => s.task_id === t.id)
        .map((s) => ({ id: s.id, title: s.title, isCompleted: s.is_completed ?? false })),
    }));

    return NextResponse.json(normalized);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
