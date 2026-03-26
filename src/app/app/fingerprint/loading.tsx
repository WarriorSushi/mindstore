export default function FingerprintLoading() {
  return (
    <div className="space-y-5 md:space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="h-7 w-56 bg-white/[0.04] rounded-xl animate-pulse" />
          <div className="h-4 w-64 bg-white/[0.03] rounded-lg animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-36 rounded-xl bg-white/[0.04] animate-pulse" />
          <div className="h-8 w-8 rounded-xl bg-white/[0.04] animate-pulse" />
        </div>
      </div>

      {/* 3D canvas placeholder */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center" style={{ height: 'calc(100dvh - 220px)', minHeight: '400px' }}>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-teal-500/40 border-t-teal-400 animate-spin" />
          <div className="h-3 w-32 bg-white/[0.03] rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
