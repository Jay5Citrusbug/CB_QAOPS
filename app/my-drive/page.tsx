"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { 
  HardDrive, 
  Search, 
  Plus, 
  X, 
  ExternalLink, 
  Download, 
  Trash2, 
  Loader2, 
  Lock, 
  Unlock, 
  FileText, 
  FileSpreadsheet, 
  FileCode, 
  FileCheck, 
  File, 
  Upload, 
  FolderOpen,
  FolderDot
} from "lucide-react";
import { createPortal } from "react-dom";
import { useConfirm } from "@/components/providers/ConfirmProvider";

interface DriveItem {
  id: string;
  name: string;
  url: string;
  type: "file" | "link";
  category: "private" | "public";
  userId: string;
  uploadedBy: string;
  uploadedAt: string | null;
  fileSize: number | null;
  fileExt: string | null;
}

export default function MyDrivePage() {
  const { data: session } = useSession();
  const userEmail = session?.user?.email || "";
  const currentUserId = (session?.user as any)?.id || "";
  const confirm = useConfirm();

  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSpace, setActiveSpace] = useState<"private" | "public">("private");
  const [uploadSource, setUploadSource] = useState<"file" | "link">("file");

  // Form States
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  
  // UI states
  const [isSyncing, setIsSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [mounted, setMounted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchDriveItems = async () => {
    try {
      const res = await fetch(`/api/my-drive?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error("Failed to fetch drive items");
      const data = await res.json();
      setItems(data);
    } catch (err: any) {
      setError(err.message || "An error occurred while loading drive items.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchDriveItems();
    }
  }, [session]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    setUploadError("");
    setIsSyncing(true);

    try {
      const formData = new FormData();
      formData.append("category", activeSpace);

      if (uploadSource === "file") {
        if (!uploadFile) throw new Error("Please select a file to upload.");
        const MAX_SIZE = 50 * 1024 * 1024; // 50MB
        if (uploadFile.size > MAX_SIZE) throw new Error("File size exceeds 50MB limit.");
        formData.append("file", uploadFile);
      } else {
        if (!linkUrl.trim()) throw new Error("Please enter a link URL.");
        formData.append("linkUrl", linkUrl.trim());
        formData.append("linkName", linkName.trim() || linkUrl.trim());
      }

      const res = await fetch("/api/my-drive", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      setToast({
        message: uploadSource === "file" ? "File uploaded successfully!" : "External link added successfully!",
        type: "success"
      });

      // Reset Form
      setUploadFile(null);
      setLinkUrl("");
      setLinkName("");
      if (fileInputRef.current) fileInputRef.current.value = "";

      // Re-fetch
      await fetchDriveItems();
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload item");
      setToast({ message: err.message || "Failed to upload item", type: "error" });
    } finally {
      setUploading(false);
      setIsSyncing(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const isConfirmed = await confirm({
      title: "Delete Drive Item",
      message: "Are you sure you want to delete this item? This action is permanent.",
      confirmText: "Delete",
      type: "danger"
    });
    if (!isConfirmed) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/my-drive?id=${itemId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete item");
      }

      setToast({ message: "Item deleted successfully!", type: "success" });
      setItems(prev => prev.filter(item => item.id !== itemId));
    } catch (err: any) {
      setToast({ message: err.message || "Failed to delete item", type: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  const getDocIcon = (name: string, type: "file" | "link") => {
    if (type === "link") {
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

  const formatFileSize = (bytes: number | null) => {
    if (bytes === null) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Filter items based on active tab & search term
  const filteredItems = useMemo(() => {
    const spaceItems = items.filter(item => item.category === activeSpace);
    if (!searchTerm.trim()) return spaceItems;
    const lower = searchTerm.toLowerCase();
    return spaceItems.filter(item => 
      item.name.toLowerCase().includes(lower) ||
      (item.uploadedBy || "").toLowerCase().includes(lower)
    );
  }, [items, activeSpace, searchTerm]);

  // Stats
  const stats = useMemo(() => {
    let totalItems = items.length;
    let privateCount = items.filter(i => i.category === "private").length;
    let publicCount = items.filter(i => i.category === "public").length;
    return { totalItems, privateCount, publicCount };
  }, [items]);

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-5 bg-white rounded-3xl border border-slate-200 min-h-[100px]" />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 h-80 bg-white border border-slate-200 rounded-3xl" />
          <div className="lg:col-span-2 h-80 bg-white border border-slate-200 rounded-3xl" />
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
                <p className="text-xs text-slate-500 font-bold animate-pulse">Uploading item...</p>
              </div>
            </div>,
            document.body
          )
        : null}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-5 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <HardDrive className="w-8 h-8 text-[#ed5c37]" /> My Drive
          </h1>
          <p className="text-slate-500 mt-1.5 text-sm">
            Upload personal files and link bookmarks under Private tab, or share documents with everyone under Public tab.
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
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Drive Items</span>
          <span className="text-3xl font-extrabold text-slate-800 mt-3">{stats.totalItems}</span>
        </div>
        <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Private Tab Uploads</span>
          <span className="text-3xl font-extrabold text-[#ed5c37] mt-3 flex items-center gap-1.5">
            <Lock className="w-5 h-5 text-[#ed5c37]" /> {stats.privateCount}
          </span>
        </div>
        <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Public Tab Uploads</span>
          <span className="text-3xl font-extrabold text-indigo-600 mt-3 flex items-center gap-1.5">
            <Unlock className="w-5 h-5 text-indigo-600" /> {stats.publicCount}
          </span>
        </div>
      </div>

      {/* Space Toggle Tabs */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit border border-transparent">
        <button
          onClick={() => { setActiveSpace("private"); setSearchTerm(""); }}
          className={`flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeSpace === "private"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Lock className="w-4 h-4" />
          Private Space (Only Me)
        </button>
        <button
          onClick={() => { setActiveSpace("public"); setSearchTerm(""); }}
          className={`flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeSpace === "public"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Unlock className="w-4 h-4" />
          Public Space (Everyone)
        </button>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Upload form Panel */}
        <div className="lg:col-span-1 p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4 h-fit">
          <h3 className="font-bold text-slate-850 text-base border-b border-slate-100 pb-3 flex items-center gap-2">
            Upload to {activeSpace === "private" ? "Private Space" : "Public Space"}
          </h3>
          
          <form onSubmit={handleUploadSubmit} className="space-y-4">
            
            {/* Upload segment toggle */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setUploadSource("file")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  uploadSource === "file"
                    ? "bg-white text-slate-850 shadow-sm"
                    : "text-slate-400 hover:text-slate-655"
                }`}
              >
                File Upload
              </button>
              <button
                type="button"
                onClick={() => setUploadSource("link")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  uploadSource === "link"
                    ? "bg-white text-slate-850 shadow-sm"
                    : "text-slate-400 hover:text-slate-655"
                }`}
              >
                External Link
              </button>
            </div>

            {uploadSource === "file" ? (
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">File</label>
                <input
                  type="file"
                  required
                  ref={fileInputRef}
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-600 hover:file:bg-[#ed5c37]/15 hover:file:text-[#ed5c37] file:cursor-pointer border border-slate-200 rounded-xl p-1 bg-slate-50 cursor-pointer outline-none"
                />
                <span className="text-[10px] text-slate-400 block mt-1">Supported: PDF, DOCX, XLSX, PNG, JPG, ZIP, etc. Max 50MB.</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Link URL</label>
                  <input
                    type="url"
                    required
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs outline-none focus:ring-2 focus:ring-[#ed5c37]/20 focus:border-[#ed5c37] transition-all font-semibold text-slate-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Link Name / Title</label>
                  <input
                    type="text"
                    required
                    value={linkName}
                    onChange={(e) => setLinkName(e.target.value)}
                    placeholder="e.g. Reference Bookmark, Shared Sheet"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs outline-none focus:ring-2 focus:ring-[#ed5c37]/20 focus:border-[#ed5c37] transition-all font-semibold text-slate-700"
                  />
                </div>
              </div>
            )}

            {uploadError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-xs font-bold">
                {uploadError}
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || (uploadSource === "file" ? !uploadFile : !linkUrl.trim())}
              className="w-full px-4 py-2.5 bg-slate-900 hover:bg-[#ed5c37] disabled:bg-slate-200 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : uploadSource === "file" ? (
                <Upload className="w-3.5 h-3.5" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              {uploadSource === "file" ? "Upload to Drive" : "Add Link Bookmark"}
            </button>
          </form>
        </div>

        {/* Drive Listing Panel */}
        <div className="lg:col-span-2 p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="relative group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#ed5c37] transition-colors">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search items by name or uploader..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2 pl-10 pr-4 text-xs outline-none focus:ring-2 focus:ring-[#ed5c37]/20 focus:border-[#ed5c37] transition-all font-medium"
            />
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {filteredItems.length === 0 ? (
              <div className="py-16 text-center text-slate-400 font-semibold border-2 border-dashed border-slate-200 rounded-3xl">
                {searchTerm ? "No matching drive items." : `Your ${activeSpace} drive space is empty.`}
              </div>
            ) : (
              filteredItems.map((item) => {
                const canDelete = item.userId === currentUserId || (session?.user as any)?.role === "ADMIN";
                return (
                  <div
                    key={item.id}
                    className="p-4 bg-slate-50 hover:bg-slate-100/50 border border-slate-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all group relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#ed5c37]/5 group-hover:bg-[#ed5c37]/80 transition-colors" />
                    
                    <div className="flex items-start gap-4 flex-1 min-w-0 pl-1">
                      <div className="mt-1 shrink-0">{getDocIcon(item.name, item.type)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2">
                          <h3 className="font-extrabold text-slate-800 text-sm group-hover:text-[#ed5c37] transition-colors truncate">
                            {item.name}
                          </h3>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-2.5">
                          <span>Uploaded by {item.uploadedBy}</span>
                          <span>•</span>
                          <span>{formatDate(item.uploadedAt)}</span>
                          {item.type === "file" && (
                            <>
                              <span>•</span>
                              <span>{formatFileSize(item.fileSize)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {/* Open Link or Download */}
                      {item.type === "link" ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 text-slate-500 hover:text-indigo-650 hover:bg-white rounded-xl shadow-xs border border-slate-150 bg-white flex items-center justify-center transition-all"
                          title="Open Link"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <a
                          href={item.url}
                          download={item.name}
                          className="p-2.5 text-slate-550 hover:text-blue-600 hover:bg-white rounded-xl shadow-xs border border-slate-150 bg-white flex items-center justify-center transition-all"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}

                      {/* Delete Action (uploader only) */}
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-xl shadow-xs border border-slate-150 bg-white flex items-center justify-center transition-all cursor-pointer"
                          title="Delete Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
