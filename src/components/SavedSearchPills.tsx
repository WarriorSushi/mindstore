"use client";

import { Star, X } from "lucide-react";
import { type SavedSearch, describeSavedSearch } from "@/lib/saved-searches";

interface SavedSearchPillsProps {
  searches: SavedSearch[];
  activeId: string | null;
  onApply: (search: SavedSearch) => void;
  onDelete: (id: string, name: string) => void;
}

const COLOR_CLASSES: Record<SavedSearch["color"], string> = {
  teal: "border-teal-500/20 bg-teal-500/[0.08] text-teal-300 hover:bg-teal-500/[0.12]",
  sky: "border-sky-500/20 bg-sky-500/[0.08] text-sky-300 hover:bg-sky-500/[0.12]",
  emerald: "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300 hover:bg-emerald-500/[0.12]",
  amber: "border-amber-500/20 bg-amber-500/[0.08] text-amber-300 hover:bg-amber-500/[0.12]",
  red: "border-red-500/20 bg-red-500/[0.08] text-red-300 hover:bg-red-500/[0.12]",
  blue: "border-blue-500/20 bg-blue-500/[0.08] text-blue-300 hover:bg-blue-500/[0.12]",
};

export function SavedSearchPills({
  searches,
  activeId,
  onApply,
  onDelete,
}: SavedSearchPillsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {searches.map((search) => {
        const isActive = activeId === search.id;
        const colors = COLOR_CLASSES[search.color] || COLOR_CLASSES.teal;

        return (
          <div
            key={search.id}
            className={`group inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 transition-all ${
              isActive
                ? `${colors} shadow-[0_0_0_1px_rgba(20,184,166,0.18)]`
                : "border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:border-white/[0.14] hover:bg-white/[0.05]"
            }`}
          >
            <button
              type="button"
              onClick={() => onApply(search)}
              className="flex items-center gap-1.5 min-w-0"
              title={describeSavedSearch(search)}
            >
              <Star className={`h-3 w-3 shrink-0 ${search.pinned ? "fill-current" : ""}`} />
              <span className="max-w-[180px] truncate text-[11px] font-medium">
                {search.name}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(search.id, search.name)}
              className="rounded-full p-0.5 text-zinc-600 transition-colors hover:bg-white/[0.08] hover:text-zinc-300"
              aria-label={`Delete saved search ${search.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
