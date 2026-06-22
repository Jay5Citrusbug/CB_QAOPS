"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { 
  Star, 
  Search, 
  FileText, 
  ExternalLink, 
  Download, 
  X, 
  FileCheck, 
  FileSpreadsheet, 
  FileCode, 
  File, 
  Loader2,
  FolderOpen,
  ArrowRight,
  BookOpen,
  StickyNote,
  FlaskConical,
  Activity,
  User,
  Shield,
  ChevronRight,
  Clock,
  Eye
} from "lucide-react";
import DocumentPreviewModal from "@/components/DocumentPreviewModal";
import { 
  toggleDocumentFavorite, 
  toggleProjectFavorite, 
  toggleTestCaseFavorite, 
  toggleQuickNoteFavorite 
} from "@/lib/actions";
import { createPortal } from "react-dom";

// Interfaces
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
  favoritedBy?: string[];
  createdAt: string | null;
}

interface TestCase {
  testCaseId: string;
  title: string;
  module: string;
  priority: string;
  devStatus: string;
  qaStatus: string;
  crossBrowserVerified: string;
  jiraTicket: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  favoritedBy?: string[];
}

interface QuickNote {
  id: string;
  title: string;
  description: string;
  isFavorited?: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

type TabType = "documents" | "projects" | "testcases" | "notes";

export default function FavoritesPage() {
  const { data: session } = useSession();
  const userEmail = session?.user?.email || "";

  const [activeTab, setActiveTab] = useState<TabType>("documents");
  const [projects, setProjects] = useState<Project[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [quickNotes, setQuickNotes] = useState<QuickNote[]>([]);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [notesLoading, setNotesLoading] = useState(true);
  const [testCasesLoading, setTestCasesLoading] = useState(true);
  
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [mounted, setMounted] = useState(false);

  // States for viewing a quick note
  const [selectedNote, setSelectedNote] = useState<QuickNote | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch Projects (and from that, compile documents and projects)
  const fetchProjectsData = async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      const data = await res.json();
      setProjects(data);
      
      // Once projects are fetched, fetch test cases for each project in parallel
      fetchTestCases(data);
    } catch (err: any) {
      setError(err.message || "An error occurred while loading projects.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch Test Cases for all fetched projects
  const fetchTestCases = async (projectsList: Project[]) => {
    setTestCasesLoading(true);
    try {
      const favoritedProjectsList = projectsList.filter(p => p.favoritedBy?.includes(userEmail));
      
      const promises = favoritedProjectsList.map(async (p) => {
        const res = await fetch(`/api/projects/${p.id}/test-cases?limit=1000`);
        if (res.ok) {
          const data = await res.json();
          const cases = data.testCases || [];
          return cases.map((tc: any) => ({
            ...tc,
            projectId: p.id,
            projectName: p.name,
            projectCode: p.code
          }));
        }
        return [];
      });
      const results = await Promise.all(promises);
      setTestCases(results.flat());
    } catch (err) {
      console.error("Failed to load test cases favorites:", err);
    } finally {
      setTestCasesLoading(false);
    }
  };

  // Fetch Quick Notes
  const fetchQuickNotes = async () => {
    setNotesLoading(true);
    try {
      const res = await fetch("/api/quick-notes");
      if (res.ok) {
        const data = await res.json();
        // Filter only favorited ones
        const favNotes = data.filter((n: any) => n.isFavorited);
        setQuickNotes(favNotes);
      }
    } catch (err) {
      console.error("Failed to load quick notes favorites:", err);
    } finally {
      setNotesLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchProjectsData();
      fetchQuickNotes();
    }
  }, [session]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Unfavorite Handlers
  const handleUnfavoriteDocument = async (projectId: string, docId: string) => {
    try {
      setIsSyncing(true);
      const res = await toggleDocumentFavorite(projectId, docId);
      if (res && "error" in res) {
        setToast({ message: res.error || "Failed to update favorites", type: "error" });
      } else {
        setToast({ message: "Removed document from favorites", type: "success" });
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
                      favoritedBy: favs.filter(email => email !== userEmail)
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

  const handleUnfavoriteProject = async (projectId: string) => {
    try {
      setIsSyncing(true);
      const res = await toggleProjectFavorite(projectId);
      if (res && "error" in res) {
        setToast({ message: res.error || "Failed to update favorites", type: "error" });
      } else {
        setToast({ message: "Removed project from favorites", type: "success" });
        setProjects(prev =>
          prev.map(p => {
            if (p.id === projectId) {
              const favs = p.favoritedBy || [];
              return {
                ...p,
                favoritedBy: favs.filter(email => email !== userEmail)
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

  const handleUnfavoriteTestCase = async (projectId: string, testCaseId: string) => {
    try {
      setIsSyncing(true);
      const res = await toggleProjectFavorite(projectId);
      if (res && "error" in res) {
        setToast({ message: res.error || "Failed to update favorites", type: "error" });
      } else {
        setToast({ message: "Removed project and its test cases from favorites", type: "success" });
        setProjects(prev =>
          prev.map(p => {
            if (p.id === projectId) {
              const favs = p.favoritedBy || [];
              return {
                ...p,
                favoritedBy: favs.filter(email => email !== userEmail)
              };
            }
            return p;
          })
        );
        setTestCases(prev => prev.filter(tc => tc.projectId !== projectId));
      }
    } catch (err: any) {
      setToast({ message: err.message || "An error occurred", type: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUnfavoriteQuickNote = async (noteId: string) => {
    try {
      setIsSyncing(true);
      const res = await toggleQuickNoteFavorite(noteId);
      if (res && "error" in res) {
        setToast({ message: res.error || "Failed to update favorites", type: "error" });
      } else {
        setToast({ message: "Removed note from favorites", type: "success" });
        setQuickNotes(prev => prev.filter(n => n.id !== noteId));
      }
    } catch (err: any) {
      setToast({ message: err.message || "An error occurred", type: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  // Compile lists based on state
  const favoritedDocuments = useMemo(() => {
    const list: Array<Document & { projectId: string; projectName: string; projectCode: string }> = [];
    projects.forEach(p => {
      p.documents?.forEach(d => {
        if (d.favoritedBy?.includes(userEmail)) {
          list.push({
            ...d,
            projectId: p.id,
            projectName: p.name,
            projectCode: p.code
          });
        }
      });
    });
    return list;
  }, [projects, userEmail]);

  const favoritedProjects = useMemo(() => {
    return projects.filter(p => p.favoritedBy?.includes(userEmail));
  }, [projects, userEmail]);

  // Document Helpers
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

  // Filter content based on active tab & search keyword
  const filteredDocuments = useMemo(() => {
    if (!searchTerm.trim()) return favoritedDocuments;
    const lower = searchTerm.toLowerCase();
    return favoritedDocuments.filter(d => 
      d.name.toLowerCase().includes(lower) ||
      d.category.toLowerCase().includes(lower) ||
      d.projectName.toLowerCase().includes(lower) ||
      d.projectCode.toLowerCase().includes(lower)
    );
  }, [favoritedDocuments, searchTerm]);

  const filteredProjects = useMemo(() => {
    if (!searchTerm.trim()) return favoritedProjects;
    const lower = searchTerm.toLowerCase();
    return favoritedProjects.filter(p => 
      p.name.toLowerCase().includes(lower) ||
      (p.code || "").toLowerCase().includes(lower)
    );
  }, [favoritedProjects, searchTerm]);

  const filteredTestCases = useMemo(() => {
    if (!searchTerm.trim()) return testCases;
    const lower = searchTerm.toLowerCase();
    return testCases.filter(tc => 
      tc.testCaseId.toLowerCase().includes(lower) ||
      tc.title.toLowerCase().includes(lower) ||
      tc.module.toLowerCase().includes(lower) ||
      tc.projectName.toLowerCase().includes(lower)
    );
  }, [testCases, searchTerm]);

  const filteredNotes = useMemo(() => {
    if (!searchTerm.trim()) return quickNotes;
    const lower = searchTerm.toLowerCase();
    return quickNotes.filter(n => 
      n.title.toLowerCase().includes(lower) ||
      n.description.toLowerCase().includes(lower)
    );
  }, [quickNotes, searchTerm]);

  const activeLoading = useMemo(() => {
    if (activeTab === "documents" || activeTab === "projects") return loading;
    if (activeTab === "testcases") return testCasesLoading;
    if (activeTab === "notes") return notesLoading;
    return false;
  }, [activeTab, loading, testCasesLoading, notesLoading]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 relative">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[9999] p-4 rounded-2xl shadow-xl border flex items-center gap-2.5 animate-in slide-in-from-bottom-5 duration-300 bg-white ${
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
            <Star className="w-8 h-8 text-amber-500 fill-amber-100 animate-pulse" /> My Favorites
          </h1>
          <p className="text-slate-500 mt-1.5 text-sm">
            Central hub to access all your starred projects, documents, test cases, and quick notes.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-800 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-50/50 p-1.5 rounded-2xl border border-slate-200">
        <button
          onClick={() => { setActiveTab("documents"); setSearchTerm(""); }}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === "documents" ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
          }`}
        >
          <FileText className={`w-4 h-4 ${activeTab === "documents" ? "text-[#ed5c37]" : ""}`} />
          Documents
          <span className="ml-1 bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md text-[10px] font-black">
            {favoritedDocuments.length}
          </span>
        </button>

        <button
          onClick={() => { setActiveTab("projects"); setSearchTerm(""); }}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === "projects" ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
          }`}
        >
          <FolderOpen className={`w-4 h-4 ${activeTab === "projects" ? "text-[#ed5c37]" : ""}`} />
          Projects
          <span className="ml-1 bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md text-[10px] font-black">
            {favoritedProjects.length}
          </span>
        </button>

        <button
          onClick={() => { setActiveTab("testcases"); setSearchTerm(""); }}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === "testcases" ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
          }`}
        >
          <FlaskConical className={`w-4 h-4 ${activeTab === "testcases" ? "text-[#ed5c37]" : ""}`} />
          Test Cases
          <span className="ml-1 bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md text-[10px] font-black">
            {testCases.length}
          </span>
        </button>

        <button
          onClick={() => { setActiveTab("notes"); setSearchTerm(""); }}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === "notes" ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
          }`}
        >
          <StickyNote className={`w-4 h-4 ${activeTab === "notes" ? "text-[#ed5c37]" : ""}`} />
          Quick Notes
          <span className="ml-1 bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md text-[10px] font-black">
            {quickNotes.length}
          </span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
        <div className="relative group">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#ed5c37] transition-colors">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder={
              activeTab === "documents" ? "Search starred docs by name, type, or project..." :
              activeTab === "projects" ? "Search starred projects by name or code..." :
              activeTab === "testcases" ? "Search starred test cases by ID, title, module..." :
              "Search starred quick notes by title or description..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#ed5c37]/20 focus:border-[#ed5c37] transition-all font-medium"
          />
        </div>
      </div>

      {/* Tab Content Display */}
      {activeLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-5 bg-white rounded-3xl border border-slate-200 h-20 flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-200" />
                <div className="space-y-2">
                  <div className="h-4 w-48 bg-slate-200 rounded" />
                  <div className="h-3 w-32 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="w-20 h-8 bg-slate-150 rounded-lg" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          
          {/* DOCUMENTS TAB VIEW */}
          {activeTab === "documents" && (
            <div className="space-y-4">
              {filteredDocuments.length === 0 ? (
                <div className="py-16 text-center text-slate-400 font-semibold border-2 border-dashed border-slate-200 rounded-3xl bg-white">
                  {searchTerm ? "No matching favorited documents." : "No favorited documents yet. Visit Project Workspace details or Centralized Docs to star documents."}
                </div>
              ) : (
                filteredDocuments.map((doc) => (
                  <div
                    key={`doc-${doc.projectId}-${doc.id}`}
                    className="p-5 bg-white hover:bg-slate-50/50 border border-slate-200 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-md group relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-[#ed5c37]/10 group-hover:bg-[#ed5c37] transition-colors" />
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="mt-1 shrink-0">{getDocIcon(doc.name, doc.isLink)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-extrabold text-slate-800 text-sm group-hover:text-[#ed5c37] transition-colors truncate">
                            {doc.name}
                          </h3>
                          <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {doc.category}
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-2">
                          <Link href={`/my-projects/${doc.projectId}`} className="flex items-center gap-1 text-slate-500 hover:text-[#ed5c37] transition-colors">
                            <FolderOpen className="w-3.5 h-3.5" /> 
                            {doc.projectName} {doc.projectCode && `(${doc.projectCode})`}
                          </Link>
                          <span>•</span>
                          <span>By {doc.uploadedBy}</span>
                          <span>•</span>
                          <span>{formatDate(doc.uploadedAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {/* Unfavorite Button */}
                      <button
                        onClick={() => handleUnfavoriteDocument(doc.projectId, doc.id)}
                        className="p-2.5 text-amber-500 hover:bg-slate-100 rounded-xl shadow-xs border border-slate-155 transition-all bg-white cursor-pointer"
                        title="Remove from Favorites"
                      >
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      </button>

                      {!doc.isLink && (
                        <button
                          onClick={() => setPreviewDoc(doc)}
                          className="p-2.5 text-slate-505 hover:text-[#ed5c37] hover:bg-slate-100 rounded-xl shadow-xs border border-slate-150 transition-all bg-white flex items-center justify-center cursor-pointer"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}

                      {/* Download or Open Link */}
                      {doc.isLink ? (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 text-slate-500 hover:text-indigo-650 hover:bg-slate-100 rounded-xl shadow-xs border border-slate-150 transition-all bg-white flex items-center justify-center"
                          title="Open Link"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      ) : (
                        <a
                          href={doc.url}
                          download={doc.name}
                          className="p-2.5 text-slate-550 hover:text-blue-600 hover:bg-slate-100 rounded-xl shadow-xs border border-slate-150 transition-all bg-white flex items-center justify-center"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* PROJECTS TAB VIEW */}
          {activeTab === "projects" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredProjects.length === 0 ? (
                <div className="col-span-full py-16 text-center text-slate-400 font-semibold border-2 border-dashed border-slate-200 rounded-3xl bg-white">
                  {searchTerm ? "No matching favorited projects." : "No favorited projects yet. Click the star icon on projects in 'My Projects' page."}
                </div>
              ) : (
                filteredProjects.map((p) => (
                  <div
                    key={`proj-${p.id}`}
                    className="p-6 bg-white hover:bg-slate-50/50 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-44 group relative overflow-hidden cursor-pointer"
                  >
                    <Link href={`/my-projects/${p.id}`} className="absolute inset-0 z-0" />
                    
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-[#ed5c37]/10 group-hover:bg-[#ed5c37] transition-colors" />
                    
                    <div className="flex items-center justify-between relative z-10">
                      <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#ed5c37] group-hover:scale-105 transition-transform shadow-xs">
                        <FolderOpen className="w-6 h-6" />
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleUnfavoriteProject(p.id); }}
                        className="p-2 text-amber-500 hover:bg-slate-100 rounded-xl shadow-xs border border-slate-150 bg-white transition-all cursor-pointer"
                        title="Remove from Favorites"
                      >
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      </button>
                    </div>

                    <div className="relative z-10 mt-3.5">
                      <h3 className="font-extrabold text-slate-800 text-sm group-hover:text-[#ed5c37] transition-colors line-clamp-1">
                        {p.name}
                      </h3>
                      {p.code && <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider mt-0.5">{p.code}</span>}
                      
                      <div className="mt-3.5 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-100 pt-2.5">
                        <span>TL: {p.tlName || "None"}</span>
                        <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{p.status}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TEST CASES TAB VIEW */}
          {activeTab === "testcases" && (
            <div className="space-y-4">
              {filteredTestCases.length === 0 ? (
                <div className="py-16 text-center text-slate-400 font-semibold border-2 border-dashed border-slate-200 rounded-3xl bg-white">
                  {searchTerm ? "No matching favorited test cases." : "No favorited test cases yet. Favorite a project to view its test cases here."}
                </div>
              ) : (
                filteredTestCases.map((tc) => (
                  <div
                    key={`tc-${tc.projectId}-${tc.testCaseId}`}
                    className="p-5 bg-white hover:bg-slate-50/50 border border-slate-200 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-md group relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-[#ed5c37]/10 group-hover:bg-[#ed5c37] transition-colors" />
                    
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="mt-1 shrink-0 p-2 bg-[#ed5c37]/5 text-[#ed5c37] rounded-xl">
                        <FlaskConical className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                            {tc.testCaseId}
                          </span>
                          <h3 className="font-extrabold text-slate-800 text-sm group-hover:text-[#ed5c37] transition-colors truncate">
                            {tc.title}
                          </h3>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-2">
                          <Link href={`/test-cases/${tc.projectId}`} className="flex items-center gap-1 text-slate-500 hover:text-[#ed5c37] transition-colors">
                            <FolderOpen className="w-3.5 h-3.5" /> 
                            {tc.projectName} {tc.projectCode && `(${tc.projectCode})`}
                          </Link>
                          <span>•</span>
                          <span>Module: {tc.module || "General"}</span>
                          <span>•</span>
                          <span>Priority: {tc.priority}</span>
                          <span>•</span>
                          <span className="text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-black text-[9px]">{tc.qaStatus || "Not Run"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => handleUnfavoriteTestCase(tc.projectId, tc.testCaseId)}
                        className="p-2.5 text-amber-500 hover:bg-slate-100 rounded-xl shadow-xs border border-slate-150 transition-all bg-white cursor-pointer"
                        title="Remove from Favorites"
                      >
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      </button>

                      <Link
                        href={`/test-cases/${tc.projectId}`}
                        className="p-2.5 text-slate-500 hover:text-[#ed5c37] hover:bg-slate-100 rounded-xl shadow-xs border border-slate-150 transition-all bg-white flex items-center justify-center"
                        title="Open Test Case Suite"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* QUICK NOTES TAB VIEW */}
          {activeTab === "notes" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredNotes.length === 0 ? (
                <div className="col-span-full py-16 text-center text-slate-400 font-semibold border-2 border-dashed border-slate-200 rounded-3xl bg-white">
                  {searchTerm ? "No matching favorited notes." : "No favorited notes yet. Visit 'Quick Notes' to star notes."}
                </div>
              ) : (
                filteredNotes.map((note) => (
                  <div
                    key={`note-${note.id}`}
                    onClick={() => setSelectedNote(note)}
                    className="p-6 bg-white hover:bg-slate-50/50 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-44 group relative overflow-hidden cursor-pointer"
                  >
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-[#ed5c37]/10 group-hover:bg-[#ed5c37] transition-colors" />
                    
                    <div className="flex items-center justify-between relative z-10">
                      <div className="w-12 h-12 rounded-2xl bg-[#ed5c37]/5 border border-[#ed5c37]/10 flex items-center justify-center text-[#ed5c37] group-hover:scale-105 transition-transform shadow-xs">
                        <StickyNote className="w-6 h-6" />
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleUnfavoriteQuickNote(note.id); }}
                        className="p-2 text-amber-500 hover:bg-slate-100 rounded-xl shadow-xs border border-slate-150 bg-white transition-all cursor-pointer"
                        title="Remove from Favorites"
                      >
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      </button>
                    </div>

                    <div className="relative z-10 mt-3.5">
                      <h3 className="font-extrabold text-slate-800 text-sm group-hover:text-[#ed5c37] transition-colors line-clamp-1">
                        {note.title}
                      </h3>
                      {note.description ? (
                        <div
                          className="text-[11px] text-slate-400 line-clamp-2 mt-1 select-none leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: note.description }}
                        />
                      ) : (
                        <p className="text-[11px] text-slate-350 italic mt-1">No description</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      )}

      {/* Quick Note Detail Overlay Modal */}
      {selectedNote && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={() => setSelectedNote(null)}
        >
          <div 
            className="bg-white w-full max-w-xl rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in scale-in duration-200 border border-slate-100"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-[#ed5c37] flex items-center justify-center shadow-xs shrink-0">
                  <StickyNote className="w-5.5 h-5.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-slate-850 text-base break-all">{selectedNote.title}</h3>
                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mt-0.5">Quick Note View</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedNote(null)}
                className="p-2 hover:bg-slate-200/50 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
              {selectedNote.description ? (
                <div 
                  className="text-slate-650 text-sm leading-relaxed whitespace-pre-wrap
                    [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
                    [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_u]:underline"
                  dangerouslySetInnerHTML={{ __html: selectedNote.description }}
                />
              ) : (
                <p className="text-slate-400 italic text-sm text-center py-6">This note has no content.</p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-[10px] text-slate-400 font-semibold">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Created {formatDate(selectedNote.createdAt)}
              </span>
              <Link
                href="/quick-notes"
                onClick={() => setSelectedNote(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-[#ed5c37] font-bold text-xs shadow-xs hover:shadow-md transition-all inline-flex items-center gap-1.5"
              >
                Go to Notes <ArrowRight className="w-3.5 h-3.5" />
              </Link>
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
