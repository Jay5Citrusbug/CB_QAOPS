"use client";

import { useState, useEffect } from "react";
import { createUser, updateUser, deleteUser } from "@/lib/actions";
import { Users, Plus, X, Search, Shield, User, Mail, MoreHorizontal, Clock, Eye, EyeOff, Edit2, Trash2, AlertTriangle } from "lucide-react";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  projectId?: string | null;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
}

export default function AdminUsersPage() {
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<UserData[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [selectedRole, setSelectedRole] = useState("USER");

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error("Failed to fetch projects", err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchProjects();
  }, []);

  const handleOpenModal = (user: UserData | null = null) => {
    setEditingUser(user);
    setSelectedRole(user ? user.role : "USER");
    setError("");
    setShowPassword(false);
    setShowModal(true);
  };

  const handleDelete = async (userId: string) => {
    if (confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      const res = await deleteUser(userId);
      if (res?.error) {
        alert(res.error);
      } else {
        fetchUsers();
      }
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="page-header !mb-0">
          <h1 className="page-title">Team Hub</h1>
          <p className="page-desc">Manage Team Members and Permissions</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="btn-primary"
        >
          <Plus className="w-5 h-5" /> Onboard New
        </button>
      </div>

      <div className="premium-card !p-0 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
           <div className="relative w-full md:w-96 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#ed5c37] transition-colors" />
              <input 
                type="text" 
                placeholder="Search by name or email..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium focus:ring-4 focus:ring-[#ed5c37]/5 focus:border-[#ed5c37]/20 outline-none transition-all shadow-sm" 
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
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border w-fit ${
                        user.role === 'ADMIN' 
                          ? 'bg-purple-50 text-purple-700 border-purple-100' 
                          : user.role === 'TL'
                          ? 'bg-blue-50 text-blue-700 border-blue-100'
                          : user.role === 'DEV'
                          ? 'bg-orange-50 text-orange-700 border-orange-100'
                          : 'bg-green-50 text-green-700 border-green-100'
                      }`}>
                        <Shield className="w-3 h-3" /> {user.role === 'USER' ? 'QA ENGINEER' : user.role === 'DEV' ? 'DEVELOPER' : user.role}
                      </span>
                      {user.role === 'DEV' && user.projectId && (
                        <span className="text-[9px] font-bold text-slate-400 ml-1 uppercase truncate max-w-[120px]">
                          Proj: {projects.find(p => p.id === user.projectId)?.name || user.projectId}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                    {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleOpenModal(user)}
                        className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                        title="Edit User"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(user.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
                <h2 className="page-title text-xl">{editingUser ? "Edit User" : "Onboard User"}</h2>
                <p className="page-desc">{editingUser ? "Update team access permissions" : "Setup team access permissions"}</p>
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
              const res = editingUser 
                ? await updateUser(editingUser.id, formData)
                : await createUser(formData);
              
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
                   <input 
                    type="text" 
                    name="name" 
                    required 
                    defaultValue={editingUser?.name || ""}
                    placeholder="User Name" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-[#ed5c37]/5 focus:border-[#ed5c37]/30 rounded-xl font-bold text-sm text-slate-700 outline-none transition-all" 
                   />
                </div>
                <div className="space-y-1.5">
                   <label className="text-xs font-bold text-slate-500 ml-1">Role</label>
                   <select 
                    name="role" 
                    required 
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl font-bold text-sm text-slate-700 outline-none transition-all appearance-none"
                   >
                      <option value="USER">QA Engineer</option>
                      <option value="TL">Team Lead (TL)</option>
                      <option value="DEV">Developer</option>
                      <option value="ADMIN">System Admin</option>
                   </select>
                </div>
              </div>

              {selectedRole === "DEV" && (
                <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                  <label className="text-xs font-bold text-slate-500 ml-1">Assigned Project</label>
                  <select 
                    name="projectId" 
                    required={selectedRole === "DEV"}
                    defaultValue={editingUser?.projectId || ""}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl font-bold text-sm text-slate-700 outline-none transition-all appearance-none"
                  >
                    <option value="">Select a project...</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 ml-1 mt-1">Developers will only see their assigned project in the Test Cases portal.</p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1">Email Address</label>
                <input 
                  type="email" 
                  name="email" 
                  required 
                  defaultValue={editingUser?.email || ""}
                  placeholder="email@qops.com" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-[#ed5c37]/5 focus:border-[#ed5c37]/30 rounded-xl font-bold text-sm text-slate-700 outline-none transition-all" 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1">
                  {editingUser ? "Password (leave blank to keep current)" : "Password"}
                </label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    name="password" 
                    required={!editingUser} 
                    minLength={6} 
                    placeholder="••••••••" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-[#ed5c37]/5 focus:border-[#ed5c37]/30 rounded-xl font-bold text-sm text-slate-700 outline-none transition-all pr-12" 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && <div className="text-[10px] font-bold text-red-500 uppercase tracking-widest text-center">{error}</div>}

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 px-4 rounded-xl font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all text-sm">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 btn-primary justify-center shadow-lg shadow-orange-500/20">
                  {loading ? <Clock className="w-4 h-4 animate-spin" /> : editingUser ? "Update User" : "Invite User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
