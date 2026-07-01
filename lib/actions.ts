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

  // Validate hours range
  for (let i = 0; i < projectIds.length; i++) {
    const hrVal = parseFloat(hours[i] || '0');
    if (isNaN(hrVal) || hrVal < 0.5 || hrVal > 24) {
      return { error: 'Hours spent must be a number between 0.5 and 24' };
    }
  }

  try {
    // Check for duplicate status on same project and date for this user
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const snapshot = await adminDb.collection('daily_statuses')
      .where('user_id', '==', userId)
      .get();

    for (const projectId of projectIds) {
      const isDuplicate = snapshot.docs.some(doc => {
        const d = doc.data();
        if (d.project_id !== projectId) return false;
        const dDate = d.date?.toDate ? d.date.toDate() : new Date(String(d.date));
        return dDate >= startOfDay && dDate <= endOfDay;
      });

      if (isDuplicate) {
        return { error: 'You have already submitted a status report for this project on this date. Please edit the existing report instead.' };
      }
    }

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

    // Fetch user profile for logging/discord
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data() || {};
    const userName = userData.name || session.user.name || "Unknown User";

    // Write Audit Log for Status Submitted
    await adminDb.collection('audit_logs').add({
      user: userName,
      action: 'Status Submitted',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        date,
        projectIds,
        hours: hours.map(h => parseFloat(h || '0')),
      }
    });

    // Send Discord Notification
    const warning = await sendDiscordNotification(
      userId,
      projectIds,
      hours,
      date,
      workDone,
      plannedWork,
      blockers,
      false
    );

    revalidatePath('/daily-status');
    if (warning) {
      return { success: true, warning };
    }
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

  // Validate hours range
  for (let i = 0; i < projectIds.length; i++) {
    const hrVal = parseFloat(hours[i] || '0');
    if (isNaN(hrVal) || hrVal < 0.5 || hrVal > 24) {
      return { error: 'Hours spent must be a number between 0.5 and 24' };
    }
  }

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
      const d = (dateVal && typeof (dateVal as any).toDate === 'function')
        ? (dateVal as admin.firestore.Timestamp).toDate()
        : new Date(String(dateVal));
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

    // Fetch user profile for logging/discord
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data() || {};
    const userName = userData.name || session.user.name || "Unknown User";

    // Write Audit Log for Status Updated
    await adminDb.collection('audit_logs').add({
      user: userName,
      action: 'Status Updated',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        date,
        projectIds,
        hours: hours.map(h => parseFloat(h || '0')),
      }
    });

    // Send Discord Notification
    const warning = await sendDiscordNotification(
      userId,
      projectIds,
      hours,
      date,
      workDone,
      plannedWork,
      blockers,
      true
    );

    revalidatePath('/daily-status');
    if (warning) {
      return { success: true, warning };
    }
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
      const d = (dateVal && typeof (dateVal as any).toDate === 'function')
        ? (dateVal as admin.firestore.Timestamp).toDate()
        : new Date(String(dateVal));
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
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  const role = (formData.get('role') as string) || 'USER';
  const projectId = (formData.get('projectId') as string) || null;

  if (!name || !email || !password) return { error: 'Missing required fields' };

  try {
    let uid: string;
    try {
      const userRecord = await adminAuth.createUser({
        email,
        password,
        displayName: name,
      });
      uid = userRecord.uid;
    } catch (authError: any) {
      const errMsg = (authError?.message || '').toLowerCase();
      const errCode = authError?.code;
      if (errCode === 'auth/email-already-exists' || errMsg.includes('already in use') || errMsg.includes('already exists')) {
        // User already exists in Firebase Auth — retrieve UID and sync details
        const existingUser = await adminAuth.getUserByEmail(email);
        uid = existingUser.uid;
        await adminAuth.updateUser(uid, {
          password,
          displayName: name,
        });
      } else if (errMsg.includes('invalid_grant') || errMsg.includes('credential') || errMsg.includes('account not found') || errMsg.includes('oauth2')) {
        console.warn("⚠️ Firebase Auth createUser failed due to credential issue. Generating simulated uid.", authError);
        uid = 'simulated_' + Math.random().toString(36).substring(2, 15);
      } else {
        throw authError;
      }
    }

    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    await adminDb.collection('users').doc(uid).set({
      name,
      email,
      role,
      project_id: projectId,
      password: hashedPassword,
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
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  const role = (formData.get('role') as string) || 'USER';
  const projectId = (formData.get('projectId') as string) || null;

  try {
    const authUpdates: any = { displayName: name, email };
    if (password) authUpdates.password = password;
    
    try {
      await adminAuth.updateUser(userId, authUpdates);
    } catch (authError: any) {
      const errMsg = (authError?.message || '').toLowerCase();
      if (errMsg.includes('invalid_grant') || errMsg.includes('credential') || errMsg.includes('account not found') || errMsg.includes('oauth2')) {
        console.warn("⚠️ Firebase Auth updateUser failed due to credential issue. Updating only Firestore database.", authError);
      } else {
        throw authError;
      }
    }

    const userUpdates: any = {
      name,
      email,
      role,
      project_id: projectId,
    };

    if (password) {
      const bcrypt = await import('bcryptjs');
      userUpdates.password = await bcrypt.hash(password, 10);
    }

    await adminDb.collection('users').doc(userId).update(userUpdates);

    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to update user' };
  }
}

export async function deleteUser(userId: string) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'ADMIN') return { error: 'Unauthorized' };

  try {
    try {
      await adminAuth.deleteUser(userId);
    } catch (authError: any) {
      const errMsg = (authError?.message || '').toLowerCase();
      if (
        errMsg.includes('invalid_grant') ||
        errMsg.includes('credential') ||
        errMsg.includes('account not found') ||
        errMsg.includes('oauth2') ||
        authError?.code === 'auth/user-not-found'
      ) {
        console.warn("⚠️ Firebase Auth deleteUser failed due to credential issue or user not found. Deleting only Firestore database.", authError);
      } else {
        throw authError;
      }
    }
    await adminDb.collection('users').doc(userId).delete();
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to delete user' };
  }
}

