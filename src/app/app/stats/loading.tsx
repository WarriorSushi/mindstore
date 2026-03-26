export default function StatsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="space-y-1.5">
        <div className="h-7 w-36 bg-white/[0.04] rounded-xl animate-pulse" />
        <div className="h-4 w-52 bg-white/[0.03] rounded-lg animate-pulse" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] animate-pulse" />
              <div className="h-3.5 w-20 bg-white/[0.04] rounded animate-pulse" />
            </div>
            <div className="h-8 w-16 bg-white/[0.05] rounded-lg animate-pulse" />
            <div className="h-2.5 w-28 bg-white/[0.03] rounded animate-pulse" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
        <div className="h-5 w-32 bg-white/[0.04] rounded animate-pulse" />
        <div className="h-48 w-full rounded-xl bg-white/[0.03] animate-pulse" />
      </div>
    </div>
  );
}
