'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { adminDb, adminAuth } from './firebase-admin';
import * as admin from 'firebase-admin';
import { revalidatePath } from 'next/cache';

// ─── DAILY STATUS ─────────────────────────────────────────────────────────────

export async function addDailyStatus(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: 'Unauthorized' };

  const userId = (session.user as any).id;
  const projectIds = formData.getAll('projectId') as string[];
  const hours = formData.getAll('hours') as string[];
  const date = formData.get('date') as string;
  const workDone = formData.get('workDone') as string;
  const plannedWork = formData.get('plannedWork') as string;
  const blockers = (formData.get('blockers') as string) || null;

  if (!projectIds.length || !date || !workDone || !plannedWork) {
    return { error: 'Missing required fields' };
  }

  try {
    const batch = adminDb.batch();
    for (let i = 0; i < projectIds.length; i++) {
      const docRef = adminDb.collection('daily_statuses').doc();
      batch.set(docRef, {
        user_id: userId,
        project_id: projectIds[i],
        date: admin.firestore.Timestamp.fromDate(new Date(date)),
        work_done: workDone,
        planned_work: plannedWork,
        hours: parseFloat(hours[i] || '0'),
        blockers,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    revalidatePath('/daily-status');
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to add status' };
  }
}

export async function updateGroupedDailyStatus(dateStr: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: 'Unauthorized' };

  const userId = (session.user as any).id;
  const projectIds = formData.getAll('projectId') as string[];
  const hours = formData.getAll('hours') as string[];
  const date = formData.get('date') as string;
  const workDone = formData.get('workDone') as string;
  const plannedWork = formData.get('plannedWork') as string;
  const blockers = (formData.get('blockers') as string) || null;

  try {
    const start = new Date(dateStr);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateStr);
    end.setHours(23, 59, 59, 999);

    const snapshot = await adminDb.collection('daily_statuses')
      .where('user_id', '==', userId)
      .get();

    const filteredDocs = snapshot.docs.filter((doc) => {
      const dateVal = doc.data().date;
      if (!dateVal) return false;
      const d = (dateVal as admin.firestore.Timestamp).toDate();
      return d >= start && d <= end;
    });

    const batch = adminDb.batch();
    filteredDocs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    for (let i = 0; i < projectIds.length; i++) {
      const newRef = adminDb.collection('daily_statuses').doc();
      batch.set(newRef, {
        user_id: userId,
        project_id: projectIds[i],
        date: admin.firestore.Timestamp.fromDate(new Date(date)),
        work_done: workDone,
        planned_work: plannedWork,
        hours: parseFloat(hours[i] || '0'),
        blockers,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    revalidatePath('/daily-status');
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to update status' };
  }
}

export async function deleteGroupedDailyStatus(dateStr: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: 'Unauthorized' };

  const userId = (session.user as any).id;

  try {
    const start = new Date(dateStr);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateStr);
    end.setHours(23, 59, 59, 999);

    const snapshot = await adminDb.collection('daily_statuses')
      .where('user_id', '==', userId)
      .get();

    const filteredDocs = snapshot.docs.filter((doc) => {
      const dateVal = doc.data().date;
      if (!dateVal) return false;
      const d = (dateVal as admin.firestore.Timestamp).toDate();
      return d >= start && d <= end;
    });

    const batch = adminDb.batch();
    filteredDocs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    revalidatePath('/daily-status');
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to delete status' };
  }
}

// ─── TASKS ────────────────────────────────────────────────────────────────────

export async function createTask(formData: FormData, targetUserId?: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: 'Unauthorized' };

  const userId = targetUserId || (session.user as any).id;
  const title = (formData.get('title') as string)?.trim();
  if (!title) return { error: 'Title is required' };

  try {
    await adminDb.collection('tasks').add({
      user_id: userId,
      title,
      status: 'PENDING',
      is_important: false,
      my_day: false,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    revalidatePath('/tasks');
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to create task' };
  }
}

export async function updateTask(taskId: string, data: Record<string, any>) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: 'Unauthorized' };

  const mappedData: Record<string, any> = {};
  if ('title' in data) mappedData.title = data.title;
  if ('status' in data) mappedData.status = data.status;
  if ('isImportant' in data) mappedData.is_important = data.isImportant;
  if ('myDay' in data) mappedData.my_day = data.myDay;
  if ('notes' in data) mappedData.notes = data.notes;
  if ('dueDate' in data) {
    mappedData.due_date = data.dueDate ? admin.firestore.Timestamp.fromDate(new Date(data.dueDate)) : null;
  }
  if ('remindAt' in data) {
    mappedData.remind_at = data.remindAt ? admin.firestore.Timestamp.fromDate(new Date(data.remindAt)) : null;
  }
  if ('repeat' in data) mappedData.repeat = data.repeat;

  try {
    await adminDb.collection('tasks').doc(taskId).update(mappedData);
    revalidatePath('/tasks');
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to update task' };
  }
}