// ─── PROJECTS ─────────────────────────────────────────────────────────────────

async function getUserInfoByEmail(email: string) {
  if (!email) return null;
  const normalizedEmail = email.trim().toLowerCase();
  try {
    const snapshot = await adminDb.collection('users').where('email', '==', normalizedEmail).limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name || normalizedEmail,
      email: data.email || normalizedEmail,
    };
  } catch (err) {
    console.error('Error fetching user by email:', err);
    return null;
  }
}

async function getUsersInfoByEmails(emails: string[]) {
  if (!emails || emails.length === 0) return [];
  const list = [];
  for (const email of emails) {
    const info = await getUserInfoByEmail(email);
    if (info) {
      list.push(info);
    }
  }
  return list;
}

async function logProjectAudit(userName: string, projectId: string, action: string, details: Record<string, any>) {
  try {
    await adminDb.collection('audit_logs').add({
      user: userName,
      action,
      project_id: projectId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details,
    });
  } catch (err) {
    console.error('Failed to write project audit log:', err);
  }
}

export async function markNotificationsAsRead() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: 'Unauthorized' };
  const userId = (session.user as any).id;
  try {
    const snapshot = await adminDb.collection('notifications')
      .where('userId', '==', userId)
      .where('read', '==', false)
      .get();
    const batch = adminDb.batch();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { read: true });
    });
    await batch.commit();
    revalidatePath('/my-projects');
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to mark notifications as read' };
  }
}

