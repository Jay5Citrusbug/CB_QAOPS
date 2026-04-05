import { useState, useMemo } from "react";
import { X, Calendar, Clock, BarChart2 } from "lucide-react";

interface DailyStatus {
  id: string;
  projectId: string;
  project: {
    name: string;
  };
  date: string;
  hours: number;
}

interface Project {
  id: string;
  name: string;
  status: string;
}

interface SummaryDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  statuses: DailyStatus[];
  projects: Project[];
}

type TimeFilter = "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM";

export default function SummaryDashboardModal({
  isOpen,
  onClose,
  statuses,
  projects
}: SummaryDashboardModalProps) {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("DAILY");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [projectFilter, setProjectFilter] = useState("ALL");

  const activeProjects = projects.filter(p => p.status === "ACTIVE");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday as start

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const isToday = (d: Date) => d >= today;
  const isThisWeek = (d: Date) => d >= startOfWeek;
  const isThisMonth = (d: Date) => d >= startOfMonth;
  
  const isCustomRange = (d: Date) => {
    if (!customStartDate || !customEndDate) return true;
    const start = new Date(customStartDate);
    start.setHours(0,0,0,0);
    const end = new Date(customEndDate);
    end.setHours(23,59,59,999);
    return d >= start && d <= end;
  };

  const getTimeFilteredStatuses = (s: DailyStatus[], filter: TimeFilter) => {
    return s.filter(st => {
      const d = new Date(st.date);
      d.setHours(0,0,0,0);
      switch(filter) {
        case "DAILY": return d.getTime() === today.getTime();
        case "WEEKLY": return isThisWeek(d);
        case "MONTHLY": return isThisMonth(d);
        case "CUSTOM": return isCustomRange(d);
        default: return true;
      }
    });
  };

  const formatHours = (decimalHours: number) => {
    const h = Math.floor(decimalHours);
    const m = Math.round((decimalHours - h) * 60);
    if (m === 0) return `${h}h`;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  const projectFilteredStatuses = useMemo(() => {
    if (projectFilter === "ALL") return statuses;
    return statuses.filter(s => s.projectId === projectFilter);
  }, [statuses, projectFilter]);

  const cardsData = useMemo(() => {
     let todayHours = 0;
     let weekHours = 0;
     let monthHours = 0;
     let customHours = 0;

     projectFilteredStatuses.forEach(s => {
       const d = new Date(s.date);
       d.setHours(0,0,0,0);
       const t = d.getTime();
       const h = Number(s.hours) || 0;

       if (t === today.getTime()) todayHours += h;
       if (isThisWeek(d)) weekHours += h;
       if (isThisMonth(d)) monthHours += h;
       if (timeFilter === "CUSTOM" && isCustomRange(d)) customHours += h;
     });

     return { todayHours, weekHours, monthHours, customHours };
  }, [projectFilteredStatuses, timeFilter, customStartDate, customEndDate]);

  const tableData = useMemo(() => {
     const timeFiltered = getTimeFilteredStatuses(projectFilteredStatuses, timeFilter);
     
     const projectMap: Record<string, {name: string, hours: number}> = {};
     
     timeFiltered.forEach(s => {
        if (!projectMap[s.projectId]) {
           projectMap[s.projectId] = { name: s.project.name, hours: 0 };
        }
        projectMap[s.projectId].hours += Number(s.hours) || 0;
     });

     return Object.values(projectMap).sort((a,b) => b.hours - a.hours);
  }, [projectFilteredStatuses, timeFilter, customStartDate, customEndDate]);


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[60] flex items-center justify-center p-6 animate-in fade-in duration-400">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#ed5c37]/10 text-[#ed5c37] rounded-2xl flex items-center justify-center">
              <BarChart2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Status Summary</h2>
              <p className="text-sm font-medium text-slate-500">Project Wise Hour Summary</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"><X className="w-6 h-6" /></button>
        </div>

        <div className="p-8 overflow-y-auto space-y-8 flex-1">
          {/* Filters Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
             <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-fit">
               {(["DAILY", "WEEKLY", "MONTHLY", "CUSTOM"] as TimeFilter[]).map(tf => (
                 <button 
                   key={tf}
                   onClick={() => setTimeFilter(tf)}
                   className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${timeFilter === tf ? 'bg-slate-100 text-[#ed5c37]' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                 >
                   {tf.charAt(0) + tf.slice(1).toLowerCase()}
                 </button>
               ))}
             </div>

             <div className="flex items-center gap-4">
               {timeFilter === "CUSTOM" && (
                 <div className="flex items-center gap-2">
                   <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#ed5c37]/20" />
                   <span className="text-slate-400 font-medium text-sm">to</span>
                   <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#ed5c37]/20" />
                 </div>
               )}

               <div className="relative min-w-[200px]">
                 <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 text-sm font-semibold text-slate-700 rounded-xl appearance-none focus:ring-4 focus:ring-[#ed5c37]/10 focus:border-[#ed5c37]/40 outline-none transition-all shadow-sm">
                   <option value="ALL">All Projects</option>
                   {activeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                 </select>
               </div>
             </div>
          </div>

          {/* Summary Cards */}
          <div className={`grid grid-cols-1 md:grid-cols-3 ${timeFilter === 'CUSTOM' ? 'lg:grid-cols-4' : ''} gap-4`}>
             <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Today</span>
                <div className="text-3xl font-black text-slate-900">{formatHours(cardsData.todayHours)}</div>
             </div>
             <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> This Week</span>
                <div className="text-3xl font-black text-slate-900">{formatHours(cardsData.weekHours)}</div>
             </div>
             <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> This Month</span>
                <div className="text-3xl font-black text-slate-900">{formatHours(cardsData.monthHours)}</div>
             </div>
             {timeFilter === 'CUSTOM' && (
               <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-2 ring-2 ring-[#ed5c37]/10">
                  <span className="text-xs font-bold text-[#ed5c37] uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Custom Range</span>
                  <div className="text-3xl font-black text-[#ed5c37]">{formatHours(cardsData.customHours)}</div>
               </div>
             )}
          </div>

          {/* Project-wise Summary Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
             <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800">Hours by Project</h3>
                <p className="text-xs font-medium text-slate-500 mt-0.5">Based on <span className="font-bold text-[#ed5c37]">{timeFilter.toLowerCase()}</span> time filter</p>
             </div>
             {tableData.length === 0 ? (
               <div className="p-8 text-center text-slate-500 text-sm font-medium">No hours logged for this selection.</div>
             ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase font-bold tracking-widest text-slate-400">
                     <tr>
                        <th className="px-6 py-3">Project Name</th>
                        <th className="px-6 py-3 text-right">Total Hours Spent</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {tableData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                           <td className="px-6 py-4 font-semibold text-slate-700">{row.name}</td>
                           <td className="px-6 py-4 text-right">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 rounded-full font-bold text-sm">
                                 <Clock className="w-3.5 h-3.5 text-slate-400" />
                                 {formatHours(row.hours)}
                              </span>
                           </td>
                        </tr>
                     ))}
                  </tbody>
                </table>
             )}
          </div>

        </div>
      </div>
    </div>
  );
}
