"use client";

import { useState, useCallback } from "react";
import {
  X, Calendar, ChevronDown,
} from "lucide-react";
import { getSourceType } from "@/lib/source-types";

// Date range presets
const DATE_PRESETS = [
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "90d", label: "Last 90 days", days: 90 },
  { id: "1y", label: "Last year", days: 365 },
] as const;

// Content type options
const CONTENT_TYPES = [
  { id: "conversation", label: "Conversations" },
  { id: "text", label: "Text" },
  { id: "code", label: "Code" },
  { id: "webpage", label: "Web pages" },
  { id: "document", label: "Documents" },
] as const;

export interface FilterState {
  sourceTypes: string[];
  dateRange: string | null; // preset id or 'custom'
  dateFrom: string | null;
  dateTo: string | null;
  contentTypes: string[];
}

interface AdvancedFilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  availableSourceTypes: Array<{ type: string; count: number }>;
}

export function AdvancedFilterBar({
  filters,
  onChange,
  availableSourceTypes,
}: AdvancedFilterBarProps) {
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [contentMenuOpen, setContentMenuOpen] = useState(false);

  const toggleSourceType = useCallback(
    (type: string) => {
      const next = filters.sourceTypes.includes(type)
        ? filters.sourceTypes.filter((t) => t !== type)
        : [...filters.sourceTypes, type];
      onChange({ ...filters, sourceTypes: next });
    },
    [filters, onChange]
  );

  const setDateRange = useCallback(
    (presetId: string | null) => {
      if (presetId === filters.dateRange) {
        onChange({ ...filters, dateRange: null, dateFrom: null, dateTo: null });
      } else if (presetId) {
        const preset = DATE_PRESETS.find((p) => p.id === presetId);
        if (preset) {
          const from = new Date();
          from.setDate(from.getDate() - preset.days);
          onChange({
            ...filters,
            dateRange: presetId,
            dateFrom: from.toISOString(),
            dateTo: new Date().toISOString(),
          });
        }
      } else {
        onChange({ ...filters, dateRange: null, dateFrom: null, dateTo: null });
      }
      setDateMenuOpen(false);
    },
    [filters, onChange]
  );

  const toggleContentType = useCallback(
    (ct: string) => {
      const next = filters.contentTypes.includes(ct)
        ? filters.contentTypes.filter((t) => t !== ct)
        : [...filters.contentTypes, ct];
      onChange({ ...filters, contentTypes: next });
    },
    [filters, onChange]
  );

  const clearAll = useCallback(() => {
    onChange({
      sourceTypes: [],
      dateRange: null,
      dateFrom: null,
      dateTo: null,
      contentTypes: [],
    });
  }, [onChange]);

  const hasFilters =
    filters.sourceTypes.length > 0 ||
    filters.dateRange !== null ||
    filters.contentTypes.length > 0;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Source type chips */}
      {availableSourceTypes.map(({ type, count }) => {
        const cfg = getSourceType(type);
        const Icon = cfg.icon;
        const isActive = filters.sourceTypes.includes(type);
        return (
          <button
            key={type}
            onClick={() => toggleSourceType(type)}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium transition-all active:scale-[0.95] ${
              isActive
                ? "bg-teal-500/15 text-teal-300 border border-teal-500/25"
                : "text-zinc-500 border border-white/[0.06] hover:bg-white/[0.04] hover:text-zinc-300"
            }`}
          >
            <Icon className="w-3 h-3" />
            {cfg.label}
            {isActive && (
              <X
                className="w-2.5 h-2.5 ml-0.5 opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSourceType(type);
                }}
              />
            )}
          </button>
        );
      })}

      {/* Separator */}
      {availableSourceTypes.length > 0 && (
        <div className="w-px h-4 bg-white/[0.06] mx-0.5" />
      )}

      {/* Date range dropdown */}
      <div className="relative">
        <button
          onClick={() => {
            setDateMenuOpen(!dateMenuOpen);
            setContentMenuOpen(false);
          }}
          className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium transition-all active:scale-[0.95] ${
            filters.dateRange
              ? "bg-teal-500/15 text-teal-300 border border-teal-500/25"
              : "text-zinc-500 border border-white/[0.06] hover:bg-white/[0.04] hover:text-zinc-300"
          }`}
        >
          <Calendar className="w-3 h-3" />
          {filters.dateRange
            ? DATE_PRESETS.find((p) => p.id === filters.dateRange)?.label || "Date"
            : "Date"}
          {filters.dateRange ? (
            <X
              className="w-2.5 h-2.5 ml-0.5 opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                setDateRange(null);
              }}
            />
          ) : (
            <ChevronDown className="w-2.5 h-2.5 opacity-60" />
          )}
        </button>
        {dateMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setDateMenuOpen(false)}
            />
            <div className="absolute left-0 top-full mt-1.5 z-40 w-44 bg-[#131315] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
              <div className="py-1">
                {DATE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setDateRange(preset.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] transition-colors ${
                      filters.dateRange === preset.id
                        ? "text-teal-300 bg-teal-500/10"
                        : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                    }`}
                  >
                    <Calendar className="w-3 h-3 shrink-0 opacity-60" />
                    {preset.label}
                    {filters.dateRange === preset.id && (
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-400 ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Content type dropdown */}
      <div className="relative">
        <button
          onClick={() => {
            setContentMenuOpen(!contentMenuOpen);
            setDateMenuOpen(false);
          }}
          className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium transition-all active:scale-[0.95] ${
            filters.contentTypes.length > 0
              ? "bg-teal-500/15 text-teal-300 border border-teal-500/25"
              : "text-zinc-500 border border-white/[0.06] hover:bg-white/[0.04] hover:text-zinc-300"
          }`}
        >
          Content
          {filters.contentTypes.length > 0 && (
            <span className="text-[9px] bg-teal-500/20 px-1 rounded">
              {filters.contentTypes.length}
            </span>
          )}
          {filters.contentTypes.length > 0 ? (
            <X
              className="w-2.5 h-2.5 ml-0.5 opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onChange({ ...filters, contentTypes: [] });
              }}
            />
          ) : (
            <ChevronDown className="w-2.5 h-2.5 opacity-60" />
          )}
        </button>
        {contentMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setContentMenuOpen(false)}
            />
            <div className="absolute left-0 top-full mt-1.5 z-40 w-44 bg-[#131315] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
              <div className="py-1">
                {CONTENT_TYPES.map((ct) => {
                  const isActive = filters.contentTypes.includes(ct.id);
                  return (
                    <button
                      key={ct.id}
                      onClick={() => toggleContentType(ct.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] transition-colors ${
                        isActive
                          ? "text-teal-300 bg-teal-500/10"
                          : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                      }`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                          isActive
                            ? "bg-teal-500 border-teal-500"
                            : "border-white/[0.15] bg-white/[0.02]"
                        }`}
                      >
                        {isActive && (
                          <svg
                            className="w-2 h-2 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                      {ct.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Clear all */}
      {hasFilters && (
        <button
          onClick={clearAll}
          className="inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[10px] font-medium text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] transition-all"
        >
          <X className="w-2.5 h-2.5" />
          Clear filters
        </button>
      )}
    </div>
  );
}

export const emptyFilterState: FilterState = {
  sourceTypes: [],
  dateRange: null,
  dateFrom: null,
  dateTo: null,
  contentTypes: [],
};
