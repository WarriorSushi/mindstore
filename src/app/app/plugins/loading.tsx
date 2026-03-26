export default function PluginsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="h-7 w-32 bg-white/[0.04] rounded-xl animate-pulse" />
        <div className="h-4 w-60 bg-white/[0.03] rounded-lg animate-pulse" />
      </div>

      {/* Search + filter skeleton */}
      <div className="flex gap-3">
        <div className="flex-1 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] animate-pulse" />
        <div className="h-10 w-24 rounded-xl bg-white/[0.04] animate-pulse" />
      </div>

      {/* Plugin grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/[0.04] animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-28 bg-white/[0.05] rounded animate-pulse" />
                <div className="h-3 w-20 bg-white/[0.03] rounded animate-pulse" />
              </div>
            </div>
            <div className="h-3 w-full bg-white/[0.03] rounded animate-pulse" />
            <div className="h-3 w-3/4 bg-white/[0.02] rounded animate-pulse" />
            <div className="flex gap-1.5">
              <div className="h-5 w-14 rounded-full bg-white/[0.03] animate-pulse" />
              <div className="h-5 w-16 rounded-full bg-white/[0.03] animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
