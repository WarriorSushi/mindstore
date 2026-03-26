/**
 * Reusable loading skeleton layouts for route pages.
 * Import the appropriate variant in each route's loading.tsx.
 */

/* ─── Base shimmer ─── */
const s = "bg-white/[0.04] animate-pulse rounded-lg";
const s2 = "bg-white/[0.03] animate-pulse rounded";
const card = "rounded-2xl border border-white/[0.06] bg-white/[0.02]";

/* ─── List page skeleton ─── */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="space-y-1.5">
        <div className={`h-7 w-44 ${s} rounded-xl`} />
        <div className={`h-4 w-64 ${s2}`} />
      </div>
      <div className={`h-11 ${s} rounded-2xl border border-white/[0.06]`} />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={`${card} p-4 flex items-start gap-3`}>
            <div className={`w-9 h-9 rounded-xl ${s} shrink-0`} />
            <div className="flex-1 space-y-2">
              <div className={`h-4 ${s}`} style={{ width: `${55 + (i * 7) % 35}%` }} />
              <div className={`h-3 ${s2}`} style={{ width: `${70 + (i * 11) % 25}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Grid page skeleton (collections, domains, etc.) ─── */
export function GridSkeleton({ cols = 3, items = 6 }: { cols?: number; items?: number }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="space-y-1.5">
        <div className={`h-7 w-40 ${s} rounded-xl`} />
        <div className={`h-4 w-56 ${s2}`} />
      </div>
      <div className={`grid gap-3 grid-cols-1 sm:grid-cols-2 ${cols >= 3 ? "lg:grid-cols-3" : ""}`}>
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} className={`${card} p-5 space-y-3`}>
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl ${s} shrink-0`} />
              <div className={`h-4 flex-1 ${s}`} />
            </div>
            <div className={`h-3 ${s2}`} style={{ width: "85%" }} />
            <div className={`h-3 ${s2}`} style={{ width: "60%" }} />
            <div className="flex gap-2 pt-1">
              <div className={`h-5 w-12 rounded-md ${s}`} />
              <div className={`h-5 w-16 rounded-md ${s}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Analytics / stats page skeleton ─── */
export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="space-y-1.5">
        <div className={`h-7 w-48 ${s} rounded-xl`} />
        <div className={`h-4 w-64 ${s2}`} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`${card} p-4 space-y-2.5`}>
            <div className={`w-5 h-5 rounded-lg ${s}`} />
            <div className={`h-6 w-14 ${s}`} />
            <div className={`h-3 w-20 ${s2}`} />
          </div>
        ))}
      </div>
      <div className={`${card} p-5 space-y-4`}>
        <div className={`h-5 w-32 ${s}`} />
        <div className={`h-48 ${s} rounded-xl`} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2].map((i) => (
          <div key={i} className={`${card} p-5 space-y-3`}>
            <div className={`h-5 w-28 ${s}`} />
            <div className="space-y-2">
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-lg ${s} shrink-0`} />
                  <div className={`flex-1 h-3 ${s2}`} />
                  <div className={`h-3 w-8 ${s2}`} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Canvas / visualization skeleton ─── */
export function CanvasSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="space-y-1.5">
        <div className={`h-7 w-40 ${s} rounded-xl`} />
        <div className={`h-4 w-56 ${s2}`} />
      </div>
      <div className={`${card} aspect-[16/9] flex items-center justify-center`}>
        <div className={`w-12 h-12 rounded-2xl ${s}`} />
      </div>
    </div>
  );
}

/* ─── Form / settings skeleton ─── */
export function FormSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="space-y-1.5">
        <div className={`h-7 w-36 ${s} rounded-xl`} />
        <div className={`h-4 w-52 ${s2}`} />
      </div>
      {Array.from({ length: sections }).map((_, i) => (
        <div key={i} className={`${card} p-5 space-y-4`}>
          <div className={`h-5 w-32 ${s}`} />
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className={`h-3 w-20 ${s2}`} />
              <div className={`h-10 ${s} rounded-xl border border-white/[0.06]`} />
            </div>
            <div className="space-y-1.5">
              <div className={`h-3 w-24 ${s2}`} />
              <div className={`h-10 ${s} rounded-xl border border-white/[0.06]`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
