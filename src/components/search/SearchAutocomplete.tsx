"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search, X, Clock, Tag, FileText, Globe, Hash,
  MessageCircle, Compass, Loader2, Sparkles,
} from "lucide-react";
import { getSearchHistory, type SearchHistoryItem, removeSearchFromHistory } from "@/lib/search-history";

interface Suggestion {
  type: string;
  text: string;
  count?: number;
  sourceType?: string;
}

interface SearchAutocompleteProps {
  query: string;
  isOpen: boolean;
  onSelect: (text: string) => void;
  onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

const ICON_MAP: Record<string, typeof Search> = {
  source: FileText,
  tag: Tag,
  type: Globe,
  topic: Compass,
  word: Hash,
};

export function SearchAutocomplete({
  query,
  isOpen,
  onSelect,
  onClose,
  inputRef,
}: SearchAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load history on open
  useEffect(() => {
    if (isOpen && !query) {
      setHistory(getSearchHistory().slice(0, 6));
    }
  }, [isOpen, query]);

  // Fetch suggestions when query changes
  useEffect(() => {
    if (!isOpen || !query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/v1/search/suggestions?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((d) => {
          if (!controller.signal.aborted) {
            setSuggestions(d.suggestions || []);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (err.name !== "AbortError") setLoading(false);
        });
    }, 150);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, isOpen]);

  // Reset focus when items change
  useEffect(() => {
    setFocusedIdx(-1);
  }, [suggestions, history, query]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const items = query
      ? suggestions
      : history.map((h) => ({ type: "history", text: h.query, count: h.resultCount }));
    const maxIdx = items.length - 1;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIdx((prev) => Math.min(prev + 1, maxIdx));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIdx((prev) => Math.max(prev - 1, -1));
      } else if (e.key === "Enter" && focusedIdx >= 0 && items[focusedIdx]) {
        e.preventDefault();
        onSelect(items[focusedIdx].text);
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, query, suggestions, history, focusedIdx, onSelect, onClose]);

  if (!isOpen) return null;

  const showHistory = !query && history.length > 0;
  const showSuggestions = query && query.length >= 2 && (suggestions.length > 0 || loading);
  if (!showHistory && !showSuggestions) return null;

  return (
    <>
      <div className="fixed inset-0 z-[15]" onClick={onClose} />
      <div
        ref={dropdownRef}
        className="relative z-20 mt-2 rounded-2xl border border-white/[0.08] bg-[#131315] shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
      >
        {/* Recent searches */}
        {showHistory && (
          <>
            <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                Recent Searches
              </span>
            </div>
            <div className="py-1 max-h-52 overflow-y-auto">
              {history.map((item, idx) => (
                <div
                  key={item.query}
                  className={`group flex items-center gap-2.5 px-4 py-2 transition-colors cursor-pointer ${
                    focusedIdx === idx
                      ? "bg-teal-500/[0.08] text-white"
                      : "hover:bg-white/[0.04]"
                  }`}
                  onClick={() => onSelect(item.query)}
                  onMouseEnter={() => setFocusedIdx(idx)}
                >
                  <Search className="w-3 h-3 text-zinc-700 shrink-0" />
                  <span className="text-[12px] text-zinc-300 truncate flex-1">
                    {item.query}
                  </span>
                  {item.resultCount !== undefined && (
                    <span className="text-[10px] text-zinc-600 tabular-nums shrink-0">
                      {item.resultCount} results
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSearchFromHistory(item.query);
                      setHistory(getSearchHistory().slice(0, 6));
                    }}
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/[0.08] transition-all"
                  >
                    <X className="w-2.5 h-2.5 text-zinc-600" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Live suggestions */}
        {showSuggestions && (
          <>
            <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                Suggestions
              </span>
              {loading && <Loader2 className="w-3 h-3 text-zinc-600 animate-spin" />}
            </div>
            <div className="py-1 max-h-52 overflow-y-auto">
              {suggestions.map((s, idx) => {
                const Icon = ICON_MAP[s.type] || Search;
                return (
                  <div
                    key={`${s.type}-${s.text}`}
                    className={`group flex items-center gap-2.5 px-4 py-2 transition-colors cursor-pointer ${
                      focusedIdx === idx
                        ? "bg-teal-500/[0.08] text-white"
                        : "hover:bg-white/[0.04]"
                    }`}
                    onClick={() => onSelect(s.text)}
                    onMouseEnter={() => setFocusedIdx(idx)}
                  >
                    <Icon className="w-3 h-3 text-zinc-600 shrink-0" />
                    <span className="text-[12px] text-zinc-300 truncate flex-1">
                      {s.text}
                    </span>
                    <span className="text-[9px] text-zinc-700 uppercase tracking-wider">
                      {s.type}
                    </span>
                    {s.count !== undefined && s.count > 0 && (
                      <span className="text-[10px] text-zinc-600 tabular-nums shrink-0">
                        {s.count}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
