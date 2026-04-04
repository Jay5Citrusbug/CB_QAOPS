"use client";

import { useState } from "react";
import { createUser } from "@/lib/actions";
import { Users, Plus, Mail, Shield, User, X, Search, MoreVertical } from "lucide-react";

export default function AdminUsersPage() {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 leading-tight">User Management</h1>
          <p className="text-slate-500">Manage team access and roles.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#F97316] text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-orange-200 hover:scale-[1.02] transition-all"
        >
          <Plus className="w-5 h-5" /> Add New User
        </button>
      </div>

      <div className="premium-card !p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
           <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Filter users..." className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#F97316]/20 outline-none" />
           </div>
        </div>
        
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 font-bold text-slate-600">User</th>
              <th className="px-6 py-4 font-bold text-slate-600">Email</th>
              <th className="px-6 py-4 font-bold text-slate-600">Role</th>
              <th className="px-6 py-4 font-bold text-slate-600">Joined</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="hover:bg-slate-50/80 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#1E293B] text-white flex items-center justify-center font-bold text-xs ring-2 ring-slate-100">AU</div>
                  <span className="font-bold text-slate-900">Admin User</span>
                </div>
              </td>
              <td className="px-6 py-4 text-slate-600">jay5.citrusbug@gmail.com</td>
              <td className="px-6 py-4">
                <span className="inline-flex px-2 py-1 bg-purple-50 text-purple-700 text-[10px] font-bold rounded uppercase tracking-wider border border-purple-100">Admin</span>
              </td>
              <td className="px-6 py-4 text-slate-500">Oct 24, 2024</td>
              <td className="px-6 py-4 text-slate-400">
                 <button className="hover:text-slate-600 transition-colors"><MoreVertical className="w-4 h-4" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Invite New User</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>
            
            <form action={async (formData) => {
              setLoading(true);
              const res = await createUser(formData);
              if (res?.error) {
                setError(res.error);
                setLoading(false);
              } else {
                setShowModal(false);
                setLoading(false);
              }
            }} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                   <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name</label>
                   <input type="text" name="name" required placeholder="John Doe" className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F97316]/20 transition-all outline-none border" />
                </div>
                <div className="col-span-2 md:col-span-1">
                   <label className="block text-sm font-semibold text-slate-700 mb-1">Role</label>
                   <select name="role" required className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F97316]/20 transition-all outline-none border">
                      <option value="USER">User (QA)</option>
                      <option value="ADMIN">Admin</option>
                   </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Email Address</label>
                <input type="email" name="email" required placeholder="name@company.com" className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F97316]/20 transition-all outline-none border" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
                <input type="password" name="password" required minLength={6} placeholder="••••••••" className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F97316]/20 transition-all outline-none border" />
              </div>

              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 px-4 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-3 px-4 rounded-xl font-bold bg-[#F97316] text-white hover:bg-[#ea580c] transition-all flex items-center justify-center shadow-lg shadow-orange-100">
                  {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
