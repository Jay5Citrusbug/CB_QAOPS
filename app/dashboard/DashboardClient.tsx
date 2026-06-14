"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { addDailyStatus, updateGroupedDailyStatus } from "@/lib/actions";
import { 
  CheckSquare, Calendar, Clock, AlertCircle, PlayCircle, 
  CheckCircle2, ArrowRight, Eye, Plus, Edit2, Loader2, X, AlertTriangle, ChevronRight,
  Check, RefreshCw
} from "lucide-react";
import Link from "next/link";

interface DashboardClientProps {
  session: any;
  projects: Array<{ id: string; name: string; status: string }>;
  taskLists: Array<{ id: string; name: string; description: string }>;
  allTasks: any[];
  dailyStatuses: any[];
  users?: Array<{ id: string; name: string; email: string; role: string }>;
}

export default function DashboardClient({
  session,
  projects,
  taskLists,
  allTasks,
  dailyStatuses,
  users = []
}: DashboardClientProps) {
  const router = useRouter();
  const userEmail = session?.user?.email || "";
  const userId = session?.user?.id || "";
  const userRole = session?.user?.role || "USER";
  const isQaLead = userRole === "ADMIN" || userRole === "TL";

  // Navigation & Filtering State
  const [activeTab, setActiveTab] = useState<"MY_DASH" | "TEAM_OVERVIEW">("MY_DASH");
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [projectHours, setProjectHours] = useState<Record<string, string>>({});
  const [workDone, setWorkDone] = useState("");
  const [plannedWork, setPlannedWork] = useState("");
  const [blockers, setBlockers] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Quick View Modal State
  const [activeTask, setActiveTask] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  // Helper: Local date formatting YYYY-MM-DD
  const getLocalDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateString(new Date());

  // Check if dates represent the same local calendar day
  const isSameDay = (d1Str: string, d2Str: string) => {
    if (!d1Str || !d2Str) return false;
    const d1 = new Date(d1Str);
    const d2 = new Date(d2Str);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  // Determine whose data to display in standard dashboard cards
  const targetUserId = viewingUserId || userId;
  const selectedUser = useMemo(() => {
    return users.find(u => u.id === viewingUserId);
  }, [users, viewingUserId]);

  const targetUserEmail = useMemo(() => {
    if (viewingUserId && selectedUser) {
      return selectedUser.email;
    }
    return userEmail;
  }, [viewingUserId, selectedUser, userEmail]);

  // 1. Group today's statuses for the target user
  const todayStatuses = useMemo(() => {
    return dailyStatuses.filter(s => s.date && isSameDay(s.date, todayStr) && (s.userId === targetUserId || s.user_id === targetUserId));
  }, [dailyStatuses, todayStr, targetUserId]);

  const todayGroupedStatus = useMemo(() => {
    if (todayStatuses.length === 0) return null;
    const first = todayStatuses[0];
    const projectsMap = new Map(projects.map(p => [p.id, p.name]));
    
    return {
      workDone: first.workDone || first.work_done || "",
      plannedWork: first.plannedWork || first.planned_work || "",
      blockers: first.blockers || null,
      createdAt: first.createdAt || first.created_at || new Date().toISOString(),
      projects: todayStatuses.map(s => ({
        projectId: s.projectId || s.project_id,
        name: projectsMap.get(s.projectId || s.project_id) || "Unknown Project",
        hours: s.hours ?? 0
      }))
    };
  }, [todayStatuses, projects]);

  // 2. Filter tasks within user scope (assigned to or created by)
  const myTasks = useMemo(() => {
    return allTasks.filter(t => t.assignedTo === targetUserEmail || t.createdBy === targetUserEmail || t.user_id === targetUserId);
  }, [allTasks, targetUserEmail, targetUserId]);

  // 3. Map Task List ID to Names
  const listsMap = useMemo(() => {
    return new Map(taskLists.map(l => [l.id, l.name]));
  }, [taskLists]);

  // 4. Today's Tasks
  const todayTasks = useMemo(() => {
    return myTasks.filter(t => t.dueDate && isSameDay(t.dueDate, todayStr));
  }, [myTasks, todayStr]);

  // 5. Upcoming Tasks (Due tomorrow and beyond, not completed)
  const upcomingTasks = useMemo(() => {
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    const list = myTasks.filter(t => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d > todayEnd && t.status !== 'Completed';
    });
    
    // Sort closest due date first
    return [...list].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [myTasks]);

  // 6. Metrics
  const metrics = useMemo(() => {
    const totalToday = todayTasks.length;
    const openTasks = myTasks.filter(t => (t.status === 'To Do' || t.status === 'PENDING' || t.status === 'Open') && t.status !== 'Completed').length;
    const inProgress = myTasks.filter(t => t.status === 'In Progress').length;
    
    // Completed today
    const completedToday = myTasks.filter(t => {
      if (t.status !== 'Completed') return false;
      return t.completedAt && isSameDay(t.completedAt, todayStr);
    }).length;

    return { totalToday, openTasks, inProgress, completedToday };
  }, [myTasks, todayTasks, todayStr]);

  // 7. Team Overview calculation (only evaluated for QA Leads)
  const teamMembersData = useMemo(() => {
    if (!isQaLead || !users || users.length === 0) return [];
    
    // Keep only QA Engineer role (USER), exclude DEV, TL, and ADMIN
    const qaUsers = users.filter(u => u.role === 'USER');
    
    return qaUsers.map(u => {
      const uTasks = allTasks.filter(t => t.assignedTo === u.email || t.createdBy === u.email || t.user_id === u.id);
      
      const uTodayTasks = uTasks.filter(t => t.dueDate && isSameDay(t.dueDate, todayStr));
      const tasksTodayCount = uTodayTasks.length;
      
      const openTasksCount = uTasks.filter(t => (t.status === 'To Do' || t.status === 'PENDING' || t.status === 'Open') && t.status !== 'Completed').length;
      
      const completedTodayCount = uTasks.filter(t => {
        return t.status === 'Completed' && t.completedAt && isSameDay(t.completedAt, todayStr);
      }).length;
      
      const uTodayStatuses = dailyStatuses.filter(s => s.date && isSameDay(s.date, todayStr) && (s.userId === u.id || s.user_id === u.id));
      const hasSubmitted = uTodayStatuses.length > 0;
      
      let statusSummary = "";
      let submittedAt = "";
      if (hasSubmitted) {
        statusSummary = uTodayStatuses[0].workDone || uTodayStatuses[0].work_done || "";
        submittedAt = uTodayStatuses[0].createdAt || uTodayStatuses[0].created_at || "";
      }
      
      return {
        user: u,
        tasksTodayCount,
        openTasksCount,
        completedTodayCount,
        hasSubmitted,
        statusSummary,
        submittedAt
      };
    });
  }, [isQaLead, users, allTasks, dailyStatuses, todayStr]);

  // Time-of-day Greeting
  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return "Good Morning";
    if (hr < 17) return "Good Afternoon";
    return "Good Evening";
  };

  // Badge Colors
  const getPriorityBadge = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'critical':
      case 'high':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-600 border border-red-100 rounded-md uppercase">High</span>;
      case 'medium':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100 rounded-md uppercase">Medium</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-100 rounded-md uppercase">Low</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-green-50 text-green-600 border border-green-100 rounded-md uppercase">Completed</span>;
      case 'in progress':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 rounded-md uppercase font-sans">In Progress</span>;
      case 'review':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-100 rounded-md uppercase">Review</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 rounded-md uppercase">Open</span>;
    }
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProjects.length === 0) {
      setFormError("Please select at least one project.");
      return;
    }
    if (!workDone.trim()) {
      setFormError("Work done highlights are required.");
      return;
    }
    if (!plannedWork.trim()) {
      setFormError("Planned work description is required.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    const formData = new FormData();
    formData.append("date", todayStr);
    formData.append("workDone", workDone.trim());
    formData.append("plannedWork", plannedWork.trim());
    formData.append("blockers", blockers.trim());

    selectedProjects.forEach(pid => {
      formData.append("projectId", pid);
      formData.append("hours", projectHours[pid] || "8");
    });

    try {
      let res;
      if (isEditing) {
        res = await updateGroupedDailyStatus(todayStr, formData);
      } else {
        res = await addDailyStatus(formData);
      }

      if (res && res.error) {
        setFormError(res.error);
        setToast({ message: res.error, type: "error" });
      } else {
        setFormSuccess(true);
        setToast({
          message: isEditing ? "Daily status updated successfully!" : "Daily status submitted successfully!",
          type: "success"
        });
        startTransition(() => {
          router.refresh();
        });
        setTimeout(() => {
          setFormSuccess(false);
          setShowForm(false);
          setIsEditing(false);
        }, 1500);
      }
    } catch (err: any) {
      setFormError(err.message || "Failed to submit status. Please try again.");
      setToast({ message: err.message || "Failed to submit status.", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = () => {
    if (!todayGroupedStatus) return;
    setIsEditing(true);
    setSelectedProjects(todayGroupedStatus.projects.map(p => p.projectId));
    const hoursMap: Record<string, string> = {};
    todayGroupedStatus.projects.forEach(p => {
      hoursMap[p.projectId] = String(p.hours);
    });
    setProjectHours(hoursMap);
    setWorkDone(todayGroupedStatus.workDone);
    setPlannedWork(todayGroupedStatus.plannedWork);
    setBlockers(todayGroupedStatus.blockers || "");
    setShowForm(true);
  };

  const toggleProject = (pid: string) => {
    if (selectedProjects.includes(pid)) {
      setSelectedProjects(prev => prev.filter(id => id !== pid));
      setProjectHours((prev: Record<string, string>) => {
        const copy = { ...prev };
        delete copy[pid];
        return copy;
      });
    } else {
      setSelectedProjects(prev => [...prev, pid]);
      setProjectHours((prev: Record<string, string>) => ({ ...prev, [pid]: "8" }));
    }
  };

  // Quick View Detail Fetching
  const handleQuickView = async (task: any) => {
    setActiveTask(task);
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`);
      if (res.ok) {
        const details = await res.json();
        setActiveTask(details);
      }
    } catch (err) {
      console.error("Failed to fetch task details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Task Completion Action inside Quick View Modal
  const handleToggleTaskStatus = async () => {
    if (!activeTask) return;
    setTogglingStatus(true);
    const isCompleted = activeTask.status === "Completed";
    const endpoint = isCompleted ? `/api/tasks/${activeTask.id}/reopen` : `/api/tasks/${activeTask.id}/complete`;
    
    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (res.ok) {
        // Refresh details
        const detailsRes = await fetch(`/api/tasks/${activeTask.id}`);
        if (detailsRes.ok) {
          const details = await detailsRes.json();
          setActiveTask(details);
        }
        setToast({ 
          message: isCompleted ? "Task reopened successfully!" : "Task completed successfully!", 
          type: "success" 
        });
        startTransition(() => {
          router.refresh();
        });
      } else {
        setToast({ message: "Failed to update task status.", type: "error" });
      }
    } catch (err: any) {
      console.error("Failed to toggle task completion:", err);
      setToast({ message: err.message || "Failed to update task status.", type: "error" });
    } finally {
      setTogglingStatus(false);
    }
  };

  // Toggle checklist step status
  const handleToggleStep = async (stepId: string, isCompleted: boolean) => {
    if (!activeTask) return;
    const updatedSteps = activeTask.steps.map((s: any) => 
      s.id === stepId ? { ...s, isCompleted: !isCompleted } : s
    );

    // Call PUT endpoint to save steps
    try {
      const res = await fetch(`/api/tasks/${activeTask.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps: updatedSteps })
      });
      if (res.ok) {
        setActiveTask((prev: any) => ({ ...prev, steps: updatedSteps }));
        setToast({ 
          message: "Checklist step updated successfully!", 
          type: "success" 
        });
        startTransition(() => {
          router.refresh();
        });
      } else {
        setToast({ message: "Failed to update checklist step.", type: "error" });
      }
    } catch (err: any) {
      console.error("Failed to update step:", err);
      setToast({ message: err.message || "Failed to update checklist step.", type: "error" });
    }
  };

  // Format Date String nicely
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="space-y-6 relative">
      {(isPending || togglingStatus || isSubmitting) && (
        <div className="fixed inset-0 bg-white/70 backdrop-blur-xs z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 bg-white/80 p-6 rounded-3xl border border-slate-100 shadow-xl">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            <p className="text-sm text-slate-500 font-bold animate-pulse">Syncing dashboard data...</p>
          </div>
        </div>
      )}
      {/* Header Greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {getGreeting()}, {session?.user?.name || "User"}!
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-0.5">
            Here&apos;s what&apos;s happening today in your QA portal.
          </p>
        </div>
        <div className="text-xs font-semibold text-slate-400 bg-slate-100 border border-slate-200/50 rounded-2xl px-4 py-2 flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-blue-600" />
          <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* View Toggle Tabs for QA Lead / Admin */}
      {isQaLead && !viewingUserId && (
        <div className="flex border-b border-slate-200/80 pb-px gap-6 text-sm font-semibold select-none">
          <button
            onClick={() => setActiveTab("MY_DASH")}
            className={`pb-2.5 px-1 relative transition-colors cursor-pointer ${
              activeTab === "MY_DASH" 
                ? "text-blue-600 font-bold" 
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            My Dashboard
            {activeTab === "MY_DASH" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("TEAM_OVERVIEW")}
            className={`pb-2.5 px-1 relative transition-colors cursor-pointer ${
              activeTab === "TEAM_OVERVIEW" 
                ? "text-blue-600 font-bold" 
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Team Overview
            {activeTab === "TEAM_OVERVIEW" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
        </div>
      )}

      {/* Viewing Selected Team Member Info Banner */}
      {viewingUserId && selectedUser && (
        <div className="bg-blue-50 border border-blue-200/70 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black text-lg shrink-0">i</div>
            <div>
              <h4 className="text-sm font-bold text-blue-800">Viewing Team Member Dashboard</h4>
              <p className="text-xs text-blue-600/90 font-semibold mt-0.5">
                Currently tracking dashboard details for <span className="font-extrabold">{selectedUser.name}</span> ({selectedUser.email}) in read-only mode.
              </p>
            </div>
          </div>
          <button 
            onClick={() => setViewingUserId(null)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shrink-0 cursor-pointer"
          >
            Back to Team Overview
          </button>
        </div>
      )}

      {/* Main View Router */}
      {activeTab === "TEAM_OVERVIEW" && !viewingUserId ? (
        /* Team Overview Panel */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-800">Team Status & Progress</h2>
            <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full">
              Total Members: {teamMembersData.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            {teamMembersData.map(({ user, tasksTodayCount, openTasksCount, completedTodayCount, hasSubmitted, statusSummary, submittedAt }) => (
              <div 
                key={user.id}
                className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  {/* User Profile Header */}
                  <div className="flex items-start justify-between border-b border-slate-100 pb-3 mb-4">
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm uppercase shrink-0">
                        {user.name.substring(0, 2)}
                      </div>
                      <div className="truncate">
                        <h3 className="font-bold text-slate-800 truncate leading-snug">{user.name}</h3>
                        <p className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">{user.email}</p>
                      </div>
                    </div>
                    {/* Role Badge */}
                    <span className={`px-2 py-0.5 text-[9px] font-black rounded-md uppercase shrink-0 ${
                      user.role === 'ADMIN' ? 'bg-red-50 text-red-600 border border-red-100' :
                      user.role === 'TL' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                      user.role === 'DEV' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                      'bg-blue-50 text-blue-600 border border-blue-100'
                    }`}>
                      {user.role}
                    </span>
                  </div>

                  {/* Today's Status State */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Today&apos;s Status</p>
                      {hasSubmitted ? (
                        <div className="mt-1.5 space-y-1 bg-green-50/35 border border-green-100/50 p-2.5 rounded-xl">
                          <div className="flex items-center gap-1.5 text-green-700 text-xs font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            <span>Submitted at {new Date(submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-xs text-slate-600 font-medium line-clamp-2 italic leading-relaxed mt-1">
                            &quot;{statusSummary}&quot;
                          </p>
                        </div>
                      ) : (
                        <div className="mt-1.5 py-3 px-4 bg-slate-50 border border-slate-100 rounded-xl text-center text-xs font-semibold text-slate-400 italic">
                          No status submitted today
                        </div>
                      )}
                    </div>

                    {/* Task Progress Summary */}
                    <div className="space-y-1.5 border-t border-slate-100 pt-3">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Task Progress</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-50 border border-slate-100/50 p-2 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Today</span>
                          <span className="text-sm font-black text-slate-800 mt-0.5 block">{tasksTodayCount}</span>
                        </div>
                        <div className="bg-slate-50 border border-slate-100/50 p-2 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block font-sans">Open</span>
                          <span className="text-sm font-black text-slate-800 mt-0.5 block">{openTasksCount}</span>
                        </div>
                        <div className="bg-slate-50 border border-slate-100/50 p-2 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Done</span>
                          <span className="text-sm font-black text-green-600 mt-0.5 block">{completedTodayCount}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Action */}
                <button 
                  onClick={() => setViewingUserId(user.id)}
                  className="w-full mt-4 py-2 bg-slate-50 hover:bg-blue-600 hover:text-white border border-slate-200 hover:border-blue-600 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" /> View Member Dashboard
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Standard Dashboard Cards (My Dashboard or Focused Member Dashboard) */
        <>
          {/* KPI Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <CheckSquare className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Tasks Today</p>
                <h3 className="text-xl font-black text-slate-800 mt-1.5">{metrics.totalToday}</h3>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Open Tasks</p>
                <h3 className="text-xl font-black text-slate-800 mt-1.5">{metrics.openTasks}</h3>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Completed Today</p>
                <h3 className="text-xl font-black text-slate-800 mt-1.5">{metrics.completedToday}</h3>
              </div>
            </div>
          </div>

          {/* Row 1 (Two Equal Columns) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Today's Tasks */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[380px]">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-slate-800">Today&apos;s Tasks</h2>
                    {todayTasks.length > 0 && (
                      <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                        {todayTasks.length}
                      </span>
                    )}
                  </div>
                  <Link 
                    href="/task-board"
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
                  >
                    Go to Board <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                  {todayTasks.map((task: any) => (
                    <div 
                      key={task.id}
                      className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-2xl transition-all duration-200 group"
                    >
                      <div className="space-y-1 truncate pr-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400">T-{task.taskNumber}</span>
                          <h4 className="font-semibold text-slate-700 truncate leading-snug">{task.title}</h4>
                        </div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            {listsMap.get(task.taskListId) || "Task Board"}
                          </span>
                          <span className="w-1 h-1 bg-slate-300 rounded-full" />
                          {getPriorityBadge(task.priority)}
                          <span className="w-1 h-1 bg-slate-300 rounded-full" />
                          {getStatusBadge(task.status)}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleQuickView(task)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-[11px] font-bold rounded-xl shadow-xs hover:bg-slate-50 hover:text-blue-600 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> Quick View
                      </button>
                    </div>
                  ))}

                  {todayTasks.length === 0 && (
                    <div className="py-12 text-center text-slate-400 italic text-sm">
                      No tasks assigned for today.
                    </div>
                  )}
                </div>
              </div>
              
              <div className="border-t border-slate-100 pt-4 mt-4 text-center">
                <Link 
                  href="/task-board" 
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
                >
                  View All Tasks <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Right Column: Today's Status */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm min-h-[380px] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                  <h2 className="text-lg font-black text-slate-800">Today&apos;s Status</h2>
                  <div className="flex items-center gap-2">
                    {todayGroupedStatus ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 px-2.5 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Submitted
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-200 px-2.5 py-0.5 rounded-full">
                        Pending
                      </span>
                    )}
                  </div>
                </div>

                {/* Dynamic Status Display / Form Container */}
                {todayGroupedStatus && !showForm ? (
                  /* Confirmation Screen if Submitted */
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-1.5">
                      {todayGroupedStatus.projects.map(p => (
                        <span key={p.projectId} className="px-2 py-1 bg-slate-900 text-[10px] font-bold text-white rounded-lg uppercase tracking-wider">
                          {p.name} • {p.hours}h
                        </span>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Wins / Highlights</p>
                        <p className="text-sm text-slate-700 font-medium leading-relaxed bg-slate-50/50 p-3 rounded-2xl border border-slate-100 whitespace-pre-wrap">{todayGroupedStatus.workDone}</p>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Next Activities</p>
                        <p className="text-sm text-slate-600 italic font-medium leading-relaxed bg-slate-50/50 p-3 rounded-2xl border border-slate-100 whitespace-pre-wrap">{todayGroupedStatus.plannedWork}</p>
                      </div>

                      {todayGroupedStatus.blockers && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Blockers
                          </p>
                          <p className="text-xs text-red-700 font-bold leading-relaxed bg-red-50/50 p-3 rounded-2xl border border-red-100 whitespace-pre-wrap">{todayGroupedStatus.blockers}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mt-2">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Submitted today at {new Date(todayGroupedStatus.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ) : (
                  /* Submission form or read-only placeholder */
                  viewingUserId ? (
                    <div className="py-12 text-center bg-slate-50 border border-slate-100 rounded-2xl">
                      <p className="text-slate-500 text-sm font-semibold italic">
                        No status submitted today by {selectedUser?.name || "this user"}.
                      </p>
                    </div>
                  ) : (
                    /* Inline Submission / Edit Form */
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {formError && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-xs font-semibold flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>{formError}</span>
                        </div>
                      )}

                      {formSuccess && (
                        <div className="p-3 bg-green-50 border border-green-200 text-green-600 rounded-2xl text-xs font-bold flex items-center gap-2 animate-pulse">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>Status saved successfully!</span>
                        </div>
                      )}

                      {/* Project Selector with checkboxes */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Projects</label>
                        <div className="max-h-[110px] overflow-y-auto border border-slate-200/80 rounded-2xl p-2.5 space-y-1.5 bg-slate-50/50 scrollbar-hide">
                          {projects.map(proj => (
                            <label 
                              key={proj.id}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100/50 rounded-lg cursor-pointer transition-colors select-none text-xs font-semibold text-slate-700"
                            >
                              <input
                                type="checkbox"
                                checked={selectedProjects.includes(proj.id)}
                                onChange={() => toggleProject(proj.id)}
                                className="w-4 h-4 text-blue-600 border-slate-300 rounded-sm focus:ring-blue-500"
                              />
                              <span className="truncate">{proj.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Checked Project Hours Inputs */}
                      {selectedProjects.length > 0 && (
                        <div className="space-y-1.5 border-t border-slate-100 pt-3">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Logged Hours</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {selectedProjects.map(pid => {
                              const proj = projects.find(p => p.id === pid);
                              return (
                                <div key={pid} className="flex items-center justify-between bg-slate-50 px-3 py-2 border border-slate-100 rounded-xl">
                                  <span className="text-xs font-semibold text-slate-600 truncate pr-2">{proj?.name}</span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <input
                                      type="number"
                                      min="0.5"
                                      max="24"
                                      step="0.5"
                                      value={projectHours[pid] || "8"}
                                      onChange={(e) => setProjectHours((prev: Record<string, string>) => ({ ...prev, [pid]: e.target.value }))}
                                      className="w-12 px-1.5 py-0.5 bg-white border border-slate-200 text-xs font-bold text-center rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                    />
                                    <span className="text-[10px] font-bold text-slate-400">h</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Work Done & Planned */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Wins / Work Done</label>
                          <textarea
                            placeholder="What did you finish today?"
                            value={workDone}
                            onChange={(e) => setWorkDone(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 text-xs font-medium text-slate-700 rounded-xl focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all resize-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Planned Work</label>
                          <textarea
                            placeholder="What is planned next?"
                            value={plannedWork}
                            onChange={(e) => setPlannedWork(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 text-xs font-medium text-slate-700 rounded-xl focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all resize-none"
                          />
                        </div>
                      </div>

                      {/* Blockers */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Blockers (Optional)</label>
                        <input
                          placeholder="Are you blocked by anything?"
                          value={blockers}
                          onChange={(e) => setBlockers(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 text-xs font-medium text-slate-700 rounded-xl focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all"
                        />
                      </div>

                      {/* Form Buttons */}
                      <div className="flex gap-2.5 pt-1">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:bg-blue-400 cursor-pointer"
                        >
                          {isSubmitting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>{isEditing ? "Save Changes" : "Submit Status"}</span>
                        </button>
                        {isEditing && (
                          <button
                            type="button"
                            onClick={() => { setShowForm(false); setIsEditing(false); }}
                            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                  )
                )}
              </div>

              {/* Footer Actions */}
              <div className="border-t border-slate-100 pt-4 mt-4 flex items-center justify-between">
                <Link 
                  href="/daily-status" 
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
                >
                  View Status History <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                {!viewingUserId && todayGroupedStatus && !showForm && (
                  <button 
                    onClick={handleEditClick}
                    className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3 text-blue-600" /> Edit Status
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Row 2 (Full Width) - Upcoming Tasks */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-800 border-b border-slate-100 pb-4 mb-4 flex items-center gap-2">
              Upcoming Tasks
              {upcomingTasks.length > 0 && (
                <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  {upcomingTasks.length}
                </span>
              )}
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase font-bold tracking-widest text-slate-400">
                    <th className="pb-3 pr-4">Task</th>
                    <th className="pb-3 px-4">Project</th>
                    <th className="pb-3 px-4">Priority</th>
                    <th className="pb-3 px-4">Status</th>
                    <th className="pb-3 px-4">Due Date</th>
                    <th className="pb-3 pl-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {upcomingTasks.map((task: any) => (
                    <tr key={task.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="py-3.5 pr-4">
                        <div className="flex items-center gap-2 font-semibold text-slate-700 max-w-xs truncate">
                          <span className="text-xs text-slate-400 font-bold shrink-0">T-{task.taskNumber}</span>
                          <span className="truncate">{task.title}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-bold text-slate-500">
                        {listsMap.get(task.taskListId) || "Task Board"}
                      </td>
                      <td className="py-3.5 px-4">
                        {getPriorityBadge(task.priority)}
                      </td>
                      <td className="py-3.5 px-4">
                        {getStatusBadge(task.status)}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-bold text-slate-400">
                        {formatDate(task.dueDate)}
                      </td>
                      <td className="py-3.5 pl-4 text-right">
                        <button 
                          onClick={() => handleQuickView(task)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 hover:text-blue-600 transition-all cursor-pointer shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                      </td>
                    </tr>
                  ))}

                  {upcomingTasks.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 italic text-sm">
                        No upcoming tasks scheduled.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Quick View Drawer / Modal */}
      {activeTask && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[60] flex items-center justify-end animate-in fade-in duration-300"
          onClick={() => setActiveTask(null)}
        >
          <div 
            className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300"
            onClick={e => e.stopPropagation()}
          >
            <div>
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded-md">
                    T-{activeTask.taskNumber}
                  </span>
                  <span className="text-xs font-bold text-slate-400 uppercase">
                    {listsMap.get(activeTask.taskListId) || "Task Board"}
                  </span>
                </div>
                <button 
                  onClick={() => setActiveTask(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Task Content */}
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-black text-slate-800 leading-snug">{activeTask.title}</h3>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {getPriorityBadge(activeTask.priority)}
                    {getStatusBadge(activeTask.status)}
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</h4>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 text-xs font-semibold min-h-[80px] whitespace-pre-wrap leading-relaxed">
                    {activeTask.description || <span className="italic text-slate-400 font-medium">No description provided.</span>}
                  </div>
                </div>

                {/* Checklist Steps */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Checklist Steps</h4>
                  <div className="space-y-2">
                    {activeTask.steps && activeTask.steps.map((step: any) => (
                      <label 
                        key={step.id}
                        className="flex items-start gap-2.5 p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer select-none transition-colors border border-transparent hover:border-slate-100"
                      >
                        <input
                          type="checkbox"
                          checked={step.isCompleted || step.is_completed}
                          onChange={() => handleToggleStep(step.id, step.isCompleted || step.is_completed)}
                          className="mt-0.5 w-4 h-4 text-blue-600 border-slate-300 rounded-sm focus:ring-blue-500"
                        />
                        <span className={`text-xs font-semibold leading-normal ${
                          (step.isCompleted || step.is_completed) ? 'line-through text-slate-400' : 'text-slate-600'
                        }`}>
                          {step.title}
                        </span>
                      </label>
                    ))}
                    {(!activeTask.steps || activeTask.steps.length === 0) && (
                      <p className="text-xs text-slate-400 italic font-medium py-1">No subtasks added.</p>
                    )}
                  </div>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 text-xs font-bold text-slate-500">
                  <div className="space-y-1">
                    <p className="text-[9px] text-slate-400 uppercase tracking-wider">Due Date</p>
                    <div className="flex items-center gap-1.5 text-slate-700 mt-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-500" />
                      <span>{formatDate(activeTask.dueDate || activeTask.due_date)}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] text-slate-400 uppercase tracking-wider">Assignee</p>
                    <div className="flex items-center gap-1.5 text-slate-700 mt-1">
                      <div className="w-4 h-4 rounded-full bg-slate-200 text-[9px] text-slate-600 flex items-center justify-center uppercase font-black font-sans shrink-0">
                        {activeTask.assignedTo ? activeTask.assignedTo.substring(0, 2) : '?'}
                      </div>
                      <span className="truncate">{activeTask.assignedTo || "Unassigned"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-2">
              <button
                onClick={handleToggleTaskStatus}
                disabled={togglingStatus}
                className={`w-full py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTask.status === "Completed"
                    ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    : 'bg-green-600 hover:bg-green-700 text-white shadow-xs'
                }`}
              >
                {togglingStatus ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : activeTask.status === "Completed" ? (
                  <RefreshCw className="w-3.5 h-3.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>
                  {activeTask.status === "Completed" ? "Reopen Task" : "Complete Task"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-xl animate-in slide-in-from-bottom-5 duration-300 ${
          toast.type === "success" 
            ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
            : "bg-red-50 border-red-100 text-red-800"
        }`}>
          {toast.type === "success" ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />}
          <span className="text-sm font-bold">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 p-0.5 hover:bg-black/5 rounded text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
