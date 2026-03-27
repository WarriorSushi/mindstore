export default function ExploreLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="space-y-1">
        <div className="h-7 w-28 bg-white/[0.04] rounded-xl animate-pulse" />
        <div className="h-4 w-48 bg-white/[0.03] rounded-lg animate-pulse" />
      </div>

      {/* Search bar skeleton */}
      <div className="h-11 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />

      {/* Filter chips skeleton */}
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 rounded-xl bg-white/[0.03] animate-pulse shrink-0" style={{ width: `${48 + i * 16}px` }} />
        ))}
      </div>

      {/* Memory list skeleton */}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-14 h-5 rounded-lg bg-white/[0.06] animate-pulse" />
              <div className="flex-1 h-4 rounded-lg bg-white/[0.04] animate-pulse" />
              <div className="w-12 h-3.5 rounded-lg bg-white/[0.03] animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 rounded-lg bg-white/[0.04] animate-pulse w-full" />
              <div className="h-4 rounded-lg bg-white/[0.03] animate-pulse w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
