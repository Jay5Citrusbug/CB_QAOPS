"use client";

import { useState, useEffect } from "react";
import { createProject, updateProject, deleteProject } from "@/lib/actions";
import { Plus, X, Search, Briefcase, User, Shield, CheckCircle2, AlertCircle, Edit2, Trash2, MoreHorizontal, Clock } from "lucide-react";

interface Project {
  id: string;
  name: string;
  tlName: string;
  assigneeName: string;
  devName: string;
  status: string;
  createdAt: string;
}

export default function ProjectHubPage() {
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");

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
    fetchProjects();
  }, []);

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.tlName.toLowerCase().includes(search.toLowerCase()) ||
    p.devName.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (project: Project) => {
    setIsEditing(true);
    setCurrentProject(project);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure? This will also delete all linked status reports!")) {
      await deleteProject(id);
      fetchProjects();
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="page-header !mb-0">
          <h1 className="page-title">Project Hub</h1>
          <p className="page-desc">Manage Delivery & Governance</p>
        </div>
        <button 
          onClick={() => { setIsEditing(false); setCurrentProject(null); setShowModal(true); }}
          className="btn-primary"
        >
          <Plus className="w-5 h-5" /> New Project
        </button>
      </div>

      <div className="premium-card !p-0 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
           <div className="relative w-full md:w-96 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#ed5c37] transition-colors" />
              <input 
                type="text" 
                placeholder="Search projects, TLs..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium focus:ring-4 focus:ring-[#ed5c37]/5 focus:border-[#ed5c37]/20 outline-none transition-all shadow-sm" 
              />
           </div>
           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm">{filteredProjects.length} entities tracked</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold tracking-widest text-slate-500">
              <tr>
                <th className="px-6 py-4">Project Stream</th>
                <th className="px-6 py-4">Lead & QA</th>
                <th className="px-6 py-4">Engineering</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProjects.map((project) => (
                <tr key={project.id} className="hover:bg-slate-50 transition-all group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs group-hover:bg-[#ed5c37] transition-colors">
                        {project.name.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="font-bold text-slate-900">{project.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="space-y-1">
                       <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-tight">
                          <Shield className="w-3.5 h-3.5 text-[#ed5c37]" />
                          {project.tlName}
                       </div>
                       <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{project.assigneeName}</div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-slate-600 font-medium">
                       <User className="w-4 h-4 text-slate-300" />
                       {project.devName}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${
                      project.status === 'ACTIVE' 
                        ? 'bg-green-50 text-green-700 border-green-100' 
                        : 'bg-red-50 text-red-700 border-red-100'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${project.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'}`} />
                      {project.status}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                     <div className="flex justify-end gap-1">
                        <button onClick={() => handleEdit(project)} className="p-2 text-slate-300 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(project.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
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
                <h2 className="page-title text-xl">{isEditing ? "Modify Project" : "New Project"}</h2>
                <p className="page-desc">System Governance Entry</p>
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
              const res = isEditing && currentProject 
                ? await updateProject(currentProject.id, formData) 
                : await createProject(formData);
              
              if (res && 'error' in res) {
                setError(res.error || "An error occurred");
                setLoading(false);
              } else {
                setError("");
                setShowModal(false);
                setLoading(false);
                fetchProjects();
              }
            }} className="p-6 space-y-5">
              <div className="space-y-1.5">
                 <label className="text-xs font-bold text-slate-500 ml-1">Project Name</label>
                 <input type="text" name="name" required defaultValue={currentProject?.name} placeholder="Nexus QA Portal" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-[#ed5c37]/5 focus:border-[#ed5c37]/30 rounded-xl font-bold text-sm text-slate-700 transition-all outline-none" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                   <label className="text-xs font-bold text-slate-500 ml-1">TL Name</label>
                   <input type="text" name="tlName" required defaultValue={currentProject?.tlName} placeholder="Lead Name" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-[#ed5c37]/5 focus:border-[#ed5c37]/30 rounded-xl font-bold text-sm text-slate-700 transition-all outline-none" />
                </div>
                <div className="space-y-1.5">
                   <label className="text-xs font-bold text-slate-500 ml-1">QA/Assignee</label>
                   <input type="text" name="assigneeName" required defaultValue={currentProject?.assigneeName} placeholder="QA Name" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-[#ed5c37]/5 focus:border-[#ed5c37]/30 rounded-xl font-bold text-sm text-slate-700 transition-all outline-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                 <label className="text-xs font-bold text-slate-500 ml-1">Developer Lead</label>
                 <input type="text" name="devName" required defaultValue={currentProject?.devName} placeholder="Lead Dev" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-[#ed5c37]/5 focus:border-[#ed5c37]/30 rounded-xl font-bold text-sm text-slate-700 transition-all outline-none" />
              </div>

              {isEditing && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">Status</label>
                  <select name="status" defaultValue={currentProject?.status} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl font-bold text-sm text-slate-700 outline-none transition-all appearance-none">
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              )}

              {error && <div className="text-[10px] font-bold text-red-500 uppercase tracking-widest text-center">{error}</div>}

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 px-4 rounded-xl font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all text-sm">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 btn-primary justify-center shadow-lg shadow-orange-500/20">
                  {loading ? <Clock className="w-4 h-4 animate-spin" /> : (isEditing ? "Update Project" : "Save Project")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

