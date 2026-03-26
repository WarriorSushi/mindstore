export default function ExploreLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="h-7 w-36 bg-white/[0.04] rounded-xl animate-pulse" />
        <div className="h-4 w-56 bg-white/[0.03] rounded-lg animate-pulse" />
      </div>

      {/* Search bar skeleton */}
      <div className="h-11 rounded-2xl bg-white/[0.04] border border-white/[0.06] animate-pulse" />

      {/* Filter chips skeleton */}
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 rounded-xl bg-white/[0.03] animate-pulse" style={{ width: `${50 + i * 12}px` }} />
        ))}
      </div>

      {/* Memory list skeleton */}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/[0.04] animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-5 w-14 rounded-md bg-white/[0.05] animate-pulse" />
                <div className="h-3.5 w-32 bg-white/[0.04] rounded animate-pulse" />
              </div>
              <div className="h-3 w-full bg-white/[0.03] rounded animate-pulse" />
              <div className="h-3 w-4/5 bg-white/[0.02] rounded animate-pulse" />
            </div>
            <div className="h-3 w-12 bg-white/[0.03] rounded animate-pulse shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
