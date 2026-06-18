"use client";

import { useState, useEffect, use, useRef, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  UploadCloud,
  Download,
  Trash2,
  ArrowLeft,
  Search,
  Filter,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  User,
  Shield,
  Info,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Database,
  Link2,
  Link2Off,
  HelpCircle,
  FileSpreadsheet,
  Plus,
  Check,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";

// Google Sheet Type Definitions
type DevStatus = "Not Started" | "Passed" | "Failed" | "Blocked";
type QAStatus = "Not Run" | "Passed" | "Failed" | "Blocked";
type CrossBrowserVerified = "Yes" | "No" | "N/A";
type Priority = "Low" | "Medium" | "High" | "Critical";

interface TestCase {
  [key: string]: any;
  testCaseId: string;
  module: string;
  title: string;
  preConditions: string;
  testSteps: string;
  testData: string;
  expectedResult: string;
  devStatus: DevStatus;
  devDateExecuted: string;
  devNotes: string;
  qaStatus: QAStatus;
  crossBrowserVerified: CrossBrowserVerified;
  priority: Priority;
  jiraTicket: string;
  status: "active" | "inactive";
  lastSyncedAt?: string;
}

interface SyncSummary {
  newRecords: number;
  updatedRecords: number;
  inactiveRecords: number;
  failedRecords: number;
  conflictRecords: number;
  duration: number;
  lastSyncTime: string;
}

interface SyncLog {
  id: string;
  syncTime: string;
  triggeredBy: string;
  createdRecords: number;
  updatedRecords: number;
  inactiveRecords: number;
  failedRecords: number;
  status: "COMPLETED" | "FAILED" | "CONFLICT";
  duration: number;
}

interface AuditLog {
  id: string;
  user: string;
  action: string;
  timestamp: string;
}

interface Conflict {
  testCaseId: string;
  rowNumber: number;
  sheetValues: Omit<TestCase, "status">;
  portalValues: Omit<TestCase, "status">;
}

// Local File Mode Status Normalization
type LocalNormalisedStatus = "Pass" | "Fail" | "TBD" | "Pending" | "N/A";

const LOCAL_STATUS_MAP: Record<string, LocalNormalisedStatus> = {
  pass: "Pass", passed: "Pass", "✓": "Pass",
  fail: "Fail", failed: "Fail", "✗": "Fail",
  tbd: "TBD", "to be done": "TBD",
  pending: "Pending", "not started": "Pending", "": "Pending", null: "Pending", undefined: "Pending",
  "n/a": "N/A", na: "N/A", "not applicable": "N/A",
};

function normalizeLocalStatus(val: any): LocalNormalisedStatus {
  if (!val) return "Pending";
  const lower = String(val).trim().toLowerCase();
  return LOCAL_STATUS_MAP[lower] || "Pending";
}

const LOCAL_STATUS_BGS: Record<LocalNormalisedStatus, string> = {
  Pass: "bg-green-50 text-green-700 border-green-200",
  Fail: "bg-red-50 text-red-700 border-red-200",
  TBD: "bg-blue-50 text-blue-700 border-blue-200",
  Pending: "bg-slate-50 text-slate-700 border-slate-200",
  "N/A": "bg-yellow-50 text-yellow-700 border-yellow-200",
};

const DEV_STATUS_BGS: Record<DevStatus, string> = {
  "Not Started": "bg-slate-100 text-slate-700 border-slate-200",
  Passed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Failed: "bg-rose-50 text-rose-700 border-rose-200",
  Blocked: "bg-amber-50 text-amber-700 border-amber-200",
};

const QA_STATUS_BGS: Record<QAStatus, string> = {
  "Not Run": "bg-slate-100 text-slate-700 border-slate-200",
  Passed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Failed: "bg-rose-50 text-rose-700 border-rose-200",
  Blocked: "bg-amber-50 text-amber-700 border-amber-200",
};

const CB_VERIFIED_BGS: Record<CrossBrowserVerified, string> = {
  Yes: "bg-indigo-50 text-indigo-700 border-indigo-200",
  No: "bg-rose-50 text-rose-700 border-rose-200",
  "N/A": "bg-slate-100 text-slate-600 border-slate-200",
};

const PRIORITY_BGS: Record<Priority, string> = {
  Low: "bg-blue-50 text-blue-700 border-blue-200",
  Medium: "bg-sky-50 text-sky-700 border-sky-200",
  High: "bg-orange-50 text-orange-700 border-orange-200",
  Critical: "bg-violet-50 text-violet-700 border-violet-200",
};

// Check if a column is completely empty across all rows (Local Mode)
function isColumnEmpty(testCases: any[], colName: string): boolean {
  return testCases.every(tc => {
    const val = tc[colName];
    return val === undefined || val === null || String(val).trim() === "" || String(val).trim() === "-";
  });
}

// Detect link column
function isLinkValue(colName: string): boolean {
  const lower = colName.toLowerCase();
  return lower.includes("jira") || lower.includes("ticket") || lower.includes("link") || lower.includes("url");
}

// Detect date column
function isDateColumn(colName: string): boolean {
  const lower = colName.toLowerCase();
  return lower.includes("date");
}

// Date formatter
function formatDateDisplay(val: string): string {
  if (!val || val === "-") return "";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toISOString().split("T")[0];
  } catch {
    return val;
  }
}

