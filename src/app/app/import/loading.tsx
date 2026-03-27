export default function ImportLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header skeleton */}
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <div className="h-7 w-24 bg-white/[0.04] rounded-xl animate-pulse" />
          <div className="h-4 w-56 bg-white/[0.03] rounded-lg animate-pulse" />
        </div>
        <div className="text-right space-y-1.5">
          <div className="h-6 w-16 bg-white/[0.04] rounded-lg animate-pulse ml-auto" />
          <div className="h-3 w-14 bg-white/[0.03] rounded animate-pulse ml-auto" />
        </div>
      </div>

      {/* Source selector skeleton */}
      <div className="space-y-4">
        {["Quick Import", "Note Apps"].map((label) => (
          <div key={label} className="space-y-2">
            <div className="h-3 w-20 bg-white/[0.03] rounded animate-pulse" />
            <div className="flex gap-2">
              {Array.from({ length: label === "Quick Import" ? 4 : 2 }).map((_, i) => (
                <div key={i} className="h-10 w-28 rounded-xl bg-white/[0.03] border border-white/[0.04] animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Tab content skeleton — drop zone */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
        <div className="space-y-3 mb-4">
          <div className="h-4 w-48 bg-white/[0.04] rounded-lg animate-pulse" />
          <div className="h-3 w-80 bg-white/[0.03] rounded animate-pulse" />
        </div>
        <div className="rounded-2xl border-2 border-dashed border-white/[0.08] bg-white/[0.01] py-16 flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.04] animate-pulse" />
          <div className="h-4 w-48 bg-white/[0.04] rounded-lg animate-pulse" />
          <div className="h-3 w-36 bg-white/[0.03] rounded animate-pulse" />
        </div>
      </div>

      {/* Import history skeleton */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <div className="h-3 w-24 bg-white/[0.03] rounded animate-pulse" />
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden divide-y divide-white/[0.04]">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-xl bg-white/[0.04] animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-40 bg-white/[0.04] rounded animate-pulse" />
                <div className="h-2.5 w-24 bg-white/[0.03] rounded animate-pulse" />
              </div>
              <div className="h-3 w-14 bg-white/[0.03] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
