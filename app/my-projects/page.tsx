"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Folder, 
  Search, 
  Filter, 
  CheckCircle, 
  Play, 
  Pause, 
  AlertTriangle, 
  Activity,
  UserCheck,
  Users,
  Calendar,
  Clock,
  ArrowRight,
  Shield,
  AlertCircle,
  FileText,
  Lock
} from "lucide-react";

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
  primaryQaEmail: string;
  primaryQaName: string;
  supportingQaEmail: string;
  supportingQaName: string;
  teamLeadEmail: string;
  teamLeadName: string;
  developerEmails: string[];
  developerNames: string[];
  documents: any[];
  timeline: Record<string, {
    status: 'Not Started' | 'In Progress' | 'Completed' | 'Blocked';
    owner: string;
    plannedDate: string | null;
    completedDate: string | null;
    notes: string;
  }>;
  notesAndFlags: Array<{
    id: string;
    type: 'Note' | 'Risk' | 'Blocker' | 'Dependency';
    title: string;
    description: string;
    createdBy: string;
    createdDate: string;
    priority: 'Low' | 'Medium' | 'High' | 'Critical';
    status: 'Open' | 'Resolved';
  }>;
  createdAt: string | null;
  updated_at?: string | null;
}

export default function MyProjectsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Array<{ id: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [primaryFilter, setPrimaryFilter] = useState("all");

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      const data = await res.json();
      setProjects(data);
    } catch (err: any) {
      setError(err.message || "An error occurred while loading projects");
    } finally {
      setLoading(false);
    }
  };

  const fetchMilestones = async () => {
    try {
      const res = await fetch("/api/milestones");
      if (res.ok) {
        const data = await res.json();
        setMilestones(data);
      }
    } catch (err) {
      console.error("Failed to fetch milestones:", err);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchProjects();
      fetchMilestones();
    }
  }, [session]);

  const userEmail = session?.user?.email || "";
  const userRole = (session?.user as any)?.role || "";
  const isQaLead = userRole === "ADMIN" || userRole === "TL";

  // Filter projects depending on the role
  // QA Engineers (role USER/DEV) should only see projects where they are assigned as primary or supporting
  const myInvolvedProjects = projects.filter(p => {
    if (isQaLead) return true;
    return p.primaryQaEmail === userEmail || p.supportingQaEmail === userEmail || p.developerEmails?.includes(userEmail);
  });

  // Unique Primary QAs in the user's projects for filter dropdowns
  const uniquePrimaryQAs = Array.from(
    new Map(projects.filter(p => p.primaryQaEmail).map(p => [p.primaryQaEmail, p.primaryQaName])).entries()
  );

  // Apply filters
  const filteredProjects = myInvolvedProjects.filter(p => {
    // Search by Name or Code
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.code || '').toLowerCase().includes(searchTerm.toLowerCase());

    // Status
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;

    // Primary QA Filter
    const matchesPrimary = primaryFilter === "all" || p.primaryQaEmail === primaryFilter;

    return matchesSearch && matchesStatus && matchesPrimary;
  });

  // Calculate Metrics for Project Dashboard Summary (based on all projects)
  const totalProjectsCount = projects.length;
  const activeProjectsCount = projects.filter(p => p.status === "ACTIVE").length;
  const onHoldProjectsCount = projects.filter(p => p.status === "ON_HOLD" || p.status === "ON HOLD").length;
  const completedProjectsCount = projects.filter(p => p.status === "COMPLETED").length;
  const myOwnedProjectsCount = projects.filter(p => p.primaryQaEmail === userEmail).length;
  const mySupportingProjectsCount = projects.filter(p => p.supportingQaEmail === userEmail).length;

  // Calculate Metrics for "My Accountability" Section (based on logged in user's role/involvement)
  const personalOwned = myInvolvedProjects.filter(p => p.primaryQaEmail === userEmail).length;
  const personalSupported = myInvolvedProjects.filter(p => p.supportingQaEmail === userEmail).length;
  const personalActive = myInvolvedProjects.filter(p => p.status === "ACTIVE" && (p.primaryQaEmail === userEmail || p.supportingQaEmail === userEmail)).length;
  const personalCompleted = myInvolvedProjects.filter(p => p.status === "COMPLETED" && (p.primaryQaEmail === userEmail || p.supportingQaEmail === userEmail)).length;

  // Derive Upcoming Delivery Dates for My Accountability
  const upcomingDeliveries = myInvolvedProjects
    .filter(p => p.targetReleaseDate && p.status !== "COMPLETED")
    .map(p => {
      let dVal: Date | null = null;
      if (p.targetReleaseDate) {
        if (typeof p.targetReleaseDate === 'object' && (p.targetReleaseDate as any).seconds !== undefined) {
          dVal = new Date((p.targetReleaseDate as any).seconds * 1000);
        } else {
          dVal = new Date(p.targetReleaseDate);
        }
      }
      return {
        id: p.id,
        name: p.name,
        dueDate: dVal && !isNaN(dVal.getTime()) ? dVal : null,
        role: p.primaryQaEmail === userEmail ? "Owner" : "Backup"
      };
    })
    .filter(d => d.dueDate !== null)
    .sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0))
    .slice(0, 3);

  // Derive Pending Timeline Activities for My Accountability
  // Map of keys to human names (dynamic with static defaults)
  const milestoneNames = milestones.reduce((acc, curr) => {
    acc[curr.id] = curr.label;
    return acc;
  }, {
    smokeTesting: "Smoke Testing",
    testCaseWriting: "Test Case Writing",
    designValidation: "Design Validation",
    integrationTesting: "Integration Testing",
    regressionTesting: "Regression Testing",
    uatSupport: "UAT Support",
    releaseVerification: "Release Verification",
    postReleaseValidation: "Post Release Validation"
  } as Record<string, string>);

  const pendingMilestones: Array<{ projectName: string; projectId: string; milestone: string; status: string; plannedDate: string | null }> = [];
  myInvolvedProjects.forEach(p => {
    if (p.timeline) {
      Object.entries(p.timeline).forEach(([key, val]) => {
        if (val.status !== "Completed" && (p.primaryQaEmail === userEmail || p.supportingQaEmail === userEmail)) {
          pendingMilestones.push({
            projectName: p.name,
            projectId: p.id,
            milestone: milestoneNames[key] || key,
            status: val.status,
            plannedDate: val.plannedDate
          });
        }
      });
    }
  });

  const getSafeTime = (dateStr: any): number => {
    if (!dateStr) return 0;
    let d: Date;
    if (typeof dateStr === 'object' && dateStr.seconds !== undefined) {
      d = new Date(dateStr.seconds * 1000);
    } else {
      d = new Date(dateStr);
    }
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  const sortedPendingMilestones = pendingMilestones
    .sort((a, b) => {
      const timeA = getSafeTime(a.plannedDate);
      const timeB = getSafeTime(b.plannedDate);
      if (timeA === 0) return 1;
      if (timeB === 0) return -1;
      return timeA - timeB;
    })
    .slice(0, 3);

  // Derive Recent Updates (projects recently updated)
  const recentUpdatesList = [...myInvolvedProjects]
    .sort((a, b) => {
      const timeA = getSafeTime(a.updated_at) || getSafeTime(a.createdAt);
      const timeB = getSafeTime(b.updated_at) || getSafeTime(b.createdAt);
      return timeB - timeA;
    })
    .slice(0, 3);

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case "ACTIVE":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-sky-100 text-sky-850 border border-sky-200">Active</span>;
      case "COMPLETED":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-850 border border-emerald-200">Completed</span>;
      case "ON_HOLD":
      case "ON HOLD":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-medium">On Hold</span>;
      case "INACTIVE":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200">Inactive</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-50 text-slate-805 border border-slate-200">{status}</span>;
    }
  };

  const formatDate = (dateStr: any) => {
    if (!dateStr) return "N/A";
    let dateObj: Date;
    if (dateStr instanceof Date) {
      dateObj = dateStr;
    } else if (typeof dateStr === 'object' && dateStr.seconds !== undefined) {
      dateObj = new Date(dateStr.seconds * 1000);
    } else {
      dateObj = new Date(dateStr);
    }
    if (isNaN(dateObj.getTime())) return "N/A";
    return dateObj.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-[#ed5c37] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-500 font-semibold text-sm animate-pulse">Loading Accountability Hub...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <Folder className="w-8 h-8 text-[#ed5c37]" /> QA Accountability Hub
          </h1>
          <p className="text-slate-500 mt-1.5 text-sm">
            {isQaLead 
              ? "QA Lead Dashboard: Total oversight of all delivery streams, QA workloads, risks, and timelines." 
              : "QA Workspace: Manage your assigned projects, deliverables, milestones, and documentation."
            }
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-800 text-sm font-medium">
          {error}
        </div>
      )}

      {/* ==================================================== */}
      {/* PROJECT DASHBOARD SUMMARY */}
      {/* ==================================================== */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest block ml-1">Project Dashboard Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Projects</span>
            <span className="text-3xl font-extrabold text-slate-800 mt-3">{totalProjectsCount}</span>
          </div>
          <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Projects</span>
            <span className="text-3xl font-extrabold text-sky-600 mt-3">{activeProjectsCount}</span>
          </div>
          <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">On Hold Projects</span>
            <span className="text-3xl font-extrabold text-amber-600 mt-3">{onHoldProjectsCount}</span>
          </div>
          <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completed Projects</span>
            <span className="text-3xl font-extrabold text-emerald-600 mt-3">{completedProjectsCount}</span>
          </div>
          <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">My Owned Projects</span>
            <span className="text-3xl font-extrabold text-[#ed5c37] mt-3">{myOwnedProjectsCount}</span>
          </div>
          <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Supporting Projects</span>
            <span className="text-3xl font-extrabold text-blue-600 mt-3">{mySupportingProjectsCount}</span>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* SEARCH AND FILTERS */}
      {/* ==================================================== */}
      <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1 group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#ed5c37] transition-colors">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search by project name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#ed5c37]/20 focus:border-[#ed5c37] transition-all font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-2xl border border-slate-200">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-600 focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="COMPLETED">Completed</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            {/* Primary QA Filter */}
            {isQaLead && (
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-2xl border border-slate-200">
                <span className="text-xs font-bold text-slate-400">Primary QA:</span>
                <select
                  value={primaryFilter}
                  onChange={(e) => setPrimaryFilter(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold text-slate-600 focus:outline-none cursor-pointer"
                >
                  <option value="all">All QAs</option>
                  {uniquePrimaryQAs.map(([email, name]) => (
                    <option key={email} value={email}>{name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* PROJECT LIST VIEW */}
      {/* ==================================================== */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {isQaLead ? (
            /* ==================================================== */
            /* QA LEAD VIEW */
            /* ==================================================== */
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Project Name</th>
                  <th className="py-4 px-4">Primary QA</th>
                  <th className="py-4 px-4">Supporting QA</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-4">Expected Delivery Date</th>
                  <th className="py-4 px-4 text-center">Open Risks</th>
                  <th className="py-4 px-4 text-center">Open Blockers</th>
                  <th className="py-4 px-4">Last Updated</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 px-6 text-center text-slate-400 font-semibold">
                      No projects assigned yet. Please contact your administrator.
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((p) => {
                    const openRisks = p.notesAndFlags?.filter(n => n.type === 'Risk' && n.status === 'Open').length || 0;
                    const openBlockers = p.notesAndFlags?.filter(n => n.type === 'Blocker' && n.status === 'Open').length || 0;
                    const displayDate = p.updated_at ? formatDate(p.updated_at) : formatDate(p.createdAt);

                    return (
                      <tr 
                        key={p.id} 
                        onClick={() => router.push(`/my-projects/${p.id}`)}
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                      >
                        <td className="py-4.5 px-6">
                          <div>
                            <span className="font-extrabold text-slate-800 group-hover:text-[#ed5c37] transition-colors">{p.name}</span>
                            {p.code && <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider mt-0.5">{p.code}</span>}
                          </div>
                        </td>
                        <td className="py-4.5 px-4 font-semibold text-slate-800">{p.primaryQaName || "Unassigned"}</td>
                        <td className="py-4.5 px-4 text-slate-600 font-medium">{p.supportingQaName || "None"}</td>
                        <td className="py-4.5 px-4">{getStatusBadge(p.status)}</td>
                        <td className="py-4.5 px-4 text-slate-600 font-semibold">{formatDate(p.targetReleaseDate)}</td>
                        <td className="py-4.5 px-4 text-center">
                          {openRisks > 0 ? (
                            <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-md font-bold text-xs">
                              {openRisks}
                            </span>
                          ) : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="py-4.5 px-4 text-center">
                          {openBlockers > 0 ? (
                            <span className="px-2 py-0.5 bg-red-50 border border-red-200 text-red-700 rounded-md font-bold text-xs">
                              {openBlockers}
                            </span>
                          ) : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="py-4.5 px-4 text-slate-500 text-xs font-semibold">{displayDate}</td>
                        <td className="py-4.5 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                          <Link href={`/my-projects/${p.id}`} className="px-4.5 py-1.5 bg-slate-900 hover:bg-[#ed5c37] text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-md transition-all inline-flex items-center gap-1.5">
                            View Details
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            /* ==================================================== */
            /* STANDARD QA ENGINEER VIEW */
            /* ==================================================== */
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Project Name</th>
                  <th className="py-4 px-4">Project Status</th>
                  <th className="py-4 px-4">Primary QA</th>
                  <th className="py-4 px-4">Expected Delivery Date</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 px-6 text-center text-slate-400 font-semibold">
                      No projects assigned yet. Please contact your administrator.
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((p) => {
                    return (
                      <tr 
                        key={p.id} 
                        onClick={() => router.push(`/my-projects/${p.id}`)}
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                      >
                        <td className="py-4.5 px-6 font-extrabold text-slate-800">
                          <div>
                            <span className="hover:text-[#ed5c37] transition-colors group-hover:text-[#ed5c37]">{p.name}</span>
                            {p.code && <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider mt-0.5">{p.code}</span>}
                          </div>
                        </td>
                        <td className="py-4.5 px-4">{getStatusBadge(p.status)}</td>
                        <td className="py-4.5 px-4 font-semibold text-slate-800">{p.primaryQaName || "Unassigned"}</td>
                        <td className="py-4.5 px-4 text-slate-600 font-semibold">{formatDate(p.targetReleaseDate)}</td>
                        <td className="py-4.5 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                          <Link href={`/my-projects/${p.id}`} className="px-4.5 py-1.5 bg-slate-900 hover:bg-[#ed5c37] text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-md transition-all inline-flex items-center gap-1.5">
                            View Details
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ==================================================== */}
      {/* MY ACCOUNTABILITY SECTION */}
      {/* ==================================================== */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest block ml-1">My Accountability</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Workload Summary Panel */}
          <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl shadow-xl flex flex-col justify-between min-h-[300px] hover:shadow-2xl transition-all">
            <div>
              <span className="text-[10px] font-bold text-[#ed5c37] uppercase tracking-widest flex items-center gap-1.5">
                <UserCheck className="w-4 h-4" /> Accountability Metrics
              </span>
              <h3 className="text-xl font-bold mt-2">Personal QA Workload</h3>
              
              <div className="grid grid-cols-2 gap-3 mt-5">
                <div className="bg-white/10 p-3 rounded-2xl border border-white/5">
                  <span className="text-[9px] font-bold text-slate-300 block uppercase tracking-wider">Projects Owned</span>
                  <span className="text-2xl font-extrabold mt-1 block">{personalOwned}</span>
                </div>
                <div className="bg-white/10 p-3 rounded-2xl border border-white/5">
                  <span className="text-[9px] font-bold text-slate-300 block uppercase tracking-wider">Projects Supported</span>
                  <span className="text-2xl font-extrabold mt-1 block">{personalSupported}</span>
                </div>
                <div className="bg-white/10 p-3 rounded-2xl border border-white/5">
                  <span className="text-[9px] font-bold text-slate-300 block uppercase tracking-wider">Active</span>
                  <span className="text-2xl font-extrabold mt-1 block text-sky-400">{personalActive}</span>
                </div>
                <div className="bg-white/10 p-3 rounded-2xl border border-white/5">
                  <span className="text-[9px] font-bold text-slate-300 block uppercase tracking-wider">Completed</span>
                  <span className="text-2xl font-extrabold mt-1 block text-emerald-300">{personalCompleted}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
              <span>Active workload: <strong>{personalActive}</strong></span>
              <span className={`px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                personalActive > 6 ? "bg-rose-500 text-white" : personalActive > 3 ? "bg-amber-500 text-white" : "bg-emerald-500 text-white"
              }`}>
                {personalActive > 6 ? "Overloaded" : personalActive > 3 ? "Moderate" : "Healthy"}
              </span>
            </div>
          </div>

          {/* Pending timeline activities */}
          <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[300px]">
            <div className="space-y-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#ed5c37]" /> Pending Timeline Activities
              </span>
              
              <div className="space-y-2.5">
                {sortedPendingMilestones.length === 0 ? (
                  <p className="text-slate-400 text-xs py-4 text-center">No pending timeline activities configured.</p>
                ) : (
                  sortedPendingMilestones.map((pm, idx) => (
                    <Link key={idx} href={`/my-projects/${pm.projectId}`} className="p-3 bg-slate-50 hover:bg-[#ed5c37]/5 border border-slate-100 rounded-2xl flex items-center justify-between transition-colors group block">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">{pm.projectName}</span>
                        <span className="text-xs font-bold text-slate-800 block mt-0.5">{pm.milestone}</span>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          pm.status === 'Blocked' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>{pm.status}</span>
                        {pm.plannedDate && <span className="text-[9px] text-slate-400 block mt-1">Due {formatDate(pm.plannedDate)}</span>}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Deliveries & Updates */}
          <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[300px]">
            <div className="space-y-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" /> Upcoming Delivery Dates
              </span>
              
              <div className="space-y-2.5">
                {upcomingDeliveries.length === 0 ? (
                  <p className="text-slate-400 text-xs py-4 text-center">No upcoming delivery expectations.</p>
                ) : (
                  upcomingDeliveries.map((ud, idx) => (
                    <Link key={idx} href={`/my-projects/${ud.id}`} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-100 flex items-center justify-between transition-colors group block">
                      <div>
                        <span className="text-xs font-extrabold text-slate-800 block">{ud.name}</span>
                        <span className="text-[9px] font-semibold text-slate-400 block mt-0.5">Role: {ud.role}</span>
                      </div>
                      <span className="text-xs font-bold text-[#ed5c37]">{formatDate(ud.dueDate)}</span>
                    </Link>
                  ))
                )}
              </div>
            </div>
            
            <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2 items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span>Recent Updates:</span>
              <div className="flex gap-1.5">
                {recentUpdatesList.map((ru, idx) => (
                  <Link key={idx} href={`/my-projects/${ru.id}`} className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 rounded-md transition-colors" title={ru.name}>
                    {ru.code || ru.name.substring(0, 3)}
                  </Link>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
