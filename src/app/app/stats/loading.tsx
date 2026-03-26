export default function StatsLoading() {
  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-300">
      <div className="space-y-2">
        <div className="h-7 w-36 bg-white/[0.04] rounded-xl animate-pulse" />
        <div className="h-4 w-72 bg-white/[0.03] rounded-lg animate-pulse" />
      </div>

      <div className="space-y-3">
        <div className="h-4 w-28 bg-white/[0.04] rounded animate-pulse" />
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="h-44 w-full rounded-xl bg-white/[0.03] animate-pulse" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="h-4 w-48 bg-white/[0.04] rounded animate-pulse" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-3.5 h-3.5 rounded bg-white/[0.04] animate-pulse" />
            <div className="h-3 w-16 rounded bg-white/[0.04] animate-pulse" />
            <div className="flex-1 h-[5px] rounded-full bg-white/[0.04]" />
            <div className="h-3 w-8 rounded bg-white/[0.04] animate-pulse" />
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-5 gap-6 md:gap-8">
        <div className="md:col-span-3 space-y-3">
          <div className="h-4 w-24 bg-white/[0.04] rounded animate-pulse" />
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="h-36 w-full rounded-xl bg-white/[0.03] animate-pulse" />
          </div>
        </div>
        <div className="md:col-span-2 space-y-3">
          <div className="h-4 w-32 bg-white/[0.04] rounded animate-pulse" />
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-white/[0.04] animate-pulse shrink-0" />
            <div className="space-y-2 pt-1">
              <div className="h-4 w-32 bg-white/[0.04] rounded animate-pulse" />
              <div className="h-3 w-20 bg-white/[0.04] rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
