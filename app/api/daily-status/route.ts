import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const statuses = await prisma.dailyStatus.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { 
      user: true,
      project: true 
    }
  });

  return NextResponse.json(statuses);
}
