"use client";

import { Hash, Pin, Sparkles } from "lucide-react";
import { getSourceType } from "@/lib/source-types";

interface SearchTag {
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
  tags?: SearchTag[];
  layers?: Record<string, any>;
  query: string;
  isFocused: boolean;
  isSelected: boolean;
  selectMode: boolean;
  viewMode: "list" | "compact";
  onClick: () => void;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}…`;
}

export function SearchResultCard({
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
  const sourceType = getSourceType(source);
  const Icon = sourceType.icon;
  const scorePercent = score ? Math.round(score * 100) : 0;
  const hasSemanticLayer = Boolean(layers?.semantic || layers?.vector);
  const hasTreeLayer = Boolean(layers?.tree);

  if (viewMode === "compact") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full rounded-xl border px-3 py-2 text-left transition-all ${
          isSelected
            ? "border-teal-500/20 bg-teal-500/[0.08]"
            : isFocused
            ? "border-white/[0.12] bg-white/[0.05]"
            : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
        }`}
      >
        <div className="flex items-start gap-2.5">
          <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${sourceType.bgColor}`}>
            <Icon className={`h-3.5 w-3.5 ${sourceType.textColor}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-[12px] font-medium text-zinc-200">
                {sourceTitle || sourceType.label}
              </p>
              {pinned && <Pin className="h-3 w-3 shrink-0 text-amber-400" />}
            </div>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
              {truncate(content, 180)}
            </p>
          </div>
          {query.trim() && scorePercent > 0 && (
            <span className="shrink-0 rounded-full border border-teal-500/15 bg-teal-500/10 px-2 py-1 text-[10px] font-semibold text-teal-300">
              {scorePercent}%
            </span>
          )}
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition-all ${
        isSelected
          ? "border-teal-500/20 bg-teal-500/[0.08]"
          : isFocused
          ? "border-white/[0.12] bg-white/[0.05]"
          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
      } ${selectMode ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${sourceType.bgColor}`}>
          <Icon className={`h-4 w-4 ${sourceType.textColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[13px] font-semibold tracking-[-0.01em] text-zinc-200">
              {sourceTitle || sourceType.label}
            </p>
            {pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
            {query.trim() && scorePercent > 0 && (
              <span className="rounded-full border border-teal-500/15 bg-teal-500/10 px-2 py-[3px] text-[10px] font-semibold text-teal-300">
                {scorePercent}% match
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-600">
            <span>{source}</span>
            <span>·</span>
            <span>{new Date(timestamp).toLocaleDateString()}</span>
            {hasSemanticLayer && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-teal-400">
                  <Sparkles className="h-3 w-3" />
                  Semantic
                </span>
              </>
            )}
            {hasTreeLayer && (
              <>
                <span>·</span>
                <span className="text-emerald-400">Structure</span>
              </>
            )}
          </div>
          <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-400">
            {truncate(content, 320)}
          </p>
          {tags && tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.slice(0, 4).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] text-zinc-400"
                >
                  <Hash className="h-2.5 w-2.5" />
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
