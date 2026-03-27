"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSourceType } from "@/lib/source-types";
import { openMemoryDrawer } from "@/components/MemoryDrawer";

interface Source {
  title: string;
  type: string;
  score?: number;
  id?: string;
  preview?: string;
  content?: string;
}

export function SourceCards({
  sources,
  highlightedIndex,
}: {
  sources: Source[];
  highlightedIndex?: number | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayed = expanded ? sources : sources.slice(0, 3);

  const handleOpenMemory = (s: Source, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (s.id) {
      openMemoryDrawer({
        id: s.id,
        content: s.content || s.preview || "",
        source: s.type,
        sourceId: "",
        sourceTitle: s.title || "Untitled",
        timestamp: "",
        importedAt: "",
        metadata: {},
        pinned: false,
      });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.08em]">
          Sources · {sources.length}
        </span>
        {sources.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-0.5 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {expanded ? "Less" : `+${sources.length - 3} more`}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {displayed.map((s, j) => {
          const st = getSourceType(s.type);
          const Icon = st.icon;
          const scorePercent = s.score != null ? Math.round(s.score * 100) : null;
          const isClickable = !!s.id;
          const isHighlighted = highlightedIndex != null && j === highlightedIndex;

          return (
            <div
              key={j}
              data-source-index={j}
              onClick={isClickable ? (e) => handleOpenMemory(s, e) : undefined}
              className={cn(
                "flex flex-col gap-1.5 px-3 py-2.5 rounded-xl border transition-all duration-200",
                isHighlighted
                  ? "bg-teal-500/[0.08] border-teal-500/20 ring-1 ring-teal-500/15"
                  : isClickable
                    ? "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.1] cursor-pointer"
                    : "bg-white/[0.02] border-white/[0.06]"
              )}
            >
              {/* Header row */}
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-[10px] font-bold rounded-md w-5 h-5 flex items-center justify-center shrink-0 tabular-nums transition-colors",
                    isHighlighted
                      ? "bg-teal-500/20 text-teal-300"
                      : "bg-white/[0.06] text-zinc-500"
                  )}
                >
                  {j + 1}
                </span>
                <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${st.bgColor}`}>
                  <Icon className={`w-3 h-3 ${st.textColor}`} />
                </div>
                <span
                  className={cn(
                    "text-[12px] truncate flex-1 min-w-0 font-medium transition-colors",
                    isHighlighted ? "text-zinc-200" : "text-zinc-400"
                  )}
                >
                  {s.title || "Untitled"}
                </span>
                {scorePercent != null && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="w-10 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-teal-500/60 transition-all"
                        style={{ width: `${Math.max(scorePercent, 8)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-600 tabular-nums font-mono w-6 text-right">
                      {scorePercent}%
                    </span>
                  </div>
                )}
              </div>
              {/* Content preview */}
              {s.preview && (
                <p className="text-[11px] text-zinc-600 leading-relaxed line-clamp-2 pl-7">
                  {s.preview}
                  {s.preview.length >= 118 ? "…" : ""}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Context indicator badge — shows how many memories are being used */
export function ContextIndicator({
  count,
  sources,
}: {
  count: number;
  sources?: Source[];
}) {
  const [expanded, setExpanded] = useState(false);

  if (count === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-medium transition-all",
          "border",
          expanded
            ? "bg-teal-500/10 border-teal-500/20 text-teal-300"
            : "bg-white/[0.03] border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.1]"
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
        Using {count} {count === 1 ? "memory" : "memories"} as context
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && sources && sources.length > 0 && (
        <div className="absolute top-full left-0 mt-2 w-80 max-h-64 overflow-y-auto rounded-xl bg-[#111113]/95 backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/60 z-50 p-3">
          <SourceCards sources={sources} />
        </div>
      )}
    </div>
  );
}
