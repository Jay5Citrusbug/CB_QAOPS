import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CheckSquare, Calendar, Activity, ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any).id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todayStatus, tasks] = await Promise.all([
    prisma.dailyStatus.findFirst({
      where: { userId, date: { gte: today } },
    }),
    prisma.task.findMany({
      where: { userId, status: "PENDING" },
      orderBy: { dueDate: 'asc' },
      take: 5
    })
  ]);

  return (
    <div className="space-y-8">
      <div className="page-header">
        <h1 className="page-title">Morning, {session?.user?.name}!</h1>
        <p className="page-desc">Here's what's happening today in your QA portal.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="premium-card md:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" /> Today's Status
            </h2>
            <Link href="/daily-status" className="text-sm font-medium text-[#ed5c37] hover:underline flex items-center gap-1">
              {todayStatus ? "View full list" : "Submit now"} <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          
          {todayStatus ? (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 italic text-slate-600">
                "{todayStatus.workDone.substring(0, 100)}..."
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2 text-xs font-medium px-3 py-1 bg-green-100 text-green-700 rounded-full">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Submitted
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  At {todayStatus.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
              <p className="text-slate-500 text-sm italic">You haven't submitted today's status yet.</p>
            </div>
          )}
        </div>

        <div className="premium-card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#ed5c37]" /> Stats
            </h2>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-slate-500 text-sm">Open Tasks</span>
              <span className="text-2xl font-bold">{tasks.length}</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
               <div className="bg-[#ed5c37] h-full" style={{ width: `${Math.min(tasks.length * 10, 100)}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="premium-card">
        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-green-500" /> Upcoming Tasks
        </h2>
        <div className="space-y-3">
          {tasks.map((task: { id: string; title: string; dueDate: Date | null }) => (
            <div key={task.id} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 bg-blue-400 rounded-full" />
                <span className="font-medium text-slate-700">{task.title}</span>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {task.dueDate ? task.dueDate.toLocaleDateString() : 'No due date'}
              </span>
            </div>
          ))}
          {tasks.length === 0 && <p className="text-slate-400 text-sm text-center py-4 italic">No pending tasks!</p>}
        </div>
      </div>
    </div>
  );
}

