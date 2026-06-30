export default function ProjectLoading() {
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
          <div key={i} className="p-4 flex flex-col justify-between h-28 bg-white border border-slate-200 rounded-2xl">
            <div className="h-3 w-16 bg-slate-200 rounded" />
            <div className="h-8 w-12 bg-slate-300 rounded" />
            <div className="h-2 w-8 bg-slate-100 rounded" />
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="overflow-hidden border border-slate-200 rounded-3xl bg-white">
        <div className="bg-slate-50 border-b border-slate-100 h-12 w-full flex items-center px-6 gap-4">
          {[...Array(6)].map((_, idx) => (
            <div key={idx} className="h-4 w-24 bg-slate-200 rounded" />
          ))}
        </div>
        <div className="p-6 space-y-4">
          {[...Array(5)].map((_, idx) => (
            <div key={idx} className="flex gap-4 items-center">
              {[...Array(6)].map((_, cIdx) => (
                <div key={cIdx} className="h-10 bg-slate-50 border border-slate-100 rounded-xl flex-1" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
