export default function FingerprintLoading() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-7 w-52 bg-white/[0.04] rounded-xl animate-pulse" />
          <div className="h-4 w-72 bg-white/[0.03] rounded-lg animate-pulse" />
        </div>
        <div className="h-9 w-9 rounded-xl bg-white/[0.04] animate-pulse" />
      </div>

      {/* 3D canvas placeholder */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] min-h-[500px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-teal-500/40 border-t-teal-400 animate-spin" />
          </div>
          <div className="h-3 w-40 bg-white/[0.03] rounded animate-pulse" />
        </div>
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
            <div className="h-3 w-16 bg-white/[0.04] rounded animate-pulse" />
            <div className="h-6 w-12 bg-white/[0.05] rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
