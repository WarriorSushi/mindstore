import { Brain } from "lucide-react";

/**
 * App loading skeleton — shown during page transitions.
 * Uses content-aware skeleton blocks instead of a basic spinner.
 */
export default function AppLoading() {
  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-300">
      {/* Header skeleton */}
      <div className="space-y-1.5">
        <div className="h-7 w-48 bg-white/[0.04] rounded-xl animate-pulse" />
        <div className="h-4 w-72 bg-white/[0.03] rounded-lg animate-pulse" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3"
            style={{ animationDelay: `${i * 75}ms` }}
          >
            <div className="w-5 h-5 rounded-lg bg-white/[0.04] animate-pulse" />
            <div className="h-6 w-16 bg-white/[0.05] rounded-lg animate-pulse" />
            <div className="h-3 w-12 bg-white/[0.03] rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Content skeleton — list items */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden divide-y divide-white/[0.04]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3.5"
            style={{ animationDelay: `${300 + i * 50}ms` }}
          >
            <div className="w-8 h-8 rounded-xl bg-white/[0.04] animate-pulse shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-white/[0.04] rounded-lg animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
              <div className="h-2.5 bg-white/[0.03] rounded animate-pulse" style={{ width: `${40 + Math.random() * 40}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Subtle loading indicator */}
      <div className="flex items-center justify-center pt-2">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-teal-500/40 animate-pulse" />
          <span className="text-[11px] text-zinc-700 font-medium">Loading…</span>
        </div>
      </div>
    </div>
  );
}
