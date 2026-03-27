"use client";

import React from "react";

/**
 * Highlights matched search terms in text with a teal background.
 * Returns an array of React nodes: plain strings + highlighted <mark> spans.
 */
export function highlightMatches(
  text: string,
  query: string,
  maxLength?: number
): React.ReactNode[] {
  if (!query || !text) {
    const display = maxLength ? text.slice(0, maxLength) : text;
    return [display];
  }

  const display = maxLength ? text.slice(0, maxLength) : text;

  // Split query into individual terms, escape regex special chars
  const terms = query
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  if (terms.length === 0) return [display];

  // Build a regex that matches any of the terms (case-insensitive)
  const regex = new RegExp(`(${terms.join("|")})`, "gi");

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(display)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(display.slice(lastIndex, match.index));
    }
    // Add highlighted match
    parts.push(
      <mark
        key={key++}
        className="bg-teal-500/25 text-teal-200 rounded-sm px-[2px] py-[0.5px]"
      >
        {match[0]}
      </mark>
    );
    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < display.length) {
    parts.push(display.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [display];
}

/**
 * Component wrapper for highlighted text
 */
export function HighlightedText({
  text,
  query,
  maxLength,
  className,
}: {
  text: string;
  query: string;
  maxLength?: number;
  className?: string;
}) {
  const nodes = highlightMatches(text, query, maxLength);
  return <span className={className}>{nodes}</span>;
}
