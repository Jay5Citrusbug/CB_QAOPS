"use client";

import { useState, useEffect, useMemo } from "react";
import { addDailyStatus, updateDailyStatus, deleteDailyStatus } from "@/lib/actions";
import { Plus, X, Calendar, CheckCircle2, User, LayoutGrid, List, Search, Filter, Briefcase, Edit2, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";

interface DailyStatus {
  id: string;
  projectId: string;
  project: {
    name: string;
  };
  date: string;
  workDone: string;
  plannedWork: string;
  blockers?: string | null;
  createdAt: string;
  user: {
    name: string;
    email: string;
  };
}

interface Project {
  id: string;
  name: string;
  status: string;
}

type ViewMode = "CARD" | "LIST";

export default function DailyStatusPage() {
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentEditId, setCurrentEditId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [statuses, setStatuses] = useState<DailyStatus[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("CARD");
  
  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterProject, setFilterProject] = useState("ALL");

  const { data: session } = useSession();

  // Fetch data
  const fetchData = async () => {
    try {
      const [statusRes, projectRes] = await Promise.all([
        fetch("/api/daily-status"),
        fetch("/api/projects")
      ]);
      const [statusData, projectData] = await Promise.all([
        statusRes.json(),
        projectRes.json()
      ]);
      setStatuses(statusData);
      setProjects(projectData);
    } catch (err) {
      console.error("Failed to fetch data", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter logic
  const filteredStatuses = useMemo(() => {
    return statuses.filter(s => {
      const matchesSearch = 
        s.project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.workDone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.user.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesDate = filterDate ? s.date.split('T')[0] === filterDate : true;
      const matchesProject = filterProject === "ALL" ? true : s.projectId === filterProject;

      return matchesSearch && matchesDate && matchesProject;
    });
  }, [statuses, searchQuery, filterDate, filterProject]);

  const activeProjects = projects.filter(p => p.status === "ACTIVE");

  const handleEdit = (status: DailyStatus) => {
    setIsEditing(true);
    setCurrentEditId(status.id);
    setShowModal(true);
    // Note: Form will be pre-filled via default values
  };

  const handleDelete = async (id: string) => {
    if (confirm("Permanently delete this status report?")) {
      await deleteDailyStatus(id);
      fetchData();
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="page-header !mb-0">
          <h1 className="page-title">Project Heartbeat</h1>
          <p className="page-desc">Daily Status Reporting & History</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button onClick={() => setViewMode("CARD")} className={`p-2 rounded-lg transition-all ${viewMode === 'CARD' ? 'bg-slate-100 text-[#f97316]' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid className="w-5 h-5" /></button>
            <button onClick={() => setViewMode("LIST")} className={`p-2 rounded-lg transition-all ${viewMode === 'LIST' ? 'bg-slate-100 text-[#f97316]' : 'text-slate-400 hover:text-slate-600'}`}><List className="w-5 h-5" /></button>
          </div>
          <button 
            onClick={() => { setIsEditing(false); setShowModal(true); }}
            className="btn-primary"
          >
            <Plus className="w-5 h-5" /> Submit Status
          </button>
        </div>
      </div>

      {/* Filter Hub */}
      <div className="premium-card grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div className="md:col-span-2 space-y-1.5">
           <label className="text-xs font-bold text-slate-500 ml-1">Search</label>
           <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#f97316] transition-colors" />
              <input type="text" placeholder="Search milestones, projects..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 rounded-xl focus:ring-4 focus:ring-[#f97316]/5 focus:border-[#f97316]/20 outline-none transition-all shadow-sm" />
           </div>
        </div>
        
        <div className="space-y-1.5">
           <label className="text-xs font-bold text-slate-500 ml-1">Project</label>
           <div className="relative">
              <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 rounded-xl appearance-none focus:ring-4 focus:ring-[#f97316]/5 focus:border-[#f97316]/20 outline-none transition-all shadow-sm">
                <option value="ALL">All Projects</option>
                {activeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <Briefcase className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
           </div>
        </div>

        <div className="space-y-1.5">
           <label className="text-xs font-bold text-slate-500 ml-1">Date</label>
           <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 rounded-xl focus:ring-4 focus:ring-[#f97316]/5 focus:border-[#f97316]/20 outline-none transition-all shadow-sm" />
        </div>
      </div>

      {viewMode === 'CARD' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredStatuses.map((status) => (
            <div key={status.id} className="premium-card space-y-5">
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs uppercase">
                    {status.user.name.substring(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-900 leading-none">{status.user.name}</h3>
                      <span className="px-2 py-0.5 bg-slate-900 text-[10px] font-bold text-white rounded-md uppercase tracking-wider">{status.project.name}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-1.5">
                      <Calendar className="w-3 h-3" /> {new Date(status.date).toLocaleDateString()} &bull; {new Date(status.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(status)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(status.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="space-y-4 pt-1">
                <div className="flex gap-4">
                  <div className="mt-1 w-2 h-2 bg-green-500 rounded-full shrink-0" />
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Wins</span>
                    <p className="text-sm text-slate-700 font-medium leading-relaxed">{status.workDone}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="mt-1 w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Next</span>
                    <p className="text-sm text-slate-600 italic font-medium leading-relaxed">{status.plannedWork}</p>
                  </div>
                </div>

                {status.blockers && (
                  <div className="p-3 bg-red-50 rounded-xl border border-red-100 flex gap-3">
                    <div className="mt-1 w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest leading-none">Blocker</span>
                      <p className="text-xs text-red-700 font-bold leading-tight">{status.blockers}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="premium-card !p-0 overflow-hidden">
           <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold tracking-widest text-slate-500">
                 <tr>
                    <th className="px-6 py-4">Lead & Project</th>
                    <th className="px-6 py-4">Highlights</th>
                    <th className="px-6 py-4">Timeline</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {filteredStatuses.map((status) => (
                    <tr key={status.id} className="hover:bg-slate-50 transition-colors">
                       <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px] uppercase">{status.user.name.substring(0, 2)}</div>
                             <div>
                                <div className="font-bold text-slate-900">{status.user.name}</div>
                                <div className="text-[9px] bg-slate-900 text-white px-1.5 py-0.5 rounded w-fit mt-1 uppercase font-bold tracking-wider">{status.project.name}</div>
                             </div>
                          </div>
                       </td>
                       <td className="px-6 py-4 max-w-sm">
                          <p className="text-slate-600 font-medium truncate">{status.workDone}</p>
                       </td>
                       <td className="px-6 py-4">
                          <div className="flex flex-col text-slate-400 font-bold text-xs">
                             <span>{new Date(status.date).toLocaleDateString()}</span>
                             <span className="text-[10px] opacity-60 font-medium">at {new Date(status.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                       </td>
                       <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1">
                             <button onClick={() => handleEdit(status)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Edit2 className="w-4 h-4" /></button>
                             <button onClick={() => handleDelete(status.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                          </div>
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xl z-[60] flex items-center justify-center p-6 animate-in fade-in duration-400 tracking-tight">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-4xl overflow-hidden animate-in zoom-in-95 duration-500">
            <div className="p-12 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter">{isEditing ? "Edit Status" : "Status Refresh"}</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Publish your latest progress</p>
              </div>
              <button onClick={() => setShowModal(false)} className="w-16 h-16 rounded-[2rem] bg-slate-50 text-slate-300 hover:text-red-500 hover:bg-white hover:shadow-2xl transition-all duration-500 flex items-center justify-center"><X className="w-9 h-9" /></button>
            </div>
            
            <form action={async (formData) => {
              setLoading(true);
              const res = isEditing 
                ? await updateDailyStatus(currentEditId, formData) 
                : await addDailyStatus(formData);

              if (res && 'error' in res) {
                setError(res.error || "An unknown error occurred.");
                setLoading(false);
              } else {
                setError("");
                setShowModal(false);
                setLoading(false);
                fetchData(); 
              }
            }} className="p-12 space-y-8">
              {!isEditing && (
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-3">Project Hub</label>
                    <div className="relative">
                      <select name="projectId" required className="w-full px-8 py-5 bg-slate-50 border-3 border-transparent focus:bg-white focus:ring-8 focus:ring-[#F97316]/5 focus:border-[#F97316]/30 rounded-[1.5rem] font-black text-slate-700 transition-all outline-none appearance-none">
                        <option value="">Select Project...</option>
                        {activeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <Briefcase className="absolute right-8 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-3">Target Date</label>
                    <input type="date" name="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-8 py-5 bg-slate-50 border-3 border-transparent focus:bg-white focus:ring-8 focus:ring-[#F97316]/5 focus:border-[#F97316]/30 rounded-[1.5rem] font-black text-slate-700 transition-all outline-none border-2" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-3">Daily Wins (Accomplishments)</label>
                <textarea name="workDone" required defaultValue={isEditing ? statuses.find(s => s.id === currentEditId)?.workDone : ''} placeholder="What milestones did you hit today?" rows={3} className="w-full px-8 py-5 bg-slate-50 border-3 border-transparent focus:bg-white focus:ring-8 focus:ring-[#F97316]/5 focus:border-[#F97316]/30 rounded-[2rem] font-black text-slate-700 transition-all outline-none resize-none border-2 shadow-inner" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-3">Future Roadmap (Tomorrow)</label>
                   <textarea name="plannedWork" required defaultValue={isEditing ? statuses.find(s => s.id === currentEditId)?.plannedWork : ''} placeholder="Next targets?" rows={2} className="w-full px-8 py-5 bg-slate-50 border-3 border-transparent focus:bg-white focus:ring-8 focus:ring-[#F97316]/5 focus:border-[#F97316]/30 rounded-[1.5rem] font-black text-slate-700 transition-all outline-none resize-none border-2" />
                </div>
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-3">Blockers (If Any)</label>
                   <textarea name="blockers" defaultValue={isEditing ? statuses.find(s => s.id === currentEditId)?.blockers || '' : ''} placeholder="Stuck on something?" rows={2} className="w-full px-8 py-5 bg-slate-50 border-3 border-transparent focus:bg-white focus:ring-8 focus:ring-[#F97316]/5 focus:border-[#F97316]/30 rounded-[1.5rem] font-black text-slate-700 transition-all outline-none resize-none border-2" />
                </div>
              </div>

              {error && <div className="p-5 bg-red-50 border-3 border-red-100 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-3xl animate-shake">{error}</div>}

              <div className="pt-8 flex gap-8">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-6 px-8 rounded-[2rem] font-black bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all text-xs uppercase tracking-[0.3em] shadow-xl">Discard</button>
                <button type="submit" disabled={loading} className="flex-1 py-6 px-8 rounded-[2rem] font-black bg-[#1E293B] text-white shadow-4xl hover:shadow-[#1E293B]/40 hover:-translate-y-2 active:translate-y-0 transition-all flex items-center justify-center text-xs uppercase tracking-[0.3em]">
                  {loading ? <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div> : (isEditing ? "Update" : "Publish")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