async function createNotification(userId: string, message: string) {
  try {
    await adminDb.collection('notifications').add({
      userId,
      message,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}

async function notifyProjectTeam(projectId: string, message: string, excludeUserEmail?: string) {
  try {
    const projDoc = await adminDb.collection('projects').doc(projectId).get();
    if (!projDoc.exists) return;
    const project = projDoc.data() || {};
    
    const emails = new Set<string>();
    const addEmail = (val: any) => {
      if (!val) return;
      if (Array.isArray(val)) {
        val.forEach((e: string) => {
          if (e && typeof e === 'string') emails.add(e.trim().toLowerCase());
        });
      } else if (typeof val === 'string') {
        emails.add(val.trim().toLowerCase());
      }
    };

    addEmail(project.primaryQaEmail);
    addEmail(project.supportingQaEmail);
    addEmail(project.teamLeadEmail);
    addEmail(project.developerEmails);
    
    if (excludeUserEmail) {
      emails.delete(excludeUserEmail.trim().toLowerCase());
    }
    
    if (emails.size === 0) return;
    
    const usersSnap = await adminDb.collection('users')
      .where('email', 'in', Array.from(emails))
      .get();
      
    if (usersSnap.empty) return;

    const batch = adminDb.batch();
    usersSnap.docs.forEach((doc) => {
      const newNotifRef = adminDb.collection('notifications').doc();
      batch.set(newNotifRef, {
        userId: doc.id,
        message,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (err) {
    console.error('Failed to notify project team:', err);
  }
}

export async function createProject(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'ADMIN') return { error: 'Unauthorized' };

  const name = formData.get('name') as string;
  let code = formData.get('code') as string || '';
  const status = (formData.get('status') as string) || 'ACTIVE';
  const description = formData.get('description') as string || '';
  const scope = formData.get('scope') as string || '';
  const requirements = formData.get('requirements') as string || '';
  const startDate = formData.get('startDate') as string || '';
  const targetReleaseDate = formData.get('targetReleaseDate') as string || '';
  
  let primaryQaEmails: string[] = [];
  const primaryQaEmailsRaw = formData.getAll('primaryQaEmail');
  if (primaryQaEmailsRaw.length === 1 && typeof primaryQaEmailsRaw[0] === 'string' && primaryQaEmailsRaw[0].includes(',')) {
    primaryQaEmails = primaryQaEmailsRaw[0].split(',').map((e: string) => e.trim()).filter(Boolean);
  } else {
    primaryQaEmails = primaryQaEmailsRaw.map((e: any) => String(e).trim()).filter(Boolean);
  }

  let supportingQaEmails: string[] = [];
  const supportingQaEmailsRaw = formData.getAll('supportingQaEmail');
  if (supportingQaEmailsRaw.length === 1 && typeof supportingQaEmailsRaw[0] === 'string' && supportingQaEmailsRaw[0].includes(',')) {
    supportingQaEmails = supportingQaEmailsRaw[0].split(',').map((e: string) => e.trim()).filter(Boolean);
  } else {
    supportingQaEmails = supportingQaEmailsRaw.map((e: any) => String(e).trim()).filter(Boolean);
  }

  let teamLeadEmails: string[] = [];
  const teamLeadEmailsRaw = formData.getAll('teamLeadEmail');
  if (teamLeadEmailsRaw.length === 1 && typeof teamLeadEmailsRaw[0] === 'string' && teamLeadEmailsRaw[0].includes(',')) {
    teamLeadEmails = teamLeadEmailsRaw[0].split(',').map((e: string) => e.trim()).filter(Boolean);
  } else {
    teamLeadEmails = teamLeadEmailsRaw.map((e: any) => String(e).trim()).filter(Boolean);
  }
  
  let devEmails: string[] = [];
  const devEmailsRaw = formData.getAll('developerEmails');
  if (devEmailsRaw.length === 1 && typeof devEmailsRaw[0] === 'string' && devEmailsRaw[0].includes(',')) {
    devEmails = devEmailsRaw[0].split(',').map((e: string) => e.trim()).filter(Boolean);
  } else {
    devEmails = devEmailsRaw.map((e: any) => String(e).trim()).filter(Boolean);
  }

  if (!name || !primaryQaEmails.length || !status) {
    return { error: 'Project Name, Primary QA, and Status are required.' };
  }

  try {
    const adminUserDoc = await adminDb.collection('users').doc((session.user as any).id).get();
    const adminUserName = adminUserDoc.data()?.name || session.user.name || 'Admin';

    if (!code) {
      let unique = false;
      while (!unique) {
        const candidate = 'PROJ-' + Math.floor(1000 + Math.random() * 9000);
        const snap = await adminDb.collection('projects').where('code', '==', candidate).get();
        if (snap.empty) {
          code = candidate;
          unique = true;
        }
      }
    } else {
      // Check code uniqueness if code was supplied
      const codeSnap = await adminDb.collection('projects').where('code', '==', code).get();
      if (!codeSnap.empty) {
        return { error: 'Project Code must be unique.' };
      }
    }

    // Resolve QA, Team Lead & Developer details
    const primaryQas = await getUsersInfoByEmails(primaryQaEmails);
    const supportingQas = await getUsersInfoByEmails(supportingQaEmails);
    const teamLeads = await getUsersInfoByEmails(teamLeadEmails);
    const devs = await getUsersInfoByEmails(devEmails);

    const newProjectData: any = {
      code,
      name,
      status,
      description,
      scope,
      requirements,
      startDate: startDate || null,
      targetReleaseDate: targetReleaseDate || null,
      primaryQaEmail: primaryQas.map(q => q.email),
      primaryQaName: primaryQas.map(q => q.name),
      supportingQaEmail: supportingQas.map(q => q.email),
      supportingQaName: supportingQas.map(q => q.name),
      teamLeadEmail: teamLeads.map(q => q.email),
      teamLeadName: teamLeads.map(q => q.name),
      developerEmails: devs.map(d => d.email),
      developerNames: devs.map(d => d.name),
      documents: [],
      timeline: {
        smokeTesting: { status: 'Not Started', owner: '', plannedDate: null, completedDate: null, notes: '' },
        testCaseWriting: { status: 'Not Started', owner: '', plannedDate: null, completedDate: null, notes: '' },
        designValidation: { status: 'Not Started', owner: '', plannedDate: null, completedDate: null, notes: '' },
        integrationTesting: { status: 'Not Started', owner: '', plannedDate: null, completedDate: null, notes: '' },
        regressionTesting: { status: 'Not Started', owner: '', plannedDate: null, completedDate: null, notes: '' },
        uatSupport: { status: 'Not Started', owner: '', plannedDate: null, completedDate: null, notes: '' },
        releaseVerification: { status: 'Not Started', owner: '', plannedDate: null, completedDate: null, notes: '' },
        postReleaseValidation: { status: 'Not Started', owner: '', plannedDate: null, completedDate: null, notes: '' },
      },
      notesAndFlags: [],
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      // Backward compatibility fields:
      tl_name: teamLeads.map(q => q.name).join(', ') || '',
      assignee_name: primaryQas.map(q => q.name).join(', ') || '',
      dev_name: devs.map(d => d.name).join(', ') || '',
    };

    const docRef = await adminDb.collection('projects').add(newProjectData);
    const projectId = docRef.id;

    // Create Audit Logs
    await logProjectAudit(adminUserName, projectId, 'Project Created', { name, code });
    for (const primaryQa of primaryQas) {
      await logProjectAudit(adminUserName, projectId, 'Primary QA Changed', {
        newPrimaryQa: primaryQa.email,
      });
      await createNotification(primaryQa.id, `You have been assigned as Primary QA for ${name}`);
    }
    for (const supportingQa of supportingQas) {
      await logProjectAudit(adminUserName, projectId, 'Supporting QA Changed', {
        newSupportingQa: supportingQa.email,
      });
      await createNotification(supportingQa.id, `You have been assigned as Supporting QA for ${name}`);
    }
    for (const dev of devs) {
      await logProjectAudit(adminUserName, projectId, 'Developer Added', {
        developer: dev.email,
      });
      await createNotification(dev.id, `You have been assigned to project ${name}`);
    }

    revalidatePath('/my-projects');
    revalidatePath('/admin/projects');

    return { success: true, projectId };
  } catch (error: any) {
    return { error: error?.message || 'Failed to create project' };
  }
}

export async function updateProject(projectId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'ADMIN') return { error: 'Unauthorized' };

  const name = formData.get('name') as string;
  const status = (formData.get('status') as string) || 'ACTIVE';
  const description = formData.get('description') as string || '';
  const requirements = formData.get('requirements') as string || '';
  const startDate = formData.get('startDate') as string || '';
  const targetReleaseDate = formData.get('targetReleaseDate') as string || '';
  
  let primaryQaEmails: string[] = [];
  const primaryQaEmailsRaw = formData.getAll('primaryQaEmail');
  if (primaryQaEmailsRaw.length === 1 && typeof primaryQaEmailsRaw[0] === 'string' && primaryQaEmailsRaw[0].includes(',')) {
    primaryQaEmails = primaryQaEmailsRaw[0].split(',').map((e: string) => e.trim()).filter(Boolean);
  } else {
    primaryQaEmails = primaryQaEmailsRaw.map((e: any) => String(e).trim()).filter(Boolean);
  }

  let supportingQaEmails: string[] = [];
  const supportingQaEmailsRaw = formData.getAll('supportingQaEmail');
  if (supportingQaEmailsRaw.length === 1 && typeof supportingQaEmailsRaw[0] === 'string' && supportingQaEmailsRaw[0].includes(',')) {
    supportingQaEmails = supportingQaEmailsRaw[0].split(',').map((e: string) => e.trim()).filter(Boolean);
  } else {
    supportingQaEmails = supportingQaEmailsRaw.map((e: any) => String(e).trim()).filter(Boolean);
  }

  let teamLeadEmails: string[] = [];
  const teamLeadEmailsRaw = formData.getAll('teamLeadEmail');
  if (teamLeadEmailsRaw.length === 1 && typeof teamLeadEmailsRaw[0] === 'string' && teamLeadEmailsRaw[0].includes(',')) {
    teamLeadEmails = teamLeadEmailsRaw[0].split(',').map((e: string) => e.trim()).filter(Boolean);
  } else {
    teamLeadEmails = teamLeadEmailsRaw.map((e: any) => String(e).trim()).filter(Boolean);
  }
  
  let devEmails: string[] = [];
  const devEmailsRaw = formData.getAll('developerEmails');
  if (devEmailsRaw.length === 1 && typeof devEmailsRaw[0] === 'string' && devEmailsRaw[0].includes(',')) {
    devEmails = devEmailsRaw[0].split(',').map((e: string) => e.trim()).filter(Boolean);
  } else {
    devEmails = devEmailsRaw.map((e: any) => String(e).trim()).filter(Boolean);
  }

  if (!name || !primaryQaEmails.length) {
    return { error: 'Project Name and Primary QA are required.' };
  }

  try {
    const adminUserDoc = await adminDb.collection('users').doc((session.user as any).id).get();
    const adminUserName = adminUserDoc.data()?.name || session.user.name || 'Admin';

    const projectRef = adminDb.collection('projects').doc(projectId);
    const oldSnap = await projectRef.get();
    if (!oldSnap.exists) return { error: 'Project not found' };
    const oldData = oldSnap.data() || {};

    const code = (formData.get('code') !== null) ? (formData.get('code') as string || '') : (oldData.code || '');
    const scope = (formData.get('scope') !== null) ? (formData.get('scope') as string || '') : (oldData.scope || '');

    // Check unique project code during update
    if (code && code !== oldData.code) {
      const codeSnap = await adminDb.collection('projects').where('code', '==', code).get();
      if (!codeSnap.empty) {
        return { error: 'Project Code must be unique.' };
      }
    }

    const hasDeveloperEmailsField = formData.has('developerEmails');
    let finalDevs = { emails: oldData.developerEmails || [], names: oldData.developerNames || [], devNameStr: oldData.dev_name || '' };
    if (hasDeveloperEmailsField) {
      const devs = await getUsersInfoByEmails(devEmails);
      finalDevs = {
        emails: devs.map(d => d.email),
        names: devs.map(d => d.name),
        devNameStr: devs.map(d => d.name).join(', '),
      };
    }

    const primaryQas = await getUsersInfoByEmails(primaryQaEmails);
    const supportingQas = await getUsersInfoByEmails(supportingQaEmails);
    const teamLeads = await getUsersInfoByEmails(teamLeadEmails);

    const updateData: any = {
      code,
      name,
      status,
      description,
      scope,
      requirements,
      startDate: startDate || null,
      targetReleaseDate: targetReleaseDate || null,
      primaryQaEmail: primaryQas.map(q => q.email),
      primaryQaName: primaryQas.map(q => q.name),
      supportingQaEmail: supportingQas.map(q => q.email),
      supportingQaName: supportingQas.map(q => q.name),
      teamLeadEmail: teamLeads.map(q => q.email),
      teamLeadName: teamLeads.map(q => q.name),
      developerEmails: finalDevs.emails,
      developerNames: finalDevs.names,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      // Backward compatibility fields:
      tl_name: teamLeads.map(q => q.name).join(', ') || '',
      assignee_name: primaryQas.map(q => q.name).join(', ') || '',
      dev_name: finalDevs.devNameStr,
    };

    // Ensure timeline and notesAndFlags exist for old projects
    if (!oldData.timeline) {
      updateData.timeline = {
        smokeTesting: { status: 'Not Started', owner: '', plannedDate: null, completedDate: null, notes: '' },
        testCaseWriting: { status: 'Not Started', owner: '', plannedDate: null, completedDate: null, notes: '' },
        designValidation: { status: 'Not Started', owner: '', plannedDate: null, completedDate: null, notes: '' },
        integrationTesting: { status: 'Not Started', owner: '', plannedDate: null, completedDate: null, notes: '' },
        regressionTesting: { status: 'Not Started', owner: '', plannedDate: null, completedDate: null, notes: '' },
        uatSupport: { status: 'Not Started', owner: '', plannedDate: null, completedDate: null, notes: '' },
        releaseVerification: { status: 'Not Started', owner: '', plannedDate: null, completedDate: null, notes: '' },
        postReleaseValidation: { status: 'Not Started', owner: '', plannedDate: null, completedDate: null, notes: '' },
      };
    }
    if (!oldData.notesAndFlags) {
      updateData.notesAndFlags = [];
    }

    await projectRef.update(updateData);

    // helper to compare string arrays/strings
    const areEqual = (a: any, b: any) => {
      const arrA = Array.isArray(a) ? a : (a ? [a] : []);
      const arrB = Array.isArray(b) ? b : (b ? [b] : []);
      if (arrA.length !== arrB.length) return false;
      return arrA.every(x => arrB.includes(x));
    };

    // Audit logs & Notifications comparisons
    // 1. Status Changed
    if (oldData.status !== status) {
      await logProjectAudit(adminUserName, projectId, 'Project Status Changed', {
        oldStatus: oldData.status || '',
        newStatus: status,
      });
      await notifyProjectTeam(projectId, `Project "${name}" status updated to ${status}`);
    }

    // 2. Primary QA Changed
    const qaChanged = !areEqual(oldData.primaryQaEmail, primaryQaEmails);
    if (qaChanged) {
      await logProjectAudit(adminUserName, projectId, 'Primary QA Changed', {
        oldPrimaryQa: oldData.primaryQaEmail || '',
        newPrimaryQa: primaryQaEmails,
      });

      for (const primaryQa of primaryQas) {
        const oldPrimaryEmails = Array.isArray(oldData.primaryQaEmail) ? oldData.primaryQaEmail : (oldData.primaryQaEmail ? [oldData.primaryQaEmail] : []);
        if (!oldPrimaryEmails.includes(primaryQa.email)) {
          await createNotification(primaryQa.id, `You have been assigned as Primary QA for ${name}`);
        }
      }
    }

    // 3. Supporting QA Changed
    const supportingQaChanged = !areEqual(oldData.supportingQaEmail, supportingQaEmails);
    if (supportingQaChanged) {
      await logProjectAudit(adminUserName, projectId, 'Supporting QA Changed', {
        oldSupportingQa: oldData.supportingQaEmail || '',
        newSupportingQa: supportingQaEmails,
      });

      for (const supportingQa of supportingQas) {
        const oldSupportingEmails = Array.isArray(oldData.supportingQaEmail) ? oldData.supportingQaEmail : (oldData.supportingQaEmail ? [oldData.supportingQaEmail] : []);
        if (!oldSupportingEmails.includes(supportingQa.email)) {
          await createNotification(supportingQa.id, `You have been assigned as Supporting QA for ${name}`);
        }
      }
    }

    // 4. Expected Delivery Date Changed
    if (oldData.targetReleaseDate !== targetReleaseDate) {
      const formattedDate = targetReleaseDate ? new Date(targetReleaseDate).toLocaleDateString() : 'N/A';
      await notifyProjectTeam(projectId, `Expected delivery date for project "${name}" has changed to ${formattedDate}`);
    }

    // 5. Developer Assignment Changed
    if (hasDeveloperEmailsField) {
      const oldDevEmails = oldData.developerEmails || [];
      const newDevEmails = finalDevs.emails;
      
      const addedDevs = newDevEmails.filter((e: string) => !oldDevEmails.includes(e));
      const removedDevs = oldDevEmails.filter((e: string) => !newDevEmails.includes(e));

      for (const email of addedDevs) {
        await logProjectAudit(adminUserName, projectId, 'Developer Added', { developer: email });
        const devInfo = await getUserInfoByEmail(email);
        if (devInfo) {
          await createNotification(devInfo.id, `You have been assigned to project ${name}`);
        }
      }

      for (const email of removedDevs) {
        await logProjectAudit(adminUserName, projectId, 'Developer Removed', { developer: email });
        const devInfo = await getUserInfoByEmail(email);
        if (devInfo) {
          await createNotification(devInfo.id, `You have been removed from project ${name}`);
        }
      }
    }

    // Generic Project Updated audit log
    await logProjectAudit(adminUserName, projectId, 'Project Updated', { name, code });
    await notifyProjectTeam(projectId, `Project "${name}" details have been updated`);

    revalidatePath('/my-projects');
    revalidatePath(`/my-projects/${projectId}`);
    revalidatePath('/admin/projects');

    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to update project' };
  }
}

export async function deleteProject(projectId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'ADMIN') return { error: 'Unauthorized' };

  try {
    const adminUserDoc = await adminDb.collection('users').doc((session.user as any).id).get();
    const adminUserName = adminUserDoc.data()?.name || session.user.name || 'Admin';

    const docRef = adminDb.collection('projects').doc(projectId);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const data = docSnap.data();
      const name = data?.name || '';
      const code = data?.code || '';
      await logProjectAudit(adminUserName, projectId, 'Project Deleted', { name, code });
    }

    // Cascade-delete linked daily statuses
    const linkedSnapshot = await adminDb.collection('daily_statuses').where('project_id', '==', projectId).get();
    const batch = adminDb.batch();
    linkedSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(adminDb.collection('projects').doc(projectId));
    await batch.commit();

    revalidatePath('/my-projects');
    revalidatePath('/admin/projects');

    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to delete project' };
  }
}

const DEFAULT_DISCORD_TEMPLATE = `📋 **Daily Status {actionLabel} by {userName}** ({userRole})

📅 **Date**: {date}

📂 **Projects & Hours**:
{projectHoursList}

✅ **Work Done**:
{workDone}

🎯 **Next Planned Work**:
{plannedWork}

🚧 **Blockers**:
{blockers}

🕒 **{actionLabel} At**: {timeFormatted}`;

/**
 * Helper to format and send a Daily Status report to Discord via a configured Webhook.
 */
async function sendDiscordNotification(
  userId: string,
  projectIds: string[],
  hours: string[],
  date: string,
  workDone: string,
  plannedWork: string,
  blockers: string | null,
  isUpdate: boolean = false
): Promise<string> {
  try {
    const settingsDoc = await adminDb.collection('settings').doc('discord').get();
    const settings = settingsDoc.data();

    if (!settings || !settings.enabled || !settings.webhookUrl) {
      return "";
    }

    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data() || {};
    const userName = userData.name || "Unknown User";
    const userRole = userData.role || "USER";

    const projectsMap: Record<string, string> = {};
    for (const pid of projectIds) {
      const pDoc = await adminDb.collection('projects').doc(pid).get();
      if (pDoc.exists) {
        projectsMap[pid] = pDoc.data()?.name || "Unknown Project";
      }
    }

    const projectHoursList = projectIds.map((pid, idx) => {
      const pName = projectsMap[pid] || "Unknown Project";
      const pHours = parseFloat(hours[idx] || '0');
      return `• ${pName}: ${pHours} hrs`;
    }).join('\n');

    const timeFormatted = new Date().toLocaleString();
    const actionLabel = isUpdate ? "Updated" : "Submitted";
    const userRoleLabel = userRole === 'USER' ? 'QA ENGINEER' : userRole === 'DEV' ? 'DEVELOPER' : userRole;

    const template = settings.messageFormat || DEFAULT_DISCORD_TEMPLATE;

    const variables: Record<string, string> = {
      userName,
      userRole: userRoleLabel,
      actionLabel,
      date,
      projectHoursList,
      workDone,
      plannedWork,
      blockers: blockers || "None",
      timeFormatted,
    };

    let discordMessage = template;
    for (const [key, val] of Object.entries(variables)) {
      discordMessage = discordMessage.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
    }

    const discRes = await fetch(settings.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: discordMessage }),
    });

    if (!discRes.ok) {
      throw new Error(`Discord API returned status ${discRes.status}`);
    }

    // Log Discord notification success
    await adminDb.collection("audit_logs").add({
      user: "System",
      action: "Discord Notification Sent",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: { userName, date }
    });

    return "";
  } catch (err: any) {
    console.error("Discord Notification Failed:", err);
    // Log Discord notification failure
    try {
      await adminDb.collection("audit_logs").add({
        user: "System",
        action: "Discord Notification Failed",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: { date, error: err.message || "Unknown error" }
      });
    } catch (logErr) {
      console.error("Failed to write failure log:", logErr);
    }
    return `Daily status saved, but Discord notification failed: ${err.message || "Unknown error"}`;
  }
}

/**
 * Server Action to fetch current Discord integration settings.
 */
export async function getDiscordSettings() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return { error: 'Unauthorized' };
  }
  try {
    const doc = await adminDb.collection('settings').doc('discord').get();
    if (!doc.exists) {
      return { webhookUrl: '', enabled: false, messageFormat: '' };
    }
    const data = doc.data() || {};
    return {
      webhookUrl: data.webhookUrl || '',
      enabled: !!data.enabled,
      messageFormat: data.messageFormat || '',
      updatedBy: data.updatedBy || '',
      updatedAt: data.updatedAt && typeof data.updatedAt.toDate === 'function' 
        ? data.updatedAt.toDate().toISOString() 
        : (data.updatedAt ? String(data.updatedAt) : null)
    };
  } catch (err: any) {
    return { error: err.message || 'Failed to fetch settings' };
  }
}

