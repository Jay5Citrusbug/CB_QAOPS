"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart2, Calendar, Clock } from "lucide-react";

interface DailyStatus {
  id: string;
  projectId: string;
  project: { name: string };
  date: string;
  hours: number;
}

interface Project {
  id: string;
  name: string;
  status: string;
}

type TimeFilter = "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM";

function formatHours(decimalHours: number) {
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export default function StatusSummaryPage() {
  const router = useRouter();
  const [statuses, setStatuses] = useState<DailyStatus[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("DAILY");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [projectFilter, setProjectFilter] = useState("ALL");

  useEffect(() => {
    Promise.all([
      fetch("/api/daily-status").then(r => r.json()),
      fetch("/api/projects").then(r => r.json()),
    ]).then(([s, p]) => {
      setStatuses(s);
      setProjects(p);
    });
  }, []);

  const activeProjects = projects.filter(p => p.status === "ACTIVE");

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const startOfWeek = useMemo(() => {
    const d = new Date(today);
    d.setDate(today.getDate() - today.getDay());
    return d;
  }, [today]);

  const startOfMonth = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);

  const isCustomRange = (d: Date) => {
    if (!customStartDate || !customEndDate) return true;
    const start = new Date(customStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(customEndDate);
    end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
  };

  const projectFilteredStatuses = useMemo(() => {
    if (projectFilter === "ALL") return statuses;
    return statuses.filter(s => s.projectId === projectFilter);
  }, [statuses, projectFilter]);

  const cardsData = useMemo(() => {
    let todayHours = 0, weekHours = 0, monthHours = 0, customHours = 0;
    projectFilteredStatuses.forEach(s => {
      const d = new Date(s.date);
      d.setHours(0, 0, 0, 0);
      const h = Number(s.hours) || 0;
      if (d.getTime() === today.getTime()) todayHours += h;
      if (d >= startOfWeek) weekHours += h;
      if (d >= startOfMonth) monthHours += h;
      if (isCustomRange(d)) customHours += h;
    });
    return { todayHours, weekHours, monthHours, customHours };
  }, [projectFilteredStatuses, today, startOfWeek, startOfMonth, customStartDate, customEndDate]);

  const tableData = useMemo(() => {
    const filtered = projectFilteredStatuses.filter(s => {
      const d = new Date(s.date);
      d.setHours(0, 0, 0, 0);
      switch (timeFilter) {
        case "DAILY": return d.getTime() === today.getTime();
        case "WEEKLY": return d >= startOfWeek;
        case "MONTHLY": return d >= startOfMonth;
        case "CUSTOM": return isCustomRange(d);
      }
    });
    const map: Record<string, { name: string; hours: number }> = {};
    filtered.forEach(s => {
      if (!map[s.projectId]) map[s.projectId] = { name: s.project.name, hours: 0 };
      map[s.projectId].hours += Number(s.hours) || 0;
    });
    return Object.values(map).sort((a, b) => b.hours - a.hours);
  }, [projectFilteredStatuses, timeFilter, today, startOfWeek, startOfMonth, customStartDate, customEndDate]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#ed5c37]/10 text-[#ed5c37] rounded-2xl flex items-center justify-center shrink-0">
              <BarChart2 className="w-6 h-6" />
            </div>
            <div className="page-header !mb-0">
              <h1 className="page-title">Status Summary</h1>
              <p className="page-desc">Project Wise Hour Summary</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="premium-card flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Time Filter Tabs */}
        <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200 w-fit">
          {(["DAILY", "WEEKLY", "MONTHLY", "CUSTOM"] as TimeFilter[]).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeFilter(tf)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                timeFilter === tf
                  ? "bg-white text-[#ed5c37] shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tf.charAt(0) + tf.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Custom Date Pickers */}
          {timeFilter === "CUSTOM" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-4 focus:ring-[#ed5c37]/10 focus:border-[#ed5c37]/30 transition-all"
              />
              <span className="text-slate-400 font-medium text-sm">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-4 focus:ring-[#ed5c37]/10 focus:border-[#ed5c37]/30 transition-all"
              />
            </div>
          )}

          {/* Project Filter */}
          <div className="relative min-w-[200px]">
            <select
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 rounded-xl appearance-none focus:ring-4 focus:ring-[#ed5c37]/10 focus:border-[#ed5c37]/30 outline-none transition-all shadow-sm"
            >
              <option value="ALL">All Projects</option>
              {activeProjects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className={`grid grid-cols-1 sm:grid-cols-3 ${timeFilter === "CUSTOM" ? "lg:grid-cols-4" : ""} gap-4`}>
        {[
          { label: "Today", hours: cardsData.todayHours, active: timeFilter === "DAILY" },
          { label: "This Week", hours: cardsData.weekHours, active: timeFilter === "WEEKLY" },
          { label: "This Month", hours: cardsData.monthHours, active: timeFilter === "MONTHLY" },
          ...(timeFilter === "CUSTOM"
            ? [{ label: "Custom Range", hours: cardsData.customHours, active: true, custom: true }]
            : []),
        ].map(card => (
          <div
            key={card.label}
            className={`premium-card space-y-3 transition-all ${
              (card as any).custom
                ? "ring-2 ring-[#ed5c37]/20 border-[#ed5c37]/20"
                : card.active
                ? "ring-2 ring-slate-200"
                : ""
            }`}
          >
            <span className={`text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 ${(card as any).custom ? "text-[#ed5c37]" : "text-slate-400"}`}>
              <Calendar className="w-3.5 h-3.5" /> {card.label}
            </span>
            <div className={`text-4xl font-black ${(card as any).custom ? "text-[#ed5c37]" : "text-slate-900"}`}>
              {formatHours(card.hours)}
            </div>
          </div>
        ))}
      </div>

      {/* Project-wise Table */}
      <div className="premium-card !p-0 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-bold text-slate-800">Hours by Project</h3>
          <p className="text-xs font-medium text-slate-500 mt-0.5">
            Based on <span className="font-bold text-[#ed5c37]">{timeFilter.charAt(0) + timeFilter.slice(1).toLowerCase()}</span> filter
          </p>
        </div>

        {tableData.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Clock className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-500">No hours logged for this selection.</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or time range.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase font-bold tracking-widest text-slate-400">
              <tr>
                <th className="px-6 py-4">Project Name</th>
                <th className="px-6 py-4 text-right">Total Hours Spent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableData.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px] uppercase">
                        {row.name.substring(0, 2)}
                      </div>
                      <span className="font-semibold text-slate-700">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full font-bold text-sm">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {formatHours(row.hours)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td className="px-6 py-4 font-black text-slate-800 text-sm">Grand Total</td>
                <td className="px-6 py-4 text-right">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ed5c37] text-white rounded-full font-black text-sm shadow">
                    <Clock className="w-3.5 h-3.5" />
                    {formatHours(tableData.reduce((acc, r) => acc + r.hours, 0))}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
