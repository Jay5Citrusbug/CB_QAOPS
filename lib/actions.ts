"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

// --- PROJECT ACTIONS ---
export async function createProject(formData: FormData) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const tlName = formData.get("tlName") as string;
  const assigneeName = formData.get("assigneeName") as string;
  const devName = formData.get("devName") as string;

  try {
    await prisma.project.create({
      data: { name, tlName, assigneeName, devName },
    });
    revalidatePath("/admin/projects");
    return { success: true };
  } catch (error: any) {
    if (error.code === 'P2002') return { error: "Project name already exists" };
    return { error: "Failed to create project" };
  }
}

export async function updateProject(projectId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const tlName = formData.get("tlName") as string;
  const assigneeName = formData.get("assigneeName") as string;
  const devName = formData.get("devName") as string;
  const status = formData.get("status") as string;

  await prisma.project.update({
    where: { id: projectId },
    data: { name, tlName, assigneeName, devName, status },
  });

  revalidatePath("/admin/projects");
  revalidatePath("/daily-status");
  return { success: true };
}

export async function deleteProject(projectId: string) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath("/admin/projects");
  return { success: true };
}

// --- DAILY STATUS ACTIONS ---
export async function addDailyStatus(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const projectIds = formData.getAll("projectId") as string[];
  const date = new Date(formData.get("date") as string);
  const workDone = formData.get("workDone") as string;
  const plannedWork = formData.get("plannedWork") as string;
  const blockers = formData.get("blockers") as string || null;
  const hoursMap = formData.getAll("hours") as string[]; // These should align with projectIds index

  try {
    const userId = (session.user as any).id;
    
    // Create status for each project
    const operations = projectIds.map((projectId, index) => {
      const hours = parseFloat(hoursMap[index] || "0");
      return prisma.dailyStatus.upsert({
        where: {
          userId_date_projectId: {
            userId,
            date,
            projectId,
          }
        },
        update: {
          workDone,
          plannedWork,
          blockers,
          hours,
        },
        create: {
          projectId,
          date,
          workDone,
          plannedWork,
          blockers,
          hours,
          userId,
        }
      });
    });

    await Promise.all(operations);

    revalidatePath("/daily-status");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("DEBUG: addDailyStatus error:", error);
    return { error: `Failed to save status reports: ${error.message}` };
  }
}

export async function updateGroupedDailyStatus(oldDateStr: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  const userId = (session.user as any).id;

  const projectIds = formData.getAll("projectId") as string[];
  const oldDate = new Date(oldDateStr);
  const newDate = new Date(formData.get("date") as string);
  const workDone = formData.get("workDone") as string;
  const plannedWork = formData.get("plannedWork") as string;
  const blockers = formData.get("blockers") as string || null;
  const hoursMap = formData.getAll("hours") as string[];

  try {
    await prisma.dailyStatus.deleteMany({
      where: { userId, date: oldDate }
    });

    const operations = projectIds.map((projectId, index) => {
      const hours = parseFloat(hoursMap[index] || "0");
      return prisma.dailyStatus.upsert({
        where: { userId_date_projectId: { userId, date: newDate, projectId } },
        update: { workDone, plannedWork, blockers, hours },
        create: { projectId, date: newDate, workDone, plannedWork, blockers, hours, userId }
      });
    });

    await Promise.all(operations);

    revalidatePath("/daily-status");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    return { error: `Failed to update status reports: ${error.message}` };
  }
}

export async function deleteGroupedDailyStatus(dateStr: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  const userId = (session.user as any).id;

  await prisma.dailyStatus.deleteMany({
    where: { userId, date: new Date(dateStr) }
  });
  
  revalidatePath("/daily-status");
  revalidatePath("/dashboard");
  return { success: true };
}

// --- USER ACTIONS ---
export async function createUser(formData: FormData) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const role = formData.get("role") as string;

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    await prisma.user.create({
      data: { name, email, password: hashedPassword, role },
    });
    revalidatePath("/admin/users");
    return { success: true };
  } catch (error: any) {
    if (error.code === 'P2002') return { error: "Email already exists" };
    return { error: "Failed to create user" };
  }
}

// --- TASK ACTIONS ---
export async function createTask(formData: FormData, targetUserId?: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: "Unauthorized" };

  const title = formData.get("title") as string;
  if (!title) return { error: "Task title is required" };

  const userId = ((session.user as any).role === "ADMIN" && targetUserId) 
    ? targetUserId 
    : (session.user as any).id;

  try {
    const task = await (prisma.task as any).create({
      data: {
        title,
        status: "PENDING",
        userId: userId,
      },
    });

    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    return task;
  } catch (error: any) {
    console.error("DEBUG: createTask error details:", error);
    return { error: error.message || "Failed to create task in database" };
  }
}

export async function updateTask(taskId: string, data: any) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: "Unauthorized" };

  try {
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data,
    });

    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    return updatedTask;
  } catch (error: any) {
    console.error("DEBUG: updateTask error:", error);
    return { error: error.message || "Failed to update task" };
  }
}

export async function toggleTaskStatus(taskId: string, currentStatus: string) {
  const newStatus = currentStatus === "COMPLETED" ? "PENDING" : "COMPLETED";
  try {
    await prisma.task.update({
      where: { id: taskId },
      data: { status: newStatus },
    });
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
  } catch (error) {
    console.error("DEBUG: toggleTaskStatus error:", error);
  }
}

export async function deleteTask(taskId: string) {
  try {
    await prisma.task.delete({ where: { id: taskId } });
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
  } catch (error) {
    console.error("DEBUG: deleteTask error:", error);
  }
}

export async function addTaskStep(taskId: string, title: string) {
  try {
    // @ts-ignore
    await prisma.taskStep.create({
      data: { 
        title,
        task: { connect: { id: taskId } }
      },
    });
    revalidatePath("/tasks");
  } catch (error) {
    console.error("DEBUG: addTaskStep error:", error);
  }
}

export async function toggleTaskStep(stepId: string, currentStatus: boolean) {
  try {
    // @ts-ignore
    await prisma.taskStep.update({
      where: { id: stepId },
      data: { isCompleted: !currentStatus },
    });
    revalidatePath("/tasks");
  } catch (error) {
    console.error("DEBUG: toggleTaskStep error:", error);
  }
}

export async function deleteTaskStep(stepId: string) {
  try {
    // @ts-ignore
    await prisma.taskStep.delete({ where: { id: stepId } });
    revalidatePath("/tasks");
  } catch (error) {
    console.error("DEBUG: deleteTaskStep error:", error);
  }
}



