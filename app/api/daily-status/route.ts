export const dynamic = 'force-dynamic';

import { adminDb } from '@/lib/firebase-admin';
import admin from 'firebase-admin';
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

    const statusesQuery = adminDb.collection('daily_statuses')
      .where('user_id', '==', userId);

    const statusesSnapshot = await statusesQuery.get();
    const statuses = statusesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    statuses.sort((a, b) => {
      const aTime = a.created_at ? (a.created_at as admin.firestore.Timestamp).toDate().getTime() : 0;
      const bTime = b.created_at ? (b.created_at as admin.firestore.Timestamp).toDate().getTime() : 0;
      return bTime - aTime;
    });

    // Fetch related projects
    const projectIds = Array.from(new Set(statuses.map((s: any) => s.project_id)));
    let projectsMap: Record<string, any> = {};
    if (projectIds.length > 0) {
      const chunks = [];
      for (let i = 0; i < projectIds.length; i += 10) {
        chunks.push(projectIds.slice(i, i + 10));
      }
      for (const chunk of chunks) {
        const pSnap = await adminDb.collection('projects').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
        pSnap.docs.forEach(doc => {
          projectsMap[doc.id] = doc.data();
        });
      }
    }

    // Fetch user
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data() || {};

    const normalized = statuses.map((s: any) => ({
      id: s.id,
      projectId: s.project_id,
      project: { name: projectsMap[s.project_id]?.name ?? '' },
      date: s.date ? s.date.toDate().toISOString() : null,
      workDone: s.work_done,
      plannedWork: s.planned_work,
      hours: s.hours ?? 0,
      blockers: s.blockers ?? null,
      createdAt: s.created_at ? s.created_at.toDate().toISOString() : null,
      user: {
        name: userData.name ?? '',
        email: userData.email ?? '',
      },
    }));

    return NextResponse.json(normalized);
  } catch (error: any) {
    const fs = require('fs');
    const path = require('path');
    const errorLog = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    };
    try {
      const logDir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'tmp');
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
      fs.appendFileSync(path.join(logDir, 'api_error.log'), JSON.stringify(errorLog, null, 2) + '\n');
    } catch (e) {}

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
