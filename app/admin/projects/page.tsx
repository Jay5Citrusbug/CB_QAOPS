"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createProject, updateProject, deleteProject } from "@/lib/actions";
import { 
  Plus, 
  X, 
  Search, 
  Briefcase, 
  User, 
  Shield, 
  CheckCircle2, 
  AlertCircle, 
  Edit2, 
  Trash2, 
  Clock, 
  Activity, 
  AlertTriangle,
  Calendar,
  Layers,
  LayoutGrid,
  Eye,
  Loader2
} from "lucide-react";
import { useConfirm } from "@/components/providers/ConfirmProvider";

interface Project {
  id: string;
  code: string;
  name: string;
  tlName: string;
  assigneeName: string;
  devName: string;
  status: string;
  description: string;
  scope: string;
  requirements: string;
  startDate: string | null;
  targetReleaseDate: string | null;
  primaryQaEmail: string | string[];
  primaryQaName: string | string[];
  supportingQaEmail: string | string[];
  supportingQaName: string | string[];
  teamLeadEmail: string | string[];
  teamLeadName: string | string[];
  developerEmails: string[];
  developerNames: string[];
  documents: any[];
  createdAt: string | null;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function ProjectHubPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const [currentTab, setCurrentTab] = useState<"projects" | "workload" | "matrix">("projects");
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedDevEmails, setSelectedDevEmails] = useState<string[]>([]);
  
  // Multi-select QA and Lead states
  const [selectedTlEmails, setSelectedTlEmails] = useState<string[]>([]);
  const [selectedPrimaryQaEmails, setSelectedPrimaryQaEmails] = useState<string[]>([]);
  const [selectedSupportingQaEmails, setSelectedSupportingQaEmails] = useState<string[]>([]);

  const [tlDropdownOpen, setTlDropdownOpen] = useState(false);
  const [primaryQaDropdownOpen, setPrimaryQaDropdownOpen] = useState(false);
  const [supportingQaDropdownOpen, setSupportingQaDropdownOpen] = useState(false);
  const [devDropdownOpen, setDevDropdownOpen] = useState(false);

  // Refs for click outside detection
  const tlDropdownRef = useRef<HTMLDivElement>(null);
  const primaryQaDropdownRef = useRef<HTMLDivElement>(null);
  const supportingQaDropdownRef = useRef<HTMLDivElement>(null);
  const devDropdownRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tlDropdownRef.current && !tlDropdownRef.current.contains(event.target as Node)) {
        setTlDropdownOpen(false);
      }
      if (primaryQaDropdownRef.current && !primaryQaDropdownRef.current.contains(event.target as Node)) {
        setPrimaryQaDropdownOpen(false);
      }
      if (supportingQaDropdownRef.current && !supportingQaDropdownRef.current.contains(event.target as Node)) {
        setSupportingQaDropdownOpen(false);
      }
      if (devDropdownRef.current && !devDropdownRef.current.contains(event.target as Node)) {
        setDevDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchProjects = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error("Failed to fetch projects", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      const uniqueUsers: UserProfile[] = [];
      const seenEmails = new Set<string>();
      for (const u of data) {
        const email = (u.email || '').toLowerCase().trim();
        if (email && !seenEmails.has(email)) {
          seenEmails.add(email);
          uniqueUsers.push(u);
        }
      }
      setUsers(uniqueUsers);
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  useEffect(() => {
    async function init() {
      setLoadingData(true);
      await Promise.all([fetchProjects(), fetchUsers()]);
      setLoadingData(false);
    }
    init();
  }, []);

  const getArray = (val: any) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return [val];
  };

  const filteredProjects = projects.filter(p => {
    const nameStr = Array.isArray(p.primaryQaName) ? p.primaryQaName.join(', ') : (p.primaryQaName || '');
    return p.name.toLowerCase().includes(search.toLowerCase()) || 
      (p.code || '').toLowerCase().includes(search.toLowerCase()) ||
      nameStr.toLowerCase().includes(search.toLowerCase());
  });

  const handleEdit = (project: Project) => {
    setIsEditing(true);
    setCurrentProject(project);
    setSelectedDevEmails(project.developerEmails || []);
    setSelectedTlEmails(getArray(project.teamLeadEmail));
    setSelectedPrimaryQaEmails(getArray(project.primaryQaEmail));
    setSelectedSupportingQaEmails(getArray(project.supportingQaEmail));
    setError("");
    setDevDropdownOpen(false);
    setTlDropdownOpen(false);
    setPrimaryQaDropdownOpen(false);
    setSupportingQaDropdownOpen(false);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = await confirm({
      title: "Delete Project",
      message: "Are you sure? This will delete the project and cascade delete daily statuses!",
      confirmText: "Delete",
      type: "danger"
    });
    if (!isConfirmed) return;

    const prevProjects = [...projects];
    setProjects(prev => prev.filter(p => p.id !== id));
    setToast({ message: "Project deleted successfully!", type: "success" });

    try {
      const res = await deleteProject(id);
      if (res && 'error' in res) throw new Error(res.error);
      fetchProjects();
    } catch (err: any) {
      setProjects(prevProjects);
      setToast({ message: err.message || "An error occurred during deletion.", type: "error" });
    }
  };

  const handleNewProject = () => {
    setIsEditing(false);
    setCurrentProject(null);
    setSelectedDevEmails([]);
    setSelectedTlEmails([]);
    setSelectedPrimaryQaEmails([]);
    setSelectedSupportingQaEmails([]);
    setError("");
    setDevDropdownOpen(false);
    setTlDropdownOpen(false);
    setPrimaryQaDropdownOpen(false);
    setSupportingQaDropdownOpen(false);
    setShowModal(true);
  };

  // Filter QA and Dev users for dropdowns
  const qaUsers = users.filter(u => u.role === "USER" || u.role === "TL" || u.role === "ADMIN");
  const devUsers = users.filter(u => u.role === "DEV");
  const tlUsers = users.filter(u => u.role === "TL" || u.role === "ADMIN");

  // QA Workload Calculation
  const qaWorkloads = qaUsers.map(qa => {
    const primaryProjects = projects.filter(p => {
      const pQa = p.primaryQaEmail;
      return Array.isArray(pQa) ? pQa.includes(qa.email) : pQa === qa.email;
    });
    const primaryCount = primaryProjects.length;
    const totalCount = primaryCount;
    const activeCount = primaryProjects.filter(p => p.status === "ACTIVE").length;

    let workloadStatus = "Healthy";
    let workloadClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (totalCount >= 9) {
      workloadStatus = "High Workload";
      workloadClass = "bg-rose-100 text-rose-800 border-rose-200";
    } else if (totalCount >= 6) {
      workloadStatus = "Moderate";
      workloadClass = "bg-amber-100 text-amber-800 border-amber-200";
    }

    return {
      name: qa.name,
      email: qa.email,
      primaryCount,
      totalCount,
      activeCount,
      workloadStatus,
      workloadClass
    };
  });

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case "ACTIVE":
        return <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-sky-100 text-sky-800 border border-sky-200">Active</span>;
      case "COMPLETED":
        return <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">Completed</span>;
      case "ON_HOLD":
      case "ON HOLD":
        return <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-amber-100 text-amber-800 border border-amber-200">On Hold</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-slate-100 text-slate-800 border border-slate-200">{status}</span>;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loadingData) {
    return (
      <div className="space-y-8 max-w-7xl mx-auto animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2.5">
            <div className="h-8 w-48 bg-slate-200 rounded-xl" />
            <div className="h-4 w-72 bg-slate-100 rounded-lg" />
          </div>
          <div className="h-11 w-36 bg-slate-200 rounded-xl shrink-0" />
        </div>

        {/* Tabs Skeleton */}
        <div className="flex items-center gap-6 border-b border-slate-200 pb-px">
          <div className="h-10 w-28 bg-slate-200 rounded-t-lg" />
          <div className="h-10 w-44 bg-slate-100 rounded-t-lg" />
          <div className="h-10 w-36 bg-slate-100 rounded-t-lg" />
        </div>

        {/* Content Table Card Skeleton */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden animate-pulse">
          {/* Search bar placeholder */}
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
            <div className="h-10 w-96 bg-slate-200 rounded-xl" />
            <div className="h-6 w-32 bg-slate-100 rounded-lg" />
          </div>
          
          {/* Table skeleton */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4"><div className="h-4 w-28 bg-slate-200 rounded-md" /></th>
                  <th className="px-6 py-4"><div className="h-4 w-16 bg-slate-200 rounded-md" /></th>
                  <th className="px-6 py-4"><div className="h-4 w-24 bg-slate-200 rounded-md" /></th>
                  <th className="px-6 py-4 text-center"><div className="h-4 w-12 bg-slate-200 mx-auto rounded-md" /></th>
                  <th className="px-6 py-4 text-right"><div className="h-4 w-20 bg-slate-200 ml-auto rounded-md" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-5"><div className="h-5 w-40 bg-slate-200 rounded-md" /></td>
                    <td className="px-6 py-5"><div className="h-5 w-16 bg-slate-100 rounded-full" /></td>
                    <td className="px-6 py-5">
                      <div className="h-4 w-24 bg-slate-200 rounded-md mb-1.5" />
                      <div className="h-3 w-36 bg-slate-100 rounded-md" />
                    </td>
                    <td className="px-6 py-5 text-center"><div className="h-5 w-8 bg-slate-100 mx-auto rounded-md" /></td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        <div className="h-8 w-8 bg-slate-100 rounded-xl" />
                        <div className="h-8 w-8 bg-slate-100 rounded-xl" />
                        <div className="h-8 w-8 bg-slate-100 rounded-xl" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto relative">
      {isSyncing && (
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#ed5c37] animate-pulse z-[100]" />
      )}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="page-header !mb-0">
          <h1 className="page-title flex items-center gap-2.5"><Briefcase className="w-8 h-8 text-[#ed5c37]" /> Project Hub</h1>
          <p className="page-desc">Manage Delivery streams, QA Allocations, and Workloads</p>
        </div>
        <button 
          onClick={handleNewProject}
          className="btn-primary flex items-center gap-1.5 px-5 py-3 bg-[#ed5c37] hover:bg-[#d94a28] text-white font-bold rounded-xl shadow-lg shadow-orange-500/15 text-sm"
        >
          <Plus className="w-5 h-5" /> New Project
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
        <button
          onClick={() => setCurrentTab("projects")}
          className={`px-5 py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 -mb-px ${
            currentTab === "projects"
              ? "border-[#ed5c37] text-[#ed5c37]"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <LayoutGrid className="w-4 h-4" /> Projects List
        </button>
        <button
          onClick={() => setCurrentTab("workload")}
          className={`px-5 py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 -mb-px ${
            currentTab === "workload"
              ? "border-[#ed5c37] text-[#ed5c37]"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <User className="w-4 h-4" /> QA Workload Dashboard
        </button>
        <button
          onClick={() => setCurrentTab("matrix")}
          className={`px-5 py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 -mb-px ${
            currentTab === "matrix"
              ? "border-[#ed5c37] text-[#ed5c37]"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <Layers className="w-4 h-4" /> Ownership Matrix
        </button>
      </div>

      {/* Tab Panel contents */}
      {currentTab === "projects" && (
        <div className="premium-card !p-0 overflow-hidden bg-white border border-slate-200 rounded-3xl shadow-sm">
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
             <div className="relative w-full md:w-96 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#ed5c37] transition-colors" />
                <input 
                  type="text" 
                  placeholder="Search projects, QAs..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium focus:ring-4 focus:ring-[#ed5c37]/5 focus:border-[#ed5c37]/20 outline-none transition-all shadow-sm" 
                />
             </div>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm">
               {filteredProjects.length} streams tracked
             </span>
          </div>
          
          <div className="overflow-x-auto relative min-h-[200px]">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Project Stream</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Primary QA</th>
                  <th className="px-6 py-4 text-center">Devs</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400 font-medium">
                      No projects found.
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((project) => (
                    <tr 
                      key={project.id} 
                      onClick={() => router.push(`/my-projects/${project.id}`)}
                      className="hover:bg-slate-50/50 transition-all group cursor-pointer"
                    >
                      <td className="px-6 py-4.5">
                        <span className="font-extrabold text-slate-800 block group-hover:text-[#ed5c37] transition-colors">{project.name}</span>
                      </td>
                      <td className="px-6 py-4.5">{getStatusBadge(project.status)}</td>
                      <td className="px-6 py-4.5">
                        <span className="font-semibold text-slate-800">
                          {Array.isArray(project.primaryQaName) 
                            ? (project.primaryQaName.filter(Boolean).join(', ') || "-") 
                            : (project.primaryQaName || "-")}
                        </span>
                        {project.primaryQaEmail && (
                          <span className="text-[10px] text-slate-400 block">
                            {Array.isArray(project.primaryQaEmail) 
                              ? (project.primaryQaEmail.filter(Boolean).join(', ') || "-") 
                              : (project.primaryQaEmail || "-")}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4.5 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 rounded-md font-bold text-xs border border-slate-200 text-slate-600">
                          {project.developerEmails?.length || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4.5 text-right" onClick={(e) => e.stopPropagation()}>
                         <div className="flex justify-end gap-1.5">
                            <Link 
                              href={`/my-projects/${project.id}`} 
                              className="p-2 text-slate-400 hover:text-[#ed5c37] hover:bg-orange-50 rounded-xl transition-all shadow-sm border border-slate-200/50 bg-white inline-flex items-center"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Link>
                            <button 
                              onClick={() => handleEdit(project)} 
                              className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all shadow-sm border border-slate-200/50 bg-white"
                              title="Edit Project"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDelete(project.id)} 
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shadow-sm border border-slate-200/50 bg-white"
                              title="Delete Project"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                         </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {currentTab === "workload" && (
        <div className="premium-card !p-0 overflow-hidden bg-white border border-slate-200 rounded-3xl shadow-sm">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-extrabold text-slate-800 text-base">QA Workload Summary</h3>
            <p className="text-slate-400 text-xs mt-0.5">Rules: 0-5 Projects = Healthy, 6-8 = Moderate, 9+ = High Workload</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">QA Engineer</th>
                  <th className="px-6 py-4 text-center">Primary Owned Projects</th>
                  <th className="px-6 py-4 text-center">Active Projects</th>
                  <th className="px-6 py-4 text-center">Total Projects</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {qaWorkloads.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400 font-medium">No QA user profiles found.</td>
                  </tr>
                ) : (
                  qaWorkloads.map(wl => (
                    <tr key={wl.email} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4.5">
                        <span className="font-extrabold text-slate-800 block">{wl.name}</span>
                        <span className="text-xs text-slate-400 block mt-0.5">{wl.email}</span>
                      </td>
                      <td className="px-6 py-4.5 text-center font-semibold text-slate-800">{wl.primaryCount}</td>
                      <td className="px-6 py-4.5 text-center font-semibold text-sky-700">{wl.activeCount}</td>
                      <td className="px-6 py-4.5 text-center font-extrabold text-[#ed5c37]">{wl.totalCount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {currentTab === "matrix" && (
        <div className="premium-card !p-0 overflow-hidden bg-white border border-slate-200 rounded-3xl shadow-sm">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-extrabold text-slate-800 text-base">Project Ownership Matrix</h3>
            <p className="text-slate-400 text-xs mt-0.5">Quick lookup of QA allocations per delivery stream</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Project Name</th>
                  <th className="px-6 py-4">Primary QA</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Start Date</th>
                  <th className="px-6 py-4">Target Release</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400 font-medium">No projects tracked yet.</td>
                  </tr>
                ) : (
                  projects.map(p => (
                    <tr 
                      key={p.id} 
                      onClick={() => router.push(`/my-projects/${p.id}`)}
                      className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4.5 font-bold text-slate-800 hover:text-[#ed5c37] transition-colors">{p.name}</td>
                      <td className="px-6 py-4.5">
                        <span className="font-semibold text-slate-800">
                          {Array.isArray(p.primaryQaName) 
                            ? (p.primaryQaName.filter(Boolean).join(', ') || "-") 
                            : (p.primaryQaName || "-")}
                        </span>
                      </td>
                      <td className="px-6 py-4.5">{getStatusBadge(p.status)}</td>
                      <td className="px-6 py-4.5 text-xs font-medium text-slate-500">{formatDate(p.startDate)}</td>
                      <td className="px-6 py-4.5 text-xs font-medium text-slate-500">{formatDate(p.targetReleaseDate)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="page-header !mb-0">
                <h2 className="page-title text-xl font-extrabold text-slate-900">{isEditing ? "Modify Project Stream" : "Register Project Stream"}</h2>
                <p className="page-desc text-xs mt-0.5">Configure delivery parameters and QA ownership</p>
              </div>
              <button 
                onClick={() => setShowModal(false)} 
                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                if (loading) return;
                setLoading(true);
                setError("");

                const formData = new FormData(e.currentTarget);
                try {
                  const res = isEditing && currentProject 
                    ? await updateProject(currentProject.id, formData) 
                    : await createProject(formData);
                  
                  if (res && 'error' in res) {
                    setError(res.error || "An error occurred");
                    setToast({ message: res.error || "Failed to save project.", type: "error" });
                    setLoading(false);
                  } else {
                    setError("");
                    setShowModal(false);
                    await fetchProjects();
                    setToast({ 
                      message: isEditing ? "Project updated successfully!" : "Project registered successfully!", 
                      type: "success" 
                    });
                    setLoading(false);
                  }
                } catch (err: any) {
                  setError(err.message || "An unexpected error occurred.");
                  setToast({ message: err.message || "An unexpected error occurred.", type: "error" });
                  setLoading(false);
                }
              }}
              className="p-6 space-y-5 overflow-y-auto flex-1"
            >

              {/* ── Row 1: Project Name | Project Status ── */}
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block ml-1">Project Name <span className="text-[#ed5c37]">*</span></label>
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={currentProject?.name}
                    placeholder="e.g. Playwright Automation"
                    className="w-full px-4 py-[11px] bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-[#ed5c37]/5 focus:border-[#ed5c37]/30 rounded-xl font-semibold text-sm text-slate-700 transition-all outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block ml-1">Project Status <span className="text-[#ed5c37]">*</span></label>
                  <select
                    name="status"
                    defaultValue={currentProject?.status || "ACTIVE"}
                    className="w-full px-4 py-[11px] bg-slate-50 border border-slate-200 focus:bg-white rounded-xl font-semibold text-sm text-slate-700 outline-none transition-all cursor-pointer"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              {/* ── Row 2: Team Lead | Primary QA ── */}
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5 relative" ref={tlDropdownRef}>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block ml-1">Team Lead</label>
                  <button
                    type="button"
                    onClick={() => setTlDropdownOpen(!tlDropdownOpen)}
                    className="w-full px-4 py-[11px] bg-slate-50 border border-slate-200 focus:bg-white rounded-xl font-semibold text-sm text-slate-700 outline-none transition-all cursor-pointer text-left flex justify-between items-center"
                  >
                    <span className="truncate pr-2 block">
                      {selectedTlEmails.length === 0
                        ? "Select Team Lead"
                        : `${selectedTlEmails.length} team lead${selectedTlEmails.length > 1 ? "s" : ""} selected`}
                    </span>
                    <span className="text-slate-400 text-xs shrink-0">▼</span>
                  </button>
                  {tlDropdownOpen && (
                    <div className="absolute z-[70] left-0 right-0 mt-1 p-3 bg-white border border-slate-200 rounded-xl shadow-xl max-h-44 overflow-y-auto space-y-1.5 animate-in fade-in duration-150">
                      {tlUsers.map(tl => {
                        const isChecked = selectedTlEmails.includes(tl.email);
                        return (
                          <label key={tl.email} className="flex items-center gap-2.5 p-1.5 hover:bg-slate-50 rounded-lg text-sm font-semibold text-slate-700 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTlEmails([...selectedTlEmails, tl.email]);
                                } else {
                                  setSelectedTlEmails(selectedTlEmails.filter(email => email !== tl.email));
                                }
                              }}
                              className="rounded border-slate-300 text-[#ed5c37] focus:ring-[#ed5c37]"
                            />
                            <span>{tl.name}</span>
                          </label>
                        );
                      })}
                      {tlUsers.length === 0 && <span className="text-xs text-slate-400 p-2 block text-center">No team leads available</span>}
                    </div>
                  )}
                  {selectedTlEmails.map(email => (
                    <input key={email} type="hidden" name="teamLeadEmail" value={email} />
                  ))}
                  {selectedTlEmails.length === 0 && (
                    <input type="hidden" name="teamLeadEmail" value="" />
                  )}
                </div>
                
                <div className="space-y-1.5 relative" ref={primaryQaDropdownRef}>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block ml-1">Primary QA <span className="text-[#ed5c37]">*</span></label>
                  <button
                    type="button"
                    onClick={() => setPrimaryQaDropdownOpen(!primaryQaDropdownOpen)}
                    className="w-full px-4 py-[11px] bg-slate-50 border border-slate-200 focus:bg-white rounded-xl font-semibold text-sm text-slate-700 outline-none transition-all cursor-pointer text-left flex justify-between items-center"
                  >
                    <span className="truncate pr-2 block">
                      {selectedPrimaryQaEmails.length === 0
                        ? "Select Primary QA"
                        : `${selectedPrimaryQaEmails.length} QA${selectedPrimaryQaEmails.length > 1 ? "s" : ""} selected`}
                    </span>
                    <span className="text-slate-400 text-xs shrink-0">▼</span>
                  </button>
                  {primaryQaDropdownOpen && (
                    <div className="absolute z-[70] left-0 right-0 mt-1 p-3 bg-white border border-slate-200 rounded-xl shadow-xl max-h-44 overflow-y-auto space-y-1.5 animate-in fade-in duration-150">
                      {qaUsers.map(qa => {
                        const isChecked = selectedPrimaryQaEmails.includes(qa.email);
                        return (
                          <label key={qa.email} className="flex items-center gap-2.5 p-1.5 hover:bg-slate-50 rounded-lg text-sm font-semibold text-slate-700 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPrimaryQaEmails([...selectedPrimaryQaEmails, qa.email]);
                                } else {
                                  setSelectedPrimaryQaEmails(selectedPrimaryQaEmails.filter(email => email !== qa.email));
                                }
                              }}
                              className="rounded border-slate-300 text-[#ed5c37] focus:ring-[#ed5c37]"
                            />
                            <span>{qa.name}</span>
                          </label>
                        );
                      })}
                      {qaUsers.length === 0 && <span className="text-xs text-slate-400 p-2 block text-center">No QA users available</span>}
                    </div>
                  )}
                  {selectedPrimaryQaEmails.map(email => (
                    <input key={email} type="hidden" name="primaryQaEmail" value={email} />
                  ))}
                  {selectedPrimaryQaEmails.length === 0 && (
                    <input type="text" className="opacity-0 absolute w-0 h-0 pointer-events-none" required value="" readOnly name="primaryQaEmail-required-placeholder" />
                  )}
                </div>
              </div>

              {/* ── Row 3: Supporting QA | Assigned Developers ── */}
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5 relative" ref={supportingQaDropdownRef}>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block ml-1">Supporting QA <span className="text-slate-300">(Optional)</span></label>
                  <button
                    type="button"
                    onClick={() => setSupportingQaDropdownOpen(!supportingQaDropdownOpen)}
                    className="w-full px-4 py-[11px] bg-slate-50 border border-slate-200 focus:bg-white rounded-xl font-semibold text-sm text-slate-700 outline-none transition-all cursor-pointer text-left flex justify-between items-center"
                  >
                    <span className="truncate pr-2 block">
                      {selectedSupportingQaEmails.length === 0
                        ? "None"
                        : `${selectedSupportingQaEmails.length} QA${selectedSupportingQaEmails.length > 1 ? "s" : ""} selected`}
                    </span>
                    <span className="text-slate-400 text-xs shrink-0">▼</span>
                  </button>
                  {supportingQaDropdownOpen && (
                    <div className="absolute z-[70] left-0 right-0 mt-1 p-3 bg-white border border-slate-200 rounded-xl shadow-xl max-h-44 overflow-y-auto space-y-1.5 animate-in fade-in duration-150">
                      {qaUsers.map(qa => {
                        const isChecked = selectedSupportingQaEmails.includes(qa.email);
                        return (
                          <label key={qa.email} className="flex items-center gap-2.5 p-1.5 hover:bg-slate-50 rounded-lg text-sm font-semibold text-slate-700 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSupportingQaEmails([...selectedSupportingQaEmails, qa.email]);
                                } else {
                                  setSelectedSupportingQaEmails(selectedSupportingQaEmails.filter(email => email !== qa.email));
                                }
                              }}
                              className="rounded border-slate-300 text-[#ed5c37] focus:ring-[#ed5c37]"
                            />
                            <span>{qa.name}</span>
                          </label>
                        );
                      })}
                      {qaUsers.length === 0 && <span className="text-xs text-slate-400 p-2 block text-center">No QA users available</span>}
                    </div>
                  )}
                  {selectedSupportingQaEmails.map(email => (
                    <input key={email} type="hidden" name="supportingQaEmail" value={email} />
                  ))}
                  {selectedSupportingQaEmails.length === 0 && (
                    <input type="hidden" name="supportingQaEmail" value="" />
                  )}
                </div>

                <div className="space-y-1.5 relative" ref={devDropdownRef}>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block ml-1">Assigned Developers</label>
                  <button
                    type="button"
                    onClick={() => setDevDropdownOpen(!devDropdownOpen)}
                    className="w-full px-4 py-[11px] bg-slate-50 border border-slate-200 focus:bg-white rounded-xl font-semibold text-sm text-slate-700 outline-none transition-all cursor-pointer text-left flex justify-between items-center"
                  >
                    <span className="truncate pr-2 block">
                      {selectedDevEmails.length === 0
                        ? "Select Developers"
                        : `${selectedDevEmails.length} dev${selectedDevEmails.length > 1 ? "s" : ""} selected`}
                    </span>
                    <span className="text-slate-400 text-xs shrink-0">▼</span>
                  </button>
                  {devDropdownOpen && (
                    <div className="absolute z-[70] left-0 right-0 mt-1 p-3 bg-white border border-slate-200 rounded-xl shadow-xl max-h-44 overflow-y-auto space-y-1.5 animate-in fade-in duration-150">
                      {devUsers.map(dev => {
                        const isChecked = selectedDevEmails.includes(dev.email);
                        return (
                          <label key={dev.email} className="flex items-center gap-2.5 p-1.5 hover:bg-slate-50 rounded-lg text-sm font-semibold text-slate-700 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedDevEmails([...selectedDevEmails, dev.email]);
                                } else {
                                  setSelectedDevEmails(selectedDevEmails.filter(email => email !== dev.email));
                                }
                              }}
                              className="rounded border-slate-300 text-[#ed5c37] focus:ring-[#ed5c37]"
                            />
                            <span>{dev.name}</span>
                          </label>
                        );
                      })}
                      {devUsers.length === 0 && <span className="text-xs text-slate-400 p-2 block text-center">No developers available</span>}
                    </div>
                  )}
                  {selectedDevEmails.map(email => (
                    <input key={email} type="hidden" name="developerEmails" value={email} />
                  ))}
                </div>
              </div>

              {/* ── Row 4: Start Date | Expected Delivery Date ── */}
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span>Start Date</span>
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    defaultValue={currentProject?.startDate ? currentProject.startDate.split("T")[0] : ""}
                    className="w-full px-4 py-[11px] bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-[#ed5c37]/5 focus:border-[#ed5c37]/30 rounded-xl font-semibold text-sm text-slate-700 transition-all outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span>Delivery Date</span>
                  </label>
                  <input
                    type="date"
                    name="targetReleaseDate"
                    defaultValue={currentProject?.targetReleaseDate ? currentProject.targetReleaseDate.split("T")[0] : ""}
                    className="w-full px-4 py-[11px] bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-[#ed5c37]/5 focus:border-[#ed5c37]/30 rounded-xl font-semibold text-sm text-slate-700 transition-all outline-none"
                  />
                </div>
              </div>

              {/* ── Row 5: Project Description (full width) ── */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block ml-1">Project Description</label>
                <textarea
                  name="description"
                  defaultValue={currentProject?.description || ""}
                  placeholder="Brief description of the project..."
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-[#ed5c37]/5 focus:border-[#ed5c37]/30 rounded-xl font-semibold text-sm text-slate-700 transition-all outline-none resize-none"
                />
              </div>

              {/* ── Row 6: Requirements Summary (full width) ── */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block ml-1">Requirements Summary</label>
                <textarea
                  name="requirements"
                  defaultValue={currentProject?.requirements || ""}
                  placeholder="Key requirements and acceptance criteria..."
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-[#ed5c37]/5 focus:border-[#ed5c37]/30 rounded-xl font-semibold text-sm text-slate-700 transition-all outline-none resize-none"
                />
              </div>

              {error && <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl"><AlertCircle className="w-4 h-4 text-red-500 shrink-0" /><span className="text-xs font-bold text-red-600">{error}</span></div>}

              <div className="pt-2 flex gap-4 border-t border-slate-100">
                <button type="button" disabled={loading} onClick={() => setShowModal(false)} className="flex-1 py-3 px-4 rounded-xl font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-50 transition-all text-sm">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 btn-primary justify-center shadow-lg shadow-orange-500/20 bg-[#ed5c37] hover:bg-[#d94a28] text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-all text-sm flex items-center gap-1.5">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{isEditing ? "Updating..." : "Saving..."}</span>
                    </>
                  ) : (
                    <span>{isEditing ? "Update Project" : "Save Project"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-xl animate-in slide-in-from-bottom-5 duration-300 ${
          toast.type === "success" 
            ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
            : "bg-red-50 border-red-100 text-red-800"
        }`}>
          {toast.type === "success" ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />}
          <span className="text-sm font-bold">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 p-0.5 hover:bg-black/5 rounded text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
