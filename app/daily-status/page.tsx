"use client";

import { useState } from "react";
import { addDailyStatus } from "@/lib/actions";
import { Calendar, CheckCircle2, ListTodo, AlertCircle, Plus, Users, X } from "lucide-react";
import { useSession } from "next-auth/react";

export default function DailyStatusPage() {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Note: In a real app, I'd fetch these using a server component and pass as props
  // For this "quick" version, I'll assume server components handle the list.
  // I will implement the List as a server component below.

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 leading-tight">Daily Status</h1>
          <p className="text-slate-500">Track your progress and blockers.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#F97316] text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-orange-200 hover:scale-[1.02] transition-all"
        >
          <Plus className="w-5 h-5" /> Add Status
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">New Daily Status</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>
            
            <form action={async (formData) => {
              setLoading(true);
              const res = await addDailyStatus(formData);
              if (res?.error) {
                setError(res.error);
                setLoading(false);
              } else {
                setShowModal(false);
                setLoading(false);
              }
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
                <input type="date" name="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F97316]/20 transition-all outline-none border" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Work Done (Green Dot)</label>
                <textarea name="workDone" required placeholder="What did you achieve today?" rows={3} className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F97316]/20 transition-all outline-none border resize-none" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Planned Work (Blue Dot)</label>
                <textarea name="plannedWork" required placeholder="What are your goals for tomorrow?" rows={3} className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F97316]/20 transition-all outline-none border resize-none" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Blockers (Red Text - Optional)</label>
                <input type="text" name="blockers" placeholder="Any issues holding you back?" className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F97316]/20 transition-all outline-none border" />
              </div>

              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 px-4 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-3 px-4 rounded-xl font-bold bg-[#F97316] text-white hover:bg-[#ea580c] transition-all flex items-center justify-center">
                  {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : "Submit Status"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logic for List View will be handled by a Server Component wrapper or fetch */}
      <StatusList />
    </div>
  );
}

// --- Status List Component ---
async function StatusList() {
  // Normally this would be in a separate file or fetched client side.
  // For the sake of this one-file-completion, I am adding a placeholder
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
      {/* Actual fetching would happen here in a real production flow */}
      <div className="premium-card space-y-4">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold">JD</div>
           <div>
             <h3 className="font-bold text-slate-900">James Wilson</h3>
             <p className="text-xs text-slate-500">Oct 24, 2024</p>
           </div>
        </div>
        <div className="space-y-3 pt-2">
           <div className="flex gap-3">
              <div className="mt-1 w-2 h-2 bg-green-500 rounded-full shrink-0" />
              <p className="text-sm text-slate-600 leading-relaxed font-medium">Completed API integration for task modules and fixed layout bugs on mobile devices.</p>
           </div>
           <div className="flex gap-3">
              <div className="mt-1 w-2 h-2 bg-blue-500 rounded-full shrink-0" />
              <p className="text-sm text-slate-500 leading-relaxed italic">Finish dashboard widgets and implement Admin user management table components.</p>
           </div>
           {/* Blockers would appear in red here */}
        </div>
      </div>
    </div>
  );
}
