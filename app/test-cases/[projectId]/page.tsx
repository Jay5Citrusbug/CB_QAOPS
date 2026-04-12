"use client";

import { useState, useEffect, use, useRef, useMemo } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import Link from "next/link";
import { UploadCloud, Download, Trash2, ArrowLeft, Search, Filter, ExternalLink } from "lucide-react";

type NormalisedStatus = "Pass" | "Fail" | "TBD" | "Pending" | "N/A";

interface TestCase {
  _internalId: string;
  [key: string]: any;
}

const STATUS_MAP: Record<string, NormalisedStatus> = {
  pass: "Pass", passed: "Pass", "✓": "Pass",
  fail: "Fail", failed: "Fail", "✗": "Fail",
  tbd: "TBD", "to be done": "TBD",
  pending: "Pending", "not started": "Pending", "": "Pending", null: "Pending", undefined: "Pending",
  "n/a": "N/A", na: "N/A", "not applicable": "N/A",
};

function normalizeStatus(val: any): NormalisedStatus {
  if (!val) return "Pending";
  const lower = String(val).trim().toLowerCase();
  return STATUS_MAP[lower] || "Pending";
}

const BGS: Record<NormalisedStatus, string> = {
  Pass: "bg-green-50 text-green-700 border-green-200",
  Fail: "bg-red-50 text-red-700 border-red-200",
  TBD: "bg-blue-50 text-blue-700 border-blue-200",
  Pending: "bg-slate-50 text-slate-700 border-slate-200",
  "N/A": "bg-yellow-50 text-yellow-700 border-yellow-200",
};

// Check if a column is completely empty across all rows
function isColumnEmpty(testCases: TestCase[], colName: string): boolean {
  return testCases.every(tc => {
    const val = tc[colName];
    return val === undefined || val === null || String(val).trim() === "" || String(val).trim() === "-";
  });
}

// Detect if a value looks like a URL or JIRA ticket key
function isLinkValue(colName: string): boolean {
  const lower = colName.toLowerCase();
  return lower.includes("jira") || lower.includes("ticket") || lower.includes("link") || lower.includes("url");
}

// Detect if a column is a date column
function isDateColumn(colName: string): boolean {
  const lower = colName.toLowerCase();
  return lower.includes("date");
}

// Format a date string for display
function formatDateDisplay(val: string): string {
  if (!val || val === "-") return "";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toISOString().split("T")[0]; // YYYY-MM-DD
  } catch {
    return val;
  }
}

// Format a date value for the date input
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

// Make a JIRA-like value into a full URL
function makeJiraUrl(val: string): string {
  if (!val) return "";
  const trimmed = val.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  // If it looks like a JIRA key (e.g. PROJ-123), return as-is for display
  return "";
}