/**
 * Server Action to save Discord integration settings.
 */
export async function saveDiscordSettings(webhookUrl: string, enabled: boolean, messageFormat?: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return { error: 'Unauthorized' };
  }

  if (!webhookUrl) {
    return { error: 'Webhook URL is required' };
  }
  const regex = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[a-zA-Z0-9-_]+$/;
  if (!regex.test(webhookUrl)) {
    return { error: 'Invalid Discord webhook URL format' };
  }

  try {
    await adminDb.collection('settings').doc('discord').set({
      webhookUrl,
      enabled,
      messageFormat: messageFormat || '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: session.user.email,
    });
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to save settings' };
  }
}

/**
 * Server Action to test connection to a Discord webhook.
 */
export async function testDiscordConnection(webhookUrl: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return { error: 'Unauthorized' };
  }

  if (!webhookUrl) {
    return { error: 'Webhook URL is required' };
  }
  const regex = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[a-zA-Z0-9-_]+$/;
  if (!regex.test(webhookUrl)) {
    return { error: 'Invalid Discord webhook URL format' };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '🧪 **CB QOps Integration Test**: Connection successful! Discord Daily Status notifications are configured correctly.',
      }),
    });

    if (!res.ok) {
      throw new Error(`Discord returned status ${res.status}`);
    }

    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to send test message' };
  }
}

