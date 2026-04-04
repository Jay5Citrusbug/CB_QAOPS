"use client";

import { useState, useEffect } from "react";
import { createTask, toggleTaskStatus, deleteTask } from "@/lib/actions";
import { CheckCircle2, Circle, Clock, Calendar, Trash2, Plus, X, Search } from "lucide-react";
import { useSession } from "next-auth/react";

interface Task {
  id: string;
  title: string;
  dueDate: string;
  status: string;
}

export default function TasksPage() {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const { data: session } = useSession();

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      console.error("Failed to fetch tasks", err);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleToggle = async (taskId: string, status: string) => {
    await toggleTaskStatus(taskId, status);
    fetchTasks();
  };

  const handleDelete = async (taskId: string) => {
    if (confirm("Permanently delete this task?")) {
      await deleteTask(taskId);
      fetchTasks();
    }
  };

  const todayTasks = tasks.filter(t => new Date(t.dueDate).setHours(0,0,0,0) === new Date().setHours(0,0,0,0));
  const upcomingTasks = tasks.filter(t => new Date(t.dueDate).setHours(0,0,0,0) > new Date().setHours(0,0,0,0));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="page-header !mb-0">
          <h1 className="page-title">Tasks</h1>
          <p className="page-desc">Manage your QA workflow and deadlines.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="btn-primary"
        >
          <Plus className="w-5 h-5" /> Create Task
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-12">
         {/* Today Section */}
         <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
               <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                 <Clock className="w-4 h-4 text-[#f97316]" /> Today
               </h2>
               <span className="text-[10px] bg-[#f97316]/10 text-[#f97316] px-2 py-0.5 rounded-full font-bold">{todayTasks.length}</span>
            </div>
            <div className="space-y-3">
               {todayTasks.map((task) => (
                  <div key={task.id} className={`premium-card group flex items-center justify-between ${task.status === 'COMPLETED' ? 'opacity-60 grayscale' : ''}`}>
                     <div className="flex items-center gap-3">
                        <button 
                          onClick={() => handleToggle(task.id, task.status)}
                          className={`w-6 h-6 flex items-center justify-center rounded-lg border-2 transition-all ${task.status === 'COMPLETED' ? 'bg-[#f97316] border-[#f97316] text-white' : 'border-slate-200 text-transparent hover:border-[#f97316]'}`}
                        >
                           {task.status === 'COMPLETED' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <Circle className="w-4 h-4 shrink-0" />}
                        </button>
                        <span className={`text-sm font-bold truncate max-w-[150px] lg:max-w-xs ${task.status === 'COMPLETED' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.title}</span>
                     </div>
                     <button onClick={() => handleDelete(task.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                  </div>
               ))}
               {todayTasks.length === 0 && <p className="text-sm italic text-slate-400 py-4 font-medium text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">No urgent tasks!</p>}
            </div>
         </section>

         {/* Upcoming Section */}
         <section className="space-y-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
               <Calendar className="w-4 h-4 text-blue-500" /> Upcoming
            </h2>
            <div className="space-y-3">
               {upcomingTasks.map((task) => (
                  <div key={task.id} className="premium-card flex items-center justify-between group">
                     <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-2 h-2 shrink-0 rounded-full bg-blue-400" />
                        <span className="text-sm font-bold text-slate-700 truncate">{task.title}</span>
                     </div>
                     <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">{new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                        <button onClick={() => handleDelete(task.id)} className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                     </div>
                  </div>
               ))}
               {upcomingTasks.length === 0 && (
                  <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center gap-2">
                     <Calendar className="w-6 h-6 text-slate-200" />
                     <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Schedule clear</p>
                  </div>
               )}
            </div>
         </section>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-400 border border-slate-100">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <div className="page-header !mb-0">
                 <h2 className="page-title text-xl">New Task</h2>
                 <p className="page-desc">Plan your next QA win</p>
              </div>
              <button 
                onClick={() => setShowModal(false)} 
                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form action={async (formData) => {
              setLoading(true);
              await createTask(formData);
              setShowModal(false);
              setLoading(false);
              fetchTasks();
            }} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1">Task Title</label>
                <input type="text" name="title" required placeholder="Describe task..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-[#f97316]/5 focus:border-[#f97316]/30 rounded-xl font-bold text-sm text-slate-700 outline-none transition-all" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1">Deadline Filter</label>
                <input type="date" name="dueDate" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-[#f97316]/5 focus:border-[#f97316]/30 rounded-xl font-bold text-sm text-slate-700 outline-none transition-all" />
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 px-4 rounded-xl font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all text-sm">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 btn-primary justify-center shadow-lg shadow-orange-500/20">
                  {loading ? <Clock className="w-4 h-4 animate-spin" /> : "Save Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