function formatDateInput(val: string): string {
  if (!val || val === "-") return "";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  } catch {
    return "";
  }
}

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(item => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const clearAll = () => onChange([]);
  const selectAll = () => onChange([...options]);
  const allSelected = options.length > 0 && selected.length === options.length;

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`inline-flex justify-between items-center w-full px-3 py-2 bg-white border text-slate-700 rounded-xl text-xs font-semibold outline-none shadow-sm hover:border-slate-300 focus:ring-4 focus:ring-[#ed5c37]/5 transition-all text-left gap-2 min-w-[140px] ${
            selected.length > 0 ? "border-[#ed5c37]/40 bg-orange-50/30" : "border-slate-200"
          }`}
        >
          <span className="truncate max-w-[120px]">
            {selected.length === 0
              ? `All ${label}s`
              : selected.length === options.length
              ? `All ${label}s ✓`
              : selected.length === 1
              ? selected[0]
              : `${label}s (${selected.length})`}
          </span>
          <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${isOpen ? "rotate-90" : ""}`} />
        </button>
      </div>

      {isOpen && (
        <div className="origin-top-right absolute left-0 mt-2 w-64 rounded-2xl shadow-xl bg-white border border-slate-100 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Filter {label}
            </span>
            <div className="flex items-center gap-2">
              {/* Select All / Deselect All toggle */}
              <button
                type="button"
                onClick={allSelected ? clearAll : selectAll}
                className={`text-[9px] font-black uppercase tracking-widest cursor-pointer transition-colors ${
                  allSelected
                    ? "text-[#ed5c37] hover:text-orange-700"
                    : "text-indigo-500 hover:text-indigo-700"
                }`}
              >
                {allSelected ? "Deselect All" : "Select All"}
              </button>
              {selected.length > 0 && !allSelected && (
                <>
                  <span className="text-slate-200 text-xs">|</span>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-[9px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-widest cursor-pointer"
                  >
                    Clear ({selected.length})
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="p-2 border-b border-slate-100">
            <input
              type="text"
              placeholder={`Search ${label}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium focus:bg-white focus:border-[#ed5c37] focus:ring-2 focus:ring-[#ed5c37]/20 outline-none transition-all"
            />
          </div>

          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
            {filteredOptions.map(option => {
              const isChecked = selected.includes(option);
              return (
                <button
                  type="button"
                  key={option}
                  onClick={() => toggleOption(option)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isChecked
                      ? "bg-orange-50/30 text-[#ed5c37] font-bold"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                    isChecked ? "border-[#ed5c37] bg-[#ed5c37] text-white" : "border-slate-300"
                  }`}>
                    {isChecked && <Check className="w-2.5 h-2.5 stroke-[4px]" />}
                  </div>
                  <span className="truncate">{option}</span>
                </button>
              );
            })}
            {filteredOptions.length === 0 && (
              <div className="text-center py-4 text-xs text-slate-400 font-medium">
                No options found
              </div>
            )}
          </div>

          {/* Bottom action bar */}
          {selected.length > 0 && (
            <div className="p-2 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex justify-between items-center">
              <span className="text-[10px] font-semibold text-slate-400">{selected.length} selected</span>
              <button
                type="button"
                onClick={() => { clearAll(); setIsOpen(false); }}
                className="text-[10px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-widest cursor-pointer px-2 py-1 rounded-lg hover:bg-rose-50 transition-all"
              >
                Clear Filter
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProjectTestCasesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { data: session } = useSession();

  // Authentication Details
  const userEmail = session?.user?.email || "Unknown";

  // Mode controller: 'google' (synced) or 'local' (offline import)
  const [mode, setMode] = useState<"google" | "local" | "uninitialized">("uninitialized");

  const [isSyncing, setIsSyncing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Navigation tabs for Google Mode
  const [activeTab, setActiveTab] = useState<"repository" | "history" | "audit">("repository");

  // State Management
  const [project, setProject] = useState<any>(null);
  const [sheetConnection, setSheetConnection] = useState<any>(null);
  const [syncHistory, setSyncHistory] = useState<SyncLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Local file states (Original functionality)
  const [localTestCases, setLocalTestCases] = useState<any[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Connection forms
  const [sheetUrl, setSheetUrl] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [validationPreview, setValidationPreview] = useState<any>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showDirectConnectModal, setShowDirectConnectModal] = useState(false);

  // Non-destructive sync/quota warning (shown as banner, never disconnects)
  const [syncWarning, setSyncWarning] = useState("");

  // Search, Filters & Pagination (Google Mode)
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [devStatusFilter, setDevStatusFilter] = useState<string[]>([]);
  const [qaStatusFilter, setQaStatusFilter] = useState<string[]>([]);
  const [cbVerifiedFilter, setCbVerifiedFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCases, setTotalCases] = useState(0);
  const [modules, setModules] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const limit = 25;

  // Search & Filters (Local Mode)
  const [localSearch, setLocalSearch] = useState("");
  const [localModuleFilter, setLocalModuleFilter] = useState<string>("all");
  const [localJiraFilter, setLocalJiraFilter] = useState<string>("all");

  // Selection & Bulk Updates
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [bulkField, setBulkField] = useState<"devStatus" | "qaStatus" | "priority" | "crossBrowserVerified">("qaStatus");
  const [bulkValue, setBulkValue] = useState<string>("Passed");
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // Add Case Modal States
  const [showAddCaseModal, setShowAddCaseModal] = useState(false);
  const [newCaseId, setNewCaseId] = useState("");
  const [newCaseTitle, setNewCaseTitle] = useState("");
  const [newCaseModule, setNewCaseModule] = useState("");
  const [newCasePriority, setNewCasePriority] = useState<Priority>("Medium");
  const [newCaseDevStatus, setNewCaseDevStatus] = useState<DevStatus>("Not Started");
  const [newCaseQaStatus, setNewCaseQaStatus] = useState<QAStatus>("Not Run");
  const [newCaseCbVerified, setNewCaseCbVerified] = useState<CrossBrowserVerified>("No");
  const [newCasePreConditions, setNewCasePreConditions] = useState("");
  const [newCaseTestSteps, setNewCaseTestSteps] = useState("");
  const [newCaseTestData, setNewCaseTestData] = useState("");
  const [newCaseExpectedResult, setNewCaseExpectedResult] = useState("");
  const [newCaseJiraTicket, setNewCaseJiraTicket] = useState("");
  const [addingCaseLoading, setAddingCaseLoading] = useState(false);

  // Cases loading state
  const [casesLoading, setCasesLoading] = useState(false);

  // Detail Modal State (Google Mode)
  const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);
  const [savingCase, setSavingCase] = useState(false);

  // Syncing states
  const [syncing, setSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);
  const [showSyncResultModal, setShowSyncResultModal] = useState(false);

  // Conflict state
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [conflictResolutions, setConflictResolutions] = useState<Record<string, "portal" | "sheet">>({});
  const [resolvingConflicts, setResolvingConflicts] = useState(false);

  // localStorage key for caching the connection config client-side
  const CONNECTION_CACHE_KEY = `cbqops_gsconnection_${projectId}`;

  // Fetch project connection details — NEVER auto-disconnects on quota/network errors
  const fetchConnection = async (silent = false) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/google-sheet`);
      const data = await res.json();

      // If the API itself returned an error (e.g. Firestore quota) — do NOT wipe connection
      if (data.error) {
        const isQuotaError = data.isQuotaError === true ||
          data.error.toLowerCase().includes("quota") ||
          data.error.toLowerCase().includes("resource_exhausted") ||
          data.error.toLowerCase().includes("exhausted");

        if (isQuotaError) {
          // Quota error — show friendly warning, NEVER expose raw error message
          setSyncWarning("Quota exceeded — please try again in about 1 minute. Your connection is preserved.");
          // Try to restore from localStorage cache so user is not disconnected
          const cached = localStorage.getItem(CONNECTION_CACHE_KEY);
          if (cached) {
            const cachedConfig = JSON.parse(cached);
            setSheetConnection((prev: any) => prev ?? cachedConfig);
            setSheetUrl(prev => prev || cachedConfig.url || "");
            setMode(prev => prev === "uninitialized" ? "google" : prev);
            return cachedConfig;
          }
          // No cache — return null but still show warning (not raw error)
          return null;
        }

        if (!silent) {
          setError(data.error);
        }
        // Return cached config without wiping existing state
        const cached = localStorage.getItem(CONNECTION_CACHE_KEY);
        return cached ? JSON.parse(cached) : null;
      }

      // Success — update state and refresh cache
      const config = data.config || null;
      setSheetConnection(config);
      setSyncHistory(data.syncHistory || []);
      setAuditLogs(data.auditLogs || []);
      setSyncWarning("");

      if (config) {
        setSheetUrl(config.url || "");
        setMode("google");
        // Cache the config in localStorage as a fallback
        localStorage.setItem(CONNECTION_CACHE_KEY, JSON.stringify(config));
      } else {
        // Only clear cache if server explicitly says no connection
        localStorage.removeItem(CONNECTION_CACHE_KEY);
      }
      return config;
    } catch (err: any) {
      // Network / parse error — never wipe existing connection state
      console.error("fetchConnection error:", err);
      if (!silent) {
        setSyncWarning("Could not reach server. Showing last known connection.");
      }
      // Return from localStorage cache
      const cached = localStorage.getItem(CONNECTION_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    }
  };

  // Fetch test cases from Firestore (Google Mode)
  const fetchTestCases = async () => {
    try {
      setCasesLoading(true);
      const queryParams = new URLSearchParams({
        search,
        module: moduleFilter.join(","),
        priority: priorityFilter.join(","),
        devStatus: devStatusFilter.join(","),
        qaStatus: qaStatusFilter.join(","),
        crossBrowserVerified: cbVerifiedFilter.join(","),
        page: String(page),
        limit: String(limit),
      });

      const res = await fetch(`/api/projects/${projectId}/test-cases?${queryParams}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setTestCases(data.testCases || []);
      setTotalCases(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setModules(data.uniqueModules || []);
      setPriorities(data.uniquePriorities || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to fetch test cases.");
    } finally {
      setCasesLoading(false);
    }
  };

  // Load local test cases on start
  useEffect(() => {
    const cached = localStorage.getItem(`cbqops_testcases_${projectId}`);
    if (cached) {
      try {
        setLocalTestCases(JSON.parse(cached));
      } catch (e) {
        console.error("Local storage parse failed", e);
      }
    }
    setLocalLoading(false);
  }, [projectId]);

  // Save local test cases to localStorage
  useEffect(() => {
    if (!localLoading && mode === "local") {
      localStorage.setItem(`cbqops_testcases_${projectId}`, JSON.stringify(localTestCases));
    }
  }, [localTestCases, projectId, localLoading, mode]);

  // Initial Fetch Setup
  useEffect(() => {
    const fetchProject = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setProject(data);
      } catch (err: any) {
        setError(err.message || "Project not found.");
      }
    };

    setLoading(true);
    Promise.all([fetchProject(), fetchConnection()]).then(([_, config]) => {
      // Check localStorage-cached connection as fallback if fetchConnection returned null
      const cachedConnection = localStorage.getItem(`cbqops_gsconnection_${projectId}`);
      const cachedLocal = localStorage.getItem(`cbqops_testcases_${projectId}`);

      if (config) {
        setMode("google");
      } else if (cachedConnection) {
        // Firestore may be temporarily unavailable — use localStorage cache to stay in google mode
        try {
          const parsedConn = JSON.parse(cachedConnection);
          setSheetConnection(parsedConn);
          setSheetUrl(parsedConn.url || "");
          setMode("google");
          setSyncWarning("Quota exceeded — please try again in about 1 minute. Your connection and data are preserved.");
        } catch {
          // Cache corrupted — fall through
          localStorage.removeItem(`cbqops_gsconnection_${projectId}`);
          if (cachedLocal && JSON.parse(cachedLocal).length > 0) {
            setMode("local");
          } else {
            setMode("uninitialized");
          }
        }
      } else if (cachedLocal && JSON.parse(cachedLocal).length > 0) {
        setMode("local");
      } else {
        setMode("uninitialized");
      }
      setLoading(false);
    });
  }, [projectId]);

  // Fetch paginated cases (Google mode)
  useEffect(() => {
    if (mode === "google" && sheetConnection) {
      fetchTestCases();
    }
  }, [mode, sheetConnection, search, moduleFilter, priorityFilter, devStatusFilter, qaStatusFilter, cbVerifiedFilter, page]);

  // Background Auto-Sync — polls every 60s, backs off on failures, never disconnects
  useEffect(() => {
    if (mode !== "google" || !sheetConnection) return;

    let consecutiveFailures = 0;
    let currentInterval = 60000; // Start at 60 seconds
    let timerId: ReturnType<typeof setTimeout>;

    const runBackgroundSync = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/sync`, {
          method: "POST",
        });
        const data = await res.json();

        if (data.error) {
          const isQuota = (data.error as string).toLowerCase().includes("quota") ||
            (data.error as string).toLowerCase().includes("exhausted");
          if (isQuota) {
            consecutiveFailures++;
            const retryMins = Math.round(Math.min(60000 * Math.pow(2, consecutiveFailures), 480000) / 60000);
            setSyncWarning(`Quota exceeded — please try again in ${retryMins} minute${retryMins > 1 ? "s" : ""}. Auto-sync will resume automatically.`);
            currentInterval = Math.min(60000 * Math.pow(2, consecutiveFailures), 480000);
            timerId = setTimeout(runBackgroundSync, currentInterval);
            return;
          }
          // Non-quota sync error — show friendly warning, strip raw technical details
          const friendlyErr = data.error.replace(/\d+\s*RESOURCE_EXHAUSTED[^.]*\./gi, "").replace(/\d+\s*[A-Z_]+:/g, "").trim();
          setSyncWarning(`Sync error — ${friendlyErr || "please try again shortly"}.`);
          consecutiveFailures++;
          currentInterval = Math.min(60000 * Math.pow(2, consecutiveFailures), 480000);
          timerId = setTimeout(runBackgroundSync, currentInterval);
          return;
        }

        // Success — reset backoff
        consecutiveFailures = 0;
        currentInterval = 60000;
        setSyncWarning("");

        if (data.success && data.status !== "CONFLICT") {
          // Silently refresh test cases
          fetchTestCases();
          // Refresh sync history/audit without wiping connection
          try {
            const connRes = await fetch(`/api/projects/${projectId}/google-sheet`);
            const connData = await connRes.json();
            if (connData.config) {
              setSheetConnection(connData.config);
              setSyncHistory(connData.syncHistory || []);
              setAuditLogs(connData.auditLogs || []);
              localStorage.setItem(`cbqops_gsconnection_${projectId}`, JSON.stringify(connData.config));
            }
          } catch {
            // Ignore secondary fetch failures
          }
        }
      } catch (err) {
        console.error("Background sync network error:", err);
        consecutiveFailures++;
        currentInterval = Math.min(60000 * Math.pow(2, consecutiveFailures), 480000);
        setSyncWarning("Network error during background sync. Will retry automatically.");
      }

      timerId = setTimeout(runBackgroundSync, currentInterval);
    };

    // Start first poll after 60 seconds
    timerId = setTimeout(runBackgroundSync, currentInterval);
    return () => clearTimeout(timerId);
  }, [mode, sheetConnection?.url]);

  // --- LOCAL IMPORT FILE HANDLERS (Original logical flow) ---
  const processLocalData = (data: any[]) => {
    if (data.length === 0) {
      setError("The file is empty.");
      return;
    }

    const cleanRows = data.map(row => {
      const newRow: any = {};
      Object.keys(row).forEach(key => {
        newRow[key.trim()] = row[key];
      });
      return newRow;
    });

    const headers = Object.keys(cleanRows[0]);
    const findStatusCol = (target: string) =>
      headers.find(h => h.trim().toLowerCase() === target.toLowerCase());

    const devStatusCol = findStatusCol("Dev Status");
    const qaStatusCol = findStatusCol("QA Status");

    if (!devStatusCol || !qaStatusCol) {
      setError("File must contain 'Dev Status' and 'QA Status' columns.");
      return;
    }

    const parsedCases: any[] = cleanRows.map(row => {
      const newRow: any = { ...row, _internalId: crypto.randomUUID() };
      newRow["Dev Status"] = normalizeLocalStatus(row[devStatusCol]);
      newRow["QA Status"] = normalizeLocalStatus(row[qaStatusCol]);

      if (devStatusCol !== "Dev Status") delete newRow[devStatusCol];
      if (qaStatusCol !== "QA Status") delete newRow[qaStatusCol];

      return newRow;
    });

    setLocalTestCases(parsedCases);
    setMode("local");
    setLocalModuleFilter("all");
    setLocalJiraFilter("all");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleLocalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    const fileExt = file.name.split(".").pop()?.toLowerCase();

    if (fileExt === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: results => {
          processLocalData(results.data as any[]);
        },
        error: err => {
          setError(`Failed to parse CSV: ${err.message}`);
        },
      });
    } else if (fileExt === "xlsx" || fileExt === "xls") {
      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        processLocalData(data);
      } catch (err: any) {
        setError(`Failed to parse Excel file: ${err.message}`);
      }
    } else {
      setError("Unsupported file format. Please upload a .csv, .xlsx, or .xls file.");
    }
  };

  const handleLocalCellChange = (id: string, field: string, value: any) => {
    setLocalTestCases(prev =>
      prev.map(tc => (tc._internalId === id ? { ...tc, [field]: value } : tc))
    );
  };

  const handleLocalExport = () => {
    const exportData = localTestCases.map(tc => {
      const { _internalId, ...rest } = tc;
      return rest;
    });

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `test_cases_${project?.name || projectId}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleLocalClear = () => {
    if (
      confirm(
        "Are you sure you want to clear all test cases? This will delete the data from your local storage for this project."
      )
    ) {
      setLocalTestCases([]);
      localStorage.removeItem(`cbqops_testcases_${projectId}`);
      setMode("uninitialized");
      setLocalModuleFilter("all");
      setLocalJiraFilter("all");
      setToast({ message: "Local cache cleared successfully!", type: "success" });
    }
  };

  // Local summaries
  const localDevSum = useMemo(() => {
    const counts = { Pass: 0, Fail: 0, TBD: 0, Pending: 0, "N/A": 0 };
    localTestCases.forEach(tc => {
      const status = normalizeLocalStatus(tc["Dev Status"]);
      counts[status]++;
    });
    const total = localTestCases.length;
    const completed = total - counts.Pending - counts.TBD;
    const passRate = total > 0 ? Math.round((counts.Pass / total) * 100) : 0;
    return { total, completed, passRate, ...counts };
  }, [localTestCases]);

  const localQaSum = useMemo(() => {
    const counts = { Pass: 0, Fail: 0, TBD: 0, Pending: 0, "N/A": 0 };
    localTestCases.forEach(tc => {
      const status = normalizeLocalStatus(tc["QA Status"]);
      counts[status]++;
    });
    const total = localTestCases.length;
    const completed = total - counts.Pending - counts.TBD;
    const passRate = total > 0 ? Math.round((counts.Pass / total) * 100) : 0;
    return { total, completed, passRate, ...counts };
  }, [localTestCases]);

  const localColumns = useMemo(() => {
    if (localTestCases.length === 0) return [];
    const rawCols = Object.keys(localTestCases[0]).filter(k => k !== "_internalId");
    return rawCols.filter(col => !isColumnEmpty(localTestCases, col));
  }, [localTestCases]);

  const uniqueLocalModules = useMemo(() => {
    const moduleCol = localColumns.find(c => c.toLowerCase() === "module");
    if (!moduleCol) return [];
    const vals = new Set<string>();
    localTestCases.forEach(tc => {
      const v = String(tc[moduleCol] || "").trim();
      if (v && v !== "-") vals.add(v);
    });
    return Array.from(vals).sort();
  }, [localTestCases, localColumns]);

  const uniqueLocalJiraTickets = useMemo(() => {
    const jiraCol = localColumns.find(c => isLinkValue(c));
    if (!jiraCol) return [];
    const vals = new Set<string>();
    localTestCases.forEach(tc => {
      const v = String(tc[jiraCol] || "").trim();
      if (v && v !== "-") vals.add(v);
    });
    return Array.from(vals).sort();
  }, [localTestCases, localColumns]);

  const localModuleColName = localColumns.find(c => c.toLowerCase() === "module") || "";
  const localJiraColName = localColumns.find(c => isLinkValue(c)) || "";

  const filteredLocalCases = useMemo(() => {
    return localTestCases.filter(tc => {
      if (localSearch) {
        const lowerSearch = localSearch.toLowerCase();
        const matchesSearch = localColumns.some(col =>
          String(tc[col] || "").toLowerCase().includes(lowerSearch)
        );
        if (!matchesSearch) return false;
      }
      if (localModuleFilter !== "all" && localModuleColName) {
        if (String(tc[localModuleColName] || "").trim() !== localModuleFilter) return false;
      }
      if (localJiraFilter !== "all" && localJiraColName) {
        if (String(tc[localJiraColName] || "").trim() !== localJiraFilter) return false;
      }
      return true;
    });
  }, [localTestCases, localSearch, localModuleFilter, localJiraFilter, localColumns, localModuleColName, localJiraColName]);

  // --- GOOGLE SYNC LINK ACTION HANDLERS ---
  const handleConnectSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetUrl.trim()) return;

    setError("");
    setSuccessMessage("");
    setConnecting(true);
    setIsSyncing(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/google-sheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sheetUrl, action: "import" }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to import Google Sheet.");
      }

      if (data.success) {
        setSuccessMessage(`Google Sheet connected and imported successfully! Imported ${data.importedCount} test cases.`);
        setToast({ message: `Google Sheet connected and imported successfully!`, type: "success" });
        setTimeout(() => setSuccessMessage(""), 10000);

        setSheetConnection({
          url: sheetUrl,
          importedCount: data.importedCount,
          lastSyncAt: new Date().toISOString(),
          connectedBy: userEmail,
          connectedAt: new Date().toISOString(),
        });
        setMode("google");
        setPage(1);
        setShowDirectConnectModal(false);
        await Promise.all([fetchConnection(true), fetchTestCases()]);
      }
    } catch (err: any) {
      setError(err.message || "Unable to connect Google Sheet.");
      setToast({ message: err.message || "Unable to connect Google Sheet.", type: "error" });
    } finally {
      setConnecting(false);
      setIsSyncing(false);
    }
  };

  const handleDisconnectSheet = async () => {
    if (
      !confirm(
        "Are you sure you want to disconnect this Google Sheet? Portal test cases will remain, but synchronization will stop."
      )
    ) {
      return;
    }

    setLoading(true);
    setIsSyncing(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/google-sheet`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to disconnect.");
      }

      setToast({ message: "Google Sheet disconnected successfully!", type: "success" });
      setSheetConnection(null);
      setTestCases([]);
      setTotalCases(0);
      setMode("uninitialized");
    } catch (err: any) {
      setError(err.message || "Disconnect request failed.");
      setToast({ message: err.message || "Disconnect request failed.", type: "error" });
    } finally {
      setLoading(false);
      setIsSyncing(false);
      fetchConnection(true);
    }
  };

  const handleSyncNow = async () => {
    if (syncing) return;

    setError("");
    setSyncing(true);
    setIsSyncing(true);
    setSyncSummary(null);
    setConflicts([]);

    try {
      const res = await fetch(`/api/projects/${projectId}/sync`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Sync engine failed.");
      }

      if (data.success) {
        if (data.status === "CONFLICT") {
          setConflicts(data.conflicts || []);
          const initialResolutions: Record<string, "portal" | "sheet"> = {};
          data.conflicts.forEach((c: Conflict) => {
            initialResolutions[c.testCaseId] = "portal";
          });
          setConflictResolutions(initialResolutions);
          setToast({ message: "Sync conflict detected!", type: "error" });
        } else {
          setSyncSummary(data.summary);
          setShowSyncResultModal(true);
          setToast({ message: "Sync completed successfully!", type: "success" });
        }

        await Promise.all([fetchConnection(true), fetchTestCases()]);
      }
    } catch (err: any) {
      setError(err.message || "Sync encountered a network issue.");
      setToast({ message: err.message || "Sync encountered an issue.", type: "error" });
    } finally {
      setSyncing(false);
      setIsSyncing(false);
    }
  };

  const handleResolveConflicts = async () => {
    if (resolvingConflicts) return;

    setResolvingConflicts(true);
    setIsSyncing(true);
    setError("");

    try {
      const payload = Object.entries(conflictResolutions).map(([id, choice]) => ({
        testCaseId: id,
        choice,
      }));

      const res = await fetch(`/api/projects/${projectId}/conflict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutions: payload }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to resolve conflicts.");
      }

      if (data.success) {
        setConflicts([]);
        setConflictResolutions({});
        setToast({ message: "Conflicts resolved! Initiating sync...", type: "success" });
        handleSyncNow();
      }
    } catch (err: any) {
      setError(err.message || "Failed to resolve conflicts.");
      setToast({ message: err.message || "Failed to resolve conflicts.", type: "error" });
    } finally {
      setResolvingConflicts(false);
      setIsSyncing(false);
    }
  };

  const handleSaveTestCase = async (updatedFields: Partial<TestCase>) => {
    if (!selectedCase) return;

    setSavingCase(true);
    setIsSyncing(true);
    setError("");

    try {
      const res = await fetch(`/api/projects/${projectId}/test-cases`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testCaseId: selectedCase.testCaseId,
          ...updatedFields,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to update test case.");
      }

      if (data.success) {
        setTestCases(prev =>
          prev.map(tc => (tc.testCaseId === selectedCase.testCaseId ? { ...tc, ...updatedFields } : tc))
        );
        setSelectedCase(prev => (prev ? { ...prev, ...updatedFields } : null));
        setToast({ message: "Test case updated successfully!", type: "success" });

        if (data.synced) {
          await fetchConnection(true);
        } else if (data.syncError) {
          setToast({ message: `Updated in portal, sheet sync failed: ${data.syncError}`, type: "error" });
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to save test case.");
      setToast({ message: err.message || "Failed to save test case.", type: "error" });
    } finally {
      setSavingCase(false);
      setIsSyncing(false);
    }
  };

  const DEFAULT_COLUMNS = [
    "Test Case ID",
    "Module",
    "Test Case Title",
    "Pre-Conditions",
    "Test Steps",
    "Test Data",
    "Expected Result",
    "Dev Status",
    "Dev Date Executed",
    "Dev Notes",
    "QA Status",
    "cross browser Verfied ?",
    "Priority",
    "JIRA Ticket",
  ];

  const googleColumns = useMemo(() => {
    if (sheetConnection?.headers && sheetConnection.headers.length > 0) {
      return sheetConnection.headers;
    }
    if (testCases.length > 0) {
      const exclude = ["_ref", "status", "lastSyncedAt", "lastSyncedValues", "createdAt", "updatedAt", "id"];
      return Object.keys(testCases[0]).filter(k => !exclude.includes(k));
    }
    return DEFAULT_COLUMNS;
  }, [sheetConnection, testCases]);

  const handleGoogleCellChangeState = (testCaseId: string, columnName: string, value: any) => {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/gi, "").trim();
    const normName = normalize(columnName);

    setTestCases(prev =>
      prev.map(tc => {
        if (tc.testCaseId === testCaseId) {
          const updated = { ...tc, [columnName]: value };
          if (normName === "devstatus") updated.devStatus = value;
          else if (normName === "qastatus") updated.qaStatus = value;
          else if (normName === "devdateexecuted") updated.devDateExecuted = value;
          else if (normName === "devnotes") updated.devNotes = value;
          else if (normName === "crossbrowserverfied" || normName === "crossbrowserverified") updated.crossBrowserVerified = value;
          else if (normName === "priority") updated.priority = value;
          else if (normName === "jiraticket") updated.jiraTicket = value;
          else if (normName === "module") updated.module = value;
          else if (normName === "testcasetitle") updated.title = value;
          return updated;
        }
        return tc;
      })
    );
  };

  const handleGoogleCellSync = async (testCaseId: string, columnName: string, value: any) => {
    let oldValue: any = "";
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/gi, "").trim();
    const normName = normalize(columnName);

    const tc = testCases.find(t => t.testCaseId === testCaseId);
    if (tc) {
      oldValue = tc.lastSyncedValues?.[columnName] !== undefined ? tc.lastSyncedValues[columnName] : tc[columnName];
    }

    if (normName === "qastatus") {
      setOverallMetrics((prev: any) => {
        if (!prev) return prev;
        const newMetrics = { ...prev };
        const oldVal = (oldValue || "Not Run") as QAStatus;
        const newVal = (value || "Not Run") as QAStatus;

        const decKey = oldVal === "Not Run" ? "notRun" : oldVal === "Passed" ? "passed" : oldVal === "Failed" ? "failed" : oldVal === "Blocked" ? "blocked" : null;
        const incKey = newVal === "Not Run" ? "notRun" : newVal === "Passed" ? "passed" : newVal === "Failed" ? "failed" : newVal === "Blocked" ? "blocked" : null;

        if (decKey && newMetrics[decKey] > 0) newMetrics[decKey]--;
        if (incKey) newMetrics[incKey]++;

        newMetrics.execPercent = newMetrics.total > 0 ? Math.round(((newMetrics.total - newMetrics.notRun) / newMetrics.total) * 100) : 0;
        return newMetrics;
      });
    }

    try {
      setIsSyncing(true);
      const res = await fetch(`/api/projects/${projectId}/test-cases`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testCaseId,
          columnName,
          value,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to update cell.");
      }

      setToast({ message: "Cell updated successfully!", type: "success" });
      setTestCases(prev =>
        prev.map(t => {
          if (t.testCaseId === testCaseId) {
            const updated = { ...t };
            if (!updated.lastSyncedValues) updated.lastSyncedValues = {};
            updated.lastSyncedValues[columnName] = value;
            return updated;
          }
          return t;
        })
      );
    } catch (err: any) {
      console.error("Failed to sync cell change:", err);
      setError(err.message || "Failed to sync cell change.");
      setToast({ message: err.message || "Failed to sync cell change.", type: "error" });
      
      // Revert overallMetrics too
      if (normName === "qastatus") {
        setOverallMetrics((prev: any) => {
          if (!prev) return prev;
          const newMetrics = { ...prev };
          const oldVal = (value || "Not Run") as QAStatus;
          const newVal = (oldValue || "Not Run") as QAStatus;

          const decKey = oldVal === "Not Run" ? "notRun" : oldVal === "Passed" ? "passed" : oldVal === "Failed" ? "failed" : oldVal === "Blocked" ? "blocked" : null;
          const incKey = newVal === "Not Run" ? "notRun" : newVal === "Passed" ? "passed" : newVal === "Failed" ? "failed" : newVal === "Blocked" ? "blocked" : null;

          if (decKey && newMetrics[decKey] > 0) newMetrics[decKey]--;
          if (incKey) newMetrics[incKey]++;

          newMetrics.execPercent = newMetrics.total > 0 ? Math.round(((newMetrics.total - newMetrics.notRun) / newMetrics.total) * 100) : 0;
          return newMetrics;
        });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      "Test Case ID",
      "Module",
      "Test Case Title",
      "Pre-Conditions",
      "Test Steps",
      "Test Data",
      "Expected Result",
      "Dev Status",
      "Dev Date Executed",
      "Dev Notes",
      "QA Status",
      "cross browser Verfied ?",
      "Priority",
      "JIRA Ticket",
    ];

    const exampleRows = [
      [
        "TC-001",
        "Authentication",
        "Verify login works with correct credentials",
        "User is on the login screen",
        "1. Input test@test.com into email\n2. Input Password123 into password\n3. Click Login Button",
        "email: test@test.com, pass: Password123",
        "Redirects successfully to project dashboard",
        "Passed",
        "2026-06-06",
        "Build 1.0.4 verified",
        "Passed",
        "Yes",
        "High",
        "QAOPS-101",
      ],
    ];

    const csvContent = [
      headers.join(","),
      ...exampleRows.map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `CB_QOps_Test_Case_Template_${projectId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [overallMetrics, setOverallMetrics] = useState<any>(null);
  useEffect(() => {
    if (mode === "google" && sheetConnection) {
      fetch(`/api/projects/${projectId}/test-cases?limit=10000`)
        .then(res => res.json())
        .then(data => {
          if (data.testCases) {
            const all = data.testCases as TestCase[];
            const total = all.length;
            const passed = all.filter(t => t.qaStatus === "Passed").length;
            const failed = all.filter(t => t.qaStatus === "Failed").length;
            const blocked = all.filter(t => t.qaStatus === "Blocked").length;
            const notRun = all.filter(t => t.qaStatus === "Not Run" || !t.qaStatus).length;
            const execPercent = total > 0 ? Math.round(((total - notRun) / total) * 100) : 0;

            const prioritiesCount = { Low: 0, Medium: 0, High: 0, Critical: 0 };
            all.forEach(t => {
              if (t.priority in prioritiesCount) prioritiesCount[t.priority]++;
            });

            setOverallMetrics({
              total,
              passed,
              failed,
              blocked,
              notRun,
              execPercent,
              prioritiesCount,
            });
          }
        })
        .catch(err => console.error("Metrics accumulation error:", err));
    } else {
      setOverallMetrics(null);
    }
  }, [testCases, sheetConnection, mode]);

  if (loading) {
    return (
      <div className="space-y-6 pb-12 animate-pulse relative">
        {/* Top Header Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-200" />
            <div className="space-y-2">
              <div className="h-6 w-48 bg-slate-200 rounded-md" />
              <div className="h-4 w-72 bg-slate-100 rounded-md" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-28 h-10 rounded-xl bg-slate-200" />
            <div className="w-10 h-10 rounded-xl bg-slate-100" />
          </div>
        </div>

        {/* Dashboard Metrics Panel Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="premium-card !p-4 flex flex-col justify-between h-28 bg-white border border-slate-200 rounded-2xl">
              <div className="h-3 w-16 bg-slate-200 rounded" />
              <div className="h-8 w-12 bg-slate-300 rounded" />
              <div className="h-2 w-8 bg-slate-100 rounded" />
            </div>
          ))}
        </div>

        {/* Table Skeleton */}
        <div className="premium-card !p-0 overflow-hidden border border-slate-200 rounded-3xl bg-white">
          <div className="bg-slate-50 border-b border-slate-100 h-12 w-full flex items-center px-6 gap-4">
            {[...Array(6)].map((_, idx) => (
              <div key={idx} className="h-4 w-24 bg-slate-200 rounded" />
            ))}
          </div>
          <div className="divide-y divide-slate-100 px-6 py-4 space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-2">
                {[...Array(6)].map((_, idx) => (
                  <div key={idx} className="h-4 bg-slate-100 rounded flex-1" style={{ width: idx === 2 ? '40%' : '15%' }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500 relative">
      {isSyncing && (
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#ed5c37] animate-pulse z-50 rounded-t-2xl" />
      )}
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/test-cases"
            className="p-2.5 hover:bg-slate-200 rounded-xl transition-all bg-slate-100 text-slate-500 border border-slate-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="page-header !mb-0">
            <h1 className="page-title text-2xl font-bold flex items-center gap-2">
              {project?.name || "Test Case Hub"}
              {mode === "google" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm animate-pulse">
                  <Database className="w-3.5 h-3.5" />
                  Google Sheet Mode
                </span>
              )}
              {mode === "local" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-sm">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Local File Mode
                </span>
              )}
            </h1>
            <p className="page-desc">
              {mode === "google"
                ? "Google Sheet Two-Way Synchronization & Execution Tracking"
                : "Test Cases & Status Tracking"}
            </p>
          </div>
        </div>

        {/* Global Toolbar buttons */}
        {mode === "google" && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className="btn-primary shadow-sm !py-2.5 !px-4 hover:shadow-[#ed5c37]/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
            <button
              onClick={handleDisconnectSheet}
              className="p-2.5 text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
              title="Disconnect Google Sheet"
            >
              <Link2Off className="w-5 h-5" />
            </button>
          </div>
        )}

        {mode === "local" && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleLocalExport}
              className="btn-primary !bg-slate-800 hover:!bg-slate-900 border border-slate-700 shadow-none !py-2.5 !px-4"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button
              onClick={handleLocalClear}
              className="p-2.5 text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
              title="Clear Local Cache"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-sm font-bold flex items-start gap-2.5 shadow-sm whitespace-pre-line">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError("")}
            className="text-rose-400 hover:text-rose-700 font-bold ml-2 cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Non-destructive quota/network warning — never causes a disconnect */}
      {syncWarning && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-sm font-semibold flex items-start gap-2.5 shadow-sm whitespace-pre-line animate-in slide-in-from-top duration-300">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
          <span className="flex-1">{syncWarning}</span>
          <button
            onClick={() => setSyncWarning("")}
            className="text-amber-500 hover:text-amber-700 font-bold ml-2 cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-sm font-bold flex items-start gap-2.5 shadow-sm whitespace-pre-line animate-in slide-in-from-top duration-300">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
          <span className="flex-1">{successMessage}</span>
          <button 
            onClick={() => setSuccessMessage("")}
            className="text-emerald-500 hover:text-emerald-700 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* --- INITIALIZATION SCREEN (WHEN NEITHER MODE IS ACTIVE) --- */}
      {mode === "uninitialized" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
          {/* OPTION 1: Google Sheet Synced Option */}
          <div className="premium-card p-8 flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-white to-slate-50/50">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm">
                <Link2 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Google Sheet Two-Way Synced Mode</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                Directly connect a Google Sheet URL. Imports test cases to our secure server databases, enabling
                centralized sharing and active two-way sync back to your Google Sheet rows on portal updates.
              </p>

              <form onSubmit={handleConnectSheet} className="space-y-4 pt-4">
                <div className="relative group">
                  <input
                    type="url"
                    value={sheetUrl}
                    onChange={e => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full pl-4 pr-32 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-[#ed5c37]/5 focus:border-[#ed5c37]/20 outline-none transition-all shadow-sm"
                    required
                  />
                  <button
                    type="submit"
                    disabled={connecting}
                    className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary !py-1.5 !px-4 text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {connecting ? "Validating..." : "Connect"}
                  </button>
                </div>
              </form>

              <div className="pt-2 text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                <Info className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  Share sheet with <strong>firebase-adminsdk-fbsvc@cbqaops.iam.gserviceaccount.com</strong> as Editor.
                </span>
              </div>
            </div>

            <button
              onClick={downloadTemplate}
              className="mt-8 w-full py-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-600 hover:bg-slate-50 transition-colors flex justify-center items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Download Schema Template
            </button>
          </div>

          {/* OPTION 2: Local Import Option */}
          <div className="premium-card p-8 flex flex-col justify-between bg-gradient-to-br from-white to-slate-50/50">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#ed5c37]/5 border border-[#ed5c37]/10 text-[#ed5c37] flex items-center justify-center shadow-sm">
                <UploadCloud className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Local CSV / Excel Offline Mode</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                Upload a test cases file exported from your test management tools (CSV, XLSX, XLS). Data is cached in your browser&apos;s local storage, allowing offline interactive inline editing.
              </p>

              <div className="pt-6">
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleLocalFileUpload}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full btn-primary justify-center py-3.5 cursor-pointer"
                >
                  <UploadCloud className="w-5 h-5" /> Browse CSV or Excel File
                </button>
              </div>
            </div>

            <div className="mt-8 text-xs text-slate-400 font-semibold text-center">
              Requires files to contain at least <strong>Dev Status</strong> and <strong>QA Status</strong> column headers.
            </div>
          </div>
        </div>
      )}

      {/* --- LOCAL FILE OFFLINE MODE INTERFACE --- */}
      {mode === "local" && (
        <div className="space-y-6">
          {/* Offline Local Dashboards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Dev Status */}
            <div className="premium-card p-6 flex flex-col gap-6 relative overflow-hidden bg-white">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Dev Status Summary</h3>
                  <p className="text-sm font-medium text-slate-500">
                    {localDevSum.completed} of {localDevSum.total} Completed
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-black text-blue-500">{localDevSum.passRate}%</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pass Rate</div>
                </div>
              </div>

              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                {localDevSum.Pass > 0 && (
                  <div
                    className="bg-green-500 h-full transition-all duration-300"
                    style={{ width: `${(localDevSum.Pass / localDevSum.total) * 100}%` }}
                  />
                )}
                {localDevSum.Fail > 0 && (
                  <div
                    className="bg-red-500 h-full transition-all duration-300"
                    style={{ width: `${(localDevSum.Fail / localDevSum.total) * 100}%` }}
                  />
                )}
                {localDevSum.TBD > 0 && (
                  <div
                    className="bg-blue-400 h-full transition-all duration-300"
                    style={{ width: `${(localDevSum.TBD / localDevSum.total) * 100}%` }}
                  />
                )}
                {localDevSum.Pending > 0 && (
                  <div
                    className="bg-slate-300 h-full transition-all duration-300"
                    style={{ width: `${(localDevSum.Pending / localDevSum.total) * 100}%` }}
                  />
                )}
                {localDevSum["N/A"] > 0 && (
                  <div
                    className="bg-yellow-400 h-full transition-all duration-300"
                    style={{ width: `${(localDevSum["N/A"] / localDevSum.total) * 100}%` }}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 pt-4 border-t border-slate-100">
                <div className="p-2.5 rounded-xl flex flex-col items-center justify-center bg-green-50">
                  <span className="text-xl font-black text-green-700">{localDevSum.Pass}</span>
                  <span className="text-[9px] font-black uppercase text-green-600">Pass</span>
                </div>
                <div className="p-2.5 rounded-xl flex flex-col items-center justify-center bg-red-50">
                  <span className="text-xl font-black text-red-700">{localDevSum.Fail}</span>
                  <span className="text-[9px] font-black uppercase text-red-600">Fail</span>
                </div>
                <div className="p-2.5 rounded-xl flex flex-col items-center justify-center bg-blue-50">
                  <span className="text-xl font-black text-blue-700">{localDevSum.TBD}</span>
                  <span className="text-[9px] font-black uppercase text-blue-600">TBD</span>
                </div>
                <div className="p-2.5 rounded-xl flex flex-col items-center justify-center bg-slate-50">
                  <span className="text-xl font-black text-slate-700">{localDevSum.Pending}</span>
                  <span className="text-[9px] font-black uppercase text-slate-600">Pending</span>
                </div>
                <div className="p-2.5 rounded-xl flex flex-col items-center justify-center bg-yellow-50">
                  <span className="text-xl font-black text-yellow-700">{localDevSum["N/A"]}</span>
                  <span className="text-[9px] font-black uppercase text-yellow-600">N/A</span>
                </div>
              </div>
            </div>

            {/* QA Status */}
            <div className="premium-card p-6 flex flex-col gap-6 relative overflow-hidden bg-white">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-[#ed5c37]" />
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">QA Status Summary</h3>
                  <p className="text-sm font-medium text-slate-500">
                    {localQaSum.completed} of {localQaSum.total} Completed
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-black text-[#ed5c37]">{localQaSum.passRate}%</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pass Rate</div>
                </div>
              </div>

              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                {localQaSum.Pass > 0 && (
                  <div
                    className="bg-green-500 h-full transition-all duration-300"
                    style={{ width: `${(localQaSum.Pass / localQaSum.total) * 100}%` }}
                  />
                )}
                {localQaSum.Fail > 0 && (
                  <div
                    className="bg-red-500 h-full transition-all duration-300"
                    style={{ width: `${(localQaSum.Fail / localQaSum.total) * 100}%` }}
                  />
                )}
                {localQaSum.TBD > 0 && (
                  <div
                    className="bg-blue-400 h-full transition-all duration-300"
                    style={{ width: `${(localQaSum.TBD / localQaSum.total) * 100}%` }}
                  />
                )}
                {localQaSum.Pending > 0 && (
                  <div
                    className="bg-slate-300 h-full transition-all duration-300"
                    style={{ width: `${(localQaSum.Pending / localQaSum.total) * 100}%` }}
                  />
                )}
                {localQaSum["N/A"] > 0 && (
                  <div
                    className="bg-yellow-400 h-full transition-all duration-300"
                    style={{ width: `${(localQaSum["N/A"] / localQaSum.total) * 100}%` }}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 pt-4 border-t border-slate-100">
                <div className="p-2.5 rounded-xl flex flex-col items-center justify-center bg-green-50">
                  <span className="text-xl font-black text-green-700">{localQaSum.Pass}</span>
                  <span className="text-[9px] font-black uppercase text-green-600">Pass</span>
                </div>
                <div className="p-2.5 rounded-xl flex flex-col items-center justify-center bg-red-50">
                  <span className="text-xl font-black text-red-700">{localQaSum.Fail}</span>
                  <span className="text-[9px] font-black uppercase text-red-600">Fail</span>
                </div>
                <div className="p-2.5 rounded-xl flex flex-col items-center justify-center bg-blue-50">
                  <span className="text-xl font-black text-blue-700">{localQaSum.TBD}</span>
                  <span className="text-[9px] font-black uppercase text-blue-600">TBD</span>
                </div>
                <div className="p-2.5 rounded-xl flex flex-col items-center justify-center bg-slate-50">
                  <span className="text-xl font-black text-slate-700">{localQaSum.Pending}</span>
                  <span className="text-[9px] font-black uppercase text-slate-600">Pending</span>
                </div>
                <div className="p-2.5 rounded-xl flex flex-col items-center justify-center bg-yellow-50">
                  <span className="text-xl font-black text-yellow-700">{localQaSum["N/A"]}</span>
                  <span className="text-[9px] font-black uppercase text-yellow-600">N/A</span>
                </div>
              </div>
            </div>
          </div>

          {/* Local editable table list */}
          <div
            className="premium-card !p-0 overflow-hidden flex flex-col bg-white"
            style={{ height: "calc(100vh - 200px)", minHeight: "450px" }}
          >
            {/* Filter controls */}
            <div className="p-4 border-b border-slate-100 flex flex-col gap-4 bg-slate-50/50">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="relative w-full md:w-80 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#ed5c37] transition-colors" />
                  <input
                    type="text"
                    placeholder="Search local records..."
                    value={localSearch}
                    onChange={e => setLocalSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium focus:ring-4 focus:ring-[#ed5c37]/5 focus:border-[#ed5c37]/20 outline-none transition-all shadow-sm"
                  />
                </div>

                {uniqueLocalModules.length > 0 && (
                  <select
                    value={localModuleFilter}
                    onChange={e => setLocalModuleFilter(e.target.value)}
                    className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-700 outline-none shadow-sm hover:border-slate-300"
                  >
                    <option value="all">All Modules</option>
                    {uniqueLocalModules.map(mod => (
                      <option key={mod} value={mod}>
                        {mod}
                      </option>
                    ))}
                  </select>
                )}

                {uniqueLocalJiraTickets.length > 0 && (
                  <select
                    value={localJiraFilter}
                    onChange={e => setLocalJiraFilter(e.target.value)}
                    className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-700 outline-none shadow-sm hover:border-slate-300"
                  >
                    <option value="all">All JIRA Tickets</option>
                    {uniqueLocalJiraTickets.map(jira => (
                      <option key={jira} value={jira}>
                        {jira}
                      </option>
                    ))}
                  </select>
                )}

                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm ml-auto whitespace-nowrap">
                  {filteredLocalCases.length} / {localTestCases.length} rows
                </span>
              </div>
            </div>

            {/* Dynamic Grid Table */}
            <div className="overflow-auto flex-1">
              <table className="w-full text-left text-sm relative">
                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold tracking-widest text-slate-500 sticky top-0 z-10 shadow-sm">
                  <tr>
                    {localColumns.map(col => (
                      <th key={col} className="px-4 py-4 whitespace-nowrap bg-slate-50">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredLocalCases.map(tc => (
                    <tr key={tc._internalId} className="hover:bg-slate-50/80 transition-colors">
                      {localColumns.map(col => (
                        <td key={col} className="px-2 py-2 min-w-[160px]">
                          {/* Inline cell renderer based on column type */}
                          {col === "Dev Status" || col === "QA Status" ? (
                            <select
                              value={tc[col]}
                              onChange={e =>
                                handleLocalCellChange(tc._internalId, col, e.target.value as LocalNormalisedStatus)
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest border border-transparent outline-none appearance-none cursor-pointer hover:brightness-95 transition-all shadow-sm ${
                                LOCAL_STATUS_BGS[tc[col] as LocalNormalisedStatus]
                              }`}
                            >
                              <option value="Pass">Pass</option>
                              <option value="Fail">Fail</option>
                              <option value="TBD">TBD</option>
                              <option value="Pending">Pending</option>
                              <option value="N/A">N/A</option>
                            </select>
                          ) : isDateColumn(col) ? (
                            <input
                              type="date"
                              value={formatDateInput(tc[col])}
                              onChange={e => handleLocalCellChange(tc._internalId, col, e.target.value)}
                              className="w-full px-3 py-1.5 text-sm font-medium text-slate-700 bg-transparent border border-transparent rounded-lg hover:border-slate-200 focus:bg-white focus:border-[#ed5c37] focus:ring-2 focus:ring-[#ed5c37]/20 outline-none transition-all cursor-pointer"
                            />
                          ) : isLinkValue(col) ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={tc[col] || ""}
                                onChange={e => handleLocalCellChange(tc._internalId, col, e.target.value)}
                                className="flex-1 px-3 py-1.5 text-sm font-semibold text-blue-600 bg-transparent border border-transparent rounded-lg hover:border-slate-200 focus:bg-white focus:border-[#ed5c37] focus:ring-2 focus:ring-[#ed5c37]/20 outline-none transition-all"
                              />
                              {tc[col] && (
                                <a
                                  href={
                                    String(tc[col]).startsWith("http")
                                      ? tc[col]
                                      : `https://www.google.com/search?q=${encodeURIComponent(tc[col])}`
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors shrink-0"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={tc[col] || ""}
                              onChange={e => handleLocalCellChange(tc._internalId, col, e.target.value)}
                              className="w-full px-3 py-1.5 text-sm font-medium text-slate-700 bg-transparent border border-transparent rounded-lg hover:border-slate-200 focus:bg-white focus:border-[#ed5c37] focus:ring-2 focus:ring-[#ed5c37]/20 outline-none transition-all"
                              placeholder="—"
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {filteredLocalCases.length === 0 && (
                    <tr>
                      <td colSpan={localColumns.length || 1} className="px-4 py-12 text-center text-slate-400">
                        No rows match your filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- GOOGLE SHEET TWO-WAY SYNC INTERFACE --- */}
      {mode === "google" && (
        <div className="space-y-6">
          {/* Dashboard Metrics Panel */}
          {overallMetrics && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="premium-card !p-4 flex flex-col justify-between h-28 relative overflow-hidden bg-gradient-to-br from-white to-slate-50/50">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Cases</span>
                  <span className="text-3xl font-black text-slate-900 leading-none">{overallMetrics.total}</span>
                  <div className="absolute right-3 bottom-3 text-slate-100 opacity-20">
                    <Layers className="w-12 h-12" />
                  </div>
                </div>

                <div className="premium-card !p-4 flex flex-col justify-between h-28 relative overflow-hidden border-l-4 border-l-emerald-500 bg-gradient-to-br from-white to-emerald-50/10">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Passed</span>
                  <span className="text-3xl font-black text-emerald-700 leading-none">{overallMetrics.passed}</span>
                  <span className="text-[9px] font-semibold text-slate-400">
                    {overallMetrics.total > 0 ? Math.round((overallMetrics.passed / overallMetrics.total) * 100) : 0}%
                  </span>
                </div>

                <div className="premium-card !p-4 flex flex-col justify-between h-28 relative overflow-hidden border-l-4 border-l-rose-500 bg-gradient-to-br from-white to-rose-50/10">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Failed</span>
                  <span className="text-3xl font-black text-rose-700 leading-none">{overallMetrics.failed}</span>
                  <span className="text-[9px] font-semibold text-slate-400">
                    {overallMetrics.total > 0 ? Math.round((overallMetrics.failed / overallMetrics.total) * 100) : 0}%
                  </span>
                </div>

                <div className="premium-card !p-4 flex flex-col justify-between h-28 relative overflow-hidden border-l-4 border-l-amber-500 bg-gradient-to-br from-white to-amber-50/10">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Blocked</span>
                  <span className="text-3xl font-black text-amber-700 leading-none">{overallMetrics.blocked}</span>
                  <span className="text-[9px] font-semibold text-slate-400">
                    {overallMetrics.total > 0 ? Math.round((overallMetrics.blocked / overallMetrics.total) * 100) : 0}%
                  </span>
                </div>

                <div className="premium-card !p-4 flex flex-col justify-between h-28 relative overflow-hidden border-l-4 border-l-slate-400 bg-gradient-to-br from-white to-slate-50/10">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Not Run</span>
                  <span className="text-3xl font-black text-slate-700 leading-none">{overallMetrics.notRun}</span>
                  <span className="text-[9px] font-semibold text-slate-400">
                    {overallMetrics.total > 0 ? Math.round((overallMetrics.notRun / overallMetrics.total) * 100) : 0}%
                  </span>
                </div>

                <div className="premium-card !p-4 flex flex-col justify-between h-28 relative overflow-hidden bg-slate-900 text-white border-none shadow-lg shadow-slate-900/10">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Completion</span>
                  <span className="text-3xl font-black text-white leading-none">{overallMetrics.execPercent}%</span>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-[#ed5c37] h-1.5 rounded-full" style={{ width: `${overallMetrics.execPercent}%` }} />
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="premium-card !p-5 space-y-3 bg-white">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#ed5c37]" />
                    QA Execution Progress
                  </span>
                  <span>
                    {overallMetrics.total - overallMetrics.notRun} of {overallMetrics.total} Executed
                  </span>
                </div>

                <div className="h-4 w-full bg-slate-100 rounded-xl overflow-hidden flex shadow-inner border border-slate-200/50">
                  {overallMetrics.passed > 0 && (
                    <div
                      className="bg-emerald-500 h-full transition-all duration-500 hover:brightness-95 cursor-pointer"
                      style={{ width: `${(overallMetrics.passed / overallMetrics.total) * 100}%` }}
                      title={`Passed: ${overallMetrics.passed}`}
                    />
                  )}
                  {overallMetrics.failed > 0 && (
                    <div
                      className="bg-rose-500 h-full transition-all duration-500 hover:brightness-95 cursor-pointer"
                      style={{ width: `${(overallMetrics.failed / overallMetrics.total) * 100}%` }}
                      title={`Failed: ${overallMetrics.failed}`}
                    />
                  )}
                  {overallMetrics.blocked > 0 && (
                    <div
                      className="bg-amber-400 h-full transition-all duration-500 hover:brightness-95 cursor-pointer"
                      style={{ width: `${(overallMetrics.blocked / overallMetrics.total) * 100}%` }}
                      title={`Blocked: ${overallMetrics.blocked}`}
                    />
                  )}
                  {overallMetrics.notRun > 0 && (
                    <div
                      className="bg-slate-200 h-full transition-all duration-500 hover:brightness-95 cursor-pointer"
                      style={{ width: `${(overallMetrics.notRun / overallMetrics.total) * 100}%` }}
                      title={`Not Run: ${overallMetrics.notRun}`}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200">
            <button
              onClick={() => setActiveTab("repository")}
              className={`flex items-center gap-2 px-6 py-3.5 border-b-2 font-bold text-sm transition-all cursor-pointer ${
                activeTab === "repository"
                  ? "border-[#ed5c37] text-[#ed5c37]"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              <Layers className="w-4 h-4" /> Test Case Repository
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-2 px-6 py-3.5 border-b-2 font-bold text-sm transition-all cursor-pointer ${
                activeTab === "history"
                  ? "border-[#ed5c37] text-[#ed5c37]"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              <Clock className="w-4 h-4" /> Sync History
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`flex items-center gap-2 px-6 py-3.5 border-b-2 font-bold text-sm transition-all cursor-pointer ${
                activeTab === "audit"
                  ? "border-[#ed5c37] text-[#ed5c37]"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              <FileText className="w-4 h-4" /> Audit Logs
            </button>
          </div>

          {/* Repository Tab Content */}
          {activeTab === "repository" && (
            <div className="premium-card !p-0 overflow-hidden flex flex-col bg-white">
              {/* Filter and Search Bar */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
                {/* Row 1: Search + Add Button */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[280px] group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#ed5c37] transition-colors" />
                    <input
                      type="text"
                      placeholder="Search ID, Title, JIRA Ticket..."
                      value={search}
                      onChange={e => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-[#ed5c37]/5 focus:border-[#ed5c37]/20 outline-none transition-all shadow-sm"
                    />
                  </div>
                  <button
                    onClick={() => setShowAddCaseModal(true)}
                    className="btn-primary !py-2.5 !px-4 flex items-center gap-2 whitespace-nowrap cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Add Test Case
                  </button>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm whitespace-nowrap">
                    {totalCases} cases
                  </span>
                </div>

                {/* Row 2: Multi-select filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filter:</span>
                  </div>
                  <MultiSelectDropdown
                    label="Module"
                    options={modules}
                    selected={moduleFilter}
                    onChange={vals => { setModuleFilter(vals); setPage(1); }}
                  />
                  <MultiSelectDropdown
                    label="Priority"
                    options={["Low", "Medium", "High", "Critical"]}
                    selected={priorityFilter}
                    onChange={vals => { setPriorityFilter(vals); setPage(1); }}
                  />
                  <MultiSelectDropdown
                    label="Dev Status"
                    options={["Not Started", "Passed", "Failed", "Blocked"]}
                    selected={devStatusFilter}
                    onChange={vals => { setDevStatusFilter(vals); setPage(1); }}
                  />
                  <MultiSelectDropdown
                    label="QA Status"
                    options={["Not Run", "Passed", "Failed", "Blocked"]}
                    selected={qaStatusFilter}
                    onChange={vals => { setQaStatusFilter(vals); setPage(1); }}
                  />
                  <MultiSelectDropdown
                    label="Cross Browser"
                    options={["Yes", "No", "N/A"]}
                    selected={cbVerifiedFilter}
                    onChange={vals => { setCbVerifiedFilter(vals); setPage(1); }}
                  />
                  {(moduleFilter.length > 0 || priorityFilter.length > 0 || devStatusFilter.length > 0 || qaStatusFilter.length > 0 || cbVerifiedFilter.length > 0) && (
                    <button
                      onClick={() => { setModuleFilter([]); setPriorityFilter([]); setDevStatusFilter([]); setQaStatusFilter([]); setCbVerifiedFilter([]); setPage(1); }}
                      className="text-[10px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-widest px-2 py-1 rounded-lg hover:bg-rose-50 transition-all cursor-pointer"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              </div>

              {/* Bulk Selection Banner */}
              {selectedCaseIds.length > 0 && (
                <div className="mx-4 mt-3 mb-1 p-3 bg-[#ed5c37]/5 border border-[#ed5c37]/20 rounded-2xl flex flex-wrap items-center gap-3 animate-in slide-in-from-top duration-200">
                  <span className="text-sm font-bold text-[#ed5c37]">
                    {selectedCaseIds.length} case{selectedCaseIds.length > 1 ? "s" : ""} selected
                  </span>
                  <div className="flex items-center gap-2 ml-2">
                    <span className="text-xs font-semibold text-slate-500">Bulk update:</span>
                    <select
                      value={bulkField}
                      onChange={e => setBulkField(e.target.value as typeof bulkField)}
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-700 outline-none shadow-sm"
                    >
                      <option value="qaStatus">QA Status</option>
                      <option value="devStatus">Dev Status</option>
                      <option value="priority">Priority</option>
                      <option value="crossBrowserVerified">Cross Browser</option>
                    </select>
                    <span className="text-slate-400 text-xs">→</span>
                    <select
                      value={bulkValue}
                      onChange={e => setBulkValue(e.target.value)}
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-700 outline-none shadow-sm"
                    >
                      {bulkField === "qaStatus" && (
                        <>
                          <option value="Not Run">Not Run</option>
                          <option value="Passed">Passed</option>
                          <option value="Failed">Failed</option>
                          <option value="Blocked">Blocked</option>
                        </>
                      )}
                      {bulkField === "devStatus" && (
                        <>
                          <option value="Not Started">Not Started</option>
                          <option value="Passed">Passed</option>
                          <option value="Failed">Failed</option>
                          <option value="Blocked">Blocked</option>
                        </>
                      )}
                      {bulkField === "priority" && (
                        <>
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Critical">Critical</option>
                        </>
                      )}
                      {bulkField === "crossBrowserVerified" && (
                        <>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                          <option value="N/A">N/A</option>
                        </>
                      )}
                    </select>
                    <button
                    onClick={async () => {
                      if (bulkUpdating) return;
                      setBulkUpdating(true);
                      setError("");
                      setIsSyncing(true);
                      try {
                        const res = await fetch(`/api/projects/${projectId}/test-cases`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            testCaseIds: selectedCaseIds,
                            [bulkField]: bulkValue,
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok || data.error) throw new Error(data.error || "Bulk update failed.");
                        // Update local state
                        setTestCases(prev =>
                          prev.map(tc =>
                            selectedCaseIds.includes(tc.testCaseId)
                              ? { ...tc, [bulkField]: bulkValue }
                              : tc
                          )
                        );
                        setSelectedCaseIds([]);
                        setToast({ message: `Bulk updated ${selectedCaseIds.length} test case(s) successfully!`, type: "success" });
                        setSuccessMessage(`Updated ${selectedCaseIds.length} test case(s) successfully.`);
                        setTimeout(() => setSuccessMessage(""), 5000);
                        if (data.syncError) {
                          console.warn("Sheet sync warning:", data.syncError);
                        }
                      } catch (err: any) {
                        setError(err.message || "Bulk update failed.");
                        setToast({ message: err.message || "Bulk update failed.", type: "error" });
                      } finally {
                        setBulkUpdating(false);
                        setIsSyncing(false);
                      }
                    }}
                    disabled={bulkUpdating}
                    className="btn-primary !py-1.5 !px-4 text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {bulkUpdating ? (
                      <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Updating...</>
                    ) : (
                      <><CheckCircle2 className="w-3.5 h-3.5" /> Apply to {selectedCaseIds.length}</>
                    )}
                  </button>
                  </div>
                  <button
                    onClick={() => setSelectedCaseIds([])}
                    className="ml-auto text-xs font-bold text-slate-400 hover:text-slate-700 cursor-pointer px-2 py-1 hover:bg-slate-100 rounded-lg transition-all"
                  >
                    ✕ Clear selection
                  </button>
                </div>
              )}

              {/* Data Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm relative divide-y divide-slate-100 bg-white">
                  <thead className="bg-slate-50 text-[10px] uppercase font-bold tracking-widest text-slate-500 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-4 bg-slate-50 w-10">
                        <input
                          type="checkbox"
                          checked={testCases.length > 0 && selectedCaseIds.length === testCases.length}
                          ref={el => { if (el) el.indeterminate = selectedCaseIds.length > 0 && selectedCaseIds.length < testCases.length; }}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedCaseIds(testCases.map(tc => tc.testCaseId));
                            } else {
                              setSelectedCaseIds([]);
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-[#ed5c37] focus:ring-[#ed5c37] cursor-pointer accent-[#ed5c37]"
                        />
                      </th>
                      {googleColumns.map((col: string) => (
                        <th key={col} className="px-4 py-4 whitespace-nowrap bg-slate-50">
                          {col}
                        </th>
                      ))}
                      <th className="px-4 py-4 whitespace-nowrap bg-slate-50 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {testCases.map(tc => (
                      <tr
                        key={tc.testCaseId}
                        className={`hover:bg-slate-50/50 transition-colors group ${
                          tc.status === "inactive" ? "opacity-50 line-through bg-slate-50/30" : ""
                        } ${selectedCaseIds.includes(tc.testCaseId) ? "bg-orange-50/30" : ""}`}
                      >
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={selectedCaseIds.includes(tc.testCaseId)}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedCaseIds(prev => [...prev, tc.testCaseId]);
                              } else {
                                setSelectedCaseIds(prev => prev.filter(id => id !== tc.testCaseId));
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-[#ed5c37] focus:ring-[#ed5c37] cursor-pointer accent-[#ed5c37]"
                          />
                        </td>
                        {googleColumns.map((col: string) => {
                          const colKey = col.toLowerCase().replace(/[^a-z0-9]/gi, "").trim();
                          const isIdCol = colKey === "testcaseid" || colKey === "tcid" || colKey === "id";
                          const isDevStatus = colKey === "devstatus";
                          const isQaStatus = colKey === "qastatus";
                          const isPriority = colKey === "priority";
                          const isCbVerified = colKey === "crossbrowserverified" || colKey === "crossbrowserverfied";
                          const isDate = colKey === "devdateexecuted" || isDateColumn(col);
                          const isLink = isLinkValue(col);

                          return (
                            <td key={col} className="px-2 py-2 min-w-[160px]">
                              {isIdCol ? (
                                <span className="px-3 py-1.5 font-bold text-slate-900 block">
                                  {tc[col] || tc.testCaseId || "—"}
                                </span>
                              ) : isDevStatus ? (
                                <select
                                  value={tc[col] || tc.devStatus || "Not Started"}
                                  onChange={e => {
                                    handleGoogleCellChangeState(tc.testCaseId, col, e.target.value);
                                    handleGoogleCellSync(tc.testCaseId, col, e.target.value);
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest border border-transparent outline-none appearance-none cursor-pointer hover:brightness-95 transition-all shadow-sm ${
                                    DEV_STATUS_BGS[(tc[col] || tc.devStatus || "Not Started") as DevStatus]
                                  }`}
                                >
                                  <option value="Not Started">Not Started</option>
                                  <option value="Passed">Passed</option>
                                  <option value="Failed">Failed</option>
                                  <option value="Blocked">Blocked</option>
                                </select>
                              ) : isQaStatus ? (
                                <select
                                  value={tc[col] || tc.qaStatus || "Not Run"}
                                  onChange={e => {
                                    handleGoogleCellChangeState(tc.testCaseId, col, e.target.value);
                                    handleGoogleCellSync(tc.testCaseId, col, e.target.value);
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest border border-transparent outline-none appearance-none cursor-pointer hover:brightness-95 transition-all shadow-sm ${
                                    QA_STATUS_BGS[(tc[col] || tc.qaStatus || "Not Run") as QAStatus]
                                  }`}
                                >
                                  <option value="Not Run">Not Run</option>
                                  <option value="Passed">Passed</option>
                                  <option value="Failed">Failed</option>
                                  <option value="Blocked">Blocked</option>
                                </select>
                              ) : isPriority ? (
                                <select
                                  value={tc[col] || tc.priority || "Medium"}
                                  onChange={e => {
                                    handleGoogleCellChangeState(tc.testCaseId, col, e.target.value);
                                    handleGoogleCellSync(tc.testCaseId, col, e.target.value);
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border border-transparent outline-none appearance-none cursor-pointer hover:brightness-95 transition-all shadow-sm ${
                                    PRIORITY_BGS[(tc[col] || tc.priority || "Medium") as Priority]
                                  }`}
                                >
                                  <option value="Low">Low</option>
                                  <option value="Medium">Medium</option>
                                  <option value="High">High</option>
                                  <option value="Critical">Critical</option>
                                </select>
                              ) : isCbVerified ? (
                                <select
                                  value={tc[col] || tc.crossBrowserVerified || "No"}
                                  onChange={e => {
                                    handleGoogleCellChangeState(tc.testCaseId, col, e.target.value);
                                    handleGoogleCellSync(tc.testCaseId, col, e.target.value);
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border border-transparent outline-none appearance-none cursor-pointer hover:brightness-95 transition-all shadow-sm ${
                                    CB_VERIFIED_BGS[(tc[col] || tc.crossBrowserVerified || "No") as CrossBrowserVerified]
                                  }`}
                                >
                                  <option value="Yes">Yes</option>
                                  <option value="No">No</option>
                                  <option value="N/A">N/A</option>
                                </select>
                              ) : isDate ? (
                                <input
                                  type="date"
                                  value={formatDateInput(tc[col] || "")}
                                  onChange={e => handleGoogleCellChangeState(tc.testCaseId, col, e.target.value)}
                                  onBlur={e => handleGoogleCellSync(tc.testCaseId, col, e.target.value)}
                                  className="w-full px-3 py-1.5 text-sm font-medium text-slate-700 bg-transparent border border-transparent rounded-lg hover:border-slate-200 focus:bg-white focus:border-[#ed5c37] focus:ring-2 focus:ring-[#ed5c37]/20 outline-none transition-all cursor-pointer"
                                />
                              ) : isLink ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={tc[col] || ""}
                                    onChange={e => handleGoogleCellChangeState(tc.testCaseId, col, e.target.value)}
                                    onBlur={e => handleGoogleCellSync(tc.testCaseId, col, e.target.value)}
                                    className="flex-1 px-3 py-1.5 text-sm font-semibold text-blue-600 bg-transparent border border-transparent rounded-lg hover:border-slate-200 focus:bg-white focus:border-[#ed5c37] focus:ring-2 focus:ring-[#ed5c37]/20 outline-none transition-all"
                                  />
                                  {tc[col] && (
                                    <a
                                      href={
                                        String(tc[col]).startsWith("http")
                                          ? tc[col]
                                          : `https://www.google.com/search?q=${encodeURIComponent(tc[col])}`
                                      }
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors shrink-0"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  value={tc[col] || ""}
                                  onChange={e => handleGoogleCellChangeState(tc.testCaseId, col, e.target.value)}
                                  onBlur={e => handleGoogleCellSync(tc.testCaseId, col, e.target.value)}
                                  className="w-full px-3 py-1.5 text-sm font-medium text-slate-700 bg-transparent border border-transparent rounded-lg hover:border-slate-200 focus:bg-white focus:border-[#ed5c37] focus:ring-2 focus:ring-[#ed5c37]/20 outline-none transition-all"
                                  placeholder="—"
                                />
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedCase(tc)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-[#ed5c37] hover:text-white rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                    {testCases.length === 0 && (
                      <tr>
                        <td colSpan={googleColumns.length + 2} className="px-6 py-16 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <Info className="w-8 h-8 text-slate-300" />
                            <p className="text-slate-400 font-medium text-sm">No test cases match filter criteria.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-semibold">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 border border-slate-200 rounded-xl bg-white text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-2 border border-slate-200 rounded-xl bg-white text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div className="premium-card !p-0 overflow-hidden bg-white">
              <table className="w-full text-left text-sm divide-y divide-slate-100">
                <thead className="bg-slate-50 text-[10px] uppercase font-bold tracking-widest text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Sync Time</th>
                    <th className="px-6 py-4">Triggered By</th>
                    <th className="px-6 py-4 text-center">New Records</th>
                    <th className="px-6 py-4 text-center">Updated Records</th>
                    <th className="px-6 py-4 text-center">Inactive Records</th>
                    <th className="px-6 py-4 text-center">Failed Records</th>
                    <th className="px-6 py-4 text-center">Duration</th>
                    <th className="px-6 py-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {syncHistory.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/40">
                      <td className="px-6 py-4 text-xs font-semibold text-slate-900">
                        {log.syncTime ? new Date(log.syncTime).toLocaleString() : "—"}
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-600">{log.triggeredBy}</td>
                      <td className="px-6 py-4 text-center text-emerald-600">+{log.createdRecords}</td>
                      <td className="px-6 py-4 text-center text-blue-600">{log.updatedRecords}</td>
                      <td className="px-6 py-4 text-center text-rose-600">{log.inactiveRecords}</td>
                      <td className="px-6 py-4 text-center text-amber-600">{log.failedRecords}</td>
                      <td className="px-6 py-4 text-center text-xs text-slate-500 font-bold">{log.duration}s</td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black border ${
                            log.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : log.status === "CONFLICT"
                              ? "bg-amber-50 text-amber-700 border-amber-100"
                              : "bg-rose-50 text-rose-700 border-rose-100"
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {syncHistory.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                        No synchronization history logged.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "audit" && (
            <div className="premium-card !p-0 overflow-hidden bg-white">
              <table className="w-full text-left text-sm divide-y divide-slate-100">
                <thead className="bg-slate-50 text-[10px] uppercase font-bold tracking-widest text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Timestamp</th>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Action Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/40">
                      <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : "—"}
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-900 whitespace-nowrap">{log.user}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{log.action}</td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                        No audit logs logged.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- MODAL: Add Test Case --- */}
      {showAddCaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200 my-8">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Add New Test Case</h3>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">Will be saved to portal and synced to Google Sheet</p>
              </div>
              <button
                onClick={() => setShowAddCaseModal(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-white/80 transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Test Case ID *</label>
                  <input
                    type="text"
                    value={newCaseId}
                    onChange={e => setNewCaseId(e.target.value)}
                    placeholder="TC-001"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-4 focus:ring-[#ed5c37]/10 focus:border-[#ed5c37]/30 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Module</label>
                  <input
                    type="text"
                    value={newCaseModule}
                    onChange={e => setNewCaseModule(e.target.value)}
                    placeholder="Authentication"
                    list="module-suggestions"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-4 focus:ring-[#ed5c37]/10 focus:border-[#ed5c37]/30 outline-none transition-all"
                  />
                  <datalist id="module-suggestions">
                    {modules.map(m => <option key={m} value={m} />)}
                  </datalist>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Test Case Title *</label>
                <input
                  type="text"
                  value={newCaseTitle}
                  onChange={e => setNewCaseTitle(e.target.value)}
                  placeholder="Verify user can login with valid credentials"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-4 focus:ring-[#ed5c37]/10 focus:border-[#ed5c37]/30 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Priority</label>
                  <select
                    value={newCasePriority}
                    onChange={e => setNewCasePriority(e.target.value as Priority)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-[#ed5c37]/10 focus:border-[#ed5c37]/30 transition-all"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Dev Status</label>
                  <select
                    value={newCaseDevStatus}
                    onChange={e => setNewCaseDevStatus(e.target.value as DevStatus)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-[#ed5c37]/10 focus:border-[#ed5c37]/30 transition-all"
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="Passed">Passed</option>
                    <option value="Failed">Failed</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">QA Status</label>
                  <select
                    value={newCaseQaStatus}
                    onChange={e => setNewCaseQaStatus(e.target.value as QAStatus)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-[#ed5c37]/10 focus:border-[#ed5c37]/30 transition-all"
                  >
                    <option value="Not Run">Not Run</option>
                    <option value="Passed">Passed</option>
                    <option value="Failed">Failed</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Cross Browser Verified</label>
                  <select
                    value={newCaseCbVerified}
                    onChange={e => setNewCaseCbVerified(e.target.value as CrossBrowserVerified)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-[#ed5c37]/10 focus:border-[#ed5c37]/30 transition-all"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                    <option value="N/A">N/A</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">JIRA Ticket</label>
                  <input
                    type="text"
                    value={newCaseJiraTicket}
                    onChange={e => setNewCaseJiraTicket(e.target.value)}
                    placeholder="QAOPS-101"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-4 focus:ring-[#ed5c37]/10 focus:border-[#ed5c37]/30 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Pre-Conditions</label>
                <textarea
                  value={newCasePreConditions}
                  onChange={e => setNewCasePreConditions(e.target.value)}
                  placeholder="User is on the login screen and not authenticated..."
                  rows={2}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-4 focus:ring-[#ed5c37]/10 focus:border-[#ed5c37]/30 outline-none transition-all resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Test Steps</label>
                <textarea
                  value={newCaseTestSteps}
                  onChange={e => setNewCaseTestSteps(e.target.value)}
                  placeholder="1. Navigate to login page&#10;2. Enter valid email&#10;3. Enter valid password&#10;4. Click Login"
                  rows={3}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-4 focus:ring-[#ed5c37]/10 focus:border-[#ed5c37]/30 outline-none transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Test Data</label>
                  <textarea
                    value={newCaseTestData}
                    onChange={e => setNewCaseTestData(e.target.value)}
                    placeholder="Email: test@test.com, Pass: Test@1234"
                    rows={2}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-4 focus:ring-[#ed5c37]/10 focus:border-[#ed5c37]/30 outline-none transition-all resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Expected Result</label>
                  <textarea
                    value={newCaseExpectedResult}
                    onChange={e => setNewCaseExpectedResult(e.target.value)}
                    placeholder="User is redirected to the dashboard"
                    rows={2}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-4 focus:ring-[#ed5c37]/10 focus:border-[#ed5c37]/30 outline-none transition-all resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  setShowAddCaseModal(false);
                  setNewCaseId(""); setNewCaseTitle(""); setNewCaseModule("");
                  setNewCasePriority("Medium"); setNewCaseDevStatus("Not Started");
                  setNewCaseQaStatus("Not Run"); setNewCaseCbVerified("No");
                  setNewCasePreConditions(""); setNewCaseTestSteps("");
                  setNewCaseTestData(""); setNewCaseExpectedResult("");
                  setNewCaseJiraTicket("");
                }}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newCaseId.trim() || !newCaseTitle.trim()) {
                    setError("Test Case ID and Title are required.");
                    return;
                  }
                  setAddingCaseLoading(true);
                  setIsSyncing(true);
                  setError("");
                  try {
                    const res = await fetch(`/api/projects/${projectId}/test-cases`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        testCaseId: newCaseId.trim(),
                        title: newCaseTitle.trim(),
                        module: newCaseModule.trim(),
                        priority: newCasePriority,
                        devStatus: newCaseDevStatus,
                        qaStatus: newCaseQaStatus,
                        crossBrowserVerified: newCaseCbVerified,
                        preConditions: newCasePreConditions,
                        testSteps: newCaseTestSteps,
                        testData: newCaseTestData,
                        expectedResult: newCaseExpectedResult,
                        jiraTicket: newCaseJiraTicket,
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok || data.error) throw new Error(data.error || "Failed to create test case.");
                    setToast({ message: `Test case "${newCaseId.trim()}" created successfully!`, type: "success" });
                    setSuccessMessage(`Test case "${newCaseId.trim()}" created successfully!${data.synced ? " Synced to Google Sheet." : ""}`);
                    setTimeout(() => setSuccessMessage(""), 6000);
                    setShowAddCaseModal(false);
                    setNewCaseId(""); setNewCaseTitle(""); setNewCaseModule("");
                    setNewCasePriority("Medium"); setNewCaseDevStatus("Not Started");
                    setNewCaseQaStatus("Not Run"); setNewCaseCbVerified("No");
                    setNewCasePreConditions(""); setNewCaseTestSteps("");
                    setNewCaseTestData(""); setNewCaseExpectedResult("");
                    setNewCaseJiraTicket("");
                    await fetchTestCases();
                  } catch (err: any) {
                    setError(err.message || "Failed to create test case.");
                    setToast({ message: err.message || "Failed to create test case.", type: "error" });
                  } finally {
                    setAddingCaseLoading(false);
                    setIsSyncing(false);
                  }
                }}
                disabled={addingCaseLoading}
                className="btn-primary py-2.5 px-6 text-sm font-semibold cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {addingCaseLoading ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Creating...</>
                ) : (
                  <><Plus className="w-4 h-4" /> Create Test Case</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL C: Conflict Resolution --- */}
      {conflicts.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200 my-8">
            <div className="p-6 bg-amber-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 animate-bounce" />
                <div>
                  <h3 className="font-bold text-lg">Conflict Detected</h3>
                  <p className="text-xs text-amber-100 font-semibold">Same test case updated in both systems</p>
                </div>
              </div>
            </div>

            <div className="p-6 max-h-[50vh] overflow-y-auto space-y-6">
              {conflicts.map(conflict => {
                const choice = conflictResolutions[conflict.testCaseId];
                return (
                  <div key={conflict.testCaseId} className="border border-slate-200 rounded-2xl p-5 space-y-4 bg-slate-50/50">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-xs font-bold text-slate-400">Row {conflict.rowNumber}</span>
                        <h4 className="font-black text-slate-900">{conflict.testCaseId}</h4>
                      </div>
                      <span className="text-xs font-semibold text-slate-500 max-w-xs truncate text-right">
                        {conflict.sheetValues.title}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Option A: Keep Portal */}
                      <div
                        onClick={() =>
                          setConflictResolutions(prev => ({ ...prev, [conflict.testCaseId]: "portal" }))
                        }
                        className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                          choice === "portal"
                            ? "border-[#ed5c37] bg-orange-50/10 shadow-md"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-black text-slate-700">Keep Portal Version</span>
                          <input
                            type="radio"
                            name={`resolution-${conflict.testCaseId}`}
                            checked={choice === "portal"}
                            onChange={() => {}}
                            className="text-[#ed5c37] focus:ring-[#ed5c37]"
                          />
                        </div>
                        <div className="space-y-1.5 text-xs text-slate-500 font-semibold">
                          <div>
                            Dev Status: <strong className="text-slate-700">{conflict.portalValues.devStatus}</strong>
                          </div>
                          <div>
                            QA Status: <strong className="text-slate-700">{conflict.portalValues.qaStatus}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Option B: Keep Google Sheet */}
                      <div
                        onClick={() =>
                          setConflictResolutions(prev => ({ ...prev, [conflict.testCaseId]: "sheet" }))
                        }
                        className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                          choice === "sheet"
                            ? "border-[#ed5c37] bg-orange-50/10 shadow-md"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-black text-slate-700">Keep Google Sheet Version</span>
                          <input
                            type="radio"
                            name={`resolution-${conflict.testCaseId}`}
                            checked={choice === "sheet"}
                            onChange={() => {}}
                            className="text-[#ed5c37] focus:ring-[#ed5c37]"
                          />
                        </div>
                        <div className="space-y-1.5 text-xs text-slate-500 font-semibold">
                          <div>
                            Dev Status: <strong className="text-slate-700">{conflict.sheetValues.devStatus}</strong>
                          </div>
                          <div>
                            QA Status: <strong className="text-slate-700">{conflict.sheetValues.qaStatus}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setConflicts([])}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-semibold cursor-pointer"
              >
                Cancel Sync
              </button>
              <button
                onClick={handleResolveConflicts}
                disabled={resolvingConflicts}
                className="btn-primary py-2.5 px-6 text-sm font-semibold cursor-pointer flex items-center gap-2"
              >
                {resolvingConflicts ? "Resolving..." : "Resolve & Continue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL D: Sync Result Confirmation --- */}
      {showSyncResultModal && syncSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-lg">Sync Completed</h3>
                  <p className="text-xs text-slate-300 font-semibold">Manual sync engine logs</p>
                </div>
              </div>
              <button
                onClick={() => setShowSyncResultModal(false)}
                className="p-1 rounded-full hover:bg-white/10 text-white/80 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500">New Records</span>
                  <span className="text-sm font-black text-emerald-600">+{syncSummary.newRecords}</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500">Updated Records</span>
                  <span className="text-sm font-black text-blue-600">{syncSummary.updatedRecords}</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500">Inactive Records</span>
                  <span className="text-sm font-black text-rose-600">{syncSummary.inactiveRecords}</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500">Failed Records</span>
                  <span className="text-sm font-black text-amber-600">{syncSummary.failedRecords}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col gap-2 text-xs font-medium text-slate-500">
                <div className="flex justify-between">
                  <span>Sync Duration:</span>
                  <strong className="text-slate-800">{syncSummary.duration} Seconds</strong>
                </div>
                <div className="flex justify-between">
                  <span>Last Sync Time:</span>
                  <strong className="text-slate-800">{new Date(syncSummary.lastSyncTime).toLocaleString()}</strong>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setShowSyncResultModal(false)}
                className="btn-primary py-2.5 px-6 text-sm font-semibold cursor-pointer"
              >
                Okay, Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL E: Test Case Details Modal (Google Synced Mode only) --- */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200 my-8">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {selectedCase.module || "General"} Module
                </span>
                <h3 className="font-bold text-lg leading-tight flex items-center gap-2">
                  {selectedCase.testCaseId}
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-[10px] font-black border ${
                      PRIORITY_BGS[selectedCase.priority]
                    }`}
                  >
                    {selectedCase.priority}
                  </span>
                </h3>
              </div>
              <button
                onClick={() => setSelectedCase(null)}
                className="p-1 rounded-full hover:bg-white/10 text-white/80 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">
                  Test Case Definitions
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                  <div className="space-y-1 md:col-span-2">
                    <span className="text-slate-400 font-bold block">Title</span>
                    <span className="text-slate-800 text-sm font-black">{selectedCase.title}</span>
                  </div>
                  {selectedCase.preConditions && (
                    <div className="space-y-1 md:col-span-2">
                      <span className="text-slate-400 font-bold block">Pre-Conditions</span>
                      <pre className="text-slate-700 bg-slate-50 border border-slate-100 rounded-xl p-3 whitespace-pre-wrap font-sans text-xs">
                        {selectedCase.preConditions}
                      </pre>
                    </div>
                  )}
                  {selectedCase.testSteps && (
                    <div className="space-y-1 md:col-span-2">
                      <span className="text-slate-400 font-bold block">Test Steps</span>
                      <pre className="text-slate-700 bg-slate-50 border border-slate-100 rounded-xl p-3 whitespace-pre-wrap font-sans text-xs">
                        {selectedCase.testSteps}
                      </pre>
                    </div>
                  )}
                  {selectedCase.testData && (
                    <div className="space-y-1">
                      <span className="text-slate-400 font-bold block">Test Data</span>
                      <pre className="text-slate-700 bg-slate-50 border border-slate-100 rounded-xl p-3 whitespace-pre-wrap font-sans text-xs">
                        {selectedCase.testData}
                      </pre>
                    </div>
                  )}
                  {selectedCase.expectedResult && (
                    <div className="space-y-1">
                      <span className="text-slate-400 font-bold block">Expected Result</span>
                      <pre className="text-slate-700 bg-slate-50 border border-slate-100 rounded-xl p-3 whitespace-pre-wrap font-sans text-xs">
                        {selectedCase.expectedResult}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-[#ed5c37] uppercase tracking-widest border-b border-slate-100 pb-1 flex items-center gap-1.5">
                  <Database className="w-4 h-4" />
                  Status Execution Tracking
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 block">Dev Status</label>
                    <select
                      value={selectedCase.devStatus}
                      onChange={e => handleSaveTestCase({ devStatus: e.target.value as DevStatus })}
                      disabled={savingCase}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-white text-slate-700 outline-none focus:border-[#ed5c37]/30"
                    >
                      <option value="Not Started">Not Started</option>
                      <option value="Passed">Passed</option>
                      <option value="Failed">Failed</option>
                      <option value="Blocked">Blocked</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 block">Dev Date Executed</label>
                    <input
                      type="date"
                      value={selectedCase.devDateExecuted || ""}
                      onChange={e => handleSaveTestCase({ devDateExecuted: e.target.value })}
                      disabled={savingCase}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-white text-slate-700 outline-none focus:border-[#ed5c37]/30"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 block">QA Status</label>
                    <select
                      value={selectedCase.qaStatus}
                      onChange={e => handleSaveTestCase({ qaStatus: e.target.value as QAStatus })}
                      disabled={savingCase}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-white text-slate-700 outline-none focus:border-[#ed5c37]/30"
                    >
                      <option value="Not Run">Not Run</option>
                      <option value="Passed">Passed</option>
                      <option value="Failed">Failed</option>
                      <option value="Blocked">Blocked</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 block">Cross Browser Verified</label>
                    <select
                      value={selectedCase.crossBrowserVerified}
                      onChange={e =>
                        handleSaveTestCase({ crossBrowserVerified: e.target.value as CrossBrowserVerified })
                      }
                      disabled={savingCase}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-white text-slate-700 outline-none focus:border-[#ed5c37]/30"
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 block">JIRA Ticket (Linked in Sheet)</label>
                    <div className="px-3.5 py-2.5 border border-slate-100 rounded-xl bg-slate-50 font-bold text-slate-800 text-sm flex items-center justify-between">
                      <span>{selectedCase.jiraTicket || "—"}</span>
                      {selectedCase.jiraTicket && (
                        <a
                          href={`https://jira.atlassian.com/browse/${selectedCase.jiraTicket}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-bold text-slate-500 block">Dev Notes</label>
                    <textarea
                      value={selectedCase.devNotes || ""}
                      onChange={e => {
                        setSelectedCase({ ...selectedCase, devNotes: e.target.value });
                      }}
                      onBlur={e => handleSaveTestCase({ devNotes: e.target.value })}
                      placeholder="Input execution comments, notes..."
                      rows={3}
                      disabled={savingCase}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white text-slate-700 outline-none focus:border-[#ed5c37]/30"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Last Saved:{" "}
                {selectedCase.lastSyncedAt ? new Date(selectedCase.lastSyncedAt).toLocaleTimeString() : "Pending sync"}
              </span>
              <button
                onClick={() => setSelectedCase(null)}
                className="btn-primary py-2.5 px-6 text-sm font-semibold cursor-pointer"
              >
                Close Details
              </button>
            </div>
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
