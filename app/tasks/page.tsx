"use client";

import { useState, useEffect, useRef } from "react";
import { 
  createTask, 
  updateTask, 
  deleteTask, 
  toggleTaskStatus, 
  addTaskStep, 
  toggleTaskStep, 
  deleteTaskStep 
} from "@/lib/actions";
import { 
  CheckCircle2, Circle, Clock, Calendar, Trash2, Plus, X, Search, 
  Star, Sun, Bell, Repeat, Paperclip, ChevronRight, MoreHorizontal, 
  Home, List, User as UserIcon, Check, AlertCircle, LayoutGrid
} from "lucide-react";
import { useSession } from "next-auth/react";

interface TaskStep {
  id: string;
  title: string;
  isCompleted: boolean;
}

interface Task {
  id: string;
  title: string;
  status: string;
  isImportant: boolean;
  myDay: boolean;
  notes: string | null;
  dueDate: string | null;
  remindAt: string | null;
  repeat: string | null;
  steps: TaskStep[];
  userId: string;
  createdAt: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const fetchTasks = async (userId?: string) => {
    setRefreshing(true);
    try {
      const url = userId ? `/api/tasks?userId=${userId}` : "/api/tasks";
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setTasks(data);
        setError(null);
      } else {
        setError(data.error || "Failed to load tasks");
      }
    } catch (err) {
      console.error("Failed to fetch tasks", err);
      setError("Unable to connect to the server.");
    } finally {
      setRefreshing(false);
    }
  };

  const fetchUsers = async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  useEffect(() => {
    fetchTasks();
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  const handleCreateTask = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && newTaskTitle.trim()) {
      setLoading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("title", newTaskTitle);
        const res = await createTask(formData, activeUserId || undefined);
        if (res && (res as any).error) {
          setError((res as any).error);
        } else {
          setNewTaskTitle("");
          fetchTasks(activeUserId || undefined);
        }
      } catch (err) {
        console.error("Creation failed", err);
        setError("Failed to create task. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleToggleImportance = async (task: Task) => {
    await updateTask(task.id, { isImportant: !task.isImportant });
    fetchTasks(activeUserId || undefined);
  };

  const handleToggleStatus = async (task: Task) => {
    await toggleTaskStatus(task.id, task.status);
    fetchTasks(activeUserId || undefined);
  };

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  return (
    <div className="flex h-[calc(100vh-12rem)] bg-white rounded-2xl border border-slate-200 overflow-hidden relative group/page shadow-sm animate-in fade-in duration-500">
      {/* Sidebar - If Admin, show user list */}
      {isAdmin && (
        <div className="w-64 border-r border-slate-100 bg-slate-50/50 p-6 hidden md:block overflow-y-auto custom-scrollbar">
           <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6 px-2">Team Directory</h2>
           <div className="space-y-1">
              <button 
                onClick={() => { setActiveUserId(null); fetchTasks(); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${!activeUserId ? 'bg-[#ed5c37]/10 text-[#ed5c37]' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="text-sm font-semibold">Global View</span>
              </button>
              {users.map(u => (
                <button 
                  key={u.id}
                  onClick={() => { setActiveUserId(u.id); fetchTasks(u.id); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${activeUserId === u.id ? 'bg-[#ed5c37]/10 text-[#ed5c37]' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                >
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold uppercase transition-colors ${activeUserId === u.id ? 'bg-[#ed5c37] text-white' : 'bg-slate-200 text-slate-500'}`}>{u.name.substring(0,2)}</div>
                  <span className="text-sm font-semibold truncate">{u.name}</span>
                </button>
              ))}
           </div>
        </div>
      )}

      {/* Main List Area */}
      <div className={`flex-1 flex flex-col min-w-0 bg-white transition-all duration-300 ${selectedTaskId ? 'md:mr-96' : ''}`}>
        <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="p-2 bg-[#ed5c37]/10 rounded-xl">
                 <Home className="w-5 h-5 text-[#ed5c37]" />
              </div>
              <div>
                 <h1 className="text-xl font-bold text-slate-900 tracking-tight">Tasks</h1>
                 {activeUserId && (
                   <p className="text-[10px] font-bold text-[#ed5c37] uppercase tracking-wider mt-0.5">
                     Viewing {users.find(u => u.id === activeUserId)?.name}
                   </p>
                 )}
              </div>
           </div>
           <div className="flex items-center gap-1">
              {/* Removed buttons as requested */}
           </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mx-8 mt-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-xs font-semibold animate-shake">
             <AlertCircle className="w-4 h-4 shrink-0" />
             {error}
          </div>
        )}

        {/* Tasks List */}
        <div className="flex-1 overflow-y-auto px-8 py-4 space-y-1 custom-scrollbar">
          {refreshing && tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-200">
               <div className="w-8 h-8 border-3 border-current border-t-[#ed5c37] rounded-full animate-spin" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 px-12 text-center">
               <div className="relative">
                  <CheckCircle2 className="w-20 h-20 text-slate-100" />
                  <div className="absolute inset-0 flex items-center justify-center">
                     <Plus className="w-6 h-6 text-slate-300 animate-pulse" />
                  </div>
               </div>
               <div className="space-y-1">
                  <p className="text-lg font-bold text-slate-900">Focus on your day</p>
                  <p className="text-sm text-slate-500 max-w-xs">Get things done with Tasks. Add a new task below to get started.</p>
               </div>
            </div>
          ) : (
            tasks.map((task) => (
              <div 
                key={task.id} 
                onClick={() => setSelectedTaskId(task.id)}
                className={`group flex items-center gap-4 p-3.5 rounded-xl transition-all cursor-pointer border-b border-slate-50 ${selectedTaskId === task.id ? 'bg-[#ed5c37]/5' : 'hover:bg-slate-50/80'}`}
              >
                <button 
                  onClick={(e) => { e.stopPropagation(); handleToggleStatus(task); }}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${task.status === 'COMPLETED' ? 'bg-[#ed5c37] border-[#ed5c37] text-white' : 'border-slate-200 text-transparent hover:border-[#ed5c37]'}`}
                >
                  <Check className="w-3 h-3 stroke-[4]" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${task.status === 'COMPLETED' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{task.title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                     <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> No Due Date</span>
                     {task.steps.length > 0 && (
                       <span className="text-[9px] font-bold text-[#ed5c37] uppercase tracking-wider">
                         {task.steps.filter(s => s.isCompleted).length} of {task.steps.length} steps
                       </span>
                     )}
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleToggleImportance(task); }}
                  className={`p-2 transition-all ${task.isImportant ? 'text-[#ed5c37]' : 'text-slate-200 hover:text-slate-400'}`}
                >
                  <Star className={`w-4 h-4 ${task.isImportant ? 'fill-current' : ''}`} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Inline Add Task Input */}
        <div className="px-8 pb-8 pt-4">
          <div className={`flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border transition-all ${newTaskTitle ? 'bg-white border-[#ed5c37]/30 ring-4 ring-[#ed5c37]/5 shadow-lg' : 'border-slate-100'}`}>
             <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center">
                {loading ? <div className="w-2 h-2 border-2 border-[#ed5c37] border-t-transparent rounded-full animate-spin" /> : <Plus className="w-3.5 h-3.5 text-slate-400" />}
             </div>
             <input 
               type="text" 
               placeholder="Add a task" 
               value={newTaskTitle}
               disabled={loading}
               onChange={(e) => setNewTaskTitle(e.target.value)}
               onKeyDown={handleCreateTask}
               className="flex-1 bg-transparent border-none outline-none text-sm font-semibold text-slate-800 placeholder:text-slate-400"
             />
             {newTaskTitle && !loading && (
               <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-4">
                  <button className="p-2 text-slate-400 hover:text-[#ed5c37] transition-all"><Calendar className="w-4 h-4" /></button>
                  <button className="p-2 text-slate-400 hover:text-[#ed5c37] transition-all"><Bell className="w-4 h-4" /></button>
                  <button className="p-2 text-slate-400 hover:text-[#ed5c37] transition-all"><Repeat className="w-4 h-4" /></button>
               </div>
             )}
          </div>
        </div>
      </div>

      {/* Task Detail Panel - Slide Over */}
      <div className={`fixed md:absolute right-0 top-0 h-full w-full md:w-96 bg-white border-l border-slate-100 shadow-2xl z-50 transition-transform duration-300 ease-out p-8 flex flex-col gap-8 overflow-y-auto custom-scrollbar ${selectedTaskId ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedTask && (
          <>
            <div className="flex items-center justify-between">
               <button onClick={() => setSelectedTaskId(null)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all"><X className="w-5 h-5" /></button>
               <button 
                 onClick={async () => {
                   if (confirm("Delete this task?")) {
                     await deleteTask(selectedTask.id);
                     setSelectedTaskId(null);
                     fetchTasks(activeUserId || undefined);
                   }
                 }}
                 className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
               >
                 <Trash2 className="w-4 h-4" />
               </button>
            </div>

            <div className="space-y-6">
               <div className="flex items-start gap-4 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                  <button 
                    onClick={() => handleToggleStatus(selectedTask)}
                    className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedTask.status === 'COMPLETED' ? 'bg-[#ed5c37] border-[#ed5c37] text-white' : 'border-slate-200 hover:border-[#ed5c37]'}`}
                  >
                    <Check className="w-2.5 h-2.5 stroke-[4]" />
                  </button>
                  <textarea 
                    defaultValue={selectedTask.title}
                    onBlur={async (e) => {
                      if (e.target.value !== selectedTask.title) {
                        await updateTask(selectedTask.id, { title: e.target.value });
                        fetchTasks(activeUserId || undefined);
                      }
                    }}
                    className={`flex-1 bg-transparent border-none outline-none text-base font-bold text-slate-800 resize-none h-12 leading-tight ${selectedTask.status === 'COMPLETED' ? 'text-slate-400 line-through' : ''}`}
                  />
                  <button 
                    onClick={() => handleToggleImportance(selectedTask)}
                    className={`mt-1 p-2 transition-all ${selectedTask.isImportant ? 'text-[#ed5c37]' : 'text-slate-200'}`}
                  >
                    <Star className={`w-4 h-4 ${selectedTask.isImportant ? 'fill-current' : ''}`} />
                  </button>
               </div>

               {/* Steps Section */}
               <div className="space-y-1">
                  <div className="space-y-0.5">
                     {selectedTask.steps.map(step => (
                       <div key={step.id} className="group flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-xl transition-all">
                          <button 
                            onClick={async () => {
                              await toggleTaskStep(step.id, step.isCompleted);
                              fetchTasks(activeUserId || undefined);
                            }}
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${step.isCompleted ? 'bg-[#ed5c37] border-[#ed5c37] text-white' : 'border-slate-200 hover:border-[#ed5c37]'}`}
                          >
                            <Check className="w-2 h-2 stroke-[4]" />
                          </button>
                          <span className={`text-sm font-medium flex-1 ${step.isCompleted ? 'text-slate-400 line-through' : 'text-slate-600'}`}>{step.title}</span>
                          <button 
                            onClick={async () => {
                              await deleteTaskStep(step.id);
                              fetchTasks(activeUserId || undefined);
                            }}
                            className="p-1 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                       </div>
                     ))}
                  </div>
                  <div className="flex items-center gap-3 p-2.5 focus-within:bg-slate-50 rounded-xl transition-all">
                     <Plus className="w-3.5 h-3.5 text-[#ed5c37]" />
                     <input 
                       type="text" 
                       placeholder="Add step" 
                       className="flex-1 bg-transparent border-none outline-none text-sm text-slate-800 placeholder:text-[#ed5c37]/60 font-semibold"
                       onKeyDown={async (e) => {
                         if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                           await addTaskStep(selectedTask.id, (e.target as HTMLInputElement).value);
                           (e.target as HTMLInputElement).value = "";
                           fetchTasks(activeUserId || undefined);
                         }
                       }}
                     />
                  </div>
               </div>

               <div className="space-y-1 pt-2 border-t border-slate-50">
                  <button className="w-full flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl text-slate-500 transition-all">
                    <Sun className="w-4 h-4" /> <span className="text-sm font-semibold">Add to My Day</span>
                  </button>
                  <button className="w-full flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl text-slate-500 transition-all">
                    <Bell className="w-4 h-4" /> <span className="text-sm font-semibold">Remind me</span>
                  </button>
                  <button className="w-full flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl text-slate-500 transition-all">
                    <Calendar className="w-4 h-4" /> <span className="text-sm font-semibold">Add due date</span>
                  </button>
                  <button className="w-full flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl text-slate-500 transition-all">
                    <Repeat className="w-4 h-4" /> <span className="text-sm font-semibold">Repeat</span>
                  </button>
               </div>

               <div className="space-y-2 pt-4 border-t border-slate-50">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-3">Notes</label>
                  <textarea 
                    placeholder="Add note"
                    defaultValue={selectedTask.notes || ""}
                    onBlur={async (e) => {
                      if (e.target.value !== selectedTask.notes) {
                        await updateTask(selectedTask.id, { notes: e.target.value });
                        fetchTasks(activeUserId || undefined);
                      }
                    }}
                    className="w-full min-h-[140px] p-4 bg-slate-50 rounded-2xl border border-transparent focus:bg-white focus:border-slate-200 focus:shadow-inner outline-none text-slate-700 text-sm font-medium resize-none transition-all"
                  />
               </div>
            </div>

            <div className="mt-auto pt-6 border-t border-slate-100 text-center">
               <span className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.2em]">Personal Task Registry &bull; {new Date(selectedTask.createdAt).toLocaleDateString()}</span>
            </div>
          </>
        )}
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