export default function TestCaseManagerPage({ params }: { params: Promise<{ projectId: string }> }) {
  const resolvedParams = use(params);
  const { projectId } = resolvedParams;

  const [project, setProject] = useState<any>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter states
  const [moduleFilter, setModuleFilter] = useState("all");
  const [jiraFilter, setJiraFilter] = useState("all");

  // Fetch Project details
  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Project not found");
        return res.json();
      })
      .then(data => {
        if (data.error) setError(data.error);
        else setProject(data);
      })
      .catch((err) => setError(err.message || "Failed to load project details"));
  }, [projectId]);

  // Load from localStorage
  useEffect(() => {
    const cached = localStorage.getItem(`cbqops_testcases_${projectId}`);
    if (cached) {
      try {
        setTestCases(JSON.parse(cached));
      } catch (e) {
        console.error("Local storage parse failed", e);
      }
    }
    setLoading(false);
  }, [projectId]);

  // Save to localStorage when changed
  useEffect(() => {
    if (!loading) {
      localStorage.setItem(`cbqops_testcases_${projectId}`, JSON.stringify(testCases));
    }
  }, [testCases, projectId, loading]);

  const processData = (data: any[]) => {
    if (data.length === 0) {
      setError("The file is empty.");
      return;
    }

    // Clean and normalize headers
    const rawHeaders = Object.keys(data[0]);
    const cleanRows = data.map(row => {
      const newRow: any = {};
      Object.keys(row).forEach(key => {
        newRow[key.trim()] = row[key];
      });
      return newRow;
    });

    const headers = Object.keys(cleanRows[0]);
    
    // Find matching columns for status (case-insensitive and trimmed)
    const findStatusCol = (target: string) => 
      headers.find(h => h.trim().toLowerCase() === target.toLowerCase());

    const devStatusCol = findStatusCol("Dev Status");
    const qaStatusCol = findStatusCol("QA Status");

    if (!devStatusCol || !qaStatusCol) {
      setError("File must contain 'Dev Status' and 'QA Status' columns.");
      return;
    }

    const parsedCases: TestCase[] = cleanRows.map((row) => {
      const newRow: any = { ...row, _internalId: crypto.randomUUID() };
      // Standardize the column names to the ones the UI expects
      newRow["Dev Status"] = normalizeStatus(row[devStatusCol]);
      newRow["QA Status"] = normalizeStatus(row[qaStatusCol]);
      
      // If the original headers were different capitalization/spacing, 
      // the status dropdown logic needs them to be exactly "Dev Status" and "QA Status"
      if (devStatusCol !== "Dev Status") delete newRow[devStatusCol];
      if (qaStatusCol !== "QA Status") delete newRow[qaStatusCol];
      
      return newRow;
    });

    setTestCases(parsedCases);
    setModuleFilter("all");
    setJiraFilter("all");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    const fileExt = file.name.split('.').pop()?.toLowerCase();

    if (fileExt === 'csv') {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            processData(results.data as any[]);
          },
          error: (err) => {
            setError(`Failed to parse CSV: ${err.message}`);
          }
        });
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: "array" });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const data = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            processData(data);
        } catch (err: any) {
            setError(`Failed to parse Excel file: ${err.message}`);
        }
    } else {
        setError("Unsupported file format. Please upload a .csv, .xlsx, or .xls file.");
    }
  };

  const handleCellChange = (id: string, field: string, value: any) => {
    setTestCases(prev => prev.map(tc => 
      tc._internalId === id ? { ...tc, [field]: value } : tc
    ));
  };

  const handleExport = () => {
    const exportData = testCases.map(tc => {
      const { _internalId, ...rest } = tc;
      return rest;
    });
    
    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `test_cases_${project?.name || projectId}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    if (confirm("Are you sure you want to clear all test cases? This will delete the data from your local storage for this project.")) {
      setTestCases([]);
      setModuleFilter("all");
      setJiraFilter("all");
    }
  };

  // Summaries
  const calcSummary = (field: "Dev Status" | "QA Status") => {
    const counts = { Pass: 0, Fail: 0, TBD: 0, Pending: 0, "N/A": 0 };
    testCases.forEach(tc => counts[tc[field] as NormalisedStatus]++);
    const total = testCases.length;
    const completed = total - counts.Pending - counts.TBD;
    const passRate = total > 0 ? Math.round((counts.Pass / total) * 100) : 0;
    return { total, completed, passRate, ...counts };
  };

  const devSum = calcSummary("Dev Status");
  const qaSum = calcSummary("QA Status");

  // Get all columns, filter out _internalId and empty columns
  const allColumns = useMemo(() => {
    if (testCases.length === 0) return [];
    const rawCols = Object.keys(testCases[0]).filter(k => k !== "_internalId");
    return rawCols.filter(col => !isColumnEmpty(testCases, col));
  }, [testCases]);

  // Extract unique module values for filter dropdown
  const uniqueModules = useMemo(() => {
    const moduleCol = allColumns.find(c => c.toLowerCase() === "module");
    if (!moduleCol) return [];
    const vals = new Set<string>();
    testCases.forEach(tc => {
      const v = String(tc[moduleCol] || "").trim();
      if (v && v !== "-") vals.add(v);
    });
    return Array.from(vals).sort();
  }, [testCases, allColumns]);

  // Extract unique JIRA ticket values for filter dropdown
  const uniqueJiraTickets = useMemo(() => {
    const jiraCol = allColumns.find(c => isLinkValue(c));
    if (!jiraCol) return [];
    const vals = new Set<string>();
    testCases.forEach(tc => {
      const v = String(tc[jiraCol] || "").trim();
      if (v && v !== "-") vals.add(v);
    });
    return Array.from(vals).sort();
  }, [testCases, allColumns]);

  // Find the actual column names for filtering
  const moduleColName = allColumns.find(c => c.toLowerCase() === "module") || "";
  const jiraColName = allColumns.find(c => isLinkValue(c)) || "";

  // Filtered cases
  const filteredCases = useMemo(() => {
    return testCases.filter(tc => {
      // Text search
      if (search) {
        const lowerSearch = search.toLowerCase();
        const matchesSearch = allColumns.some(col => 
          String(tc[col] || "").toLowerCase().includes(lowerSearch)
        );
        if (!matchesSearch) return false;
      }

      // Module filter
      if (moduleFilter !== "all" && moduleColName) {
        if (String(tc[moduleColName] || "").trim() !== moduleFilter) return false;
      }

      // JIRA filter
      if (jiraFilter !== "all" && jiraColName) {
        if (String(tc[jiraColName] || "").trim() !== jiraFilter) return false;
      }

      return true;
    });
  }, [testCases, search, moduleFilter, jiraFilter, allColumns, moduleColName, jiraColName]);

  if (loading) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Breadcrumb / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <Link href="/test-cases" className="p-2 hover:bg-slate-200 rounded-xl transition-all bg-slate-100 text-slate-500">
                <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="page-header !mb-0">
            <h1 className="page-title text-2xl">{project?.name || "Loading Project..."}</h1>
            <p className="page-desc">Test Cases & Status Tracking</p>
            </div>
        </div>
        
        {testCases.length > 0 && (
            <div className="flex items-center gap-3">
                <button onClick={handleExport} className="btn-primary !bg-slate-800 hover:!bg-slate-900 border border-slate-700 shadow-none">
                    <Download className="w-4 h-4" /> Export CSV
                </button>
                <button onClick={handleClear} className="p-3 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-colors">
                    <Trash2 className="w-5 h-5" />
                </button>
            </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-bold flex items-center gap-2">
            ⚠️ {error}
        </div>
      )}

      {/* Upload Zone */}
      {testCases.length === 0 && (
        <div className="premium-card text-center p-12 border-dashed border-2 hover:border-[#ed5c37]/50 transition-colors bg-slate-50/50">
            <UploadCloud className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">Upload Test Cases</h3>
            <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">Upload a test cases file exported from your test management tool. Make sure it contains &quot;Dev Status&quot; and &quot;QA Status&quot; columns.</p>
            <input 
                type="file" 
                accept=".csv, .xlsx, .xls" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
            />
            <button 
                onClick={() => fileInputRef.current?.click()} 
                className="btn-primary"
            >
                Browse CSV or Excel File
            </button>
        </div>
      )}

      {/* Dashboards */}
      {testCases.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DashboardCard title="Dev Status Summary" summary={devSum} color="#3b82f6" />
            <DashboardCard title="QA Status Summary" summary={qaSum} color="#ed5c37" />
        </div>
      )}

      {/* Table */}
      {testCases.length > 0 && (
        <div className="premium-card !p-0 overflow-hidden flex flex-col" style={{ height: "calc(100vh - 200px)", minHeight: "400px" }}>
            {/* Filter Bar */}
            <div className="p-4 border-b border-slate-100 flex flex-col gap-4 bg-slate-50/50">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                    {/* Search */}
                    <div className="relative w-full md:w-80 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#ed5c37] transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Search across all columns..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium focus:ring-4 focus:ring-[#ed5c37]/5 focus:border-[#ed5c37]/20 outline-none transition-all shadow-sm" 
                        />
                    </div>

                    {/* Module Filter */}
                    {uniqueModules.length > 0 && (
                        <SearchableDropdown
                            label="All Modules"
                            options={uniqueModules}
                            value={moduleFilter}
                            onChange={setModuleFilter}
                        />
                    )}

                    {/* JIRA Ticket Filter */}
                    {uniqueJiraTickets.length > 0 && (
                        <SearchableDropdown
                            label="All JIRA Tickets"
                            options={uniqueJiraTickets}
                            value={jiraFilter}
                            onChange={setJiraFilter}
                        />
                    )}

                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm ml-auto whitespace-nowrap">{filteredCases.length} / {testCases.length} cases</span>
                </div>
            </div>
            
            <div className="overflow-auto flex-1">
                <table className="w-full text-left text-sm relative">
                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold tracking-widest text-slate-500 sticky top-0 z-10 shadow-sm">
                    <tr>
                        {allColumns.map(col => (
                            <th key={col} className="px-4 py-4 whitespace-nowrap bg-slate-50">{col}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredCases.map((tc) => (
                    <tr key={tc._internalId} className="hover:bg-slate-50/80 transition-colors">
                        {allColumns.map(col => (
                            <td key={col} className="px-2 py-2 min-w-[160px]">
                                <CellRenderer 
                                    colName={col}
                                    value={tc[col]}
                                    onChange={(val) => handleCellChange(tc._internalId, col, val)}
                                />
                            </td>
                        ))}
                    </tr>
                    ))}
                    {filteredCases.length === 0 && (
                        <tr>
                            <td colSpan={allColumns.length || 1} className="px-4 py-12 text-center text-slate-400 font-medium text-sm">No test cases match your filter.</td>
                        </tr>
                    )}
                </tbody>
                </table>
            </div>
        </div>
      )}
    </div>
  );
}

// --- Cell Renderer: decides how to render each cell based on column name ---
function CellRenderer({ colName, value, onChange }: { colName: string, value: any, onChange: (val: any) => void }) {
    // Status columns → dropdown
    if (colName === "Dev Status" || colName === "QA Status") {
        return (
            <StatusDropdown 
                value={value as NormalisedStatus} 
                onChange={onChange} 
            />
        );
    }

    // Date columns → date picker
    if (isDateColumn(colName)) {
        const dateVal = formatDateInput(value);
        return (
            <input 
                type="date" 
                value={dateVal}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-1.5 text-sm font-medium text-slate-700 bg-transparent border border-transparent rounded-lg hover:border-slate-200 focus:bg-white focus:border-[#ed5c37] focus:ring-2 focus:ring-[#ed5c37]/20 outline-none transition-all cursor-pointer"
            />
        );
    }

    // JIRA / Link columns → clickable link + editable
    if (isLinkValue(colName)) {
        const strVal = String(value || "").trim();
        const fullUrl = makeJiraUrl(strVal);
        return (
            <div className="flex items-center gap-2">
                <input 
                    type="text" 
                    value={strVal}
                    onChange={(e) => onChange(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm font-semibold text-blue-600 bg-transparent border border-transparent rounded-lg hover:border-slate-200 focus:bg-white focus:border-[#ed5c37] focus:ring-2 focus:ring-[#ed5c37]/20 outline-none transition-all placeholder:text-slate-300"
                    placeholder="e.g. PROJ-123"
                />
                {strVal && (
                    fullUrl ? (
                        <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors shrink-0" title="Open link">
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    ) : (
                        <a 
                            href={`https://www.google.com/search?q=${encodeURIComponent(strVal)}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors shrink-0" 
                            title={`Search: ${strVal}`}
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    )
                )}
            </div>
        );
    }

    // Default → text input
    return (
        <input 
            type="text" 
            value={value || ""} 
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-1.5 text-sm font-medium text-slate-700 bg-transparent border border-transparent rounded-lg hover:border-slate-200 focus:bg-white focus:border-[#ed5c37] focus:ring-2 focus:ring-[#ed5c37]/20 outline-none transition-all placeholder:text-slate-300"
            placeholder={`—`}
        />
    );
}

