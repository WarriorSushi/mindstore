"use client";

import { Brain, GitBranch, Type } from "lucide-react";

interface SearchStatsProps {
  resultCount: number;
  durationMs: number | null;
  layers: {
    bm25: number;
    vector: number;
    tree: number;
  } | null;
}

/**
 * Shows "X results in Yms" after each search + layer breakdown.
 */
export function SearchStats({
  resultCount,
  durationMs,
  layers,
}: SearchStatsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] text-teal-400/80 font-semibold tabular-nums">
        {resultCount} result{resultCount !== 1 ? "s" : ""}
        {durationMs !== null && (
          <span className="text-zinc-600 font-normal ml-1">
            in {durationMs}ms
          </span>
        )}
      </span>

      {layers && (layers.bm25 > 0 || layers.vector > 0 || layers.tree > 0) && (
        <>
          <span className="w-[3px] h-[3px] rounded-full bg-zinc-700" />
          <span className="text-[10px] text-zinc-600 font-medium">via</span>
          <div className="flex items-center gap-1.5">
            {layers.bm25 > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg font-medium bg-blue-500/10 text-blue-400 border border-blue-500/10">
                <Type className="w-2.5 h-2.5" /> Keyword{" "}
                <span className="text-[9px] opacity-60 ml-0.5">
                  {layers.bm25}
                </span>
              </span>
            )}
            {layers.vector > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg font-medium bg-teal-500/10 text-teal-400 border border-teal-500/10">
                <Brain className="w-2.5 h-2.5" /> Semantic{" "}
                <span className="text-[9px] opacity-60 ml-0.5">
                  {layers.vector}
                </span>
              </span>
            )}
            {layers.tree > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">
                <GitBranch className="w-2.5 h-2.5" /> Structure{" "}
                <span className="text-[9px] opacity-60 ml-0.5">
                  {layers.tree}
                </span>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
