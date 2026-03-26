export default function ImportLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="space-y-1.5">
        <div className="h-7 w-28 bg-white/[0.04] rounded-xl animate-pulse" />
        <div className="h-4 w-64 bg-white/[0.03] rounded-lg animate-pulse" />
      </div>

      {/* Drop zone skeleton */}
      <div className="rounded-2xl border-2 border-dashed border-white/[0.08] bg-white/[0.01] p-12 flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] animate-pulse" />
        <div className="h-4 w-48 bg-white/[0.04] rounded-lg animate-pulse" />
        <div className="h-3 w-36 bg-white/[0.03] rounded animate-pulse" />
      </div>

      {/* Import options skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] animate-pulse" />
            <div className="h-4 w-24 bg-white/[0.05] rounded animate-pulse" />
            <div className="h-3 w-full bg-white/[0.03] rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
