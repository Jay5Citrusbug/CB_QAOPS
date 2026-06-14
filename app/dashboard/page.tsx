import { adminDb } from '@/lib/firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import DashboardClient from './DashboardClient';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login');
  }

  const userId = (session.user as any).id as string;
  const userRole = (session.user as any).role || 'USER';
  const isQaLead = userRole === 'ADMIN' || userRole === 'TL';

  try {
    const [projectsSnapshot, taskListsSnapshot, tasksSnapshot] = await Promise.all([
      adminDb.collection('projects').get(),
      adminDb.collection('task_lists').get(),
      adminDb.collection('tasks').get()
    ]);

    let users: any[] = [];
    let statusesSnapshot;

    if (isQaLead) {
      const [statusesSnap, usersSnap] = await Promise.all([
        adminDb.collection('daily_statuses').get(),
        adminDb.collection('users').get()
      ]);
      statusesSnapshot = statusesSnap;
      users = usersSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          email: data.email || '',
          role: data.role || 'USER'
        };
      });
    } else {
      statusesSnapshot = await adminDb.collection('daily_statuses').where('user_id', '==', userId).get();
    }

    const projects = projectsSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || '',
      status: doc.data().status || ''
    }));

    const taskLists = taskListsSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || '',
      description: doc.data().description || ''
    }));

    const allTasks = tasksSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        taskListId: data.task_list_id || data.taskListId || null,
        taskNumber: data.task_number || data.taskNumber || 1000,
        title: data.title || '',
        description: data.description || '',
        notes: data.notes || '',
        status: data.status || 'To Do',
        priority: data.priority || 'Medium',
        dueDate: data.due_date ? (data.due_date.toDate ? data.due_date.toDate().toISOString() : String(data.due_date)) : null,
        assignedTo: data.assigned_to || null,
        createdBy: data.created_by || null,
        user_id: data.user_id || null,
        createdAt: data.created_at ? (data.created_at.toDate ? data.created_at.toDate().toISOString() : String(data.created_at)) : null,
        completedAt: data.completed_at ? (data.completed_at.toDate ? data.completed_at.toDate().toISOString() : String(data.completed_at)) : null,
        completedBy: data.completed_by || null,
        steps: data.steps || [],
      };
    });

    const dailyStatuses = statusesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        projectId: data.project_id || data.projectId || '',
        date: data.date ? (data.date.toDate ? data.date.toDate().toISOString() : String(data.date)) : null,
        workDone: data.work_done || data.workDone || '',
        plannedWork: data.planned_work || data.plannedWork || '',
        hours: data.hours ?? 0,
        blockers: data.blockers ?? null,
        createdAt: data.created_at ? (data.created_at.toDate ? data.created_at.toDate().toISOString() : String(data.created_at)) : null,
        userId: data.user_id || data.userId || null,
      };
    });

    return (
      <DashboardClient
        session={session}
        projects={projects}
        taskLists={taskLists}
        allTasks={allTasks}
        dailyStatuses={dailyStatuses}
        users={users}
      />
    );
  } catch (error) {
    console.error('[Dashboard Server] Error fetching dashboard data:', error);
    return (
      <div className="p-8 text-center text-red-500 font-bold min-h-[50vh] flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 shadow-sm m-4">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-4 text-2xl font-black">!</div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Failed to Load Dashboard</h2>
        <p className="text-sm text-slate-500 max-w-md">There was a connection issue with Firestore. Please check your internet connection or try reloading the page.</p>
      </div>
    );
  }
}
