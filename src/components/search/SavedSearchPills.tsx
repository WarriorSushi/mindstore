"use client";

import { Star, X } from "lucide-react";
import { type SavedSearch } from "@/lib/saved-searches";

interface SavedSearchPillsProps {
  searches: SavedSearch[];
  activeId: string | null;
  onApply: (search: SavedSearch) => void;
  onDelete: (id: string, name: string) => void;
}

const PILL_COLORS: Record<string, string> = {
  teal: "text-teal-400 bg-teal-500/[0.08] border-teal-500/20 hover:bg-teal-500/[0.12]",
  sky: "text-sky-400 bg-sky-500/[0.08] border-sky-500/20 hover:bg-sky-500/[0.12]",
  emerald: "text-emerald-400 bg-emerald-500/[0.08] border-emerald-500/20 hover:bg-emerald-500/[0.12]",
  amber: "text-amber-400 bg-amber-500/[0.08] border-amber-500/20 hover:bg-amber-500/[0.12]",
  red: "text-red-400 bg-red-500/[0.08] border-red-500/20 hover:bg-red-500/[0.12]",
  blue: "text-blue-400 bg-blue-500/[0.08] border-blue-500/20 hover:bg-blue-500/[0.12]",
};

const ACTIVE_COLORS: Record<string, string> = {
  teal: "text-teal-300 bg-teal-500/20 border-teal-500/30 ring-1 ring-teal-500/15",
  sky: "text-sky-300 bg-sky-500/20 border-sky-500/30 ring-1 ring-sky-500/15",
  emerald: "text-emerald-300 bg-emerald-500/20 border-emerald-500/30 ring-1 ring-emerald-500/15",
  amber: "text-amber-300 bg-amber-500/20 border-amber-500/30 ring-1 ring-amber-500/15",
  red: "text-red-300 bg-red-500/20 border-red-500/30 ring-1 ring-red-500/15",
  blue: "text-blue-300 bg-blue-500/20 border-blue-500/30 ring-1 ring-blue-500/15",
};

/**
 * Quick-access saved search pills shown above the search bar.
 * Only shows pinned searches for quick access.
 */
export function SavedSearchPills({
  searches,
  activeId,
  onApply,
  onDelete,
}: SavedSearchPillsProps) {
  // Show pinned searches + recently used (up to 6 total)
  const displayed = searches.slice(0, 6);

  if (displayed.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Star className="w-3 h-3 text-zinc-700 shrink-0" />
      {displayed.map((ss) => {
        const isActive = activeId === ss.id;
        const colorClasses = isActive
          ? ACTIVE_COLORS[ss.color] || ACTIVE_COLORS.teal
          : PILL_COLORS[ss.color] || PILL_COLORS.teal;

        return (
          <button
            key={ss.id}
            onClick={() => onApply(ss)}
            className={`group inline-flex items-center gap-1 h-6 pl-2 pr-1.5 rounded-lg text-[10px] font-medium border transition-all active:scale-[0.97] ${colorClasses}`}
          >
            {ss.pinned && (
              <Star className="w-2.5 h-2.5 fill-current opacity-60" />
            )}
            <span className="truncate max-w-[100px]">{ss.name}</span>
            {ss.useCount > 0 && (
              <span className="text-[8px] opacity-50 tabular-nums">
                {ss.useCount}×
              </span>
            )}
            <X
              className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(ss.id, ss.name);
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
