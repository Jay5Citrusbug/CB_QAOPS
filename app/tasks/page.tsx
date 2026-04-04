"use client";

import { useState } from "react";
import { createTask, toggleTaskStatus, deleteTask } from "@/lib/actions";
import { CheckSquare, Calendar, Trash2, Plus, ArrowRight, X, Clock } from "lucide-react";

export default function TasksPage() {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 leading-tight">Tasks</h1>
          <p className="text-slate-500">Stay organized with your QA goals.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#F97316] text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-orange-200 hover:scale-[1.02] transition-all"
        >
          <Plus className="w-5 h-5" /> New Task
        </button>
      </div>

      <div className="space-y-8">
         <section>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Today
            </h2>
            <div className="space-y-3">
               {/* Task items mapping would live here */}
               <div className="premium-card flex items-center justify-between border-l-4 border-l-[#F97316]">
                  <div className="flex items-center gap-4">
                     <button className="w-6 h-6 border-2 border-slate-200 rounded-md hover:border-[#F97316] transition-colors"></button>
                     <span className="font-semibold text-slate-700 font-sans">Finalize Vercel Deployment</span>
                  </div>
                  <div className="flex items-center gap-4">
                     <span className="text-xs px-2 py-1 bg-orange-50 text-[#F97316] font-bold rounded">High</span>
                     <button className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
               </div>
            </div>
         </section>

         <section>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
               <Calendar className="w-4 h-4" /> Upcoming
            </h2>
            <div className="py-12 text-center bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                <p className="text-slate-400 text-sm font-medium">Your schedule looks clear for now!</p>
            </div>
         </section>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Add New Task</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>
            
            <form action={async (formData) => {
              setLoading(true);
              await createTask(formData);
              setShowModal(false);
              setLoading(false);
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Task Title</label>
                <input type="text" name="title" required placeholder="What needs to be done?" className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F97316]/20 transition-all outline-none border" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Due Date</label>
                <input type="date" name="dueDate" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F97316]/20 transition-all outline-none border" />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 px-4 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-3 px-4 rounded-xl font-bold bg-[#F97316] text-white hover:bg-[#ea580c] transition-all flex items-center justify-center shadow-lg shadow-orange-100">
                  {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
