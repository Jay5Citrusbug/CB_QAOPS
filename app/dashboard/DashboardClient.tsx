"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { getInitials } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { addDailyStatus, updateGroupedDailyStatus } from "@/lib/actions";
import { 
  CheckSquare, Calendar, Clock, AlertCircle, PlayCircle, 
  CheckCircle2, ArrowRight, Eye, Plus, Edit2, Loader2, X, AlertTriangle, ChevronRight,
  Check, RefreshCw, Folder, FlaskConical, FileText, BookOpen, History, Star
} from "lucide-react";
import Link from "next/link";

interface DashboardClientProps {
  session: any;
  projects?: Array<{ id: string; name: string; status: string }>;
  taskLists?: Array<{ id: string; name: string; description: string }>;
  allTasks?: any[];
  dailyStatuses?: any[];
  users?: Array<{ id: string; name: string; email: string; role: string }>;
}

export default function DashboardClient({
  session,
  projects: initialProjects,
  taskLists: initialTaskLists,
  allTasks: initialAllTasks,
  dailyStatuses: initialDailyStatuses,
  users: initialUsers = []
}: DashboardClientProps) {
  const router = useRouter();
  const userEmail = session?.user?.email || "";
  const userId = session?.user?.id || "";
  const userRole = session?.user?.role || "USER";
  const isQaLead = userRole === "ADMIN" || userRole === "TL";

  const [projects, setProjects] = useState<any[]>(() => initialProjects || []);
  const [taskLists, setTaskLists] = useState<any[]>(() => initialTaskLists || []);
  const [allTasks, setAllTasks] = useState<any[]>(() => initialAllTasks || []);
  const [dailyStatuses, setDailyStatuses] = useState<any[]>(() => initialDailyStatuses || []);
  const [users, setUsers] = useState<any[]>(() => initialUsers || []);
  const [loadingData, setLoadingData] = useState(() => !initialProjects || initialProjects.length === 0);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch("/api/dashboard?t=" + Date.now(), { cache: 'no-store' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setProjects(data.projects || []);
      setTaskLists(data.taskLists || []);
      setAllTasks(data.allTasks || []);
      setDailyStatuses(data.dailyStatuses || []);
      setUsers(data.users || []);
    } catch (err) {
      console.error("Failed to load dashboard data on client:", err);
    }
  };

  useEffect(() => {
    if (!initialProjects || initialProjects.length === 0) {
      setLoadingData(true);
      fetchDashboardData().finally(() => {
        setLoadingData(false);
      });
    }
  }, [initialProjects]);

  // --- Recent Activity Items (localStorage-backed) ---
  type RecentItem = { id: string; label: string; sub: string; href: string; type: 'project' | 'testcase' | 'projectdoc' | 'qadoc'; visitedAt: number; };
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cb_qops_recent_items');
      if (raw) setRecentItems(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [mounted]);

  // Navigation & Filtering State
  const [activeTab, setActiveTab] = useState<"MY_DASH" | "TEAM_OVERVIEW">("MY_DASH");
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [tasksView, setTasksView] = useState<"PERSONAL" | "TEAM">(isQaLead ? "TEAM" : "PERSONAL");

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

  const lastStatusDateStr = useMemo(() => {
    if (!dailyStatuses || dailyStatuses.length === 0) return null;
    
    // Convert all status dates to YYYY-MM-DD format
    const dates = dailyStatuses
      .map(s => {
        if (!s.date) return "";
        if (s.date.includes('T')) {
          const [datePart, timePart] = s.date.split('T');
          if (timePart.startsWith('00:00:00')) {
            return datePart;
          } else {
            const d = new Date(s.date);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          }
        }
        return s.date;
      })
      .filter(dateStr => dateStr && dateStr < todayStr); // only dates strictly before today
      
    if (dates.length === 0) return null;
    
    // Sort in descending order to get the most recent date
    dates.sort((a, b) => b.localeCompare(a));
    return dates[0];
  }, [dailyStatuses, todayStr]);

  const yesterdayStr = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return getLocalDateString(yesterday);
  }, []);

  const targetDateStr = lastStatusDateStr || yesterdayStr;

  // Check if dates represent the same local calendar day (timezone-safe)
  const isSameDay = (d1Str: string, d2Str: string) => {
    if (!d1Str || !d2Str) return false;
    if (d1Str.includes('T')) {
      const [datePart, timePart] = d1Str.split('T');
      if (timePart.startsWith('00:00:00')) {
        return datePart === d2Str;
      } else {
        const d1 = new Date(d1Str);
        const year = d1.getFullYear();
        const month = String(d1.getMonth() + 1).padStart(2, '0');
        const day = String(d1.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}` === d2Str;
      }
    }
    return d1Str === d2Str;
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

  // 2. Filter tasks based on selected view (Personal vs Team)
  const currentViewTasks = useMemo(() => {
    if (viewingUserId) {
      // Always show that user's tasks when inspecting their dashboard
      return allTasks.filter(t => t.assignedTo === targetUserEmail || t.createdBy === targetUserEmail || t.user_id === targetUserId);
    }
    if (tasksView === "TEAM" && isQaLead) {
      // Show all tasks across all users
      return allTasks;
    }
    // Default: Show logged in user's personal tasks
    return allTasks.filter(t => t.assignedTo === targetUserEmail || t.createdBy === targetUserEmail || t.user_id === targetUserId);
  }, [allTasks, tasksView, viewingUserId, targetUserEmail, targetUserId, isQaLead]);

  // 3. Map Task List ID to Names
  const listsMap = useMemo(() => {
    return new Map(taskLists.map(l => [l.id, l.name]));
  }, [taskLists]);

  // 4. Today's Tasks
  const todayTasks = useMemo(() => {
    return currentViewTasks.filter(t => t.dueDate && isSameDay(t.dueDate, todayStr));
  }, [currentViewTasks, todayStr]);

  // 5. Upcoming Tasks (Due tomorrow and beyond, not completed)
  const upcomingTasks = useMemo(() => {
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    const list = currentViewTasks.filter(t => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d > todayEnd && t.status !== 'Completed';
    });
    
    // Sort closest due date first
    return [...list].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [currentViewTasks]);

  // 6. Metrics
  const metrics = useMemo(() => {
    const totalToday = todayTasks.length;
    const openTasks = currentViewTasks.filter(t => t.status !== 'Completed' && t.status !== 'COMPLETED').length;
    const inProgress = currentViewTasks.filter(t => t.status === 'In Progress').length;
    
    // Completed today
    const completedToday = currentViewTasks.filter(t => {
      return (t.status === 'Completed' || t.status === 'COMPLETED') && t.completedAt && isSameDay(t.completedAt, todayStr);
    }).length;

    return { totalToday, openTasks, inProgress, completedToday };
  }, [currentViewTasks, todayTasks, todayStr]);

  // 7. Team Overview calculation (only evaluated for QA Leads)
  const teamMembersData = useMemo(() => {
    if (!isQaLead || !users || users.length === 0) return [];
    
    // Keep only QA Engineer role (USER), exclude DEV, TL, and ADMIN
    const qaUsers = users.filter(u => u.role === 'USER');
    
    return qaUsers.map(u => {
      const uTasks = allTasks.filter(t => t.assignedTo === u.email || t.createdBy === u.email || t.user_id === u.id);
      
      const uTodayTasks = uTasks.filter(t => t.dueDate && isSameDay(t.dueDate, todayStr));
      const tasksTodayCount = uTodayTasks.length;
      
      const openTasksCount = uTasks.filter(t => t.status !== 'Completed' && t.status !== 'COMPLETED').length;
      
      const completedTodayCount = uTasks.filter(t => {
        return t.status === 'Completed' && t.completedAt && isSameDay(t.completedAt, todayStr);
      }).length;
      
      const uLastStatuses = dailyStatuses.filter(s => s.date && isSameDay(s.date, targetDateStr) && (s.userId === u.id || s.user_id === u.id));
      const hasSubmitted = uLastStatuses.length > 0;
      
      let statusSummary = "";
      let submittedAt = "";
      if (hasSubmitted) {
        statusSummary = uLastStatuses[0].workDone || uLastStatuses[0].work_done || "";
        submittedAt = uLastStatuses[0].createdAt || uLastStatuses[0].created_at || "";
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
  }, [isQaLead, users, allTasks, dailyStatuses, todayStr, targetDateStr]);

  // 8. Team status submissions list (for Last Day's Status card on Team Dashboard)
  const teamStatusSubmissions = useMemo(() => {
    if (!users || users.length === 0) return [];
    
    // Keep only QA Engineers (USER)
    const qaUsers = users.filter(u => u.role === 'USER');
    
    return qaUsers.map(u => {
      const uLastStatuses = dailyStatuses.filter(s => s.date && isSameDay(s.date, targetDateStr) && (s.userId === u.id || s.user_id === u.id));
      const hasSubmitted = uLastStatuses.length > 0;
      
      let workDone = "";
      let submittedAt = "";
      if (hasSubmitted) {
        workDone = uLastStatuses[0].workDone || uLastStatuses[0].work_done || "";
        submittedAt = uLastStatuses[0].createdAt || uLastStatuses[0].created_at || "";
      }
      
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        hasSubmitted,
        workDone,
        submittedAt
      };
    });
  }, [users, dailyStatuses, targetDateStr]);

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
        await fetchDashboardData();
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
        await fetchDashboardData();
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
        await fetchDashboardData();
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

  // Format Date String nicely (timezone-safe for date-only UTC representations)
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    if (dateStr.includes('T')) {
      const [datePart, timePart] = dateStr.split('T');
      if (timePart.startsWith('00:00:00')) {
        const parts = datePart.split('-');
        if (parts.length === 3) {
          const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
        }
      }
    }
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };

  // Resolve assignee name from email or format email prefix nicely
  const getAssigneeName = (assignedToEmail: string | null) => {
    if (!assignedToEmail) return "Unassigned";
    const user = (users || []).find(u => u.email === assignedToEmail);
    if (user && user.name) return user.name;
    const prefix = assignedToEmail.split('@')[0];
    return prefix
      .split(/[\._-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="space-y-6 relative">
      {mounted && typeof window !== "undefined" && (togglingStatus || isSubmitting)
        ? createPortal(
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[9999] flex items-center justify-center animate-in fade-in duration-300">
              <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-3xl border border-slate-100 shadow-2xl animate-in scale-in duration-200">
                <Loader2 className="w-10 h-10 text-[#ed5c37] animate-spin" />
                <p className="text-xs text-slate-500 font-bold animate-pulse">Syncing dashboard data...</p>
              </div>
            </div>,
            document.body
          )
        : null}
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

      {loadingData ? (
        <DashboardSkeleton />
      ) : (
        <>
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
                        {getInitials(user.name)}
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

                  {/* Last Day Status State */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Last Day Status</p>
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
                          No status submitted
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
          {/* Tasks Scope Toggle */}
          {!viewingUserId && isQaLead && (
            <div className="flex justify-between items-center bg-slate-100/80 border border-slate-200/50 p-1 rounded-2xl w-fit gap-1 select-none animate-in fade-in duration-300">
              <button
                type="button"
                onClick={() => setTasksView("PERSONAL")}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  tasksView === "PERSONAL"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                My Personal Tasks
              </button>
              <button
                type="button"
                onClick={() => setTasksView("TEAM")}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  tasksView === "TEAM"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Team Tasks (All Users)
              </button>
            </div>
          )}

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
                    <h2 className="text-lg font-black text-slate-800">
                      {tasksView === "TEAM" && !viewingUserId ? "Today's Team Tasks" : "Today's Tasks"}
                    </h2>
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
                          <span className="w-1 h-1 bg-slate-300 rounded-full" />
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <span className="text-slate-400 font-semibold uppercase text-[8px] tracking-wider">Owner:</span>
                            <span className="font-bold text-slate-700">{getAssigneeName(task.assignedTo)}</span>
                          </span>
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
                      {tasksView === "TEAM" && !viewingUserId ? "No team tasks scheduled for today." : "No tasks assigned for today."}
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

            {/* Right Column: Upcoming Tasks */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[380px]">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-slate-800">
                      {tasksView === "TEAM" && !viewingUserId ? "Upcoming Team Tasks" : "Upcoming Tasks"}
                    </h2>
                    {upcomingTasks.length > 0 && (
                      <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">
                        {upcomingTasks.length}
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
                  {upcomingTasks.map((task: any) => (
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
                          <span className="text-[10px] font-bold text-slate-400">
                            Due {formatDate(task.dueDate)}
                          </span>
                          <span className="w-1 h-1 bg-slate-300 rounded-full" />
                          {getPriorityBadge(task.priority)}
                          <span className="w-1 h-1 bg-slate-300 rounded-full" />
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <span className="text-slate-400 font-semibold uppercase text-[8px] tracking-wider">Owner:</span>
                            <span className="font-bold text-slate-700">{getAssigneeName(task.assignedTo)}</span>
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleQuickView(task)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 text-slate-650 text-[11px] font-bold rounded-xl shadow-xs hover:bg-slate-50 hover:text-blue-600 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                    </div>
                  ))}

                  {upcomingTasks.length === 0 && (
                    <div className="py-12 text-center text-slate-400 italic text-sm">
                      {tasksView === "TEAM" && !viewingUserId ? "No upcoming team tasks scheduled." : "No upcoming tasks scheduled."}
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
          </div>


          {/* Row 2 (Full Width) - Quick Access / Recent Activity */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">

            {/* Section Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#ed5c37]/10 flex items-center justify-center">
                  <History className="w-4 h-4 text-[#ed5c37]" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-800 leading-none">Quick Access</h2>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Recently visited items across the portal</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/daily-status" className="text-xs font-bold text-slate-500 hover:text-[#ed5c37] flex items-center gap-1 transition-colors">
                  <Clock className="w-3.5 h-3.5" /> Daily Status
                </Link>
                <span className="text-slate-200">|</span>
                <Link href="/task-board" className="text-xs font-bold text-slate-500 hover:text-[#ed5c37] flex items-center gap-1 transition-colors">
                  <CheckSquare className="w-3.5 h-3.5" /> Task Board
                </Link>
                <span className="text-slate-200">|</span>
                <Link href="/test-cases" className="text-xs font-bold text-slate-500 hover:text-[#ed5c37] flex items-center gap-1 transition-colors">
                  <FlaskConical className="w-3.5 h-3.5" /> Test Cases
                </Link>
                <span className="text-slate-200">|</span>
                <Link href="/project-docs" className="text-xs font-bold text-slate-500 hover:text-[#ed5c37] flex items-center gap-1 transition-colors">
                  <FileText className="w-3.5 h-3.5" /> Project Docs
                </Link>
              </div>
            </div>

            {recentItems.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {recentItems
                  .sort((a, b) => b.visitedAt - a.visitedAt)
                  .slice(0, 10)
                  .map((item) => {
                    const iconMap = {
                      project: <Folder className="w-5 h-5" />,
                      testcase: <FlaskConical className="w-5 h-5" />,
                      projectdoc: <FileText className="w-5 h-5" />,
                      qadoc: <BookOpen className="w-5 h-5" />,
                    };
                    const colorMap = {
                      project:    { bg: 'bg-blue-50',   icon: 'bg-blue-100 text-blue-600',   border: 'border-blue-100',   badge: 'bg-blue-100 text-blue-700' },
                      testcase:   { bg: 'bg-violet-50', icon: 'bg-violet-100 text-violet-600', border: 'border-violet-100', badge: 'bg-violet-100 text-violet-700' },
                      projectdoc: { bg: 'bg-emerald-50',icon: 'bg-emerald-100 text-emerald-600',border: 'border-emerald-100',badge: 'bg-emerald-100 text-emerald-700' },
                      qadoc:      { bg: 'bg-amber-50',  icon: 'bg-amber-100 text-amber-600',  border: 'border-amber-100',  badge: 'bg-amber-100 text-amber-700' },
                    };
                    const colors = colorMap[item.type];
                    const labelMap = { project: 'Project', testcase: 'Test Cases', projectdoc: 'Project Docs', qadoc: 'QA Docs' };
                    const minutesAgo = Math.round((Date.now() - item.visitedAt) / 60000);
                    const timeLabel = minutesAgo < 1 ? 'Just now' : minutesAgo < 60 ? `${minutesAgo}m ago` : minutesAgo < 1440 ? `${Math.round(minutesAgo / 60)}h ago` : `${Math.round(minutesAgo / 1440)}d ago`;
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        className={`group flex flex-col gap-3 p-4 rounded-2xl border ${colors.border} ${colors.bg} hover:shadow-md hover:scale-[1.02] transition-all duration-200`}
                      >
                        <div className="flex items-center justify-between">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colors.icon}`}>
                            {iconMap[item.type]}
                          </div>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>{labelMap[item.type]}</span>
                        </div>
                        <div>
                          <span className="text-xs font-black text-slate-800 leading-tight block line-clamp-2 group-hover:text-[#ed5c37] transition-colors">{item.label}</span>
                          {item.sub && <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block truncate">{item.sub}</span>}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                          <Clock className="w-3 h-3" />
                          {timeLabel}
                        </div>
                      </Link>
                    );
                  })}
              </div>
            ) : (
              /* Empty state - show shortcut cards to all sections */
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Daily Status', desc: 'View status submission history', href: '/daily-status', icon: <Clock className="w-6 h-6" />, bg: 'bg-blue-50', icon_bg: 'bg-blue-100 text-blue-600', border: 'border-blue-100' },
                  { label: 'Task Board', desc: 'Manage checklists and tasks', href: '/task-board', icon: <CheckSquare className="w-6 h-6" />, bg: 'bg-violet-50', icon_bg: 'bg-violet-100 text-violet-600', border: 'border-violet-100' },
                  { label: 'Test Cases', desc: 'Manage test suites and coverage', href: '/test-cases', icon: <FlaskConical className="w-6 h-6" />, bg: 'bg-emerald-50', icon_bg: 'bg-emerald-100 text-emerald-600', border: 'border-emerald-100' },
                  { label: 'Project Docs', desc: 'View project documentation', href: '/project-docs', icon: <FileText className="w-6 h-6" />, bg: 'bg-amber-50', icon_bg: 'bg-amber-100 text-amber-600', border: 'border-amber-100' },
                ].map(item => (
                  <Link key={item.href} href={item.href} className={`group flex flex-col gap-3 p-5 rounded-2xl border ${item.border} ${item.bg} hover:shadow-md hover:scale-[1.02] transition-all duration-200`}>
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${item.icon_bg}`}>{item.icon}</div>
                    <div>
                      <span className="text-sm font-black text-slate-800 group-hover:text-[#ed5c37] transition-colors block">{item.label}</span>
                      <span className="text-[10px] text-slate-500 font-semibold mt-0.5 block">{item.desc}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                      Open <ArrowRight className="w-3 h-3" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Last Day Status — only shown for QA Lead / Admin */}
          {isQaLead && !viewingUserId && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            {(
              /* Team Status Submissions Grid for QA Lead */
              <>
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-slate-800">Last Day Status</h2>
                    {targetDateStr && (
                      <span className="text-xs font-bold text-slate-400 bg-slate-100 border border-slate-200/50 px-2.5 py-0.5 rounded-md">
                        {new Date(targetDateStr + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                      {teamStatusSubmissions.filter(s => s.hasSubmitted).length}/{teamStatusSubmissions.length} Submitted
                    </span>
                  </div>
                  <Link 
                    href="/daily-status" 
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                  >
                    View Status History <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto py-1 pr-1">
                  {teamStatusSubmissions.map((member) => (
                    <div key={member.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col justify-between gap-3 hover:border-slate-200 hover:shadow-xs transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 truncate">
                          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                            {getInitials(member.name)}
                          </div>
                          <div className="truncate">
                            <span className="text-xs font-bold text-slate-800 block truncate leading-tight">{member.name}</span>
                            <span className="text-[10px] font-semibold text-slate-400 block truncate mt-0.5 leading-none">{member.email}</span>
                          </div>
                        </div>

                        {member.hasSubmitted ? (
                          <span className="flex items-center gap-1 text-[9px] font-bold bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-md shrink-0">
                            <Check className="w-2.5 h-2.5" /> {new Date(member.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[9px] font-bold bg-red-50 text-red-655 border border-red-100 px-2 py-0.5 rounded-md shrink-0">
                            <X className="w-2.5 h-2.5" /> Not Submitted
                          </span>
                        )}
                      </div>

                      {member.hasSubmitted && member.workDone ? (
                        <div className="text-xs text-slate-600 bg-white/80 border border-slate-100/55 p-3 rounded-xl italic font-medium leading-relaxed max-h-[80px] overflow-y-auto scrollbar-hide">
                          "{member.workDone}"
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic font-semibold py-4 text-center">
                          No status submitted
                        </div>
                      )}
                    </div>
                  ))}


                  {teamStatusSubmissions.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-400 italic text-sm">
                      No team members found.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          )}
        </>
      )}
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
                        {activeTask.assignedTo ? getInitials(getAssigneeName(activeTask.assignedTo)) : '?'}
                      </div>
                      <span className="truncate" title={activeTask.assignedTo || "Unassigned"}>
                        {activeTask.assignedTo ? getAssigneeName(activeTask.assignedTo) : "Unassigned"}
                      </span>
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

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Skeletons for KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-4 animate-pulse">
            <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-2 bg-slate-200 rounded w-16" />
              <div className="h-4 bg-slate-200 rounded w-8" />
            </div>
          </div>
        ))}
      </div>

      {/* Skeletons for Row 1 (Two Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm min-h-[380px] flex flex-col justify-between animate-pulse">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="h-4 bg-slate-200 rounded w-32" />
              <div className="h-3 bg-slate-100 rounded w-16" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map(idx => (
                <div key={idx} className="h-16 bg-slate-50 border border-slate-100 rounded-2xl" />
              ))}
            </div>
          </div>
          <div className="h-8 bg-slate-50 rounded-xl w-24 mx-auto" />
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm min-h-[380px] flex flex-col justify-between animate-pulse">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="h-4 bg-slate-200 rounded w-32" />
              <div className="h-3 bg-slate-100 rounded w-16" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map(idx => (
                <div key={idx} className="h-16 bg-slate-50 border border-slate-100 rounded-2xl" />
              ))}
            </div>
          </div>
          <div className="h-8 bg-slate-50 rounded-xl w-24 mx-auto" />
        </div>
      </div>

      {/* Skeleton for Quick Access */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm animate-pulse space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-100 shrink-0" />
            <div className="space-y-1.5">
              <div className="h-3 bg-slate-200 rounded w-24" />
              <div className="h-2 bg-slate-100 rounded w-32" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(idx => (
            <div key={idx} className="h-24 bg-slate-50 border border-slate-100 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
