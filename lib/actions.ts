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

  const projectId = formData.get("projectId") as string;
  const date = new Date(formData.get("date") as string);
  const workDone = formData.get("workDone") as string;
  const plannedWork = formData.get("plannedWork") as string;
  const blockers = formData.get("blockers") as string || null;

  try {
    await prisma.dailyStatus.create({
      data: {
        projectId,
        date,
        workDone,
        plannedWork,
        blockers,
        userId: (session.user as any).id,
      },
    });
    revalidatePath("/daily-status");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("DEBUG: addDailyStatus error:", error);
    if (error.code === 'P2002') return { error: "A status report for this project and date already exists." };
    return { error: "Failed to save status" };
  }
}

export async function updateDailyStatus(statusId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const workDone = formData.get("workDone") as string;
  const plannedWork = formData.get("plannedWork") as string;
  const blockers = formData.get("blockers") as string || null;

  await prisma.dailyStatus.update({
    where: { id: statusId },
    data: { workDone, plannedWork, blockers },
  });

  revalidatePath("/daily-status");
  return { success: true };
}

export async function deleteDailyStatus(statusId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  await prisma.dailyStatus.delete({ where: { id: statusId } });
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
export async function createTask(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const title = formData.get("title") as string;
  const dueDate = new Date(formData.get("dueDate") as string);

  await prisma.task.create({
    data: {
      title,
      dueDate,
      userId: (session.user as any).id,
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function toggleTaskStatus(taskId: string, currentStatus: string) {
  const newStatus = currentStatus === "COMPLETED" ? "PENDING" : "COMPLETED";
  await prisma.task.update({
    where: { id: taskId },
    data: { status: newStatus },
  });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function deleteTask(taskId: string) {
  await prisma.task.delete({ where: { id: taskId } });
  revalidatePath("/tasks");
}
