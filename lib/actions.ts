"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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

// --- DAILY STATUS ACTIONS ---
export async function addDailyStatus(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const date = new Date(formData.get("date") as string);
  const workDone = formData.get("workDone") as string;
  const plannedWork = formData.get("plannedWork") as string;
  const blockers = formData.get("blockers") as string || null;

  try {
    await prisma.dailyStatus.create({
      data: {
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
    if (error.code === 'P2002') return { error: "Status already exists for this date" };
    return { error: "Failed to save status" };
  }
}
