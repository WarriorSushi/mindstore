"use client";

interface DidYouMeanProps {
  query: string;
  resultCount: number;
  onSuggestionClick: (term: string) => void;
}

function getSuggestions(query: string): string[] {
  const suggestions = new Set<string>();
  const trimmed = query.trim();

  if (!trimmed) return [];

  const collapsed = trimmed.replace(/\s+/g, " ");
  if (collapsed !== trimmed) suggestions.add(collapsed);

  const deQuoted = collapsed.replace(/["'`]+/g, "");
  if (deQuoted && deQuoted !== collapsed) suggestions.add(deQuoted);

  const normalized = deQuoted.replace(/[^\p{L}\p{N}\s-]/gu, "").trim();
  if (normalized && normalized !== deQuoted) suggestions.add(normalized);

  if (!trimmed.includes(" ") && normalized.endsWith("s") && normalized.length > 3) {
    suggestions.add(normalized.slice(0, -1));
  }

  return Array.from(suggestions).filter((value) => value && value !== query).slice(0, 2);
}

export function DidYouMean({ query, resultCount, onSuggestionClick }: DidYouMeanProps) {
  const suggestions = getSuggestions(query);

  if (!query.trim() || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap mt-2">
      <span className="text-[11px] text-zinc-600">
        {resultCount === 0 ? "Try instead:" : "Broaden search:"}
      </span>
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onSuggestionClick(suggestion)}
          className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-300 transition-all hover:bg-white/[0.06] hover:text-white"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
