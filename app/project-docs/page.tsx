"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { 
  Folder, 
  FolderOpen, 
  Search, 
  FileText, 
  Star,
  ExternalLink,
  Download,
  X,
  ArrowLeft,
  FileCheck,
  FileSpreadsheet,
  FileCode,
  File,
  Loader2,
  Lock,
  ChevronRight,
  BookOpen,
  FolderDot,
  Eye
} from "lucide-react";
import { toggleDocumentFavorite } from "@/lib/actions";
import DocumentPreviewModal from "@/components/DocumentPreviewModal";

interface Document {
  id: string;
  name: string;
  category: string;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
  isLink?: boolean;
  favoritedBy?: string[];
}

interface Project {
  id: string;
  code: string;
  name: string;
  tlName: string;
  assigneeName: string;
  devName: string;
  status: string;
  description: string;
  documents: Document[];
  createdAt: string | null;
}

const DOCUMENT_CATEGORIES = [
  "Requirements",
  "Business Documents",
  "User Stories",
  "Design Documents",
  "API Documentation",
  "Test Plans",
  "Test Cases",
  "Automation Documents",
  "Release Notes",
  "Meeting Notes",
  "Other Documents"
];

export default function ProjectDocsPage() {
  const { data: session } = useSession();
  const userEmail = session?.user?.email || "";

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [docSearch, setDocSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      const data = await res.json();
      setProjects(data);
    } catch (err: any) {
      setError(err.message || "An error occurred while loading project documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userEmail) {
      fetchProjects();
    }
  }, [userEmail]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Keep selectedProject state updated when projects state changes
  useEffect(() => {
    if (selectedProject) {
      const updated = projects.find(p => p.id === selectedProject.id);
      if (updated) {
        setSelectedProject(updated);
      }
    }
  }, [projects]);

  const handleToggleFavorite = async (projectId: string, docId: string) => {
    try {
      setIsSyncing(true);
      const res = await toggleDocumentFavorite(projectId, docId);
      if (res && "error" in res) {
        setToast({ message: res.error || "Failed to update favorites", type: "error" });
      } else {
        const proj = projects.find(p => p.id === projectId);
        const doc = proj?.documents?.find(d => d.id === docId);
        const isCurrentlyFavorited = doc?.favoritedBy?.includes(userEmail);
        setToast({ 
          message: isCurrentlyFavorited ? "Removed from favorites" : "Added to favorites", 
          type: "success" 
        });

        // Update local projects state
        setProjects(prev =>
          prev.map(p => {
            if (p.id === projectId) {
              return {
                ...p,
                documents: p.documents.map(d => {
                  if (d.id === docId) {
                    const favs = d.favoritedBy || [];
                    return {
                      ...d,
                      favoritedBy: favs.includes(userEmail)
                        ? favs.filter(email => email !== userEmail)
                        : [...favs, userEmail]
                    };
                  }
                  return d;
                })
              };
            }
            return p;
          })
        );
      }
    } catch (err: any) {
      setToast({ message: err.message || "An error occurred", type: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  const getDocIcon = (name: string, isLink?: boolean) => {
    if (isLink) {
      return <ExternalLink className="w-8 h-8 text-indigo-500" />;
    }
    const ext = name.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return <FileCheck className="w-8 h-8 text-rose-500" />;
      case "xls":
      case "xlsx":
        return <FileSpreadsheet className="w-8 h-8 text-emerald-500" />;
      case "doc":
      case "docx":
        return <FileText className="w-8 h-8 text-blue-500" />;
      case "txt":
        return <File className="w-8 h-8 text-slate-400" />;
      case "png":
      case "jpg":
      case "jpeg":
        return <FileCode className="w-8 h-8 text-amber-500" />;
      default:
        return <File className="w-8 h-8 text-slate-500" />;
    }
  };

  const formatDate = (dateStr: any) => {
    if (!dateStr) return "N/A";
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return "N/A";
    return dateObj.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Stats Calculations
  const stats = useMemo(() => {
    const totalProjects = projects.length;
    let totalDocs = 0;
    let favoritedDocs = 0;

    projects.forEach(p => {
      totalDocs += p.documents?.length || 0;
      p.documents?.forEach(d => {
        if (d.favoritedBy?.includes(userEmail)) {
          favoritedDocs++;
        }
      });
    });

    return { totalProjects, totalDocs, favoritedDocs };
  }, [projects, userEmail]);

  // Filter projects by search term
  const filteredProjects = useMemo(() => {
    return projects.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [projects, searchTerm]);

  // Filter selected project's documents by search term
  const filteredDocs = useMemo(() => {
    if (!selectedProject) return [];
    if (!docSearch.trim()) return selectedProject.documents || [];
    const lower = docSearch.toLowerCase();
    return (selectedProject.documents || []).filter(d =>
      d.name.toLowerCase().includes(lower) ||
      d.category.toLowerCase().includes(lower)
    );
  }, [selectedProject, docSearch]);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-8 animate-pulse">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-5">
          <div className="space-y-2.5">
            <div className="h-8 w-64 bg-slate-200 rounded-xl" />
            <div className="h-4 w-96 bg-slate-100 rounded-lg" />
          </div>
        </div>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-5 bg-white rounded-3xl border border-slate-200 min-h-[100px] flex flex-col justify-between">
              <div className="h-3.5 w-24 bg-slate-200 rounded" />
              <div className="h-8 w-12 bg-slate-200 rounded mt-3" />
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="h-10 bg-slate-150 rounded-2xl w-full" />

        {/* Folders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="p-6 bg-white rounded-3xl border border-slate-200 h-44 flex flex-col justify-between">
              <div className="w-12 h-12 rounded-2xl bg-slate-200" />
              <div className="space-y-2">
                <div className="h-4 w-32 bg-slate-200 rounded" />
                <div className="h-3 w-16 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 relative">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[9999] p-4 rounded-2xl shadow-xl border flex items-center gap-2.5 animate-in slide-in-from-bottom-5 duration-300 ${
          toast.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
        }`}>
          <div className={`w-2 h-2 rounded-full ${toast.type === "success" ? "bg-emerald-500" : "bg-rose-500"}`} />
          <span className="text-xs font-bold">{toast.message}</span>
        </div>
      )}

      {/* Syncing Overlay blocker */}
      {mounted && typeof window !== "undefined" && isSyncing
        ? createPortal(
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[9999] flex items-center justify-center animate-in fade-in duration-300">
              <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-3xl border border-slate-100 shadow-2xl animate-in scale-in duration-200">
                <Loader2 className="w-10 h-10 text-[#ed5c37] animate-spin" />
                <p className="text-xs text-slate-500 font-bold animate-pulse">Updating favorites...</p>
              </div>
            </div>,
            document.body
          )
        : null}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-5 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-[#ed5c37]" /> Centralized Project Docs
          </h1>
          <p className="text-slate-500 mt-1.5 text-sm">
            Explore and access documentation repositories across all projects in folder view.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-800 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Projects</span>
          <span className="text-3xl font-extrabold text-slate-800 mt-3">{stats.totalProjects}</span>
        </div>
        <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Documents</span>
          <span className="text-3xl font-extrabold text-[#ed5c37] mt-3">{stats.totalDocs}</span>
        </div>
        <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Starred Documents</span>
          <span className="text-3xl font-extrabold text-amber-500 mt-3 flex items-center gap-1">
            <Star className="w-6 h-6 fill-amber-400 text-amber-400" /> {stats.favoritedDocs}
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
        <div className="relative group">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#ed5c37] transition-colors">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search projects by name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#ed5c37]/20 focus:border-[#ed5c37] transition-all font-medium"
          />
        </div>
      </div>

      {/* Folders Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredProjects.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 font-semibold border-2 border-dashed border-slate-200 rounded-3xl">
            No projects found.
          </div>
        ) : (
          filteredProjects.map((p) => {
            const docCount = p.documents?.length || 0;
            return (
              <div
                key={p.id}
                onClick={() => {
                  setSelectedProject(p);
                  setDocSearch("");
                }}
                className="p-6 bg-white hover:bg-slate-50/50 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-44 cursor-pointer group relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#ed5c37]/10 group-hover:bg-[#ed5c37] transition-colors" />
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#ed5c37] group-hover:scale-105 transition-transform shadow-xs">
                    <Folder className="w-6 h-6 fill-orange-50" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm group-hover:text-[#ed5c37] transition-colors line-clamp-1 mt-3">
                    {p.name}
                  </h3>
                  {p.code && <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider mt-0.5">{p.code}</span>}
                  <div className="mt-3.5 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-100 pt-2.5">
                    <span>Repository</span>
                    <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{docCount} {docCount === 1 ? "doc" : "docs"}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Project Folder Documents View Overlay Modal */}
      {selectedProject && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-end animate-in fade-in duration-300"
          onClick={() => setSelectedProject(null)}
        >
          <div 
            className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300 border-l border-slate-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-[#ed5c37] flex items-center justify-center shadow-xs">
                    <FolderOpen className="w-5.5 h-5.5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                      {selectedProject.name}
                    </h3>
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider mt-0.5">
                      {selectedProject.code || "Project Folder"}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedProject(null)}
                  className="p-2 hover:bg-slate-200/50 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search documents inside the folder */}
              <div className="px-6 py-4 border-b border-slate-100 bg-white">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#ed5c37] transition-colors" />
                  <input
                    type="text"
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    placeholder="Search docs inside this folder..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#ed5c37]/20 focus:border-[#ed5c37] outline-none transition-all"
                  />
                </div>
              </div>

              {/* Categorized Document Listing */}
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                {selectedProject.documents?.length === 0 ? (
                  <div className="p-16 text-center text-slate-400 text-sm font-semibold border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/20">
                    No documents uploaded in this project workspace.
                  </div>
                ) : filteredDocs.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs font-semibold">
                    No matching documents found.
                  </div>
                ) : (
                  DOCUMENT_CATEGORIES.map(category => {
                    const categorizedDocs = filteredDocs.filter(d => d.category === category);
                    if (categorizedDocs.length === 0) return null;

                    return (
                      <div key={category} className="space-y-2.5">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block pl-1">{category}</h4>
                        <div className="space-y-2">
                          {categorizedDocs.map(doc => {
                            const isStarred = doc.favoritedBy?.includes(userEmail);
                            return (
                              <div
                                key={doc.id}
                                className="p-3.5 bg-slate-50 hover:bg-slate-100/50 border border-slate-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors group"
                              >
                                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                                  <div className="mt-0.5 shrink-0">{getDocIcon(doc.name, doc.isLink)}</div>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold text-slate-800 text-sm truncate group-hover:text-[#ed5c37] transition-colors">{doc.name}</div>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-1.5">
                                      <span>By {doc.uploadedBy}</span>
                                      <span>•</span>
                                      <span>{formatDate(doc.uploadedAt)}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                                  {/* Star Button */}
                                  <button
                                    onClick={() => handleToggleFavorite(selectedProject.id, doc.id)}
                                    className="p-2 text-slate-505 hover:text-amber-500 hover:bg-white rounded-xl shadow-sm border border-slate-100 transition-all bg-white cursor-pointer"
                                    title={isStarred ? "Remove from Favorites" : "Add to Favorites"}
                                  >
                                    <Star 
                                      className={`w-3.5 h-3.5 ${isStarred ? "fill-amber-400 text-amber-400" : "text-slate-450"}`} 
                                    />
                                  </button>

                                  {/* Open Link or Download */}
                                  {!doc.isLink && (
                                    <button
                                      onClick={() => setPreviewDoc(doc)}
                                      className="p-2 text-slate-505 hover:text-[#ed5c37] hover:bg-white rounded-xl shadow-sm border border-slate-100 transition-all bg-white cursor-pointer"
                                      title="Preview"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {doc.isLink ? (
                                    <a
                                      href={doc.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-2 text-slate-500 hover:text-indigo-650 hover:bg-white rounded-xl shadow-sm border border-slate-100 transition-all bg-white"
                                      title="Open Link"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  ) : (
                                    <a
                                      href={doc.url}
                                      download={doc.name}
                                      className="p-2 text-slate-505 hover:text-blue-600 hover:bg-white rounded-xl shadow-sm border border-slate-100 transition-all bg-white"
                                      title="Download"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {previewDoc && (
        <DocumentPreviewModal
          isOpen={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          docName={previewDoc.name}
          docUrl={previewDoc.url}
          category={previewDoc.category}
        />
      )}
    </div>
  );
}
