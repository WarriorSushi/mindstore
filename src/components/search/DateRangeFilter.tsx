"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, X, ChevronDown } from "lucide-react";

export type DateRangePreset = "7d" | "30d" | "90d" | "1y" | "custom" | null;

interface DateRangeFilterProps {
  value: DateRangePreset;
  customFrom?: string;
  customTo?: string;
  onChange: (preset: DateRangePreset, from?: string, to?: string) => void;
}

const PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "1y", label: "Last year" },
  { id: "custom", label: "Custom range" },
];

export function getDateRange(preset: DateRangePreset, customFrom?: string, customTo?: string): { from?: string; to?: string } {
  if (!preset) return {};

  if (preset === "custom") {
    return { from: customFrom, to: customTo };
  }

  const now = new Date();
  const from = new Date(now);

  switch (preset) {
    case "7d":
      from.setDate(from.getDate() - 7);
      break;
    case "30d":
      from.setDate(from.getDate() - 30);
      break;
    case "90d":
      from.setDate(from.getDate() - 90);
      break;
    case "1y":
      from.setFullYear(from.getFullYear() - 1);
      break;
  }

  return { from: from.toISOString(), to: now.toISOString() };
}

export function DateRangeFilter({ value, customFrom, customTo, onChange }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [localFrom, setLocalFrom] = useState(customFrom || "");
  const [localTo, setLocalTo] = useState(customTo || "");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const activePreset = PRESETS.find(p => p.id === value);
  const label = activePreset ? activePreset.label : "Date range";

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all active:scale-[0.95] ${
          value
            ? "bg-teal-500/15 text-teal-300 border border-teal-500/25 shadow-sm shadow-teal-500/10"
            : "text-zinc-500 border border-white/[0.06] hover:bg-white/[0.04] hover:text-zinc-300"
        }`}
      >
        <Calendar className="w-3 h-3" />
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{value ? (value === "custom" ? "Custom" : value.toUpperCase()) : "Date"}</span>
        {value ? (
          <button
            onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false); }}
            className="p-0.5 -mr-0.5 rounded hover:bg-white/[0.1] transition-colors"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        ) : (
          <ChevronDown className={`w-2.5 h-2.5 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-40 w-56 bg-[#131315] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="py-1">
            {PRESETS.filter(p => p.id !== "custom").map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  onChange(preset.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-[12px] transition-colors ${
                  value === preset.id
                    ? "text-teal-300 bg-teal-500/10"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                }`}
              >
                <Calendar className={`w-3.5 h-3.5 shrink-0 ${value === preset.id ? "text-teal-400" : "text-zinc-600"}`} />
                <span className="flex-1">{preset.label}</span>
                {value === preset.id && (
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* Custom range section */}
          <div className="border-t border-white/[0.06] p-3 space-y-2">
            <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider">Custom range</span>
            <div className="flex gap-2">
              <input
                type="date"
                value={localFrom}
                onChange={(e) => setLocalFrom(e.target.value)}
                className="flex-1 h-8 px-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-zinc-300 focus:outline-none focus:border-teal-500/30 transition-all [color-scheme:dark]"
              />
              <input
                type="date"
                value={localTo}
                onChange={(e) => setLocalTo(e.target.value)}
                className="flex-1 h-8 px-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-zinc-300 focus:outline-none focus:border-teal-500/30 transition-all [color-scheme:dark]"
              />
            </div>
            <button
              onClick={() => {
                onChange("custom", localFrom || undefined, localTo || undefined);
                setOpen(false);
              }}
              disabled={!localFrom && !localTo}
              className="w-full h-7 rounded-lg bg-teal-600 hover:bg-teal-500 text-[11px] font-medium text-white transition-all disabled:opacity-40 active:scale-[0.98]"
            >
              Apply
            </button>
          </div>

          {/* Clear */}
          {value && (
            <div className="border-t border-white/[0.06] py-1">
              <button
                onClick={() => { onChange(null); setOpen(false); }}
                className="w-full text-left px-4 py-2 text-[12px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors"
              >
                Clear date filter
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
