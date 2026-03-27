"use client";

import { Check, Pin, Tag } from "lucide-react";
import { getSourceType } from "@/lib/source-types";
import { HighlightedText } from "./HighlightMatches";

interface TagData {
  id: string;
  name: string;
  color: string;
}

interface SearchResultCardProps {
  id: string;
  content: string;
  source: string;
  sourceTitle: string;
  timestamp: string;
  score?: number;
  pinned?: boolean;
  tags?: TagData[];
  layers?: Record<string, any>;
  query: string;
  isFocused: boolean;
  isSelected: boolean;
  selectMode: boolean;
  viewMode: "list" | "compact";
  onClick: () => void;
}

const TAG_COLOR_MAP: Record<string, string> = {
  teal: "text-teal-400 bg-teal-500/10 border-teal-500/15",
  sky: "text-sky-400 bg-sky-500/10 border-sky-500/15",
  emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/15",
  amber: "text-amber-400 bg-amber-500/10 border-amber-500/15",
  red: "text-red-400 bg-red-500/10 border-red-500/15",
  blue: "text-blue-400 bg-blue-500/10 border-blue-500/15",
  orange: "text-orange-400 bg-orange-500/10 border-orange-500/15",
  zinc: "text-zinc-400 bg-zinc-500/10 border-zinc-500/15",
};

function tagColorClasses(color: string): string {
  return TAG_COLOR_MAP[color] || TAG_COLOR_MAP.teal;
}

function tagDotColor(color: string): string {
  const m: Record<string, string> = {
    teal: "bg-teal-400",
    sky: "bg-sky-400",
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    red: "bg-red-400",
    blue: "bg-blue-400",
    orange: "bg-orange-400",
    zinc: "bg-zinc-400",
  };
  return m[color] || m.teal;
}

