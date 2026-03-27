"use client";

import { useEffect, useState, useRef } from "react";
import { Search, ArrowRight, Loader2 } from "lucide-react";

interface FuzzySuggestion {
  term: string;
  kind: string;
  score: number;
}

interface DidYouMeanProps {
  query: string;
  resultCount: number;
  onSuggest: (suggestion: string) => void;
}

/**
 * Shows "Did you mean?" suggestions when search returns no/few results.
 * Uses the fuzzy matching API endpoint.
 */
export function DidYouMean({ query, resultCount, onSuggest }: DidYouMeanProps) {
  const [suggestions, setSuggestions] = useState<FuzzySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Only show when there are very few or no results
    if (!query || query.length < 3 || resultCount > 3) {
      setSuggestions([]);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/v1/search/fuzzy?q=${encodeURIComponent(query)}`, {
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
          if (err.name !== "AbortError") {
            setLoading(false);
            setSuggestions([]);
          }
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, resultCount]);

  if (!query || resultCount > 3) return null;
  if (!loading && suggestions.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap py-1">
      {loading ? (
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-600">
          <Loader2 className="w-3 h-3 animate-spin" />
          Looking for similar terms…
        </span>
      ) : (
        <>
          <span className="text-[11px] text-zinc-500 font-medium">
            Did you mean:
          </span>
          {suggestions.slice(0, 4).map((s) => (
            <button
              key={s.term}
              onClick={() => onSuggest(s.term)}
              className="inline-flex items-center gap-1 text-[11px] text-teal-400 hover:text-teal-300 font-medium px-2 py-1 rounded-lg border border-teal-500/15 bg-teal-500/[0.06] hover:bg-teal-500/10 transition-all active:scale-[0.97]"
            >
              <Search className="w-2.5 h-2.5" />
              {s.term}
              <ArrowRight className="w-2.5 h-2.5 opacity-50" />
            </button>
          ))}
        </>
      )}
    </div>
  );
}
