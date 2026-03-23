"use client";

import React from "react";

/**
 * Lightweight markdown renderer for chat messages.
 * Handles: **bold**, *italic*, `code`, [links](url), --- dividers, \n
 * No heavy dependencies — just regex + React.
 */
export function ChatMarkdown({ content }: { content: string }) {
  if (!content) return null;

  const blocks = content.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const line = blocks[i];

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} className="border-white/[0.06] my-2" />);
      continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<br key={i} />);
      continue;
    }

    // Heading-like lines (### heading)
    const h3Match = line.match(/^###\s+(.+)/);
    if (h3Match) {
      elements.push(<div key={i} className="font-semibold text-zinc-200 mt-2 mb-1">{parseInline(h3Match[1])}</div>);
      continue;
    }

    const h2Match = line.match(/^##\s+(.+)/);
    if (h2Match) {
      elements.push(<div key={i} className="font-semibold text-zinc-100 mt-3 mb-1 text-[14px]">{parseInline(h2Match[1])}</div>);
      continue;
    }

    // Regular line with inline formatting
    elements.push(<span key={i}>{parseInline(line)}{i < blocks.length - 1 ? '\n' : ''}</span>);
  }

  return <div className="whitespace-pre-wrap">{elements}</div>;
}

function parseInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Regex to match inline patterns: **bold**, *italic*, `code`, [text](url)
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_|`(.+?)`|\[(.+?)\]\((.+?)\))/g;

  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // **bold**
      nodes.push(<strong key={match.index} className="font-semibold text-zinc-200">{match[2]}</strong>);
    } else if (match[3]) {
      // *italic*
      nodes.push(<em key={match.index} className="text-zinc-300">{match[3]}</em>);
    } else if (match[4]) {
      // _italic_
      nodes.push(<em key={match.index} className="text-zinc-300">{match[4]}</em>);
    } else if (match[5]) {
      // `code`
      nodes.push(<code key={match.index} className="bg-white/[0.06] text-violet-300 px-1.5 py-[1px] rounded-md text-[12px] font-mono">{match[5]}</code>);
    } else if (match[6] && match[7]) {
      // [text](url)
      nodes.push(<a key={match.index} href={match[7]} target="_blank" rel="noopener" className="text-violet-400 hover:underline">{match[6]}</a>);
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}
