"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import {
  Folder,
  FolderOpen,
  Search,
  ChevronRight,
  Plus,
  Trash2,
  X,
  ArrowLeft,
  Loader2,
  MoreVertical,
  Edit3,
  Copy,
  Check,
  BookOpen,
  Sparkles,
  Terminal
} from "lucide-react";
import Header from "@/components/layout/Header";

interface PromptCategory {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: string | null;
}

interface Prompt {
  id: string;
  categoryId: string;
  title: string;
  prompt: string;
  createdBy: string;
  createdAt: string | null;
}

export default function PromptLibraryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const confirm = useConfirm();

  const userRole = (session?.user as any)?.role || "USER";
  const isQaLead = userRole === "ADMIN" || userRole === "TL";

  // Data States
  const [categories, setCategories] = useState<PromptCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<PromptCategory | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [draggedFolderIndex, setDraggedFolderIndex] = useState<number | null>(null);
  const [draggedPromptIndex, setDraggedPromptIndex] = useState<number | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [promptSearchTerm, setPromptSearchTerm] = useState("");

  // Loading States
  const [loading, setLoading] = useState(true);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Copy Feedback
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  // Modals States
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDesc, setNewFolderDesc] = useState("");
  
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameFolderId, setRenameFolderId] = useState("");
  const [renameFolderName, setRenameFolderName] = useState("");
  const [renameFolderDesc, setRenameFolderDesc] = useState("");

  const [showPromptModal, setShowPromptModal] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [promptTitle, setPromptTitle] = useState("");
  const [promptContent, setPromptContent] = useState("");

  // Folder actions dropdown
  const [activeMenuFolderId, setActiveMenuFolderId] = useState<string | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Toast Auto-Dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Fetch Categories (folders)
  const fetchCategories = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`/api/prompt-categories?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch prompt categories");
      const data = await res.json();
      setCategories(data);
    } catch (err: any) {
      setError(err.message || "An error occurred while loading folders.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Fetch Prompts in Folder
  const fetchPrompts = useCallback(async (catId: string, silent = false) => {
    try {
      if (!silent) setPromptsLoading(true);
      const res = await fetch(`/api/prompts?categoryId=${catId}&t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch prompts");
      const data = await res.json();
      setPrompts(data);
    } catch (err: any) {
      setToast({ message: err.message || "Failed to load prompts", type: "error" });
    } finally {
      if (!silent) setPromptsLoading(false);
    }
  }, []);

  // Use a stable primitive (email string) instead of the whole session object
  const userEmail = session?.user?.email;
  useEffect(() => {
    if (userEmail) {
      fetchCategories(false);
    }
  }, [userEmail, fetchCategories]);

  useEffect(() => {
    if (activeCategory) {
      fetchPrompts(activeCategory.id, false);
    } else {
      setPrompts([]);
    }
  }, [activeCategory, fetchPrompts]);

  // Create Category (Folder)
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      setIsSyncing(true);
      const res = await fetch("/api/prompt-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName.trim(), description: newFolderDesc.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create folder");

      setToast({ message: `Folder "${newFolderName}" created successfully`, type: "success" });
      setNewFolderName("");
      setNewFolderDesc("");
      setShowFolderModal(false);
      fetchCategories(true);
    } catch (err: any) {
      setToast({ message: err.message || "An error occurred", type: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  // Rename Category (Folder)
  const handleRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameFolderId || !renameFolderName.trim()) return;

    try {
      setIsSyncing(true);
      const res = await fetch(`/api/prompt-categories/${renameFolderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameFolderName.trim(), description: renameFolderDesc.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to rename folder");

      setToast({ message: `Folder renamed successfully`, type: "success" });
      setRenameFolderName("");
      setRenameFolderDesc("");
      setRenameFolderId("");
      setShowRenameModal(false);

      if (activeCategory && activeCategory.id === renameFolderId) {
        setActiveCategory({
          ...activeCategory,
          name: renameFolderName.trim(),
          description: renameFolderDesc.trim(),
        });
      }

      fetchCategories(true);
    } catch (err: any) {
      setToast({ message: err.message || "An error occurred", type: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  // Delete Category (Folder)
  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    const isConfirmed = await confirm({
      title: "Delete Folder & Prompts",
      message: `Are you sure you want to delete folder "${folderName}"? All prompt templates inside it will be permanently deleted.`,
      confirmText: "Delete",
      type: "danger"
    });
    if (!isConfirmed) return;

    try {
      setIsSyncing(true);
      const res = await fetch(`/api/prompt-categories/${folderId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete folder");
      }

      setToast({ message: `Deleted folder "${folderName}"`, type: "success" });
      setActiveMenuFolderId(null);
      if (activeCategory?.id === folderId) {
        setActiveCategory(null);
      }
      fetchCategories(true);
    } catch (err: any) {
      setToast({ message: err.message || "An error occurred", type: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  // Create / Update Prompt
  const handleSavePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCategory || !promptTitle.trim() || !promptContent.trim()) return;

    try {
      setIsSyncing(true);
      const url = editingPrompt ? `/api/prompts/${editingPrompt.id}` : "/api/prompts";
      const method = editingPrompt ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: activeCategory.id,
          title: promptTitle.trim(),
          prompt: promptContent.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save prompt");

      setToast({ message: editingPrompt ? "Prompt updated successfully" : "Prompt created successfully", type: "success" });
      setShowPromptModal(false);
      setPromptTitle("");
      setPromptContent("");
      setEditingPrompt(null);

      fetchPrompts(activeCategory.id, true);
    } catch (err: any) {
      setToast({ message: err.message || "An error occurred", type: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  // Delete Prompt
  const handleDeletePrompt = async (promptId: string, promptTitle: string) => {
    const isConfirmed = await confirm({
      title: "Delete Prompt Template",
      message: `Are you sure you want to delete "${promptTitle}"?`,
      confirmText: "Delete",
      type: "danger"
    });
    if (!isConfirmed) return;

    try {
      setIsSyncing(true);
      const res = await fetch(`/api/prompts/${promptId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete prompt");
      }

      setToast({ message: `Deleted prompt template`, type: "success" });
      if (activeCategory) {
        fetchPrompts(activeCategory.id, true);
      }
    } catch (err: any) {
      setToast({ message: err.message || "An error occurred", type: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  // Copy to Clipboard
  const handleCopyPrompt = (promptText: string, promptId: string) => {
    navigator.clipboard.writeText(promptText);
    setCopiedPromptId(promptId);
    setTimeout(() => {
      setCopiedPromptId(null);
    }, 2000);
  };

  // Drag and Drop: Folder Reordering
  const handleFolderDragStart = (e: React.DragEvent, index: number) => {
    setDraggedFolderIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleFolderDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleFolderDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedFolderIndex === null || draggedFolderIndex === targetIndex) return;

    const updatedCategories = [...categories];
    const [draggedFolder] = updatedCategories.splice(draggedFolderIndex, 1);
    updatedCategories.splice(targetIndex, 0, draggedFolder);
    setCategories(updatedCategories);

    // Save order to backend
    try {
      setIsSyncing(true);
      const res = await fetch("/api/prompt-categories/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: updatedCategories.map((c) => c.id) }),
      });
      if (!res.ok) throw new Error("Failed to save folder order");
      setToast({ message: "Folder order updated successfully", type: "success" });
    } catch (err: any) {
      setToast({ message: err.message || "Failed to update order", type: "error" });
      fetchCategories(true);
    } finally {
      setIsSyncing(false);
      setDraggedFolderIndex(null);
    }
  };

  const handleFolderDragEnd = () => {
    setDraggedFolderIndex(null);
  };

  // Drag and Drop: Prompt Reordering
  const handlePromptDragStart = (e: React.DragEvent, index: number) => {
    setDraggedPromptIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handlePromptDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handlePromptDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedPromptIndex === null || draggedPromptIndex === targetIndex || !activeCategory) return;

    const updatedPrompts = [...prompts];
    const [draggedPrompt] = updatedPrompts.splice(draggedPromptIndex, 1);
    updatedPrompts.splice(targetIndex, 0, draggedPrompt);
    setPrompts(updatedPrompts);

    // Save order to backend
    try {
      setIsSyncing(true);
      const res = await fetch("/api/prompts/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: updatedPrompts.map((p) => p.id) }),
      });
      if (!res.ok) throw new Error("Failed to save prompt order");
      setToast({ message: "Prompt order updated successfully", type: "success" });
    } catch (err: any) {
      setToast({ message: err.message || "Failed to update order", type: "error" });
      fetchPrompts(activeCategory.id, true);
    } finally {
      setIsSyncing(false);
      setDraggedPromptIndex(null);
    }
  };

  const handlePromptDragEnd = () => {
    setDraggedPromptIndex(null);
  };

  // Format Date Helper
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

  // Filtering
  const filteredFolders = useMemo(() => {
    if (!searchTerm.trim()) return categories;
    const lower = searchTerm.toLowerCase();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        (c.description || "").toLowerCase().includes(lower)
    );
  }, [categories, searchTerm]);

  const filteredPrompts = useMemo(() => {
    if (!promptSearchTerm.trim()) return prompts;
    const lower = promptSearchTerm.toLowerCase();
    return prompts.filter(
      (p) =>
        p.title.toLowerCase().includes(lower) ||
        p.prompt.toLowerCase().includes(lower)
    );
  }, [prompts, promptSearchTerm]);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-8 animate-pulse">
        <div className="flex items-center justify-between border-b border-slate-100 pb-5">
          <div className="space-y-2.5">
            <div className="h-8 w-64 bg-slate-200 rounded-xl" />
            <div className="h-4 w-96 bg-slate-100 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-6 bg-white border border-slate-200 rounded-3xl h-44" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] lg:h-screen overflow-hidden">
      {/* Header component */}
      <Header />

      {/* Main content scrollable container */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8 relative scrollbar-hide">
        {/* Toast Notification */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-[9999] p-4 rounded-2xl shadow-xl border flex items-center gap-2.5 animate-in slide-in-from-bottom-5 duration-300 bg-white ${
              toast.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${toast.type === "success" ? "bg-emerald-500" : "bg-rose-500"}`} />
            <span className="text-xs font-bold">{toast.message}</span>
          </div>
        )}

        {/* Syncing Overlay */}
        {isSyncing && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[9999] flex items-center justify-center animate-in fade-in duration-300">
            <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-3xl border border-slate-100 shadow-2xl scale-in duration-200">
              <Loader2 className="w-10 h-10 text-[#ed5c37] animate-spin" />
              <p className="text-xs text-slate-500 font-bold animate-pulse">Syncing change...</p>
            </div>
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-150 pb-5 gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <BookOpen className="w-7 h-7 text-[#ed5c37]" /> Prompt Library
            </h1>
            <p className="text-slate-500 mt-1 text-xs">
              Organize, generate, and copy reusable prompt templates for QA testing requirements.
            </p>
          </div>

          {!activeCategory && (
            <button
              onClick={() => {
                setNewFolderName("");
                setNewFolderDesc("");
                setShowFolderModal(true);
              }}
              className="btn-primary py-2.5 px-4 rounded-xl text-xs font-bold"
            >
              <Plus className="w-4 h-4" /> Create Folder
            </button>
          )}
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-800 text-xs font-semibold">
            {error}
          </div>
        )}

        {/* VIEW 1: FOLDERS (CATEGORIES) VIEW */}
        {!activeCategory ? (
          <>
            {/* Search Categories */}
            <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs">
              <div className="relative group">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#ed5c37] transition-colors">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Search folders by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2 pl-10 pr-4 text-xs outline-none focus:ring-2 focus:ring-[#ed5c37]/20 focus:border-[#ed5c37] transition-all font-semibold text-slate-800"
                />
              </div>
            </div>

            {/* Folder Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredFolders.length === 0 ? (
                <div className="col-span-full py-16 text-center text-slate-400 font-semibold border-2 border-dashed border-slate-200 rounded-3xl bg-white text-xs">
                  {searchTerm ? "No matching folders found." : "No folders created yet."}
                </div>
              ) : (
                filteredFolders.map((f) => {
                  const originalIndex = categories.findIndex((c) => c.id === f.id);
                  const isDragged = draggedFolderIndex === originalIndex;
                  return (
                    <div
                      key={f.id}
                      onClick={() => setActiveCategory(f)}
                      draggable={!searchTerm.trim()}
                      onDragStart={(e) => handleFolderDragStart(e, originalIndex)}
                      onDragOver={(e) => handleFolderDragOver(e, originalIndex)}
                      onDrop={(e) => handleFolderDrop(e, originalIndex)}
                      onDragEnd={handleFolderDragEnd}
                      className={`p-6 bg-white hover:bg-slate-50/50 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-44 cursor-pointer group relative ${
                        !searchTerm.trim() ? "cursor-move" : ""
                      } ${isDragged ? "opacity-30 border-dashed border-[#ed5c37] scale-95" : ""}`}
                    >
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-[#ed5c37]/10 group-hover:bg-[#ed5c37] transition-colors rounded-l-[22px]" />

                    <div className="flex items-center justify-between relative z-10">
                      <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#ed5c37] group-hover:scale-105 transition-transform shadow-xs">
                        <Folder className="w-6 h-6 fill-orange-50" />
                      </div>

                      {/* Options Dropdown */}
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
                            className="absolute right-8 top-0 w-36 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 animate-in fade-in slide-in-from-right-2 duration-150"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setRenameFolderId(f.id);
                                setRenameFolderName(f.name);
                                setRenameFolderDesc(f.description || "");
                                setShowRenameModal(true);
                                setActiveMenuFolderId(null);
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 border-b border-slate-100"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-slate-400" /> Rename Folder
                            </button>
                            <button
                              onClick={() => handleDeleteFolder(f.id, f.name)}
                              className="w-full text-left px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" /> Delete Folder
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="relative z-10 mt-3.5">
                      <h3 className="font-extrabold text-slate-800 text-sm group-hover:text-[#ed5c37] transition-colors line-clamp-1">
                        {f.name}
                      </h3>
                      <p className="text-[10px] text-slate-400 line-clamp-1 mt-1 font-medium">
                        {f.description || "No description provided."}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider border-t border-slate-100 pt-2.5">
                        <span>Created</span>
                        <span>{formatDate(f.createdAt)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          /* VIEW 2: INSIDE CATEGORY FOLDER VIEW (PROMPTS LIST) */
          <div className="space-y-6">
            {/* Breadcrumb / Category Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                  onClick={() => setActiveCategory(null)}
                  className="p-2 bg-white hover:bg-slate-100 rounded-xl shadow-xs border border-slate-150 text-slate-500 hover:text-slate-800 transition-all cursor-pointer shrink-0"
                  title="Back to Folders"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    <span>Prompt Library</span>
                    <ChevronRight className="w-2.5 h-2.5" />
                    <span className="text-slate-500">Folder</span>
                  </div>
                  <h2 className="text-lg font-extrabold text-slate-850 flex items-center gap-2 mt-1 break-all">
                    <FolderOpen className="w-5 h-5 text-[#ed5c37] fill-orange-50/50 shrink-0" />{" "}
                    {activeCategory.name}
                    <button
                      onClick={() => {
                        setRenameFolderId(activeCategory.id);
                        setRenameFolderName(activeCategory.name);
                        setRenameFolderDesc(activeCategory.description || "");
                        setShowRenameModal(true);
                      }}
                      className="p-1 hover:bg-slate-200/50 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      title="Rename Folder"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </h2>
                </div>
              </div>

              <button
                onClick={() => {
                  setEditingPrompt(null);
                  setPromptTitle("");
                  setPromptContent("");
                  setShowPromptModal(true);
                }}
                className="btn-primary py-2.5 px-4 rounded-xl text-xs font-bold shrink-0"
              >
                <Plus className="w-4 h-4" /> Create Prompt
              </button>
            </div>

            {activeCategory.description && (
              <p className="text-xs text-slate-500 italic bg-white p-4 rounded-2xl border border-slate-100">
                {activeCategory.description}
              </p>
            )}

            {/* Prompt Search bar inside folder */}
            <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between gap-4">
              <div className="relative group flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#ed5c37] transition-colors">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Search prompts in this folder..."
                  value={promptSearchTerm}
                  onChange={(e) => setPromptSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2 pl-10 pr-4 text-xs outline-none focus:ring-2 focus:ring-[#ed5c37]/20 focus:border-[#ed5c37] transition-all font-semibold text-slate-800"
                />
              </div>
              {promptSearchTerm && (
                <button
                  onClick={() => setPromptSearchTerm("")}
                  className="text-slate-400 hover:text-slate-600 font-bold text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Prompts list grid */}
            {promptsLoading ? (
              <div className="space-y-4">
                {[...Array(2)].map((_, i) => (
                  <div
                    key={i}
                    className="p-6 bg-white rounded-3xl border border-slate-200 h-40 flex flex-col justify-between animate-pulse"
                  />
                ))}
              </div>
            ) : filteredPrompts.length === 0 ? (
              <div className="py-16 text-center text-slate-400 font-semibold border-2 border-dashed border-slate-200 rounded-3xl bg-white flex flex-col items-center justify-center gap-3 text-xs">
                <Terminal className="w-10 h-10 text-slate-300" />
                <p>{promptSearchTerm ? "No matching prompt templates found." : "This folder is empty."}</p>
                {!promptSearchTerm && (
                  <button
                    onClick={() => setShowPromptModal(true)}
                    className="mt-2 text-xs font-bold text-[#ed5c37] hover:text-[#d94f2c] bg-[#ed5c37]/10 hover:bg-[#ed5c37]/15 px-3 py-1.5 rounded-lg transition-all"
                  >
                    Add your first prompt
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {filteredPrompts.map((p) => {
                  const originalIndex = prompts.findIndex((item) => item.id === p.id);
                  const isDragged = draggedPromptIndex === originalIndex;
                  const isCopied = copiedPromptId === p.id;
                  return (
                    <div
                      key={p.id}
                      draggable={!promptSearchTerm.trim()}
                      onDragStart={(e) => handlePromptDragStart(e, originalIndex)}
                      onDragOver={(e) => handlePromptDragOver(e, originalIndex)}
                      onDrop={(e) => handlePromptDrop(e, originalIndex)}
                      onDragEnd={handlePromptDragEnd}
                      className={`bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-[#ed5c37]/20 transition-all duration-200 flex flex-col overflow-hidden group relative ${
                        !promptSearchTerm.trim() ? "cursor-move" : ""
                      } ${isDragged ? "opacity-30 border-dashed border-[#ed5c37] scale-95" : ""}`}
                    >
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-[#ed5c37]/10 group-hover:bg-[#ed5c37] transition-colors" />

                      <div className="p-5 flex flex-col flex-1 gap-4">
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="font-extrabold text-slate-800 text-sm leading-snug break-words flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-[#ed5c37] shrink-0" />
                            {p.title}
                          </h3>

                          <div className="flex items-center gap-1.5 shrink-0 relative z-10">
                            {/* Copy button */}
                            <button
                              onClick={() => handleCopyPrompt(p.prompt, p.id)}
                              className={`p-1.5 rounded-lg border transition-all flex items-center justify-center gap-1 ${
                                isCopied
                                  ? "bg-green-50 border-green-200 text-green-600 font-bold"
                                  : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-855"
                              }`}
                              title={isCopied ? "Copied!" : "Copy prompt template"}
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-green-600" />
                                  <span className="text-[9px]">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span className="text-[9px]">Copy</span>
                                </>
                              )}
                            </button>

                            {/* Edit Button */}
                            <button
                              onClick={() => {
                                setEditingPrompt(p);
                                setPromptTitle(p.title);
                                setPromptContent(p.prompt);
                                setShowPromptModal(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-[#ed5c37] hover:bg-orange-50 border border-transparent hover:border-orange-100 rounded-lg transition-all"
                              title="Edit Prompt"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleDeletePrompt(p.id, p.title)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-lg transition-all"
                              title="Delete Prompt"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Monospace Codebox */}
                        <div className="relative flex-1 bg-slate-900 rounded-xl border border-slate-950 overflow-hidden">
                          <pre className="p-4 text-xs font-mono text-slate-100 overflow-x-auto max-h-56 leading-relaxed select-text whitespace-pre-wrap break-words">
                            {p.prompt}
                          </pre>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── MODAL 1: CREATE FOLDER (CATEGORY) MODAL ───────────────────────── */}
      {showFolderModal && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[999] flex items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={() => setShowFolderModal(false)}
        >
          <div
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in scale-in duration-200 border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-[#ed5c37] flex items-center justify-center shadow-xs">
                  <Folder className="w-5.5 h-5.5 fill-orange-50" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">Create Folder</h3>
                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mt-0.5">Prompt Management</span>
                </div>
              </div>
              <button
                onClick={() => setShowFolderModal(false)}
                className="p-2 hover:bg-slate-200/50 rounded-xl text-slate-400 hover:text-slate-750 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">
                  Folder Name <span className="text-[#ed5c37]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Manual Testing"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2 px-4 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#ed5c37]/20 focus:border-[#ed5c37] focus:bg-white transition-all text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">
                  Description <span className="text-slate-400 font-medium">(optional)</span>
                </label>
                <textarea
                  placeholder="Describe the purpose of prompts stored in this folder..."
                  value={newFolderDesc}
                  onChange={(e) => setNewFolderDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2 px-4 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#ed5c37]/20 focus:border-[#ed5c37] focus:bg-white transition-all text-slate-800 resize-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3 bg-white">
                <button
                  type="button"
                  onClick={() => setShowFolderModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newFolderName.trim()}
                  className="btn-primary py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: RENAME FOLDER (CATEGORY) MODAL ───────────────────────── */}
      {showRenameModal && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[999] flex items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={() => setShowRenameModal(false)}
        >
          <div
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in scale-in duration-200 border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-[#ed5c37] flex items-center justify-center shadow-xs">
                  <Folder className="w-5.5 h-5.5 fill-orange-50" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">Rename Folder</h3>
                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mt-0.5">Prompt Management</span>
                </div>
              </div>
              <button
                onClick={() => setShowRenameModal(false)}
                className="p-2 hover:bg-slate-200/50 rounded-xl text-slate-400 hover:text-slate-750 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenameFolder} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">
                  Folder Name <span className="text-[#ed5c37]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. API Testing"
                  value={renameFolderName}
                  onChange={(e) => setRenameFolderName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2 px-4 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#ed5c37]/20 focus:border-[#ed5c37] focus:bg-white transition-all text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">
                  Description <span className="text-slate-400 font-medium">(optional)</span>
                </label>
                <textarea
                  placeholder="Describe folder contents..."
                  value={renameFolderDesc}
                  onChange={(e) => setRenameFolderDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2 px-4 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#ed5c37]/20 focus:border-[#ed5c37] focus:bg-white transition-all text-slate-800 resize-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3 bg-white">
                <button
                  type="button"
                  onClick={() => setShowRenameModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!renameFolderName.trim()}
                  className="btn-primary py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  Rename Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: CREATE / EDIT PROMPT MODAL ───────────────────────── */}
      {showPromptModal && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[999] flex items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={() => setShowPromptModal(false)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in scale-in duration-200 border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-[#ed5c37] flex items-center justify-center shadow-xs">
                  <Sparkles className="w-5.5 h-5.5 fill-orange-50/50" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">
                    {editingPrompt ? "Edit Prompt" : "Create Prompt"}
                  </h3>
                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mt-0.5">Template Design</span>
                </div>
              </div>
              <button
                onClick={() => setShowPromptModal(false)}
                className="p-2 hover:bg-slate-200/50 rounded-xl text-slate-400 hover:text-slate-750 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePrompt} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">
                  Prompt Title / Use Case <span className="text-[#ed5c37]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Test Case Description"
                  value={promptTitle}
                  onChange={(e) => setPromptTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2 px-4 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#ed5c37]/20 focus:border-[#ed5c37] focus:bg-white transition-all text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">
                  Prompt Template Content <span className="text-[#ed5c37]">*</span>
                </label>
                <textarea
                  required
                  placeholder="Write your prompt template..."
                  value={promptContent}
                  onChange={(e) => setPromptContent(e.target.value)}
                  rows={8}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 px-4 text-xs font-mono font-semibold outline-none focus:ring-2 focus:ring-[#ed5c37]/20 focus:border-[#ed5c37] focus:bg-white transition-all text-slate-800 resize-y"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3 bg-white">
                <button
                  type="button"
                  onClick={() => setShowPromptModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!promptTitle.trim() || !promptContent.trim()}
                  className="btn-primary py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {editingPrompt ? "Save Changes" : "Create Prompt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
