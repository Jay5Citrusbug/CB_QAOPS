"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, ChevronRight, Shield, User, AlertCircle } from "lucide-react";
import { useSession } from "next-auth/react";

interface Project {
  id: string;
  name: string;
  tlName: string;
  assigneeName: string;
  devName: string;
  status: string;
}

export default function TestCasesProjectsPage() {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch("/api/projects");
        const data = await res.json();
        setProjects(data);
      } catch (err) {
        console.error("Failed to fetch projects", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const userRole = (session?.user as any)?.role;
  const userProjectId = (session?.user as any)?.projectId;

  const filteredProjects = projects.filter(p => {
    // Role-based filtering: DEVs only see their assigned project
    if (userRole === "DEV") {
      return p.id === userProjectId;
    }
    
    // Global search for other roles
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                         p.tlName.toLowerCase().includes(search.toLowerCase()) ||
                         p.devName.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="page-header !mb-0">
        <h1 className="page-title">Test Cases</h1>
        <p className="page-desc">Select a project stream to manage test cases</p>
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
           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm">{filteredProjects.length} projects found</span>
        </div>
        
        {loading ? (
            <div className="p-12 text-center text-slate-500 text-sm font-medium animate-pulse">Loading projects...</div>
        ) : filteredProjects.length === 0 ? (
            <div className="p-16 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 mb-4">
                    <AlertCircle className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-slate-900 font-bold mb-1">No Projects Found</h3>
                <p className="text-slate-500 text-sm max-w-xs mx-auto">
                    {userRole === "DEV" 
                      ? "You haven't been assigned to a project yet. Please contact your system administrator."
                      : "No active projects match your search criteria."}
                </p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                {filteredProjects.map((project) => (
                    <Link key={project.id} href={`/test-cases/${project.id}`} className="block group">
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-[#ed5c37]/30 hover:shadow-xl hover:shadow-[#ed5c37]/5 transition-all duration-300 relative overflow-hidden h-full flex flex-col">
                            <div className="absolute top-0 right-0 p-4 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                <ChevronRight className="w-5 h-5 text-[#ed5c37]" />
                            </div>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm group-hover:bg-[#ed5c37] transition-colors">
                                    {project.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 group-hover:text-[#ed5c37] transition-colors">{project.name}</h3>
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest border mt-1 ${
                                        project.status === 'ACTIVE' 
                                            ? 'bg-green-50 text-green-700 border-green-100' 
                                            : 'bg-red-50 text-red-700 border-red-100'
                                        }`}>
                                        {project.status}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="space-y-3 mt-auto pt-4 border-t border-slate-100">
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <Shield className="w-3.5 h-3.5 text-[#ed5c37]" />
                                        <span className="font-medium text-xs tracking-tight">TL</span>
                                    </div>
                                    <span className="font-semibold text-slate-900 text-xs">{project.tlName}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <User className="w-3.5 h-3.5 text-[#ed5c37]/60" />
                                        <span className="font-medium text-xs tracking-tight">QA</span>
                                    </div>
                                    <span className="font-semibold text-slate-900 text-xs">{project.assigneeName}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <User className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="font-medium text-xs tracking-tight">Dev</span>
                                    </div>
                                    <span className="font-semibold text-slate-900 text-xs">{project.devName}</span>
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}
