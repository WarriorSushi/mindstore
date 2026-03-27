export default function PluginsLoading() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="h-7 w-24 bg-white/[0.04] rounded-xl animate-pulse" />
          <div className="h-4 w-56 bg-white/[0.03] rounded-lg animate-pulse" />
        </div>
        {/* Search skeleton */}
        <div className="h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] animate-pulse" />
      </div>

      {/* Category pills skeleton */}
      <div className="flex gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-[30px] rounded-full bg-white/[0.03] animate-pulse"
            style={{ width: `${56 + i * 8}px` }}
          />
        ))}
      </div>

      {/* Featured spotlight skeleton */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-white/[0.04] animate-pulse" />
          <div className="h-4 w-16 bg-white/[0.04] rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/[0.04] animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-24 bg-white/[0.05] rounded animate-pulse" />
                  <div className="h-3 w-14 bg-white/[0.03] rounded animate-pulse" />
                </div>
              </div>
              <div className="h-3 w-full bg-white/[0.03] rounded animate-pulse" />
              <div className="h-3 w-2/3 bg-white/[0.02] rounded animate-pulse" />
              <div className="h-8 w-16 rounded-lg bg-white/[0.04] animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Category section skeleton */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-white/[0.04] animate-pulse" />
          <div className="h-4 w-20 bg-white/[0.04] rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] animate-pulse" />
              </div>
              <div className="h-4 w-28 bg-white/[0.05] rounded animate-pulse" />
              <div className="space-y-1.5">
                <div className="h-3 w-full bg-white/[0.03] rounded animate-pulse" />
                <div className="h-3 w-3/4 bg-white/[0.02] rounded animate-pulse" />
              </div>
              <div className="flex gap-2 pt-2 border-t border-white/[0.03]">
                <div className="h-5 w-14 rounded-md bg-white/[0.03] animate-pulse" />
                <div className="h-5 w-16 rounded-md bg-white/[0.03] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
