"use client";

interface SearchLayers {
  bm25: number;
  vector: number;
  tree: number;
}

interface SearchStatsProps {
  resultCount: number;
  durationMs: number | null;
  layers: SearchLayers | null;
}

export function SearchStats({ resultCount, durationMs, layers }: SearchStatsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] text-teal-400/80 font-semibold tabular-nums">
        {resultCount} result{resultCount !== 1 ? "s" : ""}
      </span>
      {typeof durationMs === "number" && (
        <>
          <span className="w-[3px] h-[3px] rounded-full bg-zinc-700" />
          <span className="text-[10px] text-zinc-600 font-medium">
            {Math.max(1, Math.round(durationMs))} ms
          </span>
        </>
      )}
      {layers && (
        <>
          <span className="w-[3px] h-[3px] rounded-full bg-zinc-700" />
          <span className="text-[10px] text-zinc-600 font-medium">via</span>
          <div className="flex items-center gap-1.5">
            {layers.bm25 > 0 && (
              <span className="inline-flex items-center gap-1 text-[9px] px-2 py-[3px] rounded-lg font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/15">
                Keyword <span className="text-[8px] opacity-60 ml-0.5">{layers.bm25}</span>
              </span>
            )}
            {layers.vector > 0 && (
              <span className="inline-flex items-center gap-1 text-[9px] px-2 py-[3px] rounded-lg font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/15">
                Semantic <span className="text-[8px] opacity-60 ml-0.5">{layers.vector}</span>
              </span>
            )}
            {layers.tree > 0 && (
              <span className="inline-flex items-center gap-1 text-[9px] px-2 py-[3px] rounded-lg font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                Structure <span className="text-[8px] opacity-60 ml-0.5">{layers.tree}</span>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