export async function updateProjectMilestone(projectId: string, milestoneKey: string, data: {
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Blocked';
  owner: string;
  plannedDate: string | null;
  completedDate: string | null;
  notes: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: 'Unauthorized' };

  try {
    const userId = (session.user as any).id;
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userName = userDoc.data()?.name || session.user.name || 'User';

    const projectRef = adminDb.collection('projects').doc(projectId);
    const snap = await projectRef.get();
    if (!snap.exists) return { error: 'Project not found' };
    const project = snap.data() || {};
    const timeline = project.timeline || {};
    const oldMilestone = timeline[milestoneKey] || {};

    const updatedTimeline = {
      ...timeline,
      [milestoneKey]: {
        status: data.status || 'Not Started',
        owner: data.owner || '',
        plannedDate: data.plannedDate || null,
        completedDate: data.completedDate || null,
        notes: data.notes || '',
      }
    };

    await projectRef.update({ timeline: updatedTimeline });

    if (oldMilestone.status !== data.status) {
      await logProjectAudit(userName, projectId, 'Timeline Updated', {
        milestone: milestoneKey,
        oldStatus: oldMilestone.status || 'Not Started',
        newStatus: data.status,
      });
      
      const milestoneNames: Record<string, string> = {
        smokeTesting: 'Smoke Testing',
        testCaseWriting: 'Test Case Writing',
        designValidation: 'Design Validation',
        integrationTesting: 'Integration Testing',
        regressionTesting: 'Regression Testing',
        uatSupport: 'UAT Support',
        releaseVerification: 'Release Verification',
        postReleaseValidation: 'Post Release Validation'
      };

      const mName = milestoneNames[milestoneKey] || milestoneKey;
      await notifyProjectTeam(projectId, `Milestone "${mName}" status in project "${project.name}" updated to ${data.status}`);
    }

    revalidatePath(`/my-projects/${projectId}`);
    revalidatePath('/my-projects');

    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to update milestone' };
  }
}

