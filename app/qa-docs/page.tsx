"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { createPortal } from "react-dom";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { 
  Folder, 
  FolderOpen, 
  Search, 
  FileText, 
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
  Plus,
  Trash2,
  Link as LinkIcon,
  Upload,
  Globe,
  MoreVertical,
  ShieldCheck,
  FileUp,
  Eye
} from "lucide-react";
import DocumentPreviewModal from "@/components/DocumentPreviewModal";

interface FolderType {
  id: string;
  name: string;
  created_by: string;
  created_at: string | null;
}

interface DocumentType {
  id: string;
  folderId: string;
  name: string;
  url: string;
  type: 'file' | 'link';
  uploadedBy: string;
  uploadedAt: string | null;
  fileSize: number | null;
  fileExt: string | null;
}

export default function QADocsPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || "USER";
  const isAdmin = userRole === "ADMIN";
  const confirm = useConfirm();

  const [folders, setFolders] = useState<FolderType[]>([]);
  const [activeFolder, setActiveFolder] = useState<FolderType | null>(null);
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [previewDoc, setPreviewDoc] = useState<DocumentType | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [docsLoading, setDocsLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [docSearchTerm, setDocSearchTerm] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Modals state
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadSource, setUploadSource] = useState<"file" | "link">("file");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Folder menu state
  const [activeMenuFolderId, setActiveMenuFolderId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (session?.user) {
      fetchFolders();
    }
  }, [session]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Fetch Folders
  const fetchFolders = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/qa-docs/folders");
      if (!res.ok) throw new Error("Failed to fetch QA folders");
      const data = await res.json();
      setFolders(data);
    } catch (err: any) {
      setError(err.message || "An error occurred while loading folders.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch documents for active folder
  const fetchDocuments = async (folderId: string) => {
    try {
      setDocsLoading(true);
      const res = await fetch(`/api/qa-docs?folderId=${folderId}`);
      if (!res.ok) throw new Error("Failed to fetch documents");
      const data = await res.json();
      setDocuments(data);
    } catch (err: any) {
      setToast({ message: err.message || "Failed to load documents", type: "error" });
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    if (activeFolder) {
      fetchDocuments(activeFolder.id);
    } else {
      setDocuments([]);
    }
  }, [activeFolder]);

  // Create Folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      setIsSyncing(true);
      const res = await fetch("/api/qa-docs/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create folder");

      setToast({ message: `Folder "${data.name}" created successfully`, type: "success" });
      setNewFolderName("");
      setShowFolderModal(false);
      fetchFolders();
    } catch (err: any) {
      setToast({ message: err.message || "An error occurred", type: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  // Delete Folder
  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    const isConfirmed = await confirm({
      title: "Delete QA Folder",
      message: `Are you sure you want to delete folder "${folderName}"? All files inside it will be permanently deleted.`,
      confirmText: "Delete",
      type: "danger"
    });
    if (!isConfirmed) return;

    try {
      setIsSyncing(true);
      const res = await fetch(`/api/qa-docs/folders?id=${folderId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete folder");
      }

      setToast({ message: `Deleted folder "${folderName}"`, type: "success" });
      setActiveMenuFolderId(null);
      if (activeFolder?.id === folderId) {
        setActiveFolder(null);
      }
      fetchFolders();
    } catch (err: any) {
      setToast({ message: err.message || "An error occurred", type: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  // Upload Doc / Add Link Submit
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFolder) return;

    try {
      setIsSyncing(true);

      if (uploadSource === "link") {
        if (!linkUrl.trim()) {
          setToast({ message: "Please enter a URL", type: "error" });
          setIsSyncing(false);
          return;
        }
        const formData = new FormData();
        formData.append("folderId", activeFolder.id);
        formData.append("linkUrl", linkUrl.trim());
        formData.append("linkName", linkName.trim() || linkUrl.trim());
        const res = await fetch("/api/qa-docs", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to upload item");
        setToast({ message: "Link bookmarked successfully", type: "success" });
      } else {
        if (selectedFiles.length === 0) {
          setToast({ message: "Please select at least one file to upload", type: "error" });
          setIsSyncing(false);
          return;
        }
        let successCount = 0;
        const errors: string[] = [];
        for (const file of selectedFiles) {
          const formData = new FormData();
          formData.append("folderId", activeFolder.id);
          formData.append("file", file);
          const res = await fetch("/api/qa-docs", { method: "POST", body: formData });
          const data = await res.json();
          if (!res.ok) {
            errors.push(`${file.name}: ${data.error || "Failed to upload"}`);
          } else {
            successCount++;
          }
        }
        if (errors.length > 0) {
          setToast({ message: errors[0], type: "error" });
        } else {
          setToast({ message: `${successCount} file(s) uploaded successfully`, type: "success" });
        }
      }
      
      // Reset form & state
      setLinkUrl("");
      setLinkName("");
      setSelectedFiles([]);
      setShowUploadModal(false);

      // Re-fetch folder documents
      fetchDocuments(activeFolder.id);
    } catch (err: any) {
      setToast({ message: err.message || "An error occurred", type: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  // Delete Document
  const handleDeleteDocument = async (docId: string, docName: string) => {
    const isConfirmed = await confirm({
      title: "Delete Document",
      message: `Are you sure you want to delete "${docName}"?`,
      confirmText: "Delete",
      type: "danger"
    });
    if (!isConfirmed) return;

    try {
      setIsSyncing(true);
      const res = await fetch(`/api/qa-docs?id=${docId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete document");
      }

      setToast({ message: `Deleted "${docName}"`, type: "success" });
      if (activeFolder) {
        fetchDocuments(activeFolder.id);
      }
    } catch (err: any) {
      setToast({ message: err.message || "An error occurred", type: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  // File helpers
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

  const formatFileSize = (bytes: number | null) => {
    if (bytes === null) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

  // Filter folders
  const filteredFolders = useMemo(() => {
    if (!searchTerm.trim()) return folders;
    return folders.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [folders, searchTerm]);

  // Filter documents inside active folder
  const filteredDocs = useMemo(() => {
    if (!docSearchTerm.trim()) return documents;
    const lower = docSearchTerm.toLowerCase();
    return documents.filter(d => 
      d.name.toLowerCase().includes(lower) || 
      (d.uploadedBy || "").toLowerCase().includes(lower)
    );
  }, [documents, docSearchTerm]);

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

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 bg-white rounded-3xl border border-slate-200 min-h-[100px]" />
        </div>

        {/* Folders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-6 bg-white border border-slate-200 rounded-3xl h-44" />
          ))}
        </div>
      </div>
    );
  }

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
                <p className="text-xs text-slate-500 font-bold animate-pulse">Syncing change...</p>
              </div>
            </div>,
            document.body
          )
        : null}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-5 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-[#ed5c37]" /> QA Docs Library
          </h1>
          <p className="text-slate-500 mt-1.5 text-sm">
            Central repositories for standard operating procedures (SOPs), templates, guidelines, and training resources.
          </p>
        </div>
        
        {isAdmin && !activeFolder && (
          <button
            onClick={() => setShowFolderModal(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" /> Create Folder
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-800 text-sm font-medium">
          {error}
        </div>
      )}

      {/* VIEW 1: FOLDER LIST VIEW */}
      {!activeFolder ? (
        <>
          {/* Dashboard Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Repositories / Folders</span>
              <span className="text-3xl font-extrabold text-slate-800 mt-3">{folders.length}</span>
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
                placeholder="Search folders by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#ed5c37]/20 focus:border-[#ed5c37] transition-all font-medium"
              />
            </div>
          </div>

          {/* Folders Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredFolders.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-400 font-semibold border-2 border-dashed border-slate-200 rounded-3xl bg-white">
                {searchTerm ? "No matching folders found." : "No folders created yet."}
              </div>
            ) : (
              filteredFolders.map((f) => (
                <div
                  key={f.id}
                  onClick={() => setActiveFolder(f)}
                  className="p-6 bg-white hover:bg-slate-50/50 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-44 cursor-pointer group relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-[#ed5c37]/10 group-hover:bg-[#ed5c37] transition-colors" />
                  
                  <div className="flex items-center justify-between relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#ed5c37] group-hover:scale-105 transition-transform shadow-xs">
                      <Folder className="w-6 h-6 fill-orange-50" />
                    </div>
                    
                    {isAdmin ? (
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuFolderId(activeMenuFolderId === f.id ? null : f.id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        
                        {activeMenuFolderId === f.id && (
                          <div 
                            className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => handleDeleteFolder(f.id, f.name)}
                              className="w-full text-left px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete Folder
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                    )}
                  </div>

                  <div className="relative z-10 mt-3.5">
                    <h3 className="font-extrabold text-slate-800 text-sm group-hover:text-[#ed5c37] transition-colors line-clamp-1">
                      {f.name}
                    </h3>
                    <div className="mt-3.5 flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider border-t border-slate-100 pt-2.5">
                      <span>By {f.created_by}</span>
                      <span>{formatDate(f.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        /* VIEW 2: INSIDE FOLDER VIEW */
        <div className="space-y-6">
          {/* Folder Header Breadcrumb */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                onClick={() => setActiveFolder(null)}
                className="p-2 bg-white hover:bg-slate-100 rounded-xl shadow-xs border border-slate-150 text-slate-500 hover:text-slate-855 transition-all cursor-pointer shrink-0"
                title="Back to Folders"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold uppercase tracking-wider">
                  <span>QA Library</span>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-slate-500">Folder</span>
                </div>
                <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2 mt-1 break-all">
                  <FolderOpen className="w-5 h-5 text-[#ed5c37] fill-orange-50/50 shrink-0" /> {activeFolder.name}
                </h2>
              </div>
            </div>

            {isAdmin && (
              <button
                onClick={() => {
                  setUploadSource("file");
                  setShowUploadModal(true);
                }}
                className="btn-primary"
              >
                <Upload className="w-4 h-4" /> Add Doc / Link
              </button>
            )}
          </div>

          {/* Search bar inside folder */}
          <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
            <div className="relative group flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#ed5c37] transition-colors">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search documents inside folder..."
                value={docSearchTerm}
                onChange={(e) => setDocSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2 pl-10 pr-4 text-xs outline-none focus:ring-2 focus:ring-[#ed5c37]/20 focus:border-[#ed5c37] transition-all font-semibold"
              />
            </div>
            {docSearchTerm && (
              <button 
                onClick={() => setDocSearchTerm("")}
                className="text-slate-400 hover:text-slate-600 font-bold text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Documents Listing */}
          {docsLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-5 bg-white rounded-3xl border border-slate-200 h-20 flex items-center justify-between animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-200" />
                    <div className="space-y-2">
                      <div className="h-4 w-48 bg-slate-200" />
                      <div className="h-3 w-32 bg-slate-100" />
                    </div>
                  </div>
                  <div className="w-20 h-8 bg-slate-150 rounded" />
                </div>
              ))}
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="py-16 text-center text-slate-400 font-semibold border-2 border-dashed border-slate-200 rounded-3xl bg-white flex flex-col items-center justify-center gap-3">
              <FileText className="w-10 h-10 text-slate-300" />
              <p>{docSearchTerm ? "No matching documents found." : "This folder is empty."}</p>
              {isAdmin && !docSearchTerm && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="mt-2 text-xs font-bold text-[#ed5c37] hover:text-[#d94f2c] bg-[#ed5c37]/10 hover:bg-[#ed5c37]/15 px-3 py-1.5 rounded-lg transition-all"
                >
                  Upload your first document
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="p-5 bg-white hover:bg-slate-50/50 border border-slate-200 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-md group relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-[#ed5c37]/10 group-hover:bg-[#ed5c37] transition-colors" />
                  
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="mt-1 shrink-0">{getDocIcon(doc.name, doc.type === 'link')}</div>
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-extrabold text-slate-800 text-sm group-hover:text-[#ed5c37] transition-colors truncate">
                          {doc.name}
                        </h3>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                          doc.type === 'link' 
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        }`}>
                          {doc.type}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-2">
                        <span>Uploaded by {doc.uploadedBy}</span>
                        <span>•</span>
                        <span>{formatDate(doc.uploadedAt)}</span>
                        {doc.fileSize !== null && (
                          <>
                            <span>•</span>
                            <span>{formatFileSize(doc.fileSize)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {/* Delete button (Admin only) */}
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteDocument(doc.id, doc.name)}
                        className="p-2.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all cursor-pointer border border-transparent hover:border-rose-100 bg-white"
                        title="Delete Document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    {/* Download or Open Link */}
                    {doc.type === 'file' && (
                      <button
                        onClick={() => setPreviewDoc(doc)}
                        className="p-2.5 text-slate-500 hover:text-[#ed5c37] hover:bg-slate-100 rounded-xl shadow-xs border border-slate-150 transition-all bg-white flex items-center justify-center cursor-pointer"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    {doc.type === 'link' ? (
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
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: CREATE FOLDER MODAL */}
      {showFolderModal && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[999] flex items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={() => setShowFolderModal(false)}
        >
          <div 
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in scale-in duration-200 border border-slate-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-[#ed5c37] flex items-center justify-center shadow-xs">
                  <Folder className="w-5.5 h-5.5 fill-orange-50" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-850 text-base">Create QA Folder</h3>
                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mt-0.5">Library Management</span>
                </div>
              </div>
              <button 
                onClick={() => setShowFolderModal(false)}
                className="p-2 hover:bg-slate-200/50 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-450 uppercase tracking-wider block">Folder Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SOP, Automation Training, Prompts"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs outline-none focus:ring-2 focus:ring-[#ed5c37]/20 focus:border-[#ed5c37] transition-all font-semibold text-slate-700"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFolderModal(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold bg-slate-50 hover:bg-slate-100 text-slate-500 text-xs transition-colors border border-slate-150 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSyncing}
                  className="flex-1 py-2.5 rounded-xl font-bold bg-[#ed5c37] hover:bg-[#d94f2c] text-white text-xs transition-all shadow-md shadow-[#ed5c37]/20 cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD DOC / LINK MODAL */}
      {showUploadModal && activeFolder && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[999] flex items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={() => setShowUploadModal(false)}
        >
          <div 
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in scale-in duration-200 border border-slate-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-[#ed5c37] flex items-center justify-center shadow-xs">
                  <Upload className="w-5.5 h-5.5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-850 text-base">Add Doc or Link</h3>
                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mt-0.5">
                    To Folder: {activeFolder.name}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setShowUploadModal(false)}
                className="p-2 hover:bg-slate-200/50 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              {/* Toggle upload mode */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setUploadSource("file")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    uploadSource === "file"
                      ? "bg-white text-slate-850 shadow-xs"
                      : "text-slate-400 hover:text-slate-655"
                  }`}
                >
                  File Upload
                </button>
                <button
                  type="button"
                  onClick={() => setUploadSource("link")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    uploadSource === "link"
                      ? "bg-white text-slate-850 shadow-xs"
                      : "text-slate-400 hover:text-slate-655"
                  }`}
                >
                  Add Link
                </button>
              </div>

              {uploadSource === "file" ? (
                /* FILE UPLOAD PANEL */
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-450 uppercase tracking-wider block">Choose File</label>
                  <div className="border-2 border-dashed border-slate-200 hover:border-[#ed5c37]/40 rounded-2xl p-6 text-center cursor-pointer transition-colors relative bg-slate-50/50 group">
                    <input
                      type="file"
                      multiple
                      required={uploadSource === "file"}
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []).slice(0, 5);
                        if (files.length > 0) setSelectedFiles(files);
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <FileUp className="w-8 h-8 text-slate-400 group-hover:text-[#ed5c37] mx-auto transition-colors" />
                    <span className="text-xs font-bold text-slate-600 block mt-2.5 truncate max-w-xs mx-auto">
                      {selectedFiles.length === 0 ? "Click or Drag to Upload File(s)" : selectedFiles.length === 1 ? selectedFiles[0].name : `${selectedFiles.length} files selected`}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      {selectedFiles.length > 0 ? `${selectedFiles.map(f => (f.size / (1024 * 1024)).toFixed(1)).join(" MB, ")} MB` : "Any format • Up to 5 files at once"}
                    </span>
                  </div>
                </div>
              ) : (
                /* LINK PANEL */
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-450 uppercase tracking-wider block">Link URL</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Globe className="w-4 h-4" /></span>
                      <input
                        type="url"
                        required={uploadSource === "link"}
                        placeholder="https://example.com/some-resource"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-3.5 text-xs outline-none focus:ring-2 focus:ring-[#ed5c37]/20 focus:border-[#ed5c37] transition-all font-semibold text-slate-700"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-450 uppercase tracking-wider block">Link Title / Display Name</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><LinkIcon className="w-4 h-4" /></span>
                      <input
                        type="text"
                        placeholder="e.g. Automation Repo, Best Practices Guide"
                        value={linkName}
                        onChange={(e) => setLinkName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-3.5 text-xs outline-none focus:ring-2 focus:ring-[#ed5c37]/20 focus:border-[#ed5c37] transition-all font-semibold text-slate-700"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold bg-slate-50 hover:bg-slate-100 text-slate-500 text-xs transition-colors border border-slate-150 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSyncing}
                  className="flex-1 py-2.5 rounded-xl font-bold bg-[#ed5c37] hover:bg-[#d94f2c] text-white text-xs transition-all shadow-md shadow-[#ed5c37]/20 cursor-pointer"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {previewDoc && (
        <DocumentPreviewModal
          isOpen={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          docName={previewDoc.name}
          docUrl={previewDoc.url}
          category={previewDoc.fileExt ? `${previewDoc.fileExt.toUpperCase()} File` : "QA Document"}
        />
      )}
    </div>
  );
}
