export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-2">
          <div className="h-8 bg-slate-200 rounded-xl w-48 animate-pulse" />
          <div className="h-4 bg-slate-100 rounded-lg w-64 animate-pulse" />
        </div>
      </div>

      {/* KPI Cards Skeletons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-4 animate-pulse">
            <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-2 bg-slate-200 rounded w-16" />
              <div className="h-4 bg-slate-200 rounded w-8" />
            </div>
          </div>
        ))}
      </div>

      {/* Row 1 Skeletons (Two Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm min-h-[380px] flex flex-col justify-between animate-pulse">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="h-4 bg-slate-200 rounded w-32" />
              <div className="h-3 bg-slate-100 rounded w-16" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map(idx => (
                <div key={idx} className="h-16 bg-slate-50 border border-slate-100 rounded-2xl" />
              ))}
            </div>
          </div>
          <div className="h-8 bg-slate-50 rounded-xl w-24 mx-auto" />
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm min-h-[380px] flex flex-col justify-between animate-pulse">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="h-4 bg-slate-200 rounded w-32" />
              <div className="h-3 bg-slate-100 rounded w-16" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map(idx => (
                <div key={idx} className="h-16 bg-slate-50 border border-slate-100 rounded-2xl" />
              ))}
            </div>
          </div>
          <div className="h-8 bg-slate-50 rounded-xl w-24 mx-auto" />
        </div>
      </div>

      {/* Quick Access Skeleton */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm animate-pulse space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-100 shrink-0" />
            <div className="space-y-1.5">
              <div className="h-3 bg-slate-200 rounded w-24" />
              <div className="h-2 bg-slate-100 rounded w-32" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(idx => (
            <div key={idx} className="h-24 bg-slate-50 border border-slate-100 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