export function SearchResultCard({
  id,
  content,
  source,
  sourceTitle,
  timestamp,
  score,
  pinned,
  tags,
  layers,
  query,
  isFocused,
  isSelected,
  selectMode,
  viewMode,
  onClick,
}: SearchResultCardProps) {
  const cfg = getSourceType(source);
  const Icon = cfg.icon;
  const scorePercent = score ? Math.round(score * 100) : 0;
  const isSearching = query.trim().length > 0;
  const dateStr = new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  // ═══ Compact View ═══
  if (viewMode === "compact") {
    return (
      <button
        onClick={onClick}
        className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition-all ${
          isSelected
            ? "bg-teal-500/[0.08] ring-1 ring-teal-500/20"
            : isFocused
            ? "bg-teal-500/[0.04]"
            : "hover:bg-white/[0.03]"
        }`}
      >
        {selectMode && (
          <div
            className={`w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 transition-all ${
              isSelected
                ? "bg-teal-500 border-teal-500"
                : "border-white/[0.15] bg-white/[0.02]"
            }`}
          >
            {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
          </div>
        )}
        <div
          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${cfg.bgColor}`}
        >
          <Icon className={`w-3 h-3 ${cfg.textColor}`} />
        </div>
        <span className="text-[12px] text-zinc-400 truncate w-28 shrink-0 font-medium">
          {sourceTitle || "Untitled"}
        </span>
        <span className="text-[12px] text-zinc-500 truncate flex-1">
          {isSearching ? (
            <HighlightedText
              text={content.replace(/\n/g, " ")}
              query={query}
              maxLength={120}
            />
          ) : (
            content.replace(/\n/g, " ").slice(0, 120)
          )}
        </span>
        {isSearching && scorePercent > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            <div className="w-10 h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-500/60"
                style={{ width: `${Math.max(scorePercent, 8)}%` }}
              />
            </div>
            <span className="text-[9px] text-zinc-600 tabular-nums font-mono w-6 text-right">
              {scorePercent}%
            </span>
          </div>
        )}
        <span className="text-[10px] text-zinc-700 tabular-nums shrink-0 w-10 text-right">
          {dateStr}
        </span>
        {tags && tags.length > 0 && (
          <span className="flex items-center gap-[2px] shrink-0">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className={`w-[5px] h-[5px] rounded-full ${tagDotColor(
                  tag.color
                )}`}
                title={tag.name}
              />
            ))}
            {tags.length > 3 && (
              <span className="text-[8px] text-zinc-600">
                +{tags.length - 3}
              </span>
            )}
          </span>
        )}
        {pinned && (
          <Pin className="w-2.5 h-2.5 text-amber-400 shrink-0 fill-amber-400/30" />
        )}
        {isSearching && layers && (
          <span
            className="flex items-center gap-[2px] shrink-0"
            title={[
              layers.bm25 && "Keyword",
              layers.vector && "Semantic",
              layers.tree && "Structure",
            ]
              .filter(Boolean)
              .join(" + ")}
          >
            {layers.bm25 && (
              <span className="w-[4px] h-[4px] rounded-full bg-blue-400/70" />
            )}
            {layers.vector && (
              <span className="w-[4px] h-[4px] rounded-full bg-teal-400/70" />
            )}
            {layers.tree && (
              <span className="w-[4px] h-[4px] rounded-full bg-emerald-400/70" />
            )}
          </span>
        )}
      </button>
    );
  }

  // ═══ List View — Rich Cards ═══
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-2xl border transition-all active:scale-[0.995] ${
        isSelected
          ? "border-teal-500/30 bg-teal-500/[0.06] ring-1 ring-teal-500/15"
          : isFocused
          ? "border-teal-500/20 bg-teal-500/[0.04] ring-1 ring-teal-500/10"
          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.08]"
      }`}
    >
      {/* Header row: source icon, badge, title, score, date, pins */}
      <div className="flex items-center gap-2 mb-2">
        {selectMode && (
          <div
            className={`w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 transition-all ${
              isSelected
                ? "bg-teal-500 border-teal-500"
                : "border-white/[0.15] bg-white/[0.02]"
            }`}
          >
            {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
          </div>
        )}
        {/* Source icon */}
        <div
          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${cfg.bgColor} border ${cfg.borderColor}`}
        >
          <Icon className={`w-3.5 h-3.5 ${cfg.textColor}`} />
        </div>
        {/* Source badge + title */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 text-[10px] px-2 py-[3px] rounded-lg font-semibold uppercase tracking-wide ${cfg.badgeClasses}`}
          >
            {cfg.shortLabel}
          </span>
          <span className="text-[12px] text-zinc-400 truncate font-medium">
            {isSearching && sourceTitle ? (
              <HighlightedText text={sourceTitle} query={query} />
            ) : (
              sourceTitle || "Untitled"
            )}
          </span>
        </div>
        {/* Relevance score */}
        {isSearching && scorePercent > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-14 h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  scorePercent > 70
                    ? "bg-emerald-500/60"
                    : scorePercent > 40
                    ? "bg-teal-500/60"
                    : "bg-sky-500/60"
                }`}
                style={{ width: `${Math.max(scorePercent, 8)}%` }}
              />
            </div>
            <span className="text-[9px] text-zinc-600 tabular-nums font-mono">
              {scorePercent}%
            </span>
          </div>
        )}
        {/* Date */}
        <span className="text-[10px] text-zinc-700 tabular-nums shrink-0">
          {dateStr}
        </span>
        {pinned && (
          <Pin className="w-3 h-3 text-amber-400 shrink-0 fill-amber-400/30" />
        )}
        {/* Layer indicators */}
        {isSearching && layers && (
          <span
            className="flex items-center gap-[3px] shrink-0 ml-0.5"
            title={[
              layers.bm25 && "Keyword",
              layers.vector && "Semantic",
              layers.tree && "Structure",
            ]
              .filter(Boolean)
              .join(" + ")}
          >
            {layers.bm25 && (
              <span className="w-[5px] h-[5px] rounded-full bg-blue-400/70" />
            )}
            {layers.vector && (
              <span className="w-[5px] h-[5px] rounded-full bg-teal-400/70" />
            )}
            {layers.tree && (
              <span className="w-[5px] h-[5px] rounded-full bg-emerald-400/70" />
            )}
          </span>
        )}
      </div>

      {/* Content preview with highlighting */}
      <p
        className={`text-[13px] text-zinc-300 line-clamp-2 leading-relaxed ${
          selectMode ? "pl-6" : ""
        }`}
      >
        {isSearching ? (
          <HighlightedText
            text={content}
            query={query}
            maxLength={280}
          />
        ) : (
          content.slice(0, 280)
        )}
      </p>

      {/* Tags + Word count */}
      {((tags && tags.length > 0) || !isSearching) && (
        <div
          className={`flex items-center gap-2 mt-2 flex-wrap ${
            selectMode ? "pl-6" : ""
          }`}
        >
          {tags &&
            tags.length > 0 &&
            tags.map((tag) => (
              <span
                key={tag.id}
                className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-[2px] rounded-md font-semibold ${tagColorClasses(
                  tag.color
                )}`}
              >
                <Tag className="w-2 h-2" />
                {tag.name}
              </span>
            ))}
          {!isSearching && (
            <span className="text-[10px] text-zinc-700">
              {content.trim().split(/\s+/).length} words
            </span>
          )}
        </div>
      )}
    </button>
  );
}
