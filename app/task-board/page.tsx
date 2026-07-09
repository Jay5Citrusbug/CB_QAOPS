"use client";

import { useState, useEffect, useRef, useMemo, useTransition } from "react";
import { getInitials } from "@/lib/utils";
import {
  CheckSquare, Plus, X, Search, ChevronRight, ChevronDown, Check,
  Trash2, User, Calendar, Clock, AlertCircle, FileText, Download,
  Paperclip, Star, RefreshCw, LogIn, Sparkles, Filter, Edit3, ShieldAlert,
  CheckCircle2, Loader2
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/providers/ConfirmProvider";

interface TaskList {
  id: string;
  name: string;
  description: string;
  sharedWith: string[];
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  created_by: string;
}

interface Task {
  id: string;
  taskListId: string;
  taskNumber: number;
  title: string;
  description: string;
  notes?: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  assignedTo: string | null;
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
  completedBy: string | null;
  steps: { id: string; title: string; isCompleted: boolean }[];
}

interface Attachment {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
}

interface Activity {
  id: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  performedBy: string;
  createdAt: string;
}

interface TaskDetails extends Task {
  attachments: Attachment[];
  activities: Activity[];
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
}

const normalizeDate = (val: any): string | null => {
  if (!val) return null;
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof val.toDate === 'function') {
    return val.toDate().toISOString();
  }
  if (typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000).toISOString();
  }
  if (val._seconds !== undefined) {
    return new Date(val._seconds * 1000).toISOString();
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

const formatTaskDueDate = (dateStr: string | null): string => {
  if (!dateStr) return "";
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString();
};

const isTaskOverdue = (dateStr: string | null): boolean => {
  if (!dateStr) return false;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const dueStr = dateStr.split('T')[0];
  return dueStr < todayStr;
};

const normalizeTask = (t: any): Task => {
  let normalizedStatus = t.status || "To Do";
  if (t.status) {
    const s = t.status.toLowerCase();
    if (s === "completed") {
      normalizedStatus = "Completed";
    } else if (s === "to do" || s === "pending") {
      normalizedStatus = "To Do";
    } else {
      normalizedStatus = t.status;
    }
  }
  return {
    id: t.id,
    taskListId: t.taskListId || t.task_list_id,
    taskNumber: t.taskNumber || t.task_number || 1000,
    title: t.title,
    description: t.description || "",
    notes: t.notes || "",
    status: normalizedStatus,
    priority: t.priority || "Medium",
    dueDate: normalizeDate(t.dueDate || t.due_date),
    assignedTo: t.assignedTo || t.assigned_to || null,
    createdBy: t.createdBy || t.created_by,
    createdAt: normalizeDate(t.createdAt || t.created_at) || new Date().toISOString(),
    completedAt: normalizeDate(t.completedAt || t.completed_at),
    completedBy: t.completedBy || t.completed_by || null,
    steps: t.steps || []
  };
};

export default function TaskBoardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const confirm = useConfirm();

  // App States
  const [lists, setLists] = useState<TaskList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskDetails, setTaskDetails] = useState<TaskDetails | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "PENDING" | "COMPLETED" | "OVERDUE" | "TODAY" | "ME">("ALL");

  // Modals & Loaders
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingDrawer, setLoadingDrawer] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // New Form states
  const [newListName, setNewListName] = useState("");
  const [newListDesc, setNewListDesc] = useState("");
  const [newListSharedWith, setNewListSharedWith] = useState<string[]>([]);
  const [listUserSearch, setListUserSearch] = useState("");
  const [showListUserDropdown, setShowListUserDropdown] = useState(false);
  const listUserDropdownRef = useRef<HTMLDivElement>(null);

  const [showEditListModal, setShowEditListModal] = useState(false);
  const [editListName, setEditListName] = useState("");
  const [editListDesc, setEditListDesc] = useState("");
  const [editListSharedWith, setEditListSharedWith] = useState<string[]>([]);
  const [editListUserSearch, setEditListUserSearch] = useState("");
  const [showEditListUserDropdown, setShowEditListUserDropdown] = useState(false);
  const editListUserDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (listUserDropdownRef.current && !listUserDropdownRef.current.contains(e.target as Node)) {
        setShowListUserDropdown(false);
      }
      if (editListUserDropdownRef.current && !editListUserDropdownRef.current.contains(e.target as Node)) {
        setShowEditListUserDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("Medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");

  // Inline add state
  const [fastTaskTitle, setFastTaskTitle] = useState("");
  const [fastTaskDueDate, setFastTaskDueDate] = useState("");

  // Drawer Inline Edit States
  const [drawerNotes, setDrawerNotes] = useState("");
  const [drawerDesc, setDrawerDesc] = useState("");
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingStepTitle, setEditingStepTitle] = useState<string>("");

  // Completed Section Collapse
  const [completedCollapsed, setCompletedCollapsed] = useState(false);

  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userRole = (session?.user as any)?.role || "USER";
  const userEmail = session?.user?.email || "";
  const isQaLead = userRole === "ADMIN" || userRole === "TL";

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Load Lists & Users
  const fetchLists = async (silent = false) => {
    if (!silent) setLoadingLists(true);
    try {
      const res = await fetch(`/api/task-lists?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setLists(data);
        if (data.length > 0 && !selectedListId) {
          setSelectedListId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load task lists", err);
    } finally {
      if (!silent) setLoadingLists(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`/api/users?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Failed to load team users", err);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchLists();
      fetchUsers();
    }
  }, [status]);

  // Load Tasks for Selected List
  const fetchTasks = async (listId: string, silent = false) => {
    if (!silent) setLoadingTasks(true);
    try {
      const res = await fetch(`/api/tasks?taskListId=${listId}&t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.map(normalizeTask));
      }
    } catch (err) {
      console.error("Failed to load tasks", err);
    } finally {
      if (!silent) setLoadingTasks(false);
    }
  };

  useEffect(() => {
    if (selectedListId) {
      fetchTasks(selectedListId);
      setSelectedTaskId(null);
      setTaskDetails(null);
    }
  }, [selectedListId]);

  // Load Single Task Details
  const fetchTaskDetails = async (taskId: string, silent = false) => {
    if (!silent) setLoadingDrawer(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const norm = normalizeTask(data);
        setTaskDetails({
          ...norm,
          attachments: data.attachments || [],
          activities: data.activities || []
        });
        if (document.activeElement?.id !== "taskNotesEditor") {
          setDrawerNotes(norm.notes || "");
        }
        if (document.activeElement?.id !== "taskDescriptionEditor") {
          setDrawerDesc(norm.description || "");
        }
      }
    } catch (err) {
      console.error("Failed to load task details", err);
    } finally {
      if (!silent) setLoadingDrawer(false);
    }
  };

  useEffect(() => {
    if (selectedTaskId) {
      fetchTaskDetails(selectedTaskId);
    } else {
      setTaskDetails(null);
    }
  }, [selectedTaskId]);

  // Create Task List
  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSyncing) return;
    if (!newListName.trim()) return;
    setIsSyncing(true);
    try {
      const res = await fetch("/api/task-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newListName,
          description: newListDesc,
          sharedWith: newListSharedWith
        })
      });
      if (res.ok) {
        const data = await res.json();
        setShowListModal(false);
        setNewListName("");
        setNewListDesc("");
        setNewListSharedWith([]);
        setListUserSearch("");
        setToast({ message: "Task list created successfully!", type: "success" });
        await fetchLists();
        setSelectedListId(data.id);
      } else {
        const data = await res.json();
        setToast({ message: data.error || "Failed to create task list.", type: "error" });
      }
    } catch (err: any) {
      console.error("Failed to create task list", err);
      setToast({ message: err.message || "Failed to create task list.", type: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenEditListModal = () => {
    if (!selectedList) return;
    setEditListName(selectedList.name);
    setEditListDesc(selectedList.description || "");
    setEditListSharedWith(selectedList.sharedWith || []);
    setEditListUserSearch("");
    setShowEditListUserDropdown(false);
    setShowEditListModal(true);
  };

  const handleUpdateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSyncing) return;
    if (!editListName.trim() || !selectedList) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/task-lists/${selectedList.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editListName.trim(),
          description: editListDesc.trim(),
          sharedWith: editListSharedWith
        })
      });
      if (res.ok) {
        setShowEditListModal(false);
        setToast({ message: "Task list updated successfully!", type: "success" });
        await fetchLists(true);
        setLists(prev => prev.map(l => {
          if (l.id === selectedList.id) {
            return {
              ...l,
              name: editListName.trim(),
              description: editListDesc.trim(),
              sharedWith: editListSharedWith
            };
          }
          return l;
        }));
      } else {
        const data = await res.json();
        setToast({ message: data.error || "Failed to update task list.", type: "error" });
      }
    } catch (err: any) {
      console.error("Failed to update task list", err);
      setToast({ message: err.message || "Failed to update task list.", type: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  // Delete Task List
  const handleDeleteList = async (listId: string) => {
    const isConfirmed = await confirm({
      title: "Delete Task List",
      message: "Are you sure you want to delete this list? This will cascadingly delete all tasks and attachments!",
      confirmText: "Delete",
      type: "danger"
    });
    if (!isConfirmed) return;

    const prevLists = [...lists];
    const prevTasks = [...tasks];
    const prevSelectedListId = selectedListId;

    const nextLists = lists.filter(l => l.id !== listId);
    setLists(nextLists);
    setToast({ message: "Task list deleted successfully!", type: "success" });

    let nextSelectedId: string | null = null;
    if (nextLists.length > 0) {
      nextSelectedId = nextLists[0].id;
      setSelectedListId(nextSelectedId);
      fetchTasks(nextSelectedId, true);
    } else {
      setSelectedListId(null);
      setTasks([]);
    }

    try {
      const res = await fetch(`/api/task-lists/${listId}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete task list.");
      }
      // Silently fetch fresh lists to keep in sync
      const listRes = await fetch(`/api/task-lists?t=${Date.now()}`, { cache: 'no-store' });
      if (listRes.ok) {
        const data = await listRes.json();
        setLists(data);
      }
    } catch (err: any) {
      setLists(prevLists);
      setTasks(prevTasks);
      setSelectedListId(prevSelectedListId);
      setToast({ message: err.message || "Failed to delete task list.", type: "error" });
    }
  };

  // Create Task (Detailed Modal)
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSyncing) return;
    if (!newTaskTitle.trim() || !selectedListId) return;
    setIsSyncing(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskTitle,
          taskListId: selectedListId,
          description: newTaskDesc,
          priority: newTaskPriority,
          dueDate: newTaskDueDate || null,
          assignedTo: isQaLead ? (newTaskAssignee || null) : userEmail
        })
      });
      if (res.ok) {
        setShowTaskModal(false);
        setNewTaskTitle("");
        setNewTaskDesc("");
        setNewTaskPriority("Medium");
        setNewTaskDueDate("");
        setNewTaskAssignee("");
        setToast({ message: "Task created successfully!", type: "success" });
        await Promise.all([
          fetchTasks(selectedListId),
          fetchLists(true)
        ]);
      } else {
        const data = await res.json();
        setToast({ message: data.error || "Failed to create task.", type: "error" });
      }
    } catch (err: any) {
      console.error("Failed to create task", err);
      setToast({ message: err.message || "Failed to create task.", type: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  // Create Task (Fast Inline)
  const handleFastCreateTask = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && fastTaskTitle.trim() && selectedListId) {
      const titleText = fastTaskTitle.trim();
      const dueDateVal = fastTaskDueDate ? new Date(fastTaskDueDate).toISOString() : null;
      setFastTaskTitle("");
      setFastTaskDueDate("");

      // Create unique temporary ID
      const tempId = `temp_${Date.now()}`;

      // Generate temporary task number
      const maxNumber = tasks.length > 0 ? Math.max(...tasks.map(t => t.taskNumber || 1000)) : 1000;
      const tempTaskNumber = maxNumber + 1;

      // Create temporary task object
      const tempTask: Task = {
        id: tempId,
        taskListId: selectedListId,
        taskNumber: tempTaskNumber,
        title: titleText,
        description: "",
        status: "To Do",
        priority: "Medium",
        dueDate: dueDateVal,
        assignedTo: isQaLead ? null : userEmail,
        createdBy: userEmail,
        createdAt: new Date().toISOString(),
        completedAt: null,
        completedBy: null,
        steps: []
      };

      // Optimistically prepend new task to tasks list
      setTasks(prev => [tempTask, ...prev]);

      // Optimistically update list metrics in sidebar
      setLists(prevLists => prevLists.map(l => {
        if (l.id === selectedListId) {
          return {
            ...l,
            totalTasks: (l.totalTasks || 0) + 1,
            pendingTasks: (l.pendingTasks || 0) + 1
          };
        }
        return l;
      }));

      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: titleText,
            taskListId: selectedListId,
            priority: "Medium",
            dueDate: dueDateVal,
            assignedTo: isQaLead ? null : userEmail
          })
        });
        if (res.ok) {
          const realTask = await res.json();
          const normalizedRealTask = normalizeTask(realTask);

          // Swap temp task with real task in tasks state
          setTasks(prev => prev.map(t => t.id === tempId ? normalizedRealTask : t));

          // If the user opened the task details drawer before the POST finished, update the selected task states to prevent 404 on subsequent updates
          setSelectedTaskId(prevId => prevId === tempId ? normalizedRealTask.id : prevId);
          setTaskDetails(prevDetails => {
            if (prevDetails && prevDetails.id === tempId) {
              return {
                ...normalizedRealTask,
                attachments: prevDetails.attachments || [],
                activities: prevDetails.activities || []
              };
            }
            return prevDetails;
          });

          setToast({ message: "Task created successfully!", type: "success" });
          fetchLists(true); // Sync sidebar counts silently
        } else {
          // Revert optimistic additions on failure
          setTasks(prev => prev.filter(t => t.id !== tempId));
          fetchLists(true);
          setToast({ message: "Failed to create task.", type: "error" });
        }
      } catch (err: any) {
        console.error("Failed to fast-create task", err);
        setTasks(prev => prev.filter(t => t.id !== tempId));
        fetchLists(true);
        setToast({ message: err.message || "Failed to create task.", type: "error" });
      }
    }
  };

  // Toggle Task Completion Status
  const handleToggleCompletion = async (task: Task) => {
    const isCompleted = task.status === "Completed";
    const nextStatus = isCompleted ? "To Do" : "Completed";

    // Optimistically update tasks state
    setTasks(prev => prev.map(t => {
      if (t.id === task.id) {
        return {
          ...t,
          status: nextStatus,
          completedAt: isCompleted ? null : new Date().toISOString(),
          completedBy: isCompleted ? null : userEmail
        };
      }
      return t;
    }));

    // Optimistically update list metrics in sidebar
    setLists(prevLists => prevLists.map(l => {
      if (l.id === task.taskListId) {
        const change = isCompleted ? 1 : -1;
        return {
          ...l,
          completedTasks: (l.completedTasks || 0) - change,
          pendingTasks: (l.pendingTasks || 0) + change
        };
      }
      return l;
    }));

    const endpoint = isCompleted ? `/api/tasks/${task.id}/reopen` : `/api/tasks/${task.id}/complete`;

    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (res.ok) {
        setToast({
          message: isCompleted ? "Task reopened!" : "Task completed!",
          type: "success"
        });
        await Promise.all([
          fetchTasks(task.taskListId, true),
          fetchLists(true)
        ]);
        if (selectedTaskId === task.id) {
          fetchTaskDetails(task.id);
        }
      } else {
        setToast({ message: "Failed to update task completion status.", type: "error" });
        await Promise.all([
          fetchTasks(task.taskListId, true),
          fetchLists(true)
        ]);
      }
    } catch (err: any) {
      console.error("Failed to toggle completion status", err);
      setToast({ message: err.message || "Failed to update task completion status.", type: "error" });
      await Promise.all([
        fetchTasks(task.taskListId, true),
        fetchLists(true)
      ]);
    }
  };

  const handleInlineUpdateDueDate = async (task: Task, newDueDate: string | null) => {
    setIsSyncing(true);
    // Optimistically update tasks state
    setTasks(prev => prev.map(t => {
      if (t.id === task.id) {
        return { ...t, dueDate: newDueDate };
      }
      return t;
    }));

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: newDueDate })
      });
      if (res.ok) {
        setToast({ message: "Due date updated successfully!", type: "success" });
        await Promise.all([
          fetchTasks(task.taskListId, true),
          fetchLists(true)
        ]);
        if (selectedTaskId === task.id) {
          fetchTaskDetails(task.id);
        }
      } else {
        setToast({ message: "Failed to update due date.", type: "error" });
        await Promise.all([
          fetchTasks(task.taskListId, true),
          fetchLists(true)
        ]);
      }
    } catch (err: any) {
      console.error("Failed to update due date", err);
      setToast({ message: err.message || "Failed to update due date.", type: "error" });
      await Promise.all([
        fetchTasks(task.taskListId, true),
        fetchLists(true)
      ]);
    } finally {
      setIsSyncing(false);
    }
  };

  // Update Task Detail Property
  const handleUpdateTaskDetail = async (updates: Partial<Task>, silent = false) => {
    if (!selectedTaskId || !selectedListId) return;
    setIsSyncing(true);
    // Optimistically update tasks state
    setTasks(prev => prev.map(t => {
      if (t.id === selectedTaskId) {
        return { ...t, ...updates };
      }
      return t;
    }));

    try {
      const res = await fetch(`/api/tasks/${selectedTaskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        setToast({ message: "Task updated successfully!", type: "success" });
        await Promise.all([
          fetchTaskDetails(selectedTaskId, silent),
          fetchTasks(selectedListId, true),
          fetchLists(true)
        ]);
      } else {
        setToast({ message: "Failed to update task.", type: "error" });
        await Promise.all([
          fetchTasks(selectedListId, true),
          fetchLists(true)
        ]);
      }
    } catch (err: any) {
      console.error("Failed to update task detail", err);
      setToast({ message: err.message || "Failed to update task.", type: "error" });
      await Promise.all([
        fetchTasks(selectedListId, true),
        fetchLists(true)
      ]);
    } finally {
      setIsSyncing(false);
    }
  };

  const saveStepEdit = (idx: number) => {
    if (!taskDetails) return;
    if (!editingStepTitle.trim()) {
      setEditingStepId(null);
      return;
    }
    if (editingStepTitle.trim() === taskDetails.steps[idx].title) {
      setEditingStepId(null);
      return;
    }
    const newSteps = [...taskDetails.steps];
    newSteps[idx] = { ...newSteps[idx], title: editingStepTitle.trim() };
    handleUpdateTaskDetail({ steps: newSteps }, true);
    setEditingStepId(null);
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string) => {
    const isConfirmed = await confirm({
      title: "Delete Task",
      message: "Are you sure you want to delete this task? This is irreversible.",
      confirmText: "Delete",
      type: "danger"
    });
    if (!isConfirmed) return;

    const prevTasks = [...tasks];
    const prevLists = [...lists];

    // Optimistically close details drawer
    setSelectedTaskId(null);
    setTaskDetails(null);

    // Optimistically remove task from state
    setTasks(prev => prev.filter(t => t.id !== taskId));

    // Optimistically decrement counts
    const deletedTask = tasks.find(t => t.id === taskId);
    if (deletedTask) {
      setLists(prevLists => prevLists.map(l => {
        if (l.id === deletedTask.taskListId) {
          const isCompleted = deletedTask.status === "Completed";
          return {
            ...l,
            totalTasks: Math.max(0, (l.totalTasks || 0) - 1),
            completedTasks: isCompleted ? Math.max(0, (l.completedTasks || 0) - 1) : (l.completedTasks || 0),
            pendingTasks: !isCompleted ? Math.max(0, (l.pendingTasks || 0) - 1) : (l.pendingTasks || 0)
          };
        }
        return l;
      }));
    }

    setToast({ message: "Task deleted successfully!", type: "success" });

    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task.");
      if (selectedListId) {
        await Promise.all([
          fetchTasks(selectedListId, true),
          fetchLists(true)
        ]);
      }
    } catch (err: any) {
      setTasks(prevTasks);
      setLists(prevLists);
      setToast({ message: err.message || "Failed to delete task.", type: "error" });
    }
  };

  // Add Attachment File
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 5);
    if (files.length === 0 || !selectedTaskId) return;
    setIsSyncing(true);
    let successCount = 0;
    const errors: string[] = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch(`/api/tasks/${selectedTaskId}/attachments`, { method: "POST", body: formData });
        if (res.ok) {
          successCount++;
        } else {
          const data = await res.json();
          errors.push(`${file.name}: ${data.error || "Upload failed."}`);
        }
      } catch (err: any) {
        errors.push(`${file.name}: ${err.message || "Upload failed."}`);
      }
    }
    if (errors.length > 0) {
      setToast({ message: errors[0], type: "error" });
    } else {
      setToast({ message: `${successCount} file(s) uploaded successfully!`, type: "success" });
    }
    await fetchTaskDetails(selectedTaskId);
    setIsSyncing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Delete Attachment
  const handleDeleteAttachment = async (attId: string) => {
    const isConfirmed = await confirm({
      title: "Remove Attachment",
      message: "Are you sure you want to remove this attachment?",
      confirmText: "Remove",
      type: "danger"
    });
    if (!isConfirmed) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/attachments/${attId}`, { method: "DELETE" });
      if (res.ok) {
        setToast({ message: "Attachment removed successfully!", type: "success" });
        if (selectedTaskId) await fetchTaskDetails(selectedTaskId);
      } else {
        setToast({ message: "Failed to remove attachment.", type: "error" });
      }
    } catch (err: any) {
      console.error("Failed to delete attachment", err);
      setToast({ message: err.message || "Failed to remove attachment.", type: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  // Description Editor Markdown helpers
  const handleAddMarkdown = (syntax: string) => {
    const textarea = document.getElementById("taskDescriptionEditor") as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    let inserted = "";
    let newCursorStart = start;
    let newCursorEnd = end;

    if (start === end) {
      // No text selected
      if (syntax === "**") {
        inserted = "**bold text**";
        newCursorStart = start + 2;
        newCursorEnd = start + 11;
      } else if (syntax === "*") {
        inserted = "*italic text*";
        newCursorStart = start + 1;
        newCursorEnd = start + 12;
      } else if (syntax === "- ") {
        const needsNewline = start > 0 && text.charAt(start - 1) !== "\n";
        inserted = needsNewline ? "\n- list item" : "- list item";
        newCursorStart = start + (needsNewline ? 3 : 2);
        newCursorEnd = start + inserted.length;
      } else if (syntax === "1. ") {
        const needsNewline = start > 0 && text.charAt(start - 1) !== "\n";
        inserted = needsNewline ? "\n1. list item" : "1. list item";
        newCursorStart = start + (needsNewline ? 4 : 3);
        newCursorEnd = start + inserted.length;
      } else if (syntax === "[]") {
        inserted = "[link text](url)";
        newCursorStart = start + 1;
        newCursorEnd = start + 10;
      }
    } else {
      // Text is selected
      const selected = text.substring(start, end);
      if (syntax === "**" || syntax === "*") {
        inserted = `${syntax}${selected}${syntax}`;
        newCursorStart = start;
        newCursorEnd = start + inserted.length;
      } else if (syntax === "- ") {
        const needsNewline = start > 0 && text.charAt(start - 1) !== "\n";
        inserted = (needsNewline ? "\n- " : "- ") + selected;
        newCursorStart = start;
        newCursorEnd = start + inserted.length;
      } else if (syntax === "1. ") {
        const needsNewline = start > 0 && text.charAt(start - 1) !== "\n";
        inserted = (needsNewline ? "\n1. " : "1. ") + selected;
        newCursorStart = start;
        newCursorEnd = start + inserted.length;
      } else if (syntax === "[]") {
        inserted = `[${selected}](url)`;
        newCursorStart = start + 1;
        newCursorEnd = start + 1 + selected.length;
      }
    }

    const newText = before + inserted + after;
    setDrawerDesc(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorStart, newCursorEnd);
    }, 0);
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === " ") {
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const text = textarea.value;
      const before = text.substring(0, start);
      const after = text.substring(start);

      const lines = before.split("\n");
      const currentLine = lines[lines.length - 1] || "";
      const trimmed = currentLine.trim();

      if (trimmed === "1") {
        e.preventDefault();
        const indent = currentLine.substring(0, currentLine.length - 1);
        const prefix = before.substring(0, before.length - currentLine.length);
        const newBefore = prefix + indent + "1. ";
        const newText = newBefore + after;
        setDrawerDesc(newText);

        const newCursorPos = newBefore.length;
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
      } else if (trimmed === "-") {
        e.preventDefault();
        const indent = currentLine.substring(0, currentLine.length - 1);
        const prefix = before.substring(0, before.length - currentLine.length);
        const newBefore = prefix + indent + "- ";
        const newText = newBefore + after;
        setDrawerDesc(newText);

        const newCursorPos = newBefore.length;
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
      }
    }
  };

  // Render HTML-like structure from raw description text supporting markdown basics
  const renderRichDescription = (text: string) => {
    if (!text) return <p className="text-slate-400 italic text-sm">No description provided.</p>;

    return text.split('\n').map((line, idx) => {
      // Parse links: [label](url) -> <a href="url">label</a>
      const linkRegex = /\[(.*?)\]\((.*?)\)/g;
      let linkMatch;
      if (line.match(linkRegex)) {
        const parts = [];
        let lastIndex = 0;
        while ((linkMatch = linkRegex.exec(line)) !== null) {
          if (linkMatch.index > lastIndex) {
            parts.push(line.substring(lastIndex, linkMatch.index));
          }
          parts.push(
            <a
              key={linkMatch.index}
              href={linkMatch[2].startsWith("http") ? linkMatch[2] : `https://${linkMatch[2]}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#F46A3A] font-bold hover:underline"
            >
              {linkMatch[1]}
            </a>
          );
          lastIndex = linkRegex.lastIndex;
        }
        if (lastIndex < line.length) {
          parts.push(line.substring(lastIndex));
        }
        return <div key={idx} className="min-h-[1.5rem]">{parts}</div>;
      }

      // Parse bullet points
      if (line.trim().startsWith("- ")) {
        return (
          <li key={idx} className="list-disc ml-5 text-slate-700 text-sm py-0.5">
            {line.replace(/^\s*-\s*/, "")}
          </li>
        );
      }

      // Parse numbered list
      if (/^\s*\d+\.\s*/.test(line)) {
        return (
          <li key={idx} className="list-decimal ml-5 text-slate-700 text-sm py-0.5">
            {line.replace(/^\s*\d+\.\s*/, "")}
          </li>
        );
      }

      // Parse Bold syntax
      const boldRegex = /\*\*(.*?)\*\*/g;
      let boldMatch;
      if (line.match(boldRegex)) {
        const parts = [];
        let lastIndex = 0;
        while ((boldMatch = boldRegex.exec(line)) !== null) {
          if (boldMatch.index > lastIndex) {
            parts.push(line.substring(lastIndex, boldMatch.index));
          }
          parts.push(<strong key={boldMatch.index} className="font-bold text-slate-950">{boldMatch[1]}</strong>);
          lastIndex = boldRegex.lastIndex;
        }
        if (lastIndex < line.length) {
          parts.push(line.substring(lastIndex));
        }
        return <div key={idx} className="min-h-[1.5rem]">{parts}</div>;
      }

      // Parse Italic syntax
      const italicRegex = /\*(.*?)\*/g;
      let italicMatch;
      if (line.match(italicRegex)) {
        const parts = [];
        let lastIndex = 0;
        while ((italicMatch = italicRegex.exec(line)) !== null) {
          if (italicMatch.index > lastIndex) {
            parts.push(line.substring(lastIndex, italicMatch.index));
          }
          parts.push(<em key={italicMatch.index} className="italic text-slate-700">{italicMatch[1]}</em>);
          lastIndex = italicRegex.lastIndex;
        }
        if (lastIndex < line.length) {
          parts.push(line.substring(lastIndex));
        }
        return <div key={idx} className="min-h-[1.5rem]">{parts}</div>;
      }

      return (
        <div key={idx} className="min-h-[1.5rem] text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
          {line}
        </div>
      );
    });
  };

  // Filter Tasks locally based on SearchQuery & active Tab
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // 1. Search Query filter (matches Name, ID, or Description)
      const matchesSearch =
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `T-${t.taskNumber}`.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // 2. Status & Tab Filter
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      switch (activeTab) {
        case "PENDING":
          return t.status !== "Completed" && t.status !== "COMPLETED";
        case "COMPLETED":
          return t.status === "Completed" || t.status === "COMPLETED";
        case "OVERDUE":
          if (t.status === "Completed" || t.status === "COMPLETED" || !t.dueDate) return false;
          return t.dueDate.split('T')[0] < todayStr;
        case "TODAY":
          if (t.status === "Completed" || t.status === "COMPLETED" || !t.dueDate) return false;
          return t.dueDate.split('T')[0] === todayStr;
        case "ME":
          return (t.status !== "Completed" && t.status !== "COMPLETED") && t.assignedTo === userEmail;
        case "ALL":
        default:
          return true;
      }
    });
  }, [tasks, searchQuery, activeTab, userEmail]);

  // Divide filtered tasks into Active and Completed
  const activeTasksList = filteredTasks.filter(t => t.status !== "Completed" && t.status !== "COMPLETED");
  const completedTasksList = filteredTasks.filter(t => t.status === "Completed" || t.status === "COMPLETED");

  const selectedList = lists.find(l => l.id === selectedListId);

  if (status === "loading" || loadingLists) {
    return (
      <div className="flex-1 flex h-full min-h-0 bg-[#F8FAFC] overflow-hidden relative animate-pulse">
        {/* Left Sidebar Skeleton */}
        <div className="w-80 bg-[#F8FAFC] border-r border-slate-200 flex flex-col shrink-0">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="h-4 w-28 bg-slate-200 rounded-md" />
            <div className="h-7 w-7 bg-slate-100 rounded-lg shrink-0" />
          </div>
          <div className="flex-1 px-3 py-3 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-3 bg-white border border-slate-200 rounded-xl">
                <div className="w-10 h-10 bg-slate-200 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-slate-200 rounded-md w-3/4" />
                  <div className="h-3 bg-slate-100 rounded-md w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Skeleton */}
        <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-slate-200 flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="h-7 w-48 bg-slate-200 rounded-md" />
                <div className="h-4 w-96 bg-slate-100 rounded-md" />
              </div>
              <div className="flex items-center gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg h-9 w-20 flex flex-col justify-center" />
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-8 w-20 bg-slate-100 rounded-lg" />
              ))}
            </div>
          </div>

          {/* Action Bar */}
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-3">
            <div className="h-10 bg-slate-100 rounded-xl flex-1" />
            <div className="h-10 w-28 bg-slate-100 rounded-xl" />
          </div>

          {/* Tasks List */}
          <div className="flex-1 p-6 space-y-6 overflow-y-auto">
            {/* Active Tasks Section */}
            <div className="space-y-3">
              <div className="h-4 w-32 bg-slate-200 rounded-md" />
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="h-5 w-5 bg-slate-200 rounded-md shrink-0" />
                      <div className="h-4 bg-slate-200 rounded-md w-1/3" />
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="h-5 w-16 bg-slate-100 rounded-full" />
                      <div className="h-5 w-24 bg-slate-100 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Completed Tasks Section */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="h-4 w-36 bg-slate-100 rounded-md" />
              <div className="space-y-2">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between opacity-60">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="h-5 w-5 bg-slate-100 rounded-md shrink-0" />
                      <div className="h-4 bg-slate-100 rounded-md w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex h-full min-h-0 bg-[#F8FAFC] overflow-hidden relative animate-in fade-in duration-500">
      {(isPending || isSyncing) && (
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#F46A3A] animate-pulse z-[100]" />
      )}

      {/* 1. Left Sidebar: Task Lists Panel */}
      <div className="w-80 bg-[#F8FAFC] border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">My Task Boards</span>
          <button
            onClick={() => setShowListModal(true)}
            className="p-1.5 bg-white hover:bg-[#F46A3A] text-slate-400 hover:text-white border border-slate-200 rounded-lg transition-all cursor-pointer shadow-sm"
            title="Create New List"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* List items */}
        <div className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {lists.map((list) => {
            const completionPercent = list.totalTasks > 0 ? Math.round((list.completedTasks / list.totalTasks) * 100) : 0;
            const isSelected = list.id === selectedListId;

            // Progress SVG constants
            const radius = 18;
            const stroke = 3;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (completionPercent / 100) * circumference;

            return (
              <div
                key={list.id}
                onClick={() => setSelectedListId(list.id)}
                className={`w-full group flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all ${isSelected
                  ? "bg-white border border-slate-200 shadow-sm"
                  : "hover:bg-white hover:border-slate-200 hover:shadow-sm border border-transparent"
                  }`}
              >
                {/* SVG Progress Ring */}
                <div className="relative shrink-0 w-10 h-10 flex items-center justify-center">
                  <svg className="w-10 h-10 -rotate-90">
                    <circle
                      cx="20" cy="20" r={radius}
                      className="text-slate-200 stroke-current"
                      strokeWidth={stroke} fill="transparent"
                    />
                    <circle
                      cx="20" cy="20" r={radius}
                      className="text-[#F46A3A] stroke-current transition-all duration-500"
                      strokeWidth={stroke} fill="transparent"
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                    />
                  </svg>
                  <span className="absolute text-[8px] font-black text-slate-600">{completionPercent}%</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className={`text-sm font-bold truncate ${isSelected ? 'text-[#1D283A]' : 'text-slate-700'}`}>{list.name}</p>
                    {list.sharedWith.length > 0 && (
                      <span className="flex items-center gap-0.5 text-[8px] bg-[#F46A3A]/10 text-[#F46A3A] px-1.5 py-0.5 rounded-full font-black shrink-0">
                        <User className="w-2 h-2" />{list.sharedWith.length + 1}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-400 mt-0.5">
                    <span>{list.pendingTasks} Pending</span>
                    {list.overdueTasks > 0 && (
                      <span className="text-red-500 font-bold">{list.overdueTasks} Overdue</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Create New List CTA when no lists exist */}
          {lists.length === 0 && (
            <button
              onClick={() => setShowListModal(true)}
              className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-[#F46A3A] hover:border-[#F46A3A]/30 transition-all text-xs font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Create New List
            </button>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-white/70 text-center">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">QA Velocity Task Board v2.0</span>
        </div>
      </div>

      {/* 2. Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 bg-white transition-all duration-300 ${selectedTaskId ? "xl:mr-[450px]" : ""}`}>
        {selectedList ? (
          <>
            {/* Header: Title, Search, List Info */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-black text-[#1D283A] truncate max-w-md">{selectedList.name}</h1>
                  {(selectedList.created_by === userEmail || isQaLead || selectedList.sharedWith?.includes(userEmail)) && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={handleOpenEditListModal}
                        className="p-1 text-slate-350 hover:text-[#F46A3A] rounded transition-all cursor-pointer"
                        title="Edit Task Board Details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteList(selectedList.id)}
                        className="p-1 text-slate-300 hover:text-red-500 rounded transition-all shrink-0 cursor-pointer"
                        title="Delete this Task List"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-xs font-semibold text-slate-400 mt-0.5 truncate">{selectedList.description || "No description provided."}</p>
              </div>

              {/* Real-time search */}
              <div className="relative shrink-0 w-56">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl focus:bg-white focus:ring-4 focus:ring-[#F46A3A]/5 focus:border-[#F46A3A]/20 outline-none transition-all"
                />
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="px-6 py-2 border-b border-slate-100 flex gap-1 overflow-x-auto select-none scrollbar-hide">
              {[
                { id: "ALL", label: "All Tasks" },
                { id: "PENDING", label: "Pending" },
                { id: "COMPLETED", label: "Completed" },
                { id: "OVERDUE", label: "Overdue" },
                { id: "TODAY", label: "Due Today" },
                { id: "ME", label: "Assigned to Me" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${activeTab === tab.id
                    ? "bg-[#F46A3A] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tasks list area */}
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
              {loadingTasks ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="w-8 h-8 text-slate-300 animate-spin" />
                </div>
              ) : activeTasksList.length === 0 && completedTasksList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-300">
                  <CheckSquare className="w-16 h-16 text-slate-100" />
                  <p className="text-sm font-semibold text-slate-400">All caught up here!</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Active tasks list */}
                  {activeTasksList.length > 0 && (
                    <div className="space-y-1">
                      {activeTasksList.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTaskId(task.id)}
                          className={`flex items-center gap-4 px-4 py-3.5 bg-white border border-slate-100 rounded-xl cursor-pointer transition-all ${selectedTaskId === task.id ? "bg-[#F46A3A]/5 border-[#F46A3A]/20" : "hover:bg-slate-50/50"
                            }`}
                        >
                          {/* Checkbox */}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleToggleCompletion(task); }}
                            className="w-5 h-5 rounded-full border-2 border-slate-200 hover:border-[#F46A3A] flex items-center justify-center shrink-0 transition-all text-transparent hover:text-[#F46A3A]/40"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[4]" />
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-[#F46A3A] uppercase tracking-wider">T-{task.taskNumber}</span>
                              <p className="text-sm font-bold text-slate-800 truncate">{task.title}</p>
                            </div>

                            <div className="flex items-center gap-3 mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex-wrap">
                              <div
                                className="relative flex items-center gap-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md px-1.5 py-0.5 transition-all text-slate-500 hover:text-slate-700 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const input = e.currentTarget.querySelector('input[type="date"]') as HTMLInputElement | null;
                                  if (input && typeof input.showPicker === 'function') {
                                    try {
                                      input.showPicker();
                                    } catch (err) {
                                      console.error("showPicker failed:", err);
                                    }
                                  }
                                }}
                              >
                                {task.dueDate ? (
                                  <span className={`flex items-center gap-1 ${isTaskOverdue(task.dueDate) ? "text-red-500 font-bold" : ""}`}>
                                    <Calendar className="w-3 h-3" /> Due {formatTaskDueDate(task.dueDate)}
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> No Due Date</span>
                                )}
                                <input
                                  type="date"
                                  value={task.dueDate ? task.dueDate.split('T')[0] : ""}
                                  onChange={async (e) => {
                                    const newDate = e.target.value ? new Date(e.target.value).toISOString() : null;
                                    await handleInlineUpdateDueDate(task, newDate);
                                  }}
                                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                  title="Change due date"
                                />
                                {task.dueDate && (
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      await handleInlineUpdateDueDate(task, null);
                                    }}
                                    className="ml-1 text-slate-400 hover:text-red-500 transition-colors z-10 p-0.5 rounded hover:bg-slate-200 cursor-pointer flex items-center justify-center"
                                    title="Clear due date"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                              <span>&bull;</span>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black ${task.priority === 'Critical' ? 'bg-red-100 text-red-700' :
                                task.priority === 'High' ? 'bg-amber-100 text-amber-700' :
                                  task.priority === 'Medium' ? 'bg-blue-100 text-blue-700' :
                                    'bg-slate-100 text-slate-700'
                                }`}>{task.priority}</span>
                            </div>
                          </div>

                          {/* Assignee initials avatar */}
                          {task.assignedTo ? (
                            <div
                              className="w-7 h-7 rounded-full bg-[#1D283A] text-white flex items-center justify-center text-[10px] font-black uppercase shrink-0 border border-slate-700 shadow-sm"
                              title={`Assigned to ${task.assignedTo}`}
                            >
                              {getInitials(task.assignedTo.includes('@') ? task.assignedTo.split('@')[0].replace(/[\._-]/g, ' ') : task.assignedTo)}
                            </div>
                          ) : (
                            <div
                              className="w-7 h-7 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center shrink-0 border border-slate-200 border-dashed"
                              title="Unassigned"
                            >
                              <User className="w-4.5 h-4.5" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Completed tasks list */}
                  {completedTasksList.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => setCompletedCollapsed(!completedCollapsed)}
                        className="flex items-center gap-1.5 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors ml-1"
                      >
                        {completedCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        Completed ({completedTasksList.length})
                      </button>

                      {!completedCollapsed && (
                        <div className="space-y-1 animate-in fade-in duration-300">
                          {completedTasksList.map((task) => (
                            <div
                              key={task.id}
                              onClick={() => setSelectedTaskId(task.id)}
                              className={`flex items-center gap-4 px-4 py-3 bg-slate-50/50 border border-slate-100 rounded-xl cursor-pointer opacity-65 hover:opacity-90 transition-all ${selectedTaskId === task.id ? "bg-[#F46A3A]/5 border-[#F46A3A]/20" : ""
                                }`}
                            >
                              {/* Completed Checkbox */}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleToggleCompletion(task); }}
                                className="w-5 h-5 rounded-full bg-[#F46A3A] border-2 border-[#F46A3A] text-white flex items-center justify-center shrink-0 transition-all"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[4]" />
                              </button>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider line-through">T-{task.taskNumber}</span>
                                  <p className="text-sm font-semibold text-slate-500 line-through truncate">{task.title}</p>
                                </div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
                                  Completed {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : ""} by {task.completedBy}
                                </span>
                              </div>

                              {task.assignedTo && (
                                <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-black uppercase shrink-0">
                                  {getInitials(task.assignedTo.includes('@') ? task.assignedTo.split('@')[0].replace(/[\._-]/g, ' ') : task.assignedTo)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Fast Inline add task */}
            <div className="px-8 pb-8 pt-4 border-t border-slate-50 bg-white">
              <div className="flex items-center gap-4 p-4 bg-slate-50/70 border border-slate-100 rounded-2xl focus-within:bg-white focus-within:border-[#F46A3A]/30 focus-within:ring-4 focus-within:ring-[#F46A3A]/5 transition-all">
                <button
                  type="button"
                  onClick={() => { setNewTaskAssignee(isQaLead ? "" : userEmail); setShowTaskModal(true); }}
                  className="w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center hover:border-[#F46A3A] hover:bg-[#F46A3A]/5 text-slate-400 hover:text-[#F46A3A] cursor-pointer shrink-0"
                  title="Create task with details"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="text"
                  placeholder="Add a task (Press Enter to publish)..."
                  value={fastTaskTitle}
                  onChange={(e) => setFastTaskTitle(e.target.value)}
                  onKeyDown={handleFastCreateTask}
                  className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-semibold"
                />

                {/* Due Date Picker on Right Side */}
                <div className="flex items-center gap-2 shrink-0">
                  {fastTaskDueDate && (
                    <div className="flex items-center gap-1.5 bg-[#F46A3A]/10 text-[#F46A3A] border border-[#F46A3A]/20 rounded-xl px-2.5 py-1 text-xs font-bold transition-all">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatTaskDueDate(fastTaskDueDate)}</span>
                      <button
                        type="button"
                        onClick={() => setFastTaskDueDate("")}
                        className="hover:text-red-500 font-extrabold ml-0.5 text-xs transition-colors cursor-pointer flex items-center justify-center"
                        title="Clear due date"
                      >
                        <X className="w-3 h-3 stroke-[3]" />
                      </button>
                    </div>
                  )}
                  <div className="relative p-2 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-350 rounded-xl transition-all text-slate-400 hover:text-slate-600 cursor-pointer shadow-xs" title="Set due date">
                    <Calendar className="w-4 h-4" />
                    <input
                      type="date"
                      value={fastTaskDueDate}
                      onChange={(e) => setFastTaskDueDate(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-300">
            <CheckSquare className="w-20 h-20 text-slate-100" />
            <p className="text-sm font-semibold text-slate-400">Select or create a task list to get started.</p>
          </div>
        )}
      </div>

      {/* Backdrop overlay for closing drawer when clicking outside */}
      {selectedTaskId && (
        <div
          className="absolute inset-0 bg-slate-900/15 z-[40] animate-in fade-in duration-300 cursor-pointer"
          onClick={() => setSelectedTaskId(null)}
        />
      )}

      {/* 3. Task Details Drawer Slide Over (450px) */}
      <div
        className={`absolute right-0 top-0 h-full w-[450px] bg-white border-l border-slate-200 shadow-2xl z-[50] transition-transform duration-300 ease-out flex flex-col overflow-hidden ${selectedTaskId ? "translate-x-0" : "translate-x-full"
          }`}
      >
        {loadingDrawer ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <RefreshCw className="w-8 h-8 text-[#F46A3A] animate-spin" />
            <p className="text-xs text-slate-500 font-semibold">Loading task details...</p>
          </div>
        ) : taskDetails ? (
          <div className="h-full flex flex-col">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-100 flex items-start gap-4">
              {/* Task Completion toggle inside header */}
              <button
                type="button"
                onClick={() => handleToggleCompletion(taskDetails)}
                className={`mt-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${taskDetails.status === 'Completed' ? 'bg-[#F46A3A] border-[#F46A3A] text-white' : 'border-slate-300 hover:border-[#F46A3A]'
                  }`}
              >
                <Check className="w-3.5 h-3.5 stroke-[4]" />
              </button>

              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-black text-[#F46A3A] uppercase tracking-widest">T-{taskDetails.taskNumber}</span>
                <textarea
                  defaultValue={taskDetails.title}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value.trim() !== taskDetails.title) {
                      handleUpdateTaskDetail({ title: e.target.value.trim() });
                    }
                  }}
                  rows={2}
                  className={`w-full bg-transparent border-none outline-none text-base font-black text-slate-800 resize-none leading-snug p-0 mt-0.5 ${taskDetails.status === 'Completed' ? 'text-slate-400 line-through' : ''
                    }`}
                />
              </div>

              <button
                onClick={() => setSelectedTaskId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body Scroll */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Task Attributes Panel */}
              <div className="bg-slate-50/50 rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="grid grid-cols-3 gap-2 items-center text-xs">
                  <span className="font-bold text-slate-400 uppercase tracking-wider">Status</span>
                  <span className="col-span-2 font-bold text-slate-800 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${taskDetails.status === 'Completed' ? 'bg-green-500' : 'bg-blue-400'}`} />
                    {taskDetails.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 items-center text-xs">
                  <span className="font-bold text-slate-400 uppercase tracking-wider">Due Date</span>
                  <input
                    type="date"
                    defaultValue={taskDetails.dueDate ? taskDetails.dueDate.split('T')[0] : ""}
                    onChange={(e) => handleUpdateTaskDetail({ dueDate: e.target.value || null })}
                    className="col-span-2 bg-transparent border-none font-bold text-slate-700 outline-none p-0 cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 items-center text-xs">
                  <span className="font-bold text-slate-400 uppercase tracking-wider">Assignee</span>
                  {!isQaLead ? (
                    <span className="col-span-2 font-bold text-slate-700">
                      {taskDetails.assignedTo ? (users.find(u => u.email === taskDetails.assignedTo)?.name || taskDetails.assignedTo.split('@')[0]) : "Unassigned"}
                    </span>
                  ) : (
                    <select
                      value={taskDetails.assignedTo || ""}
                      onChange={(e) => handleUpdateTaskDetail({ assignedTo: e.target.value || null })}
                      className="col-span-2 bg-transparent border-none font-bold text-slate-700 outline-none p-0 cursor-pointer"
                    >
                      <option value="">Unassigned</option>
                      {users.map(u => (
                        <option key={u.id} value={u.email}>{u.name} ({u.email.split('@')[0]})</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 items-center text-xs">
                  <span className="font-bold text-slate-400 uppercase tracking-wider">Priority</span>
                  <select
                    value={taskDetails.priority}
                    onChange={(e) => handleUpdateTaskDetail({ priority: e.target.value })}
                    className="col-span-2 bg-transparent border-none font-bold text-slate-700 outline-none p-0 cursor-pointer"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              {/* Direct Description Editor (Auto-saves on blur) */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Task Description</label>

                <div className="border border-slate-200 rounded-2xl overflow-hidden focus-within:border-[#F46A3A]/40 focus-within:ring-4 focus-within:ring-[#F46A3A]/5 transition-all">
                  {/* Toolbar */}
                  <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 flex gap-1 items-center">
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); handleAddMarkdown("**"); }} className="p-1 hover:bg-slate-200 rounded text-xs font-bold w-6 h-6">B</button>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); handleAddMarkdown("*"); }} className="p-1 hover:bg-slate-200 rounded text-xs italic w-6 h-6">I</button>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); handleAddMarkdown("- "); }} className="p-1 hover:bg-slate-200 rounded text-xs w-6 h-6">•</button>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); handleAddMarkdown("1. "); }} className="p-1 hover:bg-slate-200 rounded text-[10px] w-6 h-6">1.</button>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); handleAddMarkdown("[]"); }} className="p-1 hover:bg-slate-200 rounded text-[10px] w-6 h-6">L</button>
                  </div>
                  <textarea
                    id="taskDescriptionEditor"
                    value={drawerDesc}
                    onChange={(e) => setDrawerDesc(e.target.value)}
                    onKeyDown={handleDescriptionKeyDown}
                    onBlur={() => {
                      if (drawerDesc !== taskDetails.description) {
                        handleUpdateTaskDetail({ description: drawerDesc });
                      }
                    }}
                    placeholder="Support bold **text**, italics *text*, lists, or links."
                    rows={5}
                    className="w-full p-4 bg-slate-50 outline-none text-slate-700 text-sm font-semibold resize-y border-none"
                  />
                </div>
              </div>

              {/* Steps Subtasks section */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Steps / Subtasks</span>
                <div className="space-y-1">
                  {taskDetails.steps.map((step, idx) => (
                    <div key={step.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-all">
                      <div className="flex items-center gap-3 flex-1">
                        <button
                          type="button"
                          onClick={() => {
                            const newSteps = [...taskDetails.steps];
                            newSteps[idx] = { ...step, isCompleted: !step.isCompleted };
                            handleUpdateTaskDetail({ steps: newSteps }, true);
                          }}
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${step.isCompleted ? "bg-[#F46A3A] border-[#F46A3A] text-white" : "border-slate-300"
                            }`}
                        >
                          {step.isCompleted && <Check className="w-2.5 h-2.5" />}
                        </button>
                        {editingStepId === step.id ? (
                          <input
                            type="text"
                            value={editingStepTitle}
                            onChange={(e) => setEditingStepTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                saveStepEdit(idx);
                              } else if (e.key === "Escape") {
                                setEditingStepId(null);
                              }
                            }}
                            onBlur={() => saveStepEdit(idx)}
                            className="bg-transparent border-b border-[#F46A3A]/30 focus:border-[#F46A3A] outline-none text-sm text-slate-800 font-semibold py-0 px-1 w-full max-w-[280px]"
                            autoFocus
                          />
                        ) : (
                          <span
                            onClick={() => {
                              setEditingStepId(step.id);
                              setEditingStepTitle(step.title);
                            }}
                            className={`text-sm font-semibold cursor-pointer hover:text-[#F46A3A] transition-colors ${step.isCompleted ? "text-slate-400 line-through" : "text-slate-700"}`}
                          >
                            {step.title}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newSteps = taskDetails.steps.filter((_, i) => i !== idx);
                          handleUpdateTaskDetail({ steps: newSteps }, true);
                        }}
                        className="p-1 text-slate-300 hover:text-red-500 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 p-2 focus-within:bg-slate-50 rounded-xl transition-all">
                    <Plus className="w-4 h-4 text-[#F46A3A]" />
                    <input
                      type="text"
                      placeholder="Add subtask step..."
                      className="flex-1 bg-transparent border-none outline-none text-sm text-slate-800 placeholder:text-[#F46A3A]/70 font-semibold"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                          const newStep = {
                            id: `step_${Date.now()}`,
                            title: (e.target as HTMLInputElement).value.trim(),
                            isCompleted: false
                          };
                          handleUpdateTaskDetail({ steps: [...taskDetails.steps, newStep] }, true);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val) {
                          const newStep = {
                            id: `step_${Date.now()}`,
                            title: val,
                            isCompleted: false
                          };
                          handleUpdateTaskDetail({ steps: [...taskDetails.steps, newStep] }, true);
                          e.target.value = "";
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Notes Editor (Auto-saves on blur) */}
              <div className="space-y-2 pt-4 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Internal Notes</label>
                <textarea
                  id="taskNotesEditor"
                  placeholder="Draft notes here (Auto-saves on blur)..."
                  value={drawerNotes}
                  onChange={(e) => setDrawerNotes(e.target.value)}
                  onBlur={() => handleUpdateTaskDetail({ notes: drawerNotes })}
                  className="w-full min-h-[100px] p-4 bg-slate-50 rounded-2xl border border-transparent focus:bg-white focus:border-slate-200 outline-none text-slate-700 text-sm font-semibold resize-none transition-all shadow-inner"
                />
              </div>

              {/* Attachments list & upload */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Files & Attachments</span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 text-[10px] font-black text-[#F46A3A] hover:underline cursor-pointer"
                  >
                    <Paperclip className="w-3.5 h-3.5" /> Upload File
                  </button>
                  <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                <div className="space-y-1.5">
                  {taskDetails.attachments.map(att => (
                    <div key={att.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-700 truncate">{att.fileName}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">{Math.round(att.fileSize / 1024)} KB &bull; {att.uploadedBy.split('@')[0]}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <a
                          href={`/api/attachments/${att.id}/download`}
                          className="p-1.5 text-slate-400 hover:text-[#F46A3A] hover:bg-slate-100 rounded-lg transition-all"
                          title="Download attachment"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                          title="Delete attachment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {taskDetails.attachments.length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-2">No attachments uploaded.</p>
                  )}
                </div>
              </div>

              {/* Activity Timeline logs */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Activity Timeline</span>
                <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                  {taskDetails.activities.map(act => (
                    <div key={act.id} className="relative text-xs leading-relaxed">
                      {/* Timeline Dot */}
                      <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-white border-2 border-[#F46A3A] flex items-center justify-center shrink-0 z-10">
                        <div className="w-1.5 h-1.5 bg-[#F46A3A] rounded-full" />
                      </div>
                      <p className="font-bold text-slate-700">
                        {act.action} by <span className="text-slate-900">{act.performedBy.split('@')[0]}</span>
                      </p>
                      {act.newValue && (
                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                          {act.oldValue && `${act.oldValue} → `}{act.newValue}
                        </p>
                      )}
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        {act.createdAt ? new Date(act.createdAt).toLocaleString() : ""}
                      </p>
                    </div>
                  ))}
                  {taskDetails.activities.length === 0 && (
                    <p className="text-xs text-slate-400 italic py-1 pl-1">No activities logged.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer footer actions */}
            <div className="p-6 border-t border-slate-100 flex gap-4 bg-slate-50/50">
              <button
                onClick={() => handleDeleteTask(taskDetails.id)}
                className="flex-1 py-2.5 px-4 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 hover:text-red-700 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
              >
                Delete Task
              </button>
              <button
                onClick={() => handleToggleCompletion(taskDetails)}
                className="flex-1 py-2.5 px-4 bg-[#F46A3A] hover:bg-[#F46A3A]/90 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer text-center"
              >
                {taskDetails.status === "Completed" ? "Reopen Task" : "Mark Completed"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* 4. MODAL: Create New Task List */}
      {showListModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[80] flex items-center justify-center p-6 overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative animate-in zoom-in-95 duration-400">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">Create Task List</h2>
              <button onClick={() => setShowListModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateList} className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 block ml-1">List Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Daily Regression Activities"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 rounded-xl focus:bg-white focus:ring-4 focus:ring-[#F46A3A]/5 focus:border-[#F46A3A]/20 outline-none transition-all shadow-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 block ml-1">Description</label>
                  <textarea
                    placeholder="Describe the purpose of this task board list"
                    value={newListDesc}
                    onChange={(e) => setNewListDesc(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 rounded-xl focus:bg-white focus:ring-4 focus:ring-[#F46A3A]/5 focus:border-[#F46A3A]/20 outline-none transition-all shadow-sm resize-none"
                  />
                </div>
                {/* Shared With - multi-select member picker (excludes DEV) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 block ml-1">Share With Members</label>
                  <p className="text-[10px] text-slate-400 ml-1 -mt-0.5">Only selected members (+ QA Leads) can see this board. DEVs are excluded.</p>

                  {/* Selected member tags */}
                  {newListSharedWith.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-1">
                      {newListSharedWith.map(email => {
                        const u = users.find(x => x.email === email);
                        return (
                          <span key={email} className="flex items-center gap-1 px-2 py-1 bg-[#F46A3A]/10 text-[#F46A3A] text-[10px] font-black rounded-full border border-[#F46A3A]/20">
                            {u?.name || email.split('@')[0]}
                            <button type="button" onClick={() => setNewListSharedWith(prev => prev.filter(e => e !== email))} className="hover:text-red-500 transition-colors">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Searchable dropdown */}
                  <div ref={listUserDropdownRef} className="relative">
                    <div
                      onClick={() => setShowListUserDropdown(true)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 cursor-text focus-within:bg-white focus-within:border-[#F46A3A]/30 focus-within:ring-2 focus-within:ring-[#F46A3A]/10 transition-all"
                    >
                      <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="Search & invite team members..."
                        value={listUserSearch}
                        onChange={e => { setListUserSearch(e.target.value); setShowListUserDropdown(true); }}
                        className="flex-1 bg-transparent outline-none text-xs font-semibold text-slate-700 placeholder:text-slate-400"
                      />
                    </div>

                    {showListUserDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-[90] max-h-44 overflow-y-auto">
                        {users
                          .filter(u =>
                            u.role !== 'DEV' &&
                            u.email !== userEmail &&
                            !newListSharedWith.includes(u.email) &&
                            (u.name.toLowerCase().includes(listUserSearch.toLowerCase()) || u.email.toLowerCase().includes(listUserSearch.toLowerCase()))
                          )
                          .map(u => (
                            <div
                              key={u.id}
                              onClick={() => {
                                setNewListSharedWith(prev => [...prev, u.email]);
                                setListUserSearch("");
                                setShowListUserDropdown(false);
                              }}
                              className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors"
                            >
                              <div className="w-7 h-7 rounded-full bg-[#1D283A] text-white flex items-center justify-center text-[10px] font-black shrink-0">
                                {getInitials(u.name)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate">{u.name}</p>
                                <p className="text-[10px] text-slate-400 truncate">{u.role} · {u.email.split('@')[0]}</p>
                              </div>
                            </div>
                          ))
                        }
                        {users.filter(u => u.role !== 'DEV' && u.email !== userEmail && !newListSharedWith.includes(u.email) && (u.name.toLowerCase().includes(listUserSearch.toLowerCase()) || u.email.toLowerCase().includes(listUserSearch.toLowerCase()))).length === 0 && (
                          <div className="px-4 py-3 text-xs font-bold text-slate-400 text-center">No members found</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-4 pt-4 border-t border-slate-100">
                <button type="button" disabled={isSyncing} onClick={() => setShowListModal(false)} className="flex-1 py-2.5 rounded-xl font-semibold bg-slate-50 hover:bg-slate-100 text-slate-500 text-xs disabled:opacity-50">Discard</button>
                <button type="submit" disabled={isSyncing} className="flex-1 py-2.5 rounded-xl font-bold bg-[#F46A3A] hover:bg-[#F46A3A]/90 text-white text-xs shadow-lg shadow-orange-500/10 flex items-center justify-center gap-1.5 disabled:opacity-50">
                  {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create Board"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4b. MODAL: Edit Task List */}
      {showEditListModal && selectedList && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[80] flex items-center justify-center p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative animate-in zoom-in-95 duration-400">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">Edit Board Details</h2>
              <button onClick={() => setShowEditListModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleUpdateList} className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 block ml-1">List Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Daily Regression Activities"
                    value={editListName}
                    onChange={(e) => setEditListName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 rounded-xl focus:bg-white focus:ring-4 focus:ring-[#F46A3A]/5 focus:border-[#F46A3A]/20 outline-none transition-all shadow-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 block ml-1">Description</label>
                  <textarea
                    placeholder="Describe the purpose of this task board list"
                    value={editListDesc}
                    onChange={(e) => setEditListDesc(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 rounded-xl focus:bg-white focus:ring-4 focus:ring-[#F46A3A]/5 focus:border-[#F46A3A]/20 outline-none transition-all shadow-sm resize-none"
                  />
                </div>
                {/* Shared With - multi-select member picker (excludes DEV) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 block ml-1">Share With Members</label>
                  <p className="text-[10px] text-slate-400 ml-1 -mt-0.5">Only selected members (+ QA Leads) can see this board. DEVs are excluded.</p>

                  {/* Selected member tags */}
                  {editListSharedWith.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-1">
                      {editListSharedWith.map(email => {
                        const u = users.find(x => x.email === email);
                        return (
                          <span key={email} className="flex items-center gap-1 px-2 py-1 bg-[#F46A3A]/10 text-[#F46A3A] text-[10px] font-black rounded-full border border-[#F46A3A]/20">
                            {u?.name || email.split('@')[0]}
                            <button type="button" onClick={() => setEditListSharedWith(prev => prev.filter(e => e !== email))} className="hover:text-red-500 transition-colors cursor-pointer">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Searchable dropdown */}
                  <div ref={editListUserDropdownRef} className="relative">
                    <div
                      onClick={() => setShowEditListUserDropdown(true)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 cursor-text focus-within:bg-white focus-within:border-[#F46A3A]/30 focus-within:ring-2 focus-within:ring-[#F46A3A]/10 transition-all"
                    >
                      <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="Search & invite team members..."
                        value={editListUserSearch}
                        onChange={e => { setEditListUserSearch(e.target.value); setShowEditListUserDropdown(true); }}
                        className="flex-1 bg-transparent outline-none text-xs font-semibold text-slate-700 placeholder:text-slate-400"
                      />
                    </div>

                    {showEditListUserDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-[90] max-h-44 overflow-y-auto">
                        {users
                          .filter(u =>
                            u.role !== 'DEV' &&
                            u.email !== userEmail &&
                            !editListSharedWith.includes(u.email) &&
                            (u.name.toLowerCase().includes(editListUserSearch.toLowerCase()) || u.email.toLowerCase().includes(editListUserSearch.toLowerCase()))
                          )
                          .map(u => (
                            <div
                              key={u.id}
                              onClick={() => {
                                setEditListSharedWith(prev => [...prev, u.email]);
                                setEditListUserSearch("");
                                setShowEditListUserDropdown(false);
                              }}
                              className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors"
                            >
                              <div className="w-7 h-7 rounded-full bg-[#1D283A] text-white flex items-center justify-center text-[10px] font-black shrink-0">
                                {getInitials(u.name)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate">{u.name}</p>
                                <p className="text-[10px] text-slate-400 truncate">{u.role} · {u.email.split('@')[0]}</p>
                              </div>
                            </div>
                          ))
                        }
                        {users.filter(u => u.role !== 'DEV' && u.email !== userEmail && !editListSharedWith.includes(u.email) && (u.name.toLowerCase().includes(editListUserSearch.toLowerCase()) || u.email.toLowerCase().includes(editListUserSearch.toLowerCase()))).length === 0 && (
                          <div className="px-4 py-3 text-xs font-bold text-slate-400 text-center">No members found</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-4 pt-4 border-t border-slate-100">
                <button type="button" disabled={isSyncing} onClick={() => setShowEditListModal(false)} className="flex-1 py-2.5 rounded-xl font-semibold bg-slate-50 hover:bg-slate-100 text-slate-500 text-xs disabled:opacity-50 cursor-pointer">Discard</button>
                <button type="submit" disabled={isSyncing} className="flex-1 py-2.5 rounded-xl font-bold bg-[#F46A3A] hover:bg-[#F46A3A]/90 text-white text-xs shadow-lg shadow-orange-500/10 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer">
                  {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: Detailed Create Task */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[80] flex items-center justify-center p-6 overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl relative animate-in zoom-in-95 duration-400">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">Add New Task</h2>
              <button onClick={() => setShowTaskModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateTask} className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 block ml-1">Task Name *</label>
                  <input
                    type="text"
                    required
                    maxLength={255}
                    placeholder="e.g. Verify Login Validation Messages"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 rounded-xl focus:bg-white focus:ring-4 focus:ring-[#F46A3A]/5 focus:border-[#F46A3A]/20 outline-none transition-all shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 block ml-1">Description</label>
                  <textarea
                    placeholder="Provide details about steps or outcomes"
                    value={newTaskDesc}
                    onChange={(e) => setNewTaskDesc(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 rounded-xl focus:bg-white focus:ring-4 focus:ring-[#F46A3A]/5 focus:border-[#F46A3A]/20 outline-none transition-all shadow-sm resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 block ml-1">Priority</label>
                    <select
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 rounded-xl focus:bg-white focus:ring-4 focus:ring-[#F46A3A]/5 focus:border-[#F46A3A]/20 outline-none transition-all shadow-sm cursor-pointer"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 block ml-1">Due Date</label>
                    <input
                      type="date"
                      value={newTaskDueDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 rounded-xl focus:bg-white focus:ring-4 focus:ring-[#F46A3A]/5 focus:border-[#F46A3A]/20 outline-none transition-all shadow-sm cursor-pointer"
                    />
                  </div>
                </div>

                {!isQaLead ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 block ml-1">Assignee</label>
                    <div className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-500 rounded-xl cursor-not-allowed">
                      Assigned to Me ({session?.user?.name})
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 block ml-1">Assignee</label>
                    <select
                      value={newTaskAssignee}
                      onChange={(e) => setNewTaskAssignee(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 rounded-xl focus:bg-white focus:ring-4 focus:ring-[#F46A3A]/5 focus:border-[#F46A3A]/20 outline-none transition-all shadow-sm cursor-pointer"
                    >
                      <option value="">Unassigned</option>
                      {users.map(u => (
                        <option key={u.id} value={u.email}>{u.name} ({u.email.split('@')[0]})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-100">
                <button type="button" disabled={isSyncing} onClick={() => setShowTaskModal(false)} className="flex-1 py-2.5 rounded-xl font-semibold bg-slate-50 hover:bg-slate-100 text-slate-500 text-xs disabled:opacity-50">Discard</button>
                <button type="submit" disabled={isSyncing} className="flex-1 py-2.5 rounded-xl font-bold bg-[#F46A3A] hover:bg-[#F46A3A]/90 text-white text-xs shadow-lg shadow-orange-500/10 flex items-center justify-center gap-1.5 disabled:opacity-50">
                  {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Publish Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-xl animate-in slide-in-from-bottom-5 duration-300 ${toast.type === "success"
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