export async function addProjectNote(projectId: string, noteData: {
  id: string;
  type: 'Note' | 'Risk' | 'Blocker' | 'Dependency';
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'Resolved';
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: 'Unauthorized' };

  try {
    const userId = (session.user as any).id;
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userName = userDoc.data()?.name || session.user.name || 'User';

    const projectRef = adminDb.collection('projects').doc(projectId);
    const snap = await projectRef.get();
    if (!snap.exists) return { error: 'Project not found' };
    const project = snap.data() || {};
    const notesAndFlags = project.notesAndFlags || [];

    const newNote = {
      id: noteData.id || `note_${Date.now()}`,
      type: noteData.type,
      title: noteData.title,
      description: noteData.description || '',
      createdBy: userName,
      createdDate: new Date().toISOString(),
      priority: noteData.priority || 'Medium',
      status: noteData.status || 'Open',
    };

    const updatedNotes = [...notesAndFlags, newNote];
    await projectRef.update({ notesAndFlags: updatedNotes });

    // Track Audit Log & Send Notifications
    if (noteData.type === 'Risk') {
      await logProjectAudit(userName, projectId, 'Risk Added', { title: noteData.title });
      await notifyProjectTeam(projectId, `⚠️ New Risk added to project "${project.name}": ${noteData.title}`);
    } else if (noteData.type === 'Blocker') {
      await logProjectAudit(userName, projectId, 'Blocker Added', { title: noteData.title });
      await notifyProjectTeam(projectId, `🛑 New Blocker added to project "${project.name}": ${noteData.title}`);
    } else if (noteData.type === 'Dependency') {
      await logProjectAudit(userName, projectId, 'Dependency Added', { title: noteData.title });
      await notifyProjectTeam(projectId, `🔗 New Dependency added to project "${project.name}": ${noteData.title}`);
    } else {
      await logProjectAudit(userName, projectId, 'Project Updated', { note: noteData.title });
    }

    revalidatePath(`/my-projects/${projectId}`);
    revalidatePath('/my-projects');

    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to add note' };
  }
}