function StatusDropdown({ value, onChange }: { value: NormalisedStatus, onChange: (val: NormalisedStatus) => void }) {
    return (
        <select 
            value={value} 
            onChange={(e) => onChange(e.target.value as NormalisedStatus)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest border border-transparent outline-none appearance-none cursor-pointer hover:brightness-95 transition-all shadow-sm ${BGS[value]}`}
        >
            <option value="Pass">Pass</option>
            <option value="Fail">Fail</option>
            <option value="TBD">TBD</option>
            <option value="Pending">Pending</option>
            <option value="N/A">N/A</option>
        </select>
    );
}

function DashboardCard({ title, summary, color }: { title: string, summary: any, color: string }) {
    const isQA = title.includes("QA");
    const activeColor = isQA ? "text-[#ed5c37]" : "text-blue-500";
    
    return (
        <div className="premium-card p-6 flex flex-col gap-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: color }} />
            
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                    <p className="text-sm font-medium text-slate-500">{summary.completed} of {summary.total} Completed</p>
                </div>
                <div className="text-right">
                    <div className={`text-3xl font-black ${activeColor}`}>{summary.passRate}%</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pass Rate</div>
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                {summary.Pass > 0 && <div className="bg-green-500 h-full transition-all duration-500" style={{ width: `${(summary.Pass / summary.total) * 100}%` }} />}
                {summary.Fail > 0 && <div className="bg-red-500 h-full transition-all duration-500" style={{ width: `${(summary.Fail / summary.total) * 100}%` }} />}
                {summary.TBD > 0 && <div className="bg-blue-400 h-full transition-all duration-500" style={{ width: `${(summary.TBD / summary.total) * 100}%` }} />}
                {summary.Pending > 0 && <div className="bg-slate-300 h-full transition-all duration-500" style={{ width: `${(summary.Pending / summary.total) * 100}%` }} />}
                {summary['N/A'] > 0 && <div className="bg-yellow-400 h-full transition-all duration-500" style={{ width: `${(summary['N/A'] / summary.total) * 100}%` }} />}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 pt-4 border-t border-slate-100">
                <StatBox label="Pass" count={summary.Pass} color="bg-green-500" text="text-green-700" bg="bg-green-50" />
                <StatBox label="Fail" count={summary.Fail} color="bg-red-500" text="text-red-700" bg="bg-red-50" />
                <StatBox label="TBD" count={summary.TBD} color="bg-blue-400" text="text-blue-700" bg="bg-blue-50" />
                <StatBox label="Pending" count={summary.Pending} color="bg-slate-300" text="text-slate-700" bg="bg-slate-50" />
                <StatBox label="N/A" count={summary['N/A']} color="bg-yellow-400" text="text-yellow-700" bg="bg-yellow-50" />
            </div>
        </div>
    );
}

function StatBox({ label, count, color, text, bg }: { label: string, count: number, color: string, text: string, bg: string }) {
    return (
        <div className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1 ${bg}`}>
            <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${color}`} />
                <span className={`text-2xl font-black leading-none ${text}`}>{count}</span>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-widest opacity-70 ${text}`}>{label}</span>
        </div>
    );
}

