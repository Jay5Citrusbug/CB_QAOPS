"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { addDailyStatus, updateGroupedDailyStatus, deleteGroupedDailyStatus } from "@/lib/actions";
import { Plus, X, Calendar, CheckCircle2, User, LayoutGrid, List, Search, Filter, Briefcase, Edit2, Trash2, Clock, ChevronDown, Check, Eye, Copy, BarChart2 } from "lucide-react";
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
  hours: number;
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

interface GroupedStatus {
  id: string;
  user: DailyStatus["user"];
  date: string;
  workDone: string;
  plannedWork: string;
  blockers?: string | null;
  createdAt: string;
  projects: {
    projectId: string;
    projectName: string;
    hours: number;
    statusId: string;
  }[];
}

type ViewMode = "CARD" | "LIST";

const renderWithLinks = (text: string) => {
  if (!text) return text;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.split(urlRegex).map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-[#ed5c37] font-bold hover:underline" onClick={e => e.stopPropagation()}>
          {part}
        </a>
      );
    }
    return part;
  });
};

export default function DailyStatusPage() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentEditDate, setCurrentEditDate] = useState("");
  const [editingGroup, setEditingGroup] = useState<GroupedStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [statuses, setStatuses] = useState<DailyStatus[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("LIST");
  
  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterProject, setFilterProject] = useState("ALL");

  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [projectHours, setProjectHours] = useState<Record<string, string>>({});
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [viewStatusId, setViewStatusId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const groupedStatuses = useMemo(() => {
    const map: Record<string, GroupedStatus> = {};
    filteredStatuses.forEach(s => {
      const key = `${s.user.email}_${s.date.split("T")[0]}`;
      if (!map[key]) {
        map[key] = {
          id: key,
          user: s.user,
          date: s.date,
          workDone: s.workDone,
          plannedWork: s.plannedWork,
          blockers: s.blockers,
          createdAt: s.createdAt,
          projects: []
        };
      }
      if (!map[key].projects.some(p => p.projectId === s.projectId)) {
        map[key].projects.push({
          projectId: s.projectId,
          projectName: s.project.name,
          hours: s.hours,
          statusId: s.id
        });
      }
    });
    return Object.values(map).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredStatuses]);

  const handleEdit = (group: GroupedStatus) => {
    setIsEditing(true);
    setCurrentEditDate(group.date);
    setSelectedProjects(group.projects.map(p => p.projectId));
    const hoursObj: Record<string, string> = {};
    group.projects.forEach(p => { hoursObj[p.projectId] = String(p.hours); });
    setProjectHours(hoursObj);
    setEditingGroup(group);
    setShowModal(true);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async (dateStr: string) => {
    if (confirm("Permanently delete this entire status report?")) {
      await deleteGroupedDailyStatus(dateStr);
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
            <button onClick={() => setViewMode("CARD")} className={`p-2 rounded-lg transition-all ${viewMode === 'CARD' ? 'bg-slate-100 text-[#ed5c37]' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid className="w-5 h-5" /></button>
            <button onClick={() => setViewMode("LIST")} className={`p-2 rounded-lg transition-all ${viewMode === 'LIST' ? 'bg-slate-100 text-[#ed5c37]' : 'text-slate-400 hover:text-slate-600'}`}><List className="w-5 h-5" /></button>
          </div>
          <button 
            onClick={() => router.push("/daily-status/summary")}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 font-bold text-sm rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 transition-all focus:ring-4 focus:ring-slate-100"
          >
            <BarChart2 className="w-5 h-5 text-[#ed5c37]" /> Summary Dashboard
          </button>
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#ed5c37] transition-colors" />
              <input type="text" placeholder="Search milestones, projects..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 rounded-xl focus:ring-4 focus:ring-[#ed5c37]/5 focus:border-[#ed5c37]/20 outline-none transition-all shadow-sm" />
           </div>
        </div>
        
        <div className="space-y-1.5">
           <label className="text-xs font-bold text-slate-500 ml-1">Project</label>
           <div className="relative">
              <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 rounded-xl appearance-none focus:ring-4 focus:ring-[#ed5c37]/5 focus:border-[#ed5c37]/20 outline-none transition-all shadow-sm">
                <option value="ALL">All Projects</option>
                {activeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <Briefcase className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
           </div>
        </div>

        <div className="space-y-1.5">
           <label className="text-xs font-bold text-slate-500 ml-1">Date</label>
           <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 rounded-xl focus:ring-4 focus:ring-[#ed5c37]/5 focus:border-[#ed5c37]/20 outline-none transition-all shadow-sm" />
        </div>
      </div>

      {viewMode === 'CARD' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {groupedStatuses.map((group) => (
            <div key={group.id} className="premium-card space-y-5">
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs uppercase">
                    {group.user.name.substring(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-900 leading-none">{group.user.name}</h3>
                      <div className="flex flex-wrap gap-1">
                        {group.projects.map(p => (
                          <span key={p.projectId} className="px-2 py-0.5 bg-slate-900 text-[10px] font-bold text-white rounded-md uppercase tracking-wider">{p.projectName} &bull; {p.hours || 0}h</span>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-1.5">
                      <Calendar className="w-3 h-3" /> {new Date(group.date).toLocaleDateString()} &bull; {new Date(group.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setViewStatusId(group.id)} className="p-2 text-slate-400 hover:text-[#ed5c37] hover:bg-[#ed5c37]/5 rounded-lg transition-all"><Eye className="w-4 h-4" /></button>
                  <button onClick={() => handleEdit(group)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(group.date)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="space-y-4 pt-1">
                <div className="flex gap-4">
                  <div className="mt-1 w-2 h-2 bg-green-500 rounded-full shrink-0" />
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Wins</span>
                    <p className="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{renderWithLinks(group.workDone)}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="mt-1 w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Next</span>
                    <p className="text-sm text-slate-600 italic font-medium leading-relaxed whitespace-pre-wrap">{renderWithLinks(group.plannedWork)}</p>
                  </div>
                </div>

                {group.blockers && (
                  <div className="p-3 bg-red-50 rounded-xl border border-red-100 flex gap-3">
                    <div className="mt-1 w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest leading-none">Blocker</span>
                      <p className="text-xs text-red-700 font-bold leading-tight whitespace-pre-wrap">{renderWithLinks(group.blockers)}</p>
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
                    <th className="px-6 py-4">Project Name</th>
                    <th className="px-6 py-4">Highlights</th>
                    <th className="px-6 py-4">Timeline</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {groupedStatuses.map((group) => (
                    <tr key={group.id} className="hover:bg-slate-50 transition-colors">
                       <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {group.projects.map(p => (
                              <span key={p.projectId} className="text-[9px] bg-slate-900 text-white px-2 py-1 rounded-md w-fit uppercase font-bold tracking-wider">{p.projectName} &bull; {p.hours || 0}h</span>
                            ))}
                          </div>
                       </td>
                       <td className="px-6 py-4 max-w-sm">
                          <p className="text-slate-600 font-medium truncate">{renderWithLinks(group.workDone)}</p>
                       </td>
                       <td className="px-6 py-4">
                          <div className="flex flex-col text-slate-400 font-bold text-xs">
                             <span>{new Date(group.date).toLocaleDateString()}</span>
                             <span className="text-[10px] opacity-60 font-medium">at {new Date(group.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                       </td>
                       <td className="px-6 py-4 text-right">
                           <div className="flex justify-end gap-1">
                              <button onClick={() => setViewStatusId(group.id)} className="p-2 text-slate-400 hover:text-[#ed5c37] hover:bg-[#ed5c37]/5 rounded-lg transition-all"><Eye className="w-4 h-4" /></button>
                              <button onClick={() => handleEdit(group)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Edit2 className="w-4 h-4" /></button>
                              <button onClick={() => handleDelete(group.date)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                           </div>
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
      )}

      {viewStatusId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[60] flex items-center justify-center p-6 animate-in fade-in duration-400" onClick={() => setViewStatusId(null)}>
           <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500" onClick={e => e.stopPropagation()}>
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                 <div>
                    <h2 className="text-xl font-bold text-slate-900">Task Details</h2>
                    <p className="text-sm font-medium text-slate-500">{groupedStatuses.find(s => s.id === viewStatusId)?.projects.map(p => p.projectName).join(", ")}</p>
                 </div>
                 <button onClick={() => setViewStatusId(null)} className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-8 space-y-8">
                 <div className="space-y-3">
                    <div className="flex items-center justify-between">
                       <span className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">Highlights & Links</span>
                       <button 
                         type="button"
                         onClick={() => handleCopy(groupedStatuses.find(s => s.id === viewStatusId)?.workDone || '')}
                         className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#ed5c37] hover:bg-[#ed5c37]/90 px-3 py-2 rounded-lg transition-all shadow-md focus:ring-4 focus:ring-[#ed5c37]/20"
                       >
                         {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} 
                         {copied ? 'Copied Details!' : 'Copy Highlights'}
                       </button>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 whitespace-pre-wrap leading-relaxed shadow-inner max-h-[40vh] overflow-y-auto">
                       {renderWithLinks(groupedStatuses.find(s => s.id === viewStatusId)?.workDone || '')}
                    </div>
                 </div>
                 
                 <div className="space-y-3">
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">Planned Work</span>
                     <div className="p-5 bg-blue-50/50 border border-blue-100/50 rounded-xl text-sm font-medium text-slate-600 whitespace-pre-wrap italic">
                        {renderWithLinks(groupedStatuses.find(s => s.id === viewStatusId)?.plannedWork || '')}
                     </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[60] flex items-center justify-center p-6 animate-in fade-in duration-400">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
            <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">{isEditing ? "Edit Status" : "Status Refresh"}</h2>
                <p className="text-sm font-medium text-slate-500 mt-1">Publish your latest progress</p>
              </div>
              <button onClick={() => { setShowModal(false); setSelectedProjects([]); setProjectHours({}); setIsDropdownOpen(false); }} className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"><X className="w-6 h-6" /></button>
            </div>
            
            <form action={async (formData) => {
              setLoading(true);
              const res = isEditing 
                ? await updateGroupedDailyStatus(currentEditDate, formData) 
                : await addDailyStatus(formData);

              if (res && 'error' in res) {
                setError(res.error || "An unknown error occurred.");
                setLoading(false);
              } else {
                setError("");
                setShowModal(false);
                setEditingGroup(null);
                setLoading(false);
                fetchData(); 
              }
            }} className="p-10 space-y-6">
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2 relative">
                      <label className="block text-sm font-semibold text-slate-700 ml-1">Project Hub (Multi-Select)</label>
                      <div 
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-[#ed5c37]/10 focus:border-[#ed5c37]/40 rounded-xl font-medium text-slate-900 transition-all outline-none cursor-pointer flex justify-between items-center z-10"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      >
                        <span className="truncate">{selectedProjects.length > 0 ? `${selectedProjects.length} Projects Selected` : "Select Projects..."}</span>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      </div>
                      {isDropdownOpen && (
                        <div className="absolute top-[80px] left-0 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-[70] max-h-48 overflow-y-auto">
                           {activeProjects.map(p => (
                             <div 
                               key={p.id} 
                               className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex items-center gap-3"
                               onClick={() => {
                                 setSelectedProjects(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]);
                               }}
                             >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedProjects.includes(p.id) ? 'bg-[#ed5c37] border-[#ed5c37] text-white' : 'border-slate-300'}`}>
                                  {selectedProjects.includes(p.id) && <Check className="w-3 h-3" />}
                                </div>
                                <span className="text-sm font-semibold text-slate-700">{p.name}</span>
                             </div>
                           ))}
                        </div>
                      )}
                      {selectedProjects.map(id => (
                        <input key={id} type="hidden" name="projectId" value={id} />
                      ))}
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 ml-1">Target Date</label>
                      <input type="date" name="date" required defaultValue={isEditing && editingGroup ? editingGroup.date.split('T')[0] : new Date().toISOString().split('T')[0]} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-[#ed5c37]/10 focus:border-[#ed5c37]/40 rounded-xl font-medium text-slate-900 transition-all outline-none" />
                    </div>
                  </div>

                  {selectedProjects.length > 0 && (
                    <div className="space-y-3 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 mb-2">Hours Spent Per Project</label>
                      <div className="grid grid-cols-2 gap-4 auto-rows-max">
                         {selectedProjects.map(id => {
                            const proj = projects.find(p => p.id === id);
                            return (
                              <div key={id} className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm relative focus-within:ring-2 focus-within:ring-[#ed5c37]/30 transition-all">
                                <span className="text-xs font-bold text-slate-700 flex-1 truncate">{proj?.name}</span>
                                <input 
                                  type="number" 
                                  name="hours" 
                                  step="0.5"
                                  min="0"
                                  required
                                  placeholder="0.0"
                                  value={projectHours[id] || ""}
                                  onChange={(e) => setProjectHours(prev => ({...prev, [id]: e.target.value}))}
                                  className="w-16 bg-transparent border-none text-right font-black text-slate-900 outline-none"
                                />
                                <span className="text-[10px] font-bold text-slate-400 py-1 px-2 bg-slate-50 rounded-md">hrs</span>
                              </div>
                            )
                         })}
                      </div>
                    </div>
                  )}
                </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700 ml-1">Daily Wins (Accomplishments)</label>
                <textarea name="workDone" required defaultValue={isEditing && editingGroup ? editingGroup.workDone : ''} placeholder="What milestones did you hit today?" rows={3} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-[#ed5c37]/10 focus:border-[#ed5c37]/40 rounded-xl font-medium text-slate-900 transition-all outline-none resize-none" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                   <label className="block text-sm font-semibold text-slate-700 ml-1">Future Roadmap (Tomorrow)</label>
                   <textarea name="plannedWork" required defaultValue={isEditing && editingGroup ? editingGroup.plannedWork : ''} placeholder="Next targets?" rows={2} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-[#ed5c37]/10 focus:border-[#ed5c37]/40 rounded-xl font-medium text-slate-900 transition-all outline-none resize-none" />
                </div>
                <div className="space-y-2">
                   <label className="block text-sm font-semibold text-slate-700 ml-1">Blockers (If Any)</label>
                   <textarea name="blockers" defaultValue={isEditing && editingGroup ? editingGroup.blockers || '' : ''} placeholder="Stuck on something?" rows={2} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-[#ed5c37]/10 focus:border-[#ed5c37]/40 rounded-xl font-medium text-slate-900 transition-all outline-none resize-none" />
                </div>
              </div>

              {error && <div className="p-5 bg-red-50 border-3 border-red-100 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-3xl animate-shake">{error}</div>}

              <div className="pt-6 flex gap-4">
                <button type="button" onClick={() => { setShowModal(false); setSelectedProjects([]); setProjectHours({}); setIsDropdownOpen(false); setEditingGroup(null); }} className="flex-1 py-3 px-6 rounded-xl font-semibold bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all text-sm">Discard</button>
                <button type="submit" disabled={loading} className="flex-1 py-3 px-6 rounded-xl font-semibold bg-[#ed5c37] text-white shadow-lg hover:bg-[#ed5c37]/90 transition-all flex items-center justify-center text-sm">
                  {loading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : (isEditing ? "Update Status Reports" : "Publish Status")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

