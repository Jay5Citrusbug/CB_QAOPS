import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("userId");

  let userIdFilter = (session.user as any).id;
  
  if ((session.user as any).role === "ADMIN") {
    if (targetUserId) {
      userIdFilter = targetUserId;
    } else {
      // If admin and no specific userId, optionally fetch all or just self
      // For ToDo style, maybe we want to see ALL tasks if no filter selected
      // But the requirement says "Once click on it Open interface... as admin I can see all"
      // I'll return ALL tasks if admin and no targetUserId is specified, 
      // or maybe there's a "Global" view.
      // Let's stick to the current user's tasks by default, but allow fetching all.
      // Wait, requirement: "as admin I can see all given register user data todo list"
      // I'll fetch ALL tasks if admin and no targetUserId, but the front-end will handle filtering.
      // Actually, better for performance to filter here.
      const tasks = await prisma.task.findMany({
        include: {
          steps: {
            orderBy: { id: "asc" }
          }
        },
        orderBy: { createdAt: "desc" }
      });
      return NextResponse.json(tasks);
    }
  }

  const tasks = await prisma.task.findMany({
    where: { userId: userIdFilter },
    include: {
      steps: {
        orderBy: { id: "asc" }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json(tasks);
}