function SearchableDropdown({ label, options, value, onChange }: { label: string, options: string[], value: string, onChange: (val: string) => void }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setQuery("");
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()));
    const displayValue = value === "all" ? label : value;
    const isActive = value !== "all";

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => { setOpen(!open); setQuery(""); }}
                className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-sm font-medium transition-all shadow-sm cursor-pointer whitespace-nowrap ${
                    isActive
                        ? "bg-[#ed5c37]/10 border-[#ed5c37]/30 text-[#ed5c37]"
                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
            >
                <Filter className="w-3.5 h-3.5" />
                <span className="max-w-[140px] truncate">{displayValue}</span>
                {isActive && (
                    <span
                        onClick={(e) => { e.stopPropagation(); onChange("all"); setOpen(false); }}
                        className="ml-1 p-0.5 rounded-full hover:bg-[#ed5c37]/20 transition-colors"
                    >
                        ✕
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {/* Search input */}
                    <div className="p-2 border-b border-slate-100">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={`Search ${label.toLowerCase()}...`}
                                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-[#ed5c37]/30 focus:ring-2 focus:ring-[#ed5c37]/10 transition-all"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Options list */}
                    <div className="max-h-52 overflow-y-auto">
                        <button
                            type="button"
                            onClick={() => { onChange("all"); setOpen(false); setQuery(""); }}
                            className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                                value === "all"
                                    ? "bg-[#ed5c37]/5 text-[#ed5c37]"
                                    : "text-slate-600 hover:bg-slate-50"
                            }`}
                        >
                            {label}
                        </button>
                        {filtered.map(opt => (
                            <button
                                type="button"
                                key={opt}
                                onClick={() => { onChange(opt); setOpen(false); setQuery(""); }}
                                className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                                    value === opt
                                        ? "bg-[#ed5c37]/5 text-[#ed5c37]"
                                        : "text-slate-700 hover:bg-slate-50"
                                }`}
                            >
                                {opt}
                            </button>
                        ))}
                        {filtered.length === 0 && (
                            <div className="px-4 py-3 text-sm text-slate-400 text-center">No matches found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
