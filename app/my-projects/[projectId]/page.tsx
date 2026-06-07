"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { 
  ArrowLeft, 
  Folder, 
  Users, 
  FileText, 
  History, 
  Calendar, 
  Clock, 
  Shield, 
  User, 
  Activity, 
  AlertTriangle,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  Eye,
  FileCheck,
  FileCode,
  FileSpreadsheet,
  File,
  X,
  CheckCircle,
  Play,
  Pause,
  AlertCircle,
  Flag,
  Plus,
  Lock
} from "lucide-react";
import { 
  updateProjectMilestone, 
  addProjectNote, 
  updateProjectNoteStatus, 
  deleteProjectNote,
  addProjectMilestone,
  editProjectMilestone,
  deleteProjectMilestone,
  reorderProjectMilestones
} from "@/lib/actions";

interface Document {
  id: string;
  name: string;
  category: string;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
}

interface AuditLog {
  id: string;
  user: string;
  action: string;
  timestamp: string | null;
  details: Record<string, any>;
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
  documents: Document[];
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

const DEFAULT_MILESTONES = [
  { key: "smokeTesting", label: "Smoke Testing" },
  { key: "testCaseWriting", label: "Test Case Writing" },
  { key: "designValidation", label: "Design Validation" },
  { key: "integrationTesting", label: "Integration Testing" },
  { key: "regressionTesting", label: "Regression Testing" },
  { key: "uatSupport", label: "UAT Support" },
  { key: "releaseVerification", label: "Release Verification" },
  { key: "postReleaseValidation", label: "Post Release Validation" }
];

export default function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;
  const { data: session } = useSession();

  const [project, setProject] = useState<Project | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "documents" | "notes" | "history">("overview");

  // Document upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState("Other Documents");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [replaceDocId, setReplaceDocId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);

  // Milestone Editing state
  const [editingMilestoneKey, setEditingMilestoneKey] = useState<string | null>(null);
  const [msStatus, setMsStatus] = useState<'Not Started' | 'In Progress' | 'Completed' | 'Blocked'>('Not Started');
  const [msOwner, setMsOwner] = useState('');
  const [msPlanned, setMsPlanned] = useState('');
  const [msCompleted, setMsCompleted] = useState('');
  const [msNotes, setMsNotes] = useState('');
  const [msLoading, setMsLoading] = useState(false);

  // Dynamic Milestone list state (initialize with defaults)
  const [milestoneKeys, setMilestoneKeys] = useState<Array<{ key: string; label: string }>>(DEFAULT_MILESTONES);
  const [showMilestoneManageModal, setShowMilestoneManageModal] = useState(false);
  const [newMilestoneLabel, setNewMilestoneLabel] = useState("");
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [editingMilestoneLabel, setEditingMilestoneLabel] = useState("");
  const [milestoneActionLoading, setMilestoneActionLoading] = useState(false);
  const [milestoneError, setMilestoneError] = useState("");

