export default function SettingsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="h-7 w-32 bg-white/[0.04] rounded-xl animate-pulse" />
        <div className="h-4 w-64 bg-white/[0.03] rounded-lg animate-pulse" />
      </div>

      {/* Tab bar skeleton */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 h-9 rounded-lg bg-white/[0.04] animate-pulse" />
        ))}
      </div>

      {/* Provider cards skeleton */}
      <div className="space-y-3">
        <div className="h-3 w-24 bg-white/[0.04] rounded animate-pulse" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/[0.04] animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-28 bg-white/[0.05] rounded animate-pulse" />
                  <div className="h-4 w-12 rounded-md bg-white/[0.04] animate-pulse" />
                </div>
                <div className="h-3 w-48 bg-white/[0.03] rounded animate-pulse" />
              </div>
              <div className="w-4 h-4 bg-white/[0.03] rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
