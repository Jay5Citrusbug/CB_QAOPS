"use client";

import { useState, useEffect } from "react";
import { createUser } from "@/lib/actions";
import { Users, Plus, X, Search, Shield, User, Mail, MoreHorizontal, Clock } from "lucide-react";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<UserData[]>([]);
  const [search, setSearch] = useState("");

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="page-header !mb-0">
          <h1 className="page-title">Team Hub</h1>
          <p className="page-desc">Manage QA Analysts and Permissions</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="btn-primary"
        >
          <Plus className="w-5 h-5" /> Onboard New
        </button>
      </div>

      <div className="premium-card !p-0 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
           <div className="relative w-full md:w-96 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#f97316] transition-colors" />
              <input 
                type="text" 
                placeholder="Search by name or email..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium focus:ring-4 focus:ring-[#f97316]/5 focus:border-[#f97316]/20 outline-none transition-all shadow-sm" 
              />
           </div>
           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm">{filteredUsers.length} total users</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold tracking-widest text-slate-500">
              <tr>
                <th className="px-6 py-4">Full Profile</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Security Role</th>
                <th className="px-6 py-4">Since</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-all group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                        {user.name.substring(0, 2)}
                      </div>
                      <span className="font-bold text-slate-900">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-slate-500 font-medium text-xs">
                       <Mail className="w-3.5 h-3.5 text-slate-300" />
                       {user.email}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${
                      user.role === 'ADMIN' 
                        ? 'bg-purple-50 text-purple-700 border-purple-100' 
                        : 'bg-green-50 text-green-700 border-green-100'
                    }`}>
                      <Shield className="w-3 h-3" /> {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                    {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-5 text-right">
                     <button className="p-2 text-slate-300 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all">
                        <MoreHorizontal className="w-4 h-4" />
                     </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-400 border border-slate-100">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <div className="page-header !mb-0">
                <h2 className="page-title text-xl">Onboard User</h2>
                <p className="page-desc">Setup team access permissions</p>
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
              const res = await createUser(formData);
              if (res?.error) {
                setError(res.error);
                setLoading(false);
              } else {
                setError("");
                setShowModal(false);
                setLoading(false);
                fetchUsers();
              }
            }} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                   <label className="text-xs font-bold text-slate-500 ml-1">Full Name</label>
                   <input type="text" name="name" required placeholder="User Name" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-[#f97316]/5 focus:border-[#f97316]/30 rounded-xl font-bold text-sm text-slate-700 outline-none transition-all" />
                </div>
                <div className="space-y-1.5">
                   <label className="text-xs font-bold text-slate-500 ml-1">Role</label>
                   <select name="role" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl font-bold text-sm text-slate-700 outline-none transition-all appearance-none">
                      <option value="USER">QA Analyst</option>
                      <option value="ADMIN">System Admin</option>
                   </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1">Email Address</label>
                <input type="email" name="email" required placeholder="email@qops.com" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-[#f97316]/5 focus:border-[#f97316]/30 rounded-xl font-bold text-sm text-slate-700 outline-none transition-all" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1">Password</label>
                <input type="password" name="password" required minLength={6} placeholder="••••••••" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-[#f97316]/5 focus:border-[#f97316]/30 rounded-xl font-bold text-sm text-slate-700 outline-none transition-all" />
              </div>

              {error && <div className="text-[10px] font-bold text-red-500 uppercase tracking-widest text-center">{error}</div>}

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 px-4 rounded-xl font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all text-sm">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 btn-primary justify-center shadow-lg shadow-orange-500/20">
                  {loading ? <Clock className="w-4 h-4 animate-spin" /> : "Invite User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