  useEffect(() => {
    if (project?.timeline) {
      const keys = Object.entries(project.timeline)
        .map(([key, val]: [string, any]) => ({
          key,
          label: val.label || key,
          order: val.order !== undefined ? val.order : 999
        }))
        .sort((a, b) => a.order - b.order);
      setMilestoneKeys(keys);
    }
  }, [project]);

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestoneLabel.trim()) return;
    setMilestoneActionLoading(true);
    setMilestoneError("");
    try {
      const res = await addProjectMilestone(projectId, newMilestoneLabel.trim());
      if (res.error) throw new Error(res.error);
      setNewMilestoneLabel("");
      await fetchProjectDetails();
    } catch (err: any) {
      setMilestoneError(err.message || "Failed to add milestone");
    } finally {
      setMilestoneActionLoading(false);
    }
  };

  const handleUpdateMilestone = async (id: string, newLabel: string) => {
    if (!newLabel.trim()) return;
    setMilestoneActionLoading(true);
    setMilestoneError("");
    try {
      const res = await editProjectMilestone(projectId, id, newLabel.trim());
      if (res.error) throw new Error(res.error);
      setEditingMilestoneId(null);
      await fetchProjectDetails();
    } catch (err: any) {
      setMilestoneError(err.message || "Failed to update milestone");
    } finally {
      setMilestoneActionLoading(false);
    }
  };

  const handleDeleteMilestone = async (id: string) => {
    if (!confirm("Are you sure? Removing this milestone will remove it from this project. Existing status data for this milestone will be ignored but preserved in documents.")) return;
    setMilestoneActionLoading(true);
    setMilestoneError("");
    try {
      const res = await deleteProjectMilestone(projectId, id);
      if (res.error) throw new Error(res.error);
      await fetchProjectDetails();
    } catch (err: any) {
      setMilestoneError(err.message || "Failed to delete milestone");
    } finally {
      setMilestoneActionLoading(false);
    }
  };

  const handleMoveMilestone = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === milestoneKeys.length - 1) return;

    setMilestoneActionLoading(true);
    setMilestoneError("");

    const newMilestones = [...milestoneKeys];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    const temp = newMilestones[index];
    newMilestones[index] = newMilestones[targetIndex];
    newMilestones[targetIndex] = temp;

    const orders = newMilestones.map((m, idx) => ({ key: m.key, order: idx + 1 }));

    try {
      const res = await reorderProjectMilestones(projectId, orders);
      if (res.error) throw new Error(res.error);
      setMilestoneKeys(newMilestones);
    } catch (err: any) {
      setMilestoneError(err.message || "Failed to reorder milestones");
    } finally {
      setMilestoneActionLoading(false);
    }
  };

  // Notes & Flags Form state
  const [noteType, setNoteType] = useState<'Note' | 'Risk' | 'Blocker' | 'Dependency'>('Note');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteDesc, setNoteDesc] = useState('');
  const [notePriority, setNotePriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [noteError, setNoteError] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);

  const fetchProjectDetails = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch project details");
      const data = await res.json();
      setProject(data);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/audit-logs`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    }
  };

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      await Promise.all([fetchProjectDetails(), fetchAuditLogs()]);
      setLoading(false);
    };
    if (projectId) {
      initData();
    }
  }, [projectId]);

  const userEmail = session?.user?.email || "";
  const userRole = (session?.user as any)?.role || "";
  
  const isLeadOrAdmin = userRole === "ADMIN" || userRole === "TL";
  const isOwnerOrBackup = project ? (project.primaryQaEmail === userEmail || project.supportingQaEmail === userEmail) : false;
  
  // Permissions
  const canManageTimeline = isLeadOrAdmin || isOwnerOrBackup;
  const canManageDocs = isLeadOrAdmin || isOwnerOrBackup;
  const canManageNotes = isLeadOrAdmin || isOwnerOrBackup || userRole === "DEV" || userRole === "USER";

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    setUploadError("");

    // Validations: File Type and Size (50MB)
    const allowedExtensions = ["pdf", "docx", "xlsx", "png", "jpg", "jpeg", "txt", "zip"];
    const ext = uploadFile.name.split(".").pop()?.toLowerCase() || "";
    if (!allowedExtensions.includes(ext)) {
      setUploadError("Unsupported file type. Supported types: PDF, DOCX, XLSX, PNG, JPG, TXT, ZIP");
      setUploading(false);
      return;
    }

    if (uploadFile.size > 50 * 1024 * 1024) {
      setUploadError("File size exceeds 50 MB limit");
      setUploading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("category", uploadCategory);

      // Duplicate filename check -> Version replacement automation
      let finalReplaceId = replaceDocId;
      if (!finalReplaceId && project?.documents) {
        const duplicate = project.documents.find(d => d.name.toLowerCase() === uploadFile.name.toLowerCase());
        if (duplicate) {
          if (confirm(`A file named "${uploadFile.name}" already exists. Do you want to replace it as a new version?`)) {
            finalReplaceId = duplicate.id;
          } else {
            setUploading(false);
            return;
          }
        }
      }

      if (finalReplaceId) {
        formData.append("replaceDocId", finalReplaceId);
      }

      const res = await fetch(`/api/projects/${projectId}/documents`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      await Promise.all([fetchProjectDetails(), fetchAuditLogs()]);
      setUploadFile(null);
      setUploadCategory("Other Documents");
      setReplaceDocId(null);
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/documents?docId=${docId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete document");
      }

      await Promise.all([fetchProjectDetails(), fetchAuditLogs()]);
      if (previewDoc && previewDoc.id === docId) {
        setPreviewDoc(null);
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete document");
    }
  };

  // Milestone Save Handler
  const handleSaveMilestone = async (key: string) => {
    if (!project) return;
    setMsLoading(true);
    try {
      const res = await updateProjectMilestone(project.id, key, {
        status: msStatus,
        owner: msOwner,
        plannedDate: msPlanned || null,
        completedDate: msCompleted || null,
        notes: msNotes
      });
      if (res && 'error' in res) {
        alert(res.error || "Failed to update milestone");
      } else {
        await Promise.all([fetchProjectDetails(), fetchAuditLogs()]);
        setEditingMilestoneKey(null);
      }
    } catch (err: any) {
      alert(err.message || "An error occurred");
    } finally {
      setMsLoading(false);
    }
  };

  // Add Note / Flag Handler
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !noteTitle.trim()) return;
    setNoteLoading(true);
    setNoteError("");
    try {
      const res = await addProjectNote(project.id, {
        id: `note_${Date.now()}`,
        type: noteType,
        title: noteTitle,
        description: noteDesc,
        priority: notePriority,
        status: 'Open'
      });
      if (res && 'error' in res) {
        setNoteError(res.error || "Failed to add note");
      } else {
        await Promise.all([fetchProjectDetails(), fetchAuditLogs()]);
        setNoteTitle('');
        setNoteDesc('');
        setNoteType('Note');
        setNotePriority('Medium');
      }
    } catch (err: any) {
      setNoteError(err.message || "An error occurred");
    } finally {
      setNoteLoading(false);
    }
  };

  // Resolve Note Status Handler
  const handleToggleNoteStatus = async (noteId: string, currentStatus: 'Open' | 'Resolved') => {
    if (!project) return;
    const nextStatus = currentStatus === 'Open' ? 'Resolved' : 'Open';
    try {
      const res = await updateProjectNoteStatus(project.id, noteId, nextStatus);
      if (res && 'error' in res) {
        alert(res.error || "Failed to update status");
      } else {
        await fetchProjectDetails();
      }
    } catch (err: any) {
      alert(err.message || "An error occurred");
    }
  };

  // Delete Note Handler
  const handleDeleteNote = async (noteId: string) => {
    if (!project || !confirm("Are you sure you want to delete this note/flag?")) return;
    try {
      const res = await deleteProjectNote(project.id, noteId);
      if (res && 'error' in res) {
        alert(res.error || "Failed to delete note");
      } else {
        await fetchProjectDetails();
      }
    } catch (err: any) {
      alert(err.message || "An error occurred");
    }
  };

  const getDocIcon = (name: string) => {
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

  const isPreviewable = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    return ["png", "jpg", "jpeg", "pdf", "txt"].includes(ext);
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

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case "ACTIVE":
        return <span className="px-3 py-1 text-sm font-semibold rounded-full bg-sky-100 text-sky-800 border border-sky-200">Active</span>;
      case "COMPLETED":
        return <span className="px-3 py-1 text-sm font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">Completed</span>;
      case "ON_HOLD":
      case "ON HOLD":
        return <span className="px-3 py-1 text-sm font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200">On Hold</span>;
      case "INACTIVE":
        return <span className="px-3 py-1 text-sm font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200">Inactive</span>;
      default:
        return <span className="px-3 py-1 text-sm font-semibold rounded-full bg-slate-100 text-slate-800 border border-slate-200">{status}</span>;
    }
  };

  const getInitialsAvatar = (name: string, roleLabel: string) => {
    const initials = name ? name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() : "QA";
    let bg = "bg-slate-700";
    if (roleLabel === "Primary QA") bg = "bg-[#ed5c37]";
    if (roleLabel === "Supporting QA") bg = "bg-blue-600";
    if (roleLabel === "Team Lead") bg = "bg-amber-600";
    
    return (
      <div className={`w-11 h-11 rounded-full ${bg} text-white flex items-center justify-center font-bold text-sm border-2 border-white shadow-sm`}>
        {initials}
      </div>
    );
  };

  // Milestone status color classes
  const getMilestoneStatusClass = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "In Progress":
        return "bg-sky-100 text-sky-850 border-sky-200";
      case "Blocked":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[65vh]">
        <div className="w-12 h-12 border-4 border-[#ed5c37] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-500 font-semibold text-sm animate-pulse">Loading Workspace Details...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-6">
        <Link href="/my-projects" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to projects
        </Link>
        <div className="p-6 bg-rose-50 border border-rose-100 rounded-3xl text-rose-800">
          <h2 className="font-bold text-lg">Error Loading Workspace</h2>
          <p className="mt-1 text-sm">{error || "Project not found or access denied."}</p>
        </div>
      </div>
    );
  }

  // Calculate Progress Percent for visualizer
  const milestones = Object.values(project.timeline || {});
  const completedCount = milestones.filter(m => m.status === 'Completed').length;
  const totalMilestones = milestoneKeys.length || 1;
  const progressPercent = Math.round((completedCount / totalMilestones) * 100);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Header Navigation */}
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-6">
        <Link href="/my-projects" className="inline-flex items-center gap-2 text-slate-500 hover:text-[#ed5c37] transition-colors text-sm font-bold">
          <ArrowLeft className="w-4 h-4" /> Back to Accountability Hub
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{project.name}</h1>
              {project.code && <span className="px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold uppercase tracking-wider">{project.code}</span>}
            </div>
            <p className="text-slate-400 mt-1 text-sm">Created at {formatDate(project.createdAt)}</p>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(project.status)}
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-5 py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 -mb-px ${
            activeTab === "overview"
              ? "border-[#ed5c37] text-[#ed5c37]"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <Folder className="w-4 h-4" /> Overview & Team
        </button>
        <button
          onClick={() => setActiveTab("timeline")}
          className={`px-5 py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 -mb-px ${
            activeTab === "timeline"
              ? "border-[#ed5c37] text-[#ed5c37]"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <Clock className="w-4 h-4" /> Milestone Tracker ({progressPercent}%)
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={`px-5 py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 -mb-px ${
            activeTab === "documents"
              ? "border-[#ed5c37] text-[#ed5c37]"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <FileText className="w-4 h-4" /> Documentation Hub ({project.documents?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("notes")}
          className={`px-5 py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 -mb-px ${
            activeTab === "notes"
              ? "border-[#ed5c37] text-[#ed5c37]"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <Flag className="w-4 h-4" /> Notes & Flags ({project.notesAndFlags?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-5 py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 -mb-px ${
            activeTab === "history"
              ? "border-[#ed5c37] text-[#ed5c37]"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <History className="w-4 h-4" /> Recent Activity
        </button>
      </div>

      {/* Tab Contents */}
      <div className="space-y-6">
        
        {/* ==================================================== */}
        {/* OVERVIEW & TEAM TAB */}
        {/* ==================================================== */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Left side details */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Project Description */}
              {project.description && (
                <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-3">
                  <h3 className="font-bold text-slate-800 text-base">Project Description</h3>
                  <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{project.description}</p>
                </div>
              )}


              {/* Requirements */}
              <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <h3 className="font-bold text-slate-800 text-base">Requirement Summary</h3>
                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                  {project.requirements || "No requirement summary details have been specified yet."}
                </p>
              </div>
            </div>

            {/* Right side dates & Team directory */}
            <div className="space-y-6">
              
              {/* Timeline Dates */}
              <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-3 flex items-center gap-2"><Calendar className="w-5 h-5 text-slate-400" /> Key Dates</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Start Date</span>
                    <span className="text-sm font-semibold text-slate-800">{formatDate(project.startDate)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Release Date</span>
                    <span className="text-sm font-semibold text-slate-800">{formatDate(project.targetReleaseDate)}</span>
                  </div>
                </div>
              </div>

              {/* Team Members */}
              <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-3 flex items-center gap-2"><Users className="w-5 h-5 text-slate-400" /> Team Directory</h3>
                
                <div className="space-y-3">
                  {/* Team Lead */}
                  {project.teamLeadEmail && (
                    <div className="flex items-center gap-3.5 p-2.5 rounded-2xl hover:bg-slate-50 transition-colors">
                      {getInitialsAvatar(project.teamLeadName, "Team Lead")}
                      <div>
                        <span className="text-sm font-bold text-slate-800 block">{project.teamLeadName}</span>
                        <span className="text-[9px] font-semibold text-slate-400 block uppercase tracking-wider">Team Lead</span>
                      </div>
                    </div>
                  )}

                  {/* Primary QA */}
                  {project.primaryQaEmail && (
                    <div className="flex items-center gap-3.5 p-2.5 rounded-2xl hover:bg-slate-50 transition-colors">
                      {getInitialsAvatar(project.primaryQaName, "Primary QA")}
                      <div>
                        <span className="text-sm font-bold text-slate-800 block">{project.primaryQaName}</span>
                        <span className="text-[9px] font-semibold text-slate-400 block uppercase tracking-wider">Primary QA</span>
                      </div>
                    </div>
                  )}

                  {/* Supporting QA */}
                  {project.supportingQaEmail && (
                    <div className="flex items-center gap-3.5 p-2.5 rounded-2xl hover:bg-slate-50 transition-colors">
                      {getInitialsAvatar(project.supportingQaName, "Supporting QA")}
                      <div>
                        <span className="text-sm font-bold text-slate-800 block">{project.supportingQaName}</span>
                        <span className="text-[9px] font-semibold text-slate-400 block uppercase tracking-wider">Supporting QA (Backup)</span>
                      </div>
                    </div>
                  )}

                  {/* Developers list */}
                  {project.developerEmails?.map((email, idx) => {
                    const devName = project.developerNames[idx] || email;
                    return (
                      <div key={email} className="flex items-center gap-3.5 p-2.5 rounded-2xl hover:bg-slate-50 transition-colors">
                        {getInitialsAvatar(devName, "Developer")}
                        <div>
                          <span className="text-sm font-bold text-slate-800 block">{devName}</span>
                          <span className="text-[9px] font-semibold text-slate-400 block uppercase tracking-wider">Developer</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* MILESTONE TRACKER & TIMELINE TAB */}
        {/* ==================================================== */}
        {activeTab === "timeline" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Visual Progress Header */}
            <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-lg">Test Plan Milestones Progress</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Track the status of the standard QA testing verification flow.</p>
                </div>
                <div className="flex items-center gap-3">
                  {isLeadOrAdmin && (
                    <button
                      onClick={() => {
                        setShowMilestoneManageModal(true);
                        setMilestoneError("");
                      }}
                      className="px-4 py-2 bg-slate-100 hover:bg-[#ed5c37] hover:text-white text-slate-700 text-xs font-bold rounded-xl transition-all shadow-sm border border-slate-200"
                    >
                      ⚙ Manage Milestones
                    </button>
                  )}
                  <span className="px-3 py-1 bg-slate-900 text-white rounded-full font-bold text-xs">{progressPercent}% Completed</span>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200 p-0.5">
                <div 
                  className="bg-[#ed5c37] h-2 rounded-full transition-all duration-550" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Timeline Milestones Grid/List */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100">
                {milestoneKeys.map(({ key, label }) => {
                  const ms = project.timeline?.[key] || {
                    status: 'Not Started',
                    owner: '',
                    plannedDate: null,
                    completedDate: null,
                    notes: ''
                  };

                  const isEditing = editingMilestoneKey === key;

                  return (
                    <div key={key} className="p-6 hover:bg-slate-50/50 transition-colors">
                      {!isEditing ? (
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <h4 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                              {label}
                            </h4>
                            {ms.notes && <p className="text-xs text-slate-500 italic max-w-2xl mt-1">{ms.notes}</p>}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {ms.owner && <span>Owner: <strong className="text-slate-600">{ms.owner}</strong></span>}
                              {ms.plannedDate && <span>Planned Date: <strong className="text-slate-600">{formatDate(ms.plannedDate)}</strong></span>}
                              {ms.completedDate && <span>Completed Date: <strong className="text-slate-600">{formatDate(ms.completedDate)}</strong></span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-3.5 self-start md:self-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getMilestoneStatusClass(ms.status)}`}>
                              {ms.status}
                            </span>
                            {canManageTimeline && (
                              <button
                                onClick={() => {
                                  setEditingMilestoneKey(key);
                                  setMsStatus(ms.status);
                                  setMsOwner(ms.owner || '');
                                  setMsPlanned(ms.plannedDate ? ms.plannedDate.split("T")[0] : '');
                                  setMsCompleted(ms.completedDate ? ms.completedDate.split("T")[0] : '');
                                  setMsNotes(ms.notes || '');
                                }}
                                className="px-3.5 py-1.5 bg-slate-900 hover:bg-[#ed5c37] text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Editing Form */
                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-3xl space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <h4 className="font-extrabold text-slate-800 text-sm">Update Milestone: {label}</h4>
                            <button onClick={() => setEditingMilestoneKey(null)} className="p-1 hover:bg-slate-200 rounded-full">
                              <X className="w-4 h-4 text-slate-400" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status</label>
                              <select
                                value={msStatus}
                                onChange={(e) => setMsStatus(e.target.value as any)}
                                className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold text-slate-700"
                              >
                                <option value="Not Started">Not Started</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Completed">Completed</option>
                                <option value="Blocked">Blocked</option>
                              </select>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Milestone Owner</label>
                              <input
                                type="text"
                                value={msOwner}
                                onChange={(e) => setMsOwner(e.target.value)}
                                placeholder="QA Engineer email or name"
                                className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold text-slate-700 outline-none"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Planned Date</label>
                                <input
                                  type="date"
                                  value={msPlanned}
                                  onChange={(e) => setMsPlanned(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold text-slate-700 outline-none"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Completed Date</label>
                                <input
                                  type="date"
                                  value={msCompleted}
                                  onChange={(e) => setMsCompleted(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold text-slate-700 outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Milestone Notes & Remarks</label>
                            <textarea
                              value={msNotes}
                              onChange={(e) => setMsNotes(e.target.value)}
                              placeholder="Enter any status comments or blockers..."
                              rows={2}
                              className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs font-medium text-slate-700 outline-none resize-none"
                            />
                          </div>

                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setEditingMilestoneKey(null)}
                              className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl font-bold text-xs"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveMilestone(key)}
                              disabled={msLoading}
                              className="px-4.5 py-2 bg-slate-900 hover:bg-[#ed5c37] text-white rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5"
                            >
                              {msLoading ? <Clock className="w-3 animate-spin" /> : "Save Changes"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* DOCUMENTATION HUB TAB */}
        {/* ==================================================== */}
        {activeTab === "documents" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Upload Document Panel */}
            <div className="lg:col-span-1 p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4 h-fit">
              <h3 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-3">
                {replaceDocId ? "Replace Version" : "Upload Project Document"}
              </h3>
              
              {canManageDocs ? (
                <form onSubmit={handleUpload} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">File</label>
                    <input
                      type="file"
                      required={!replaceDocId}
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-600 hover:file:bg-[#ed5c37]/15 hover:file:text-[#ed5c37] file:cursor-pointer border border-slate-200 rounded-xl p-1 bg-slate-50 cursor-pointer outline-none"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">Supported: PDF, DOCX, XLSX, PNG, JPG, TXT, ZIP. Max 50MB.</span>
                    {replaceDocId && (
                      <span className="text-[10px] text-amber-600 font-bold block mt-1.5">
                        ⚠️ Warning: You are about to replace this document version.
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Category</label>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs outline-none focus:ring-2 focus:ring-[#ed5c37]/20 focus:border-[#ed5c37] transition-all font-semibold text-slate-600"
                    >
                      {DOCUMENT_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {uploadError && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-xs font-bold">
                      {uploadError}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={uploading || (!uploadFile && !replaceDocId)}
                      className="flex-1 px-4 py-2.5 bg-slate-900 hover:bg-[#ed5c37] disabled:bg-slate-200 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
                    >
                      {uploading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      {replaceDocId ? "Replace version" : "Upload file"}
                    </button>

                    {replaceDocId && (
                      <button
                        type="button"
                        onClick={() => {
                          setReplaceDocId(null);
                          setUploadFile(null);
                          setUploadError("");
                        }}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-sm transition-all"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-slate-400">
                  <Lock className="w-4 h-4 text-slate-400" /> Only Primary / Supporting QA can manage repository.
                </div>
              )}
            </div>

            {/* Document Listing categorized */}
            <div className="lg:col-span-2 p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-5">
              <h3 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-3 flex items-center gap-2">
                Project Documentation Repository
              </h3>

              <div className="space-y-5 max-h-[500px] overflow-y-auto pr-1">
                {project.documents?.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-sm font-medium border-2 border-dashed border-slate-200 rounded-2xl">
                    No project documents uploaded.
                  </div>
                ) : (
                  // Group by categories
                  DOCUMENT_CATEGORIES.map(category => {
                    const categorizedDocs = project.documents?.filter(d => d.category === category) || [];
                    if (categorizedDocs.length === 0) return null;

                    return (
                      <div key={category} className="space-y-2.5">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block pl-1">{category}</h4>
                        <div className="space-y-2">
                          {categorizedDocs.map(doc => (
                            <div
                              key={doc.id}
                              className="p-3.5 bg-slate-50 hover:bg-slate-100/50 border border-slate-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors group"
                            >
                              <div className="flex items-start gap-4">
                                <div className="mt-0.5">{getDocIcon(doc.name)}</div>
                                <div>
                                  <div className="font-bold text-slate-800 text-sm line-clamp-1 group-hover:text-[#ed5c37] transition-colors">{doc.name}</div>
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-1">
                                    <span>Uploaded by {doc.uploadedBy}</span>
                                    <span>•</span>
                                    <span>{formatDate(doc.uploadedAt)}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 self-end sm:self-center">
                                {isPreviewable(doc.name) && (
                                  <button
                                    onClick={() => setPreviewDoc(doc)}
                                    className="p-2 text-slate-500 hover:text-[#ed5c37] hover:bg-white rounded-xl shadow-sm border border-slate-100 transition-all bg-white"
                                    title="Preview"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <a
                                  href={doc.url}
                                  download={doc.name}
                                  className="p-2 text-slate-500 hover:text-blue-600 hover:bg-white rounded-xl shadow-sm border border-slate-100 transition-all bg-white"
                                  title="Download"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                                {canManageDocs && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setReplaceDocId(doc.id);
                                        setUploadCategory(doc.category);
                                        setUploadError("");
                                      }}
                                      className="p-2 text-slate-500 hover:text-amber-600 hover:bg-white rounded-xl shadow-sm border border-slate-100 transition-all bg-white"
                                      title="Replace version"
                                    >
                                      <RefreshCw className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteDoc(doc.id)}
                                      className="p-2 text-slate-500 hover:text-red-600 hover:bg-white rounded-xl shadow-sm border border-slate-100 transition-all bg-white"
                                      title="Delete version"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* NOTES & FLAGS TAB */}
        {/* ==================================================== */}
        {activeTab === "notes" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Left Column - Add Note/Flag */}
            <div className="lg:col-span-1 p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4 h-fit">
              <h3 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-3">
                Log Project Note / Flag
              </h3>

              {canManageNotes ? (
                <form onSubmit={handleAddNote} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Entry Type</label>
                    <select
                      value={noteType}
                      onChange={(e) => setNoteType(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold text-slate-700 outline-none transition-all cursor-pointer"
                    >
                      <option value="Note">📝 Note</option>
                      <option value="Risk">⚠️ Risk</option>
                      <option value="Blocker">🛑 Blocker</option>
                      <option value="Dependency">🔗 Dependency</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Title (Required)</label>
                    <input
                      type="text"
                      required
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      placeholder="Summary title..."
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-xl py-2 px-3 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#ed5c37]/20 focus:border-[#ed5c37] transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Description</label>
                    <textarea
                      value={noteDesc}
                      onChange={(e) => setNoteDesc(e.target.value)}
                      placeholder="Add details, notes, plans, blockers..."
                      rows={4}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-xl py-2 px-3 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#ed5c37]/20 focus:border-[#ed5c37] transition-all resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Priority</label>
                    <select
                      value={notePriority}
                      onChange={(e) => setNotePriority(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-xl py-2 px-3 text-xs font-semibold text-slate-700 outline-none transition-all cursor-pointer"
                    >
                      <option value="Low">🟢 Low</option>
                      <option value="Medium">🟡 Medium</option>
                      <option value="High">🟠 High</option>
                      <option value="Critical">🔴 Critical</option>
                    </select>
                  </div>

                  {noteError && (
                    <div className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-100 p-2.5 rounded-lg">
                      {noteError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={noteLoading}
                    className="w-full px-4 py-2.5 bg-slate-900 hover:bg-[#ed5c37] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
                  >
                    {noteLoading ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Add Flag / Note
                  </button>
                </form>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-slate-400">
                  <Lock className="w-4 h-4 text-slate-400" /> Only project members can log notes.
                </div>
              )}
            </div>

            {/* Right Column - Listing Notes & Flags */}
            <div className="lg:col-span-2 p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-3 flex items-center gap-2">
                Logged Flags & Notes
              </h3>

              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                {project.notesAndFlags?.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-sm font-medium border-2 border-dashed border-slate-200 rounded-2xl">
                    No project flags or notes recorded yet.
                  </div>
                ) : (
                  [...project.notesAndFlags].reverse().map((nf) => {
                    const badgeColor = 
                      nf.type === 'Blocker' ? 'bg-red-100 text-red-800 border-red-200' :
                      nf.type === 'Risk' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                      nf.type === 'Dependency' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' :
                      'bg-slate-100 text-slate-700 border-slate-200';
                    
                    const priorityColor =
                      nf.priority === 'Critical' ? 'bg-red-500 text-white' :
                      nf.priority === 'High' ? 'bg-orange-500 text-white' :
                      nf.priority === 'Medium' ? 'bg-amber-500 text-white' :
                      'bg-slate-400 text-white';

                    return (
                      <div key={nf.id} className={`p-4 border rounded-2xl flex flex-col justify-between gap-3 transition-colors ${
                        nf.status === 'Resolved' ? 'bg-slate-50/50 border-slate-100 opacity-60' : 'bg-white border-slate-200 shadow-sm'
                      }`}>
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${badgeColor}`}>
                                {nf.type}
                              </span>
                              <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold uppercase tracking-wider ${priorityColor}`}>
                                {nf.priority}
                              </span>
                              <h4 className={`font-bold text-sm ${nf.status === 'Resolved' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                {nf.title}
                              </h4>
                            </div>
                            {nf.description && <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{nf.description}</p>}
                          </div>

                          <div className="flex items-center gap-1.5 self-end sm:self-start">
                            {canManageNotes && (
                              <button
                                onClick={() => handleToggleNoteStatus(nf.id, nf.status)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                                  nf.status === 'Resolved' 
                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300' 
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                                }`}
                              >
                                {nf.status === 'Resolved' ? 'Reopen' : 'Resolve'}
                              </button>
                            )}
                            {canManageNotes && (
                              <button
                                onClick={() => handleDeleteNote(nf.id)}
                                className="p-1 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors border border-transparent hover:border-red-200"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold border-t border-slate-100 pt-2">
                          <span>Logged by {nf.createdBy}</span>
                          <span>{formatDate(nf.createdDate)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* RECENT ACTIVITY TAB */}
        {/* ==================================================== */}
        {activeTab === "history" && (
          <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h3 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-3 flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#ed5c37]" /> Project Recent Activity Logs
            </h3>
            
            <div className="relative border-l-2 border-slate-100 ml-4 pl-6 space-y-6 max-h-[500px] overflow-y-auto py-2">
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm ml-[-24px]">
                  No activities recorded for this project workspace yet.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="relative">
                    {/* Circle marker */}
                    <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 border-4 border-white ring-1 ring-slate-100"></span>
                    
                    <div className="bg-slate-50 hover:bg-slate-100/50 p-4 rounded-2xl border border-slate-100 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="font-bold text-slate-800 text-sm">{log.action}</span>
                        <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {formatDate(log.timestamp)}
                        </span>
                      </div>
                      
                      <div className="text-slate-500 text-xs mt-1">
                        Triggered by <span className="font-semibold text-slate-700">{log.user}</span>
                      </div>

                      {log.details && Object.keys(log.details).length > 0 && (
                        <div className="mt-3 text-xs bg-white/70 p-3 rounded-xl border border-slate-100 text-slate-600 font-medium">
                          {log.action === "Status Changed" && (
                            <div>Status updated: <span className="font-bold text-slate-800">{log.details.oldStatus}</span> &rarr; <span className="font-bold text-emerald-600">{log.details.newStatus}</span></div>
                          )}
                          {log.action === "Project Status Changed" && (
                            <div>Project Status updated: <span className="font-bold text-slate-800">{log.details.oldStatus}</span> &rarr; <span className="font-bold text-[#ed5c37]">{log.details.newStatus}</span></div>
                          )}
                          {log.action === "Primary QA Changed" && (
                            <div>Primary QA assigned: <span className="font-bold text-slate-800">{log.details.newPrimaryQa || "Unassigned"}</span></div>
                          )}
                          {log.action === "Supporting QA Changed" && (
                            <div>Supporting QA assigned: <span className="font-bold text-slate-800">{log.details.newSupportingQa || "Unassigned"}</span></div>
                          )}
                          {log.action === "Developer Added" && (
                            <div>Developer added to team: <span className="font-bold text-slate-800">{log.details.developer}</span></div>
                          )}
                          {log.action === "Developer Removed" && (
                            <div>Developer removed from team: <span className="font-bold text-red-600">{log.details.developer}</span></div>
                          )}
                          {log.action === "Document Uploaded" && (
                            <div>Uploaded document: <span className="font-bold text-[#ed5c37]">{log.details.fileName}</span> under category <span className="font-bold text-slate-800">{log.details.category}</span></div>
                          )}
                          {log.action === "Document Replaced" && (
                            <div>Replaced document: <span className="font-bold text-slate-800">{log.details.fileName}</span> ({log.details.category})</div>
                          )}
                          {log.action === "Document Deleted" && (
                            <div>Deleted document: <span className="font-bold text-red-600">{log.details.fileName}</span></div>
                          )}
                          {log.action === "Timeline Updated" && (
                            <div>Milestone <span className="font-bold text-slate-800">{log.details.milestone}</span> status updated: <span className="font-bold text-slate-800">{log.details.oldStatus}</span> &rarr; <span className="font-bold text-blue-600">{log.details.newStatus}</span></div>
                          )}
                          {log.action === "Risk Added" && (
                            <div>⚠️ Risk added: <span className="font-bold text-amber-600">{log.details.title}</span></div>
                          )}
                          {log.action === "Blocker Added" && (
                            <div>🛑 Blocker added: <span className="font-bold text-red-600">{log.details.title}</span></div>
                          )}
                          {log.action === "Dependency Added" && (
                            <div>🔗 Dependency added: <span className="font-bold text-indigo-600">{log.details.title}</span></div>
                          )}
                          {!["Status Changed", "Project Status Changed", "Primary QA Changed", "Supporting QA Changed", "Developer Added", "Developer Removed", "Document Uploaded", "Document Replaced", "Document Deleted", "Timeline Updated", "Risk Added", "Blocker Added", "Dependency Added"].includes(log.action) && (
                            <div className="text-slate-500 italic">Project details modified.</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base line-clamp-1">{previewDoc.name}</h3>
                <span className="px-2.5 py-0.5 bg-[#ed5c37]/10 text-[#ed5c37] rounded-md font-bold text-[10px] uppercase tracking-wider mt-1 inline-block">
                  {previewDoc.category}
                </span>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 p-6 bg-slate-100 overflow-auto flex items-center justify-center min-h-[350px]">
              {(() => {
                const ext = previewDoc.name.split(".").pop()?.toLowerCase() || "";
                if (["png", "jpg", "jpeg"].includes(ext)) {
                  return (
                    <img
                      src={previewDoc.url}
                      alt={previewDoc.name}
                      className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-md"
                    />
                  );
                } else if (ext === "pdf" || ext === "txt") {
                  return (
                    <iframe
                      src={previewDoc.url}
                      className="w-full h-[60vh] rounded-xl border border-slate-200 shadow-inner bg-white"
                      title={previewDoc.name}
                    />
                  );
                } else {
                  return (
                    <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm max-w-md">
                      {getDocIcon(previewDoc.name)}
                      <h4 className="font-bold text-slate-800 text-sm mt-3">{previewDoc.name}</h4>
                      <p className="text-xs text-slate-400 mt-1">This file format cannot be previewed in the browser.</p>
                      <a
                        href={previewDoc.url}
                        download={previewDoc.name}
                        className="mt-4 px-4 py-2 bg-slate-900 hover:bg-[#ed5c37] text-white font-bold text-xs rounded-xl shadow-sm inline-flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" /> Download file
                      </a>
                    </div>
                  );
                }
              })()}
            </div>
          </div>
        </div>
      )}
      {showMilestoneManageModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg">Manage Milestones</h3>
                <p className="text-xs text-slate-400 mt-0.5">Add, edit, delete, or change the display order of milestones</p>
              </div>
              <button 
                onClick={() => {
                  setShowMilestoneManageModal(false);
                  setMilestoneError("");
                }} 
                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {milestoneError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-xs font-semibold">
                  {milestoneError}
                </div>
              )}

              {/* Add New Milestone */}
              <form onSubmit={handleAddMilestone} className="flex gap-2 pb-4 border-b border-slate-100">
                <input 
                  type="text" 
                  value={newMilestoneLabel}
                  onChange={(e) => setNewMilestoneLabel(e.target.value)}
                  placeholder="New milestone name..."
                  className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-[#ed5c37]/20 focus:border-[#ed5c37] rounded-xl font-semibold text-xs text-slate-700 outline-none transition-all"
                  disabled={milestoneActionLoading}
                />
                <button 
                  type="submit"
                  disabled={milestoneActionLoading || !newMilestoneLabel.trim()}
                  className="px-4 py-2 bg-slate-900 hover:bg-[#ed5c37] text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-colors"
                >
                  Add
                </button>
              </form>

              {/* Milestones List */}
              <div className="space-y-2">
                {milestoneKeys.map((m, idx) => {
                  const isEditingThis = editingMilestoneId === m.key;
                  return (
                    <div key={m.key} className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-2xl gap-3">
                      <div className="flex-1 min-w-0">
                        {isEditingThis ? (
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={editingMilestoneLabel}
                              onChange={(e) => setEditingMilestoneLabel(e.target.value)}
                              className="flex-1 px-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#ed5c37]/20"
                              autoFocus
                            />
                            <button 
                              type="button"
                              onClick={() => handleUpdateMilestone(m.key, editingMilestoneLabel)}
                              className="px-3 py-1 bg-emerald-650 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg"
                              disabled={milestoneActionLoading}
                            >
                              Save
                            </button>
                            <button 
                              type="button"
                              onClick={() => setEditingMilestoneId(null)}
                              className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-600 text-[10px] font-bold rounded-lg"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-slate-800 truncate block">{m.label}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Reordering */}
                        <button 
                          type="button"
                          onClick={() => handleMoveMilestone(idx, 'up')}
                          disabled={idx === 0 || milestoneActionLoading}
                          className="p-1 bg-white hover:bg-slate-200 border border-slate-200 rounded-md text-slate-500 disabled:opacity-40"
                          title="Move Up"
                        >
                          ▲
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleMoveMilestone(idx, 'down')}
                          disabled={idx === milestoneKeys.length - 1 || milestoneActionLoading}
                          className="p-1 bg-white hover:bg-slate-200 border border-slate-200 rounded-md text-slate-500 disabled:opacity-40"
                          title="Move Down"
                        >
                          ▼
                        </button>

                        {/* Edit & Delete */}
                        {!isEditingThis && (
                          <>
                            <button 
                              type="button"
                              onClick={() => {
                                setEditingMilestoneId(m.key);
                                setEditingMilestoneLabel(m.label);
                              }}
                              disabled={milestoneActionLoading}
                              className="px-2 py-1 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 text-blue-600 rounded-md text-[10px] font-bold"
                            >
                              Edit
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleDeleteMilestone(m.key)}
                              disabled={milestoneActionLoading}
                              className="px-2 py-1 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 text-red-600 rounded-md text-[10px] font-bold"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button 
                onClick={() => {
                  setShowMilestoneManageModal(false);
                  setMilestoneError("");
                }} 
                className="px-5 py-2.5 bg-slate-900 text-white hover:bg-[#ed5c37] font-bold text-xs rounded-xl shadow-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