export async function updateProjectNoteStatus(projectId: string, noteId: string, status: 'Open' | 'Resolved') {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: 'Unauthorized' };

  try {
    const userId = (session.user as any).id;
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userName = userDoc.data()?.name || session.user.name || 'User';

    const projectRef = adminDb.collection('projects').doc(projectId);
    const snap = await projectRef.get();
    if (!snap.exists) return { error: 'Project not found' };
    const project = snap.data() || {};
    const notesAndFlags = project.notesAndFlags || [];

    let noteTitle = '';
    let noteType = 'Note';
    const updatedNotes = notesAndFlags.map((note: any) => {
      if (note.id === noteId) {
        noteTitle = note.title;
        noteType = note.type;
        return { ...note, status };
      }
      return note;
    });

    await projectRef.update({ notesAndFlags: updatedNotes });

    await logProjectAudit(userName, projectId, 'Project Updated', { noteId, status, title: noteTitle });
    
    if (status === 'Resolved' && (noteType === 'Risk' || noteType === 'Blocker')) {
      await notifyProjectTeam(projectId, `✅ ${noteType} "${noteTitle}" in project "${project.name}" has been resolved.`);
    }

    revalidatePath(`/my-projects/${projectId}`);
    revalidatePath('/my-projects');

    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to update note status' };
  }
}

export async function deleteProjectNote(projectId: string, noteId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: 'Unauthorized' };

  try {
    const userId = (session.user as any).id;
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userName = userDoc.data()?.name || session.user.name || 'User';

    const projectRef = adminDb.collection('projects').doc(projectId);
    const snap = await projectRef.get();
    if (!snap.exists) return { error: 'Project not found' };
    const project = snap.data() || {};
    const notesAndFlags = project.notesAndFlags || [];

    const targetNote = notesAndFlags.find((n: any) => n.id === noteId);
    if (!targetNote) return { error: 'Note not found' };

    const updatedNotes = notesAndFlags.filter((note: any) => note.id !== noteId);
    await projectRef.update({ notesAndFlags: updatedNotes });

    await logProjectAudit(userName, projectId, 'Project Updated', { deletedNoteId: noteId, title: targetNote.title });

    revalidatePath(`/my-projects/${projectId}`);
    revalidatePath('/my-projects');

    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to delete note' };
  }
}