export async function deleteTask(taskId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: 'Unauthorized' };

  try {
    // Delete task steps as well (Cascade)
    const stepsSnapshot = await adminDb.collection('task_steps').where('task_id', '==', taskId).get();
    const batch = adminDb.batch();
    stepsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(adminDb.collection('tasks').doc(taskId));
    await batch.commit();

    revalidatePath('/tasks');
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to delete task' };
  }
}

export async function toggleTaskStatus(taskId: string, currentStatus: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: 'Unauthorized' };

  try {
    await adminDb.collection('tasks').doc(taskId).update({
      status: currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED',
    });
    revalidatePath('/tasks');
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to toggle task status' };
  }
}

export async function addTaskStep(taskId: string, title: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: 'Unauthorized' };

  try {
    await adminDb.collection('task_steps').add({ 
      task_id: taskId, 
      title: title.trim(), 
      is_completed: false,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    revalidatePath('/tasks');
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to add step' };
  }
}

export async function toggleTaskStep(stepId: string, isCompleted: boolean) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: 'Unauthorized' };

  try {
    await adminDb.collection('task_steps').doc(stepId).update({ is_completed: !isCompleted });
    revalidatePath('/tasks');
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to toggle step' };
  }
}

export async function deleteTaskStep(stepId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: 'Unauthorized' };

  try {
    await adminDb.collection('task_steps').doc(stepId).delete();
    revalidatePath('/tasks');
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to delete step' };
  }
}

// ─── USERS (ADMIN) ────────────────────────────────────────────────────────────

export async function createUser(formData: FormData) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'ADMIN') return { error: 'Unauthorized' };

  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const role = (formData.get('role') as string) || 'USER';
  const projectId = (formData.get('projectId') as string) || null;

  if (!name || !email || !password) return { error: 'Missing required fields' };

  try {
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
    });

    await adminDb.collection('users').doc(userRecord.uid).set({
      name,
      email,
      role,
      project_id: projectId,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    return { error: error.message || 'Failed to create user' };
  }
}

export async function updateUser(userId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'ADMIN') return { error: 'Unauthorized' };

  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const role = (formData.get('role') as string) || 'USER';
  const projectId = (formData.get('projectId') as string) || null;

  try {
    const authUpdates: any = { displayName: name, email };
    if (password) authUpdates.password = password;
    await adminAuth.updateUser(userId, authUpdates);

    await adminDb.collection('users').doc(userId).update({
      name,
      email,
      role,
      project_id: projectId,
    });

    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to update user' };
  }
}

export async function deleteUser(userId: string) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'ADMIN') return { error: 'Unauthorized' };

  try {
    await adminAuth.deleteUser(userId);
    await adminDb.collection('users').doc(userId).delete();
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to delete user' };
  }
}

// ─── PROJECTS ─────────────────────────────────────────────────────────────────

export async function createProject(formData: FormData) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'ADMIN') return { error: 'Unauthorized' };

  const name = formData.get('name') as string;
  const tlName = formData.get('tlName') as string;
  const assigneeName = formData.get('assigneeName') as string;
  const devName = formData.get('devName') as string;

  if (!name || !tlName || !assigneeName || !devName) return { error: 'Missing required fields' };

  try {
    await adminDb.collection('projects').add({ 
      name, 
      tl_name: tlName, 
      assignee_name: assigneeName, 
      dev_name: devName, 
      status: 'ACTIVE',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to create project' };
  }
}

export async function updateProject(projectId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'ADMIN') return { error: 'Unauthorized' };

  const name = formData.get('name') as string;
  const tlName = formData.get('tlName') as string;
  const assigneeName = formData.get('assigneeName') as string;
  const devName = formData.get('devName') as string;
  const status = (formData.get('status') as string) || 'ACTIVE';

  try {
    await adminDb.collection('projects').doc(projectId).update({ 
      name, 
      tl_name: tlName, 
      assignee_name: assigneeName, 
      dev_name: devName, 
      status 
    });
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to update project' };
  }
}

export async function deleteProject(projectId: string) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'ADMIN') return { error: 'Unauthorized' };

  try {
    // Cascade-delete linked daily statuses
    const linkedSnapshot = await adminDb.collection('daily_statuses').where('project_id', '==', projectId).get();
    const batch = adminDb.batch();
    linkedSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(adminDb.collection('projects').doc(projectId));
    await batch.commit();

    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to delete project' };
  }
}