export async function addProjectMilestone(projectId: string, label: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session?.user || (role !== 'ADMIN' && role !== 'TL')) return { error: 'Unauthorized' };

  if (!label.trim()) return { error: 'Label is required' };

  try {
    const projectRef = adminDb.collection('projects').doc(projectId);
    const snap = await projectRef.get();
    if (!snap.exists) return { error: 'Project not found' };

    const project = snap.data() || {};
    const timeline = project.timeline || {};

    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
    if (!key) return { error: 'Invalid label' };

    if (timeline[key]) return { error: 'Milestone already exists in this project' };

    // Find max order
    let maxOrder = 0;
    Object.values(timeline).forEach((m: any) => {
      if (m.order !== undefined && m.order > maxOrder) {
        maxOrder = m.order;
      }
    });

    const updatedTimeline = {
      ...timeline,
      [key]: {
        label: label.trim(),
        status: 'Not Started',
        owner: '',
        plannedDate: null,
        completedDate: null,
        notes: '',
        order: maxOrder + 1
      }
    };

    await projectRef.update({ timeline: updatedTimeline });
    revalidatePath(`/my-projects/${projectId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to add milestone' };
  }
}

export async function editProjectMilestone(projectId: string, milestoneKey: string, newLabel: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session?.user || (role !== 'ADMIN' && role !== 'TL')) return { error: 'Unauthorized' };

  if (!newLabel.trim()) return { error: 'Label is required' };

  try {
    const projectRef = adminDb.collection('projects').doc(projectId);
    const snap = await projectRef.get();
    if (!snap.exists) return { error: 'Project not found' };

    const project = snap.data() || {};
    const timeline = project.timeline || {};

    if (!timeline[milestoneKey]) return { error: 'Milestone not found' };

    const updatedTimeline = {
      ...timeline,
      [milestoneKey]: {
        ...timeline[milestoneKey],
        label: newLabel.trim()
      }
    };

    await projectRef.update({ timeline: updatedTimeline });
    revalidatePath(`/my-projects/${projectId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to edit milestone' };
  }
}

export async function deleteProjectMilestone(projectId: string, milestoneKey: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session?.user || (role !== 'ADMIN' && role !== 'TL')) return { error: 'Unauthorized' };

  try {
    const projectRef = adminDb.collection('projects').doc(projectId);
    const snap = await projectRef.get();
    if (!snap.exists) return { error: 'Project not found' };

    const project = snap.data() || {};
    const timeline = { ...(project.timeline || {}) };

    if (!timeline[milestoneKey]) return { error: 'Milestone not found' };

    delete timeline[milestoneKey];

    await projectRef.update({ timeline });
    revalidatePath(`/my-projects/${projectId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to delete milestone' };
  }
}

export async function reorderProjectMilestones(projectId: string, orders: { key: string; order: number }[]) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session?.user || (role !== 'ADMIN' && role !== 'TL')) return { error: 'Unauthorized' };

  try {
    const projectRef = adminDb.collection('projects').doc(projectId);
    const snap = await projectRef.get();
    if (!snap.exists) return { error: 'Project not found' };

    const project = snap.data() || {};
    const timeline = { ...(project.timeline || {}) };

    orders.forEach(item => {
      if (timeline[item.key]) {
        timeline[item.key] = {
          ...timeline[item.key],
          order: item.order
        };
      }
    });

    await projectRef.update({ timeline });
    revalidatePath(`/my-projects/${projectId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to reorder milestones' };
  }
}

export async function updateSelfProfile(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: 'Unauthorized' };

  const userId = (session.user as any).id;
  const firstName = (formData.get('firstName') as string || '').trim();
  const lastName = (formData.get('lastName') as string || '').trim();
  const password = formData.get('password') as string || '';
  const confirmPassword = formData.get('confirmPassword') as string || '';

  if (!firstName) return { error: 'First name is required' };

  if (password && password.length < 6) {
    return { error: 'Password must be at least 6 characters' };
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match' };
  }

  try {
    const fullName = `${firstName} ${lastName}`.trim();
    const authUpdates: any = { displayName: fullName };
    if (password) authUpdates.password = password;
    
    try {
      await adminAuth.updateUser(userId, authUpdates);
    } catch (authError: any) {
      const errMsg = (authError?.message || '').toLowerCase();
      if (errMsg.includes('invalid_grant') || errMsg.includes('credential') || errMsg.includes('account not found') || errMsg.includes('oauth2')) {
        console.warn("⚠️ Firebase Auth updateUser profile failed due to credential issue. Updating only Firestore database.", authError);
      } else {
        throw authError;
      }
    }

    const userUpdates: any = {
      name: fullName,
    };

    if (password) {
      const bcrypt = await import('bcryptjs');
      userUpdates.password = await bcrypt.hash(password, 10);
    }

    await adminDb.collection('users').doc(userId).update(userUpdates);

    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to update profile' };
  }
}

export async function toggleDocumentFavorite(projectId: string, docId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: 'Unauthorized' };

  const userEmail = session.user.email;
  if (!userEmail) return { error: 'Missing user email' };

  try {
    const projectRef = adminDb.collection('projects').doc(projectId);
    const snap = await projectRef.get();
    if (!snap.exists) return { error: 'Project not found' };

    const project = snap.data() || {};
    const documents = project.documents || [];

    const updatedDocuments = documents.map((doc: any) => {
      if (doc.id === docId) {
        const favoritedBy = doc.favoritedBy || [];
        const isFavorited = favoritedBy.includes(userEmail);
        const updatedFavoritedBy = isFavorited
          ? favoritedBy.filter((email: string) => email !== userEmail)
          : [...favoritedBy, userEmail];
        return {
          ...doc,
          favoritedBy: updatedFavoritedBy,
        };
      }
      return doc;
    });

    await projectRef.update({ documents: updatedDocuments });
    
    revalidatePath(`/my-projects/${projectId}`);
    revalidatePath('/project-docs');
    revalidatePath('/favorites');

    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to toggle favorite' };
  }
}

export async function toggleProjectFavorite(projectId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: 'Unauthorized' };

  const userEmail = session.user.email;
  if (!userEmail) return { error: 'Missing user email' };

  try {
    const projectRef = adminDb.collection('projects').doc(projectId);
    const snap = await projectRef.get();
    if (!snap.exists) return { error: 'Project not found' };

    const project = snap.data() || {};
    const favoritedBy = project.favoritedBy || [];
    const isFavorited = favoritedBy.includes(userEmail);
    const updatedFavoritedBy = isFavorited
      ? favoritedBy.filter((email: string) => email !== userEmail)
      : [...favoritedBy, userEmail];

    await projectRef.update({ favoritedBy: updatedFavoritedBy });

    revalidatePath('/my-projects');
    revalidatePath('/favorites');
    revalidatePath('/project-docs');
    revalidatePath('/test-cases');

    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to toggle project favorite' };
  }
}

export async function toggleTestCaseFavorite(projectId: string, testCaseId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: 'Unauthorized' };

  const userEmail = session.user.email;
  if (!userEmail) return { error: 'Missing user email' };

  try {
    const tcRef = adminDb.collection('projects').doc(projectId).collection('test_cases').doc(testCaseId);
    const snap = await tcRef.get();
    if (!snap.exists) return { error: 'Test case not found' };

    const tc = snap.data() || {};
    const favoritedBy = tc.favoritedBy || [];
    const isFavorited = favoritedBy.includes(userEmail);
    const updatedFavoritedBy = isFavorited
      ? favoritedBy.filter((email: string) => email !== userEmail)
      : [...favoritedBy, userEmail];

    await tcRef.update({ favoritedBy: updatedFavoritedBy });

    revalidatePath(`/test-cases/${projectId}`);
    revalidatePath('/favorites');

    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to toggle test case favorite' };
  }
}

export async function toggleQuickNoteFavorite(noteId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: 'Unauthorized' };

  const userId = (session.user as any).id;

  try {
    const noteRef = adminDb.collection('quick_notes').doc(noteId);
    const snap = await noteRef.get();
    if (!snap.exists) return { error: 'Note not found' };

    const data = snap.data() || {};
    if (data.user_id !== userId) return { error: 'Forbidden' };

    const currentFavorited = data.is_favorited ?? false;
    await noteRef.update({ is_favorited: !currentFavorited });

    revalidatePath('/quick-notes');
    revalidatePath('/favorites');

    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to toggle quick note favorite' };
  }
}
