"use client";

import React, { useState, useCallback } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Lightweight markdown renderer for chat messages.
 * Handles: **bold**, *italic*, `code`, ```code blocks```, [links](url),
 * --- dividers, bullet lists (- / *), numbered lists (1.), headings, \n
 * No heavy dependencies — just regex + React.
 */
export function ChatMarkdown({ content }: { content: string }) {
  if (!content) return null;

  const blocks = parseBlocks(content);
  return <div className="space-y-1.5">{blocks}</div>;
}

/** Parse content into block-level elements */
function parseBlocks(content: string): React.ReactNode[] {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Fenced code block ───────────────────────
    const fenceMatch = line.match(/^```(\w*)/);
    if (fenceMatch) {
      const lang = fenceMatch[1] || "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      elements.push(
        <CodeBlock key={key++} code={codeLines.join("\n")} language={lang} />
      );
      continue;
    }

    // ── Horizontal rule ─────────────────────────
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={key++} className="border-white/[0.06] my-2" />);
      i++;
      continue;
    }

    // ── Empty line ──────────────────────────────
    if (!line.trim()) {
      i++;
      continue;
    }

    // ── Heading ### ─────────────────────────────
    const h3Match = line.match(/^###\s+(.+)/);
    if (h3Match) {
      elements.push(
        <div key={key++} className="font-semibold text-zinc-200 mt-2 mb-0.5 text-[13px]">
          {parseInline(h3Match[1])}
        </div>
      );
      i++;
      continue;
    }

    // ── Heading ## ──────────────────────────────
    const h2Match = line.match(/^##\s+(.+)/);
    if (h2Match) {
      elements.push(
        <div key={key++} className="font-semibold text-zinc-100 mt-3 mb-0.5 text-[14px]">
          {parseInline(h2Match[1])}
        </div>
      );
      i++;
      continue;
    }

    // ── Heading # ───────────────────────────────
    const h1Match = line.match(/^#\s+(.+)/);
    if (h1Match) {
      elements.push(
        <div key={key++} className="font-bold text-zinc-100 mt-3 mb-0.5 text-[15px]">
          {parseInline(h1Match[1])}
        </div>
      );
      i++;
      continue;
    }

    // ── Bullet list (- or * at start) ───────────
    if (/^[\-\*]\s/.test(line)) {
      const items: { indent: number; content: string }[] = [];
      while (i < lines.length && /^(\s*)[\-\*]\s/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)[\-\*]\s(.+)/);
        if (m) {
          items.push({ indent: m[1].length, content: m[2] });
        }
        i++;
      }
      elements.push(<BulletList key={key++} items={items} />);
      continue;
    }

    // ── Numbered list (1. 2. etc) ───────────────
    if (/^\d+\.\s/.test(line)) {
      const items: { num: string; content: string }[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const m = lines[i].match(/^(\d+)\.\s(.+)/);
        if (m) {
          items.push({ num: m[1], content: m[2] });
        }
        i++;
      }
      elements.push(<NumberedList key={key++} items={items} />);
      continue;
    }

    // ── Blockquote ──────────────────────────────
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <blockquote
          key={key++}
          className="border-l-2 border-violet-500/30 pl-3 py-0.5 text-[13px] text-zinc-400 leading-relaxed"
        >
          {quoteLines.map((ql, qi) => (
            <span key={qi}>
              {parseInline(ql)}
              {qi < quoteLines.length - 1 ? "\n" : ""}
            </span>
          ))}
        </blockquote>
      );
      continue;
    }

    // ── Regular paragraph ───────────────────────
    // Collect consecutive non-special lines into a paragraph
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^```/.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim()) &&
      !/^#{1,3}\s/.test(lines[i]) &&
      !/^[\-\*]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !/^>\s/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      elements.push(
        <p key={key++} className="text-[13px] leading-[1.65] whitespace-pre-wrap">
          {parseInline(paraLines.join("\n"))}
        </p>
      );
    }
  }

  return elements;
}

/** Bullet list component */
function BulletList({ items }: { items: { indent: number; content: string }[] }) {
  return (
    <ul className="space-y-0.5 text-[13px] leading-[1.6]">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2" style={{ paddingLeft: Math.min(item.indent, 8) * 4 }}>
          <span className="w-1 h-1 rounded-full bg-zinc-500 mt-[9px] shrink-0" />
          <span className="min-w-0">{parseInline(item.content)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Numbered list component */
function NumberedList({ items }: { items: { num: string; content: string }[] }) {
  return (
    <ol className="space-y-0.5 text-[13px] leading-[1.6]">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="text-[12px] text-zinc-500 font-medium tabular-nums mt-[1px] shrink-0 w-4 text-right">
            {item.num}.
          </span>
          <span className="min-w-0">{parseInline(item.content)}</span>
        </li>
      ))}
    </ol>
  );
}

/** Fenced code block with copy button */
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [code]);

  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.03]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.02] border-b border-white/[0.04]">
        <span className="text-[10px] text-zinc-600 font-mono font-medium uppercase tracking-wide">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors px-1.5 py-0.5 rounded-md hover:bg-white/[0.06]"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-green-400" />
              <span className="text-green-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      {/* Code content */}
      <pre className="px-3 py-2.5 overflow-x-auto">
        <code className="text-[12px] font-mono text-zinc-300 leading-[1.6]">{code}</code>
      </pre>
    </div>
  );
}

/** Parse inline markdown: **bold**, *italic*, `code`, [links](url) */
function parseInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Match inline patterns: **bold**, *italic*, _italic_, `code`, [text](url)
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
      nodes.push(
        <strong key={match.index} className="font-semibold text-zinc-200">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // *italic*
      nodes.push(
        <em key={match.index} className="text-zinc-300">
          {match[3]}
        </em>
      );
    } else if (match[4]) {
      // _italic_
      nodes.push(
        <em key={match.index} className="text-zinc-300">
          {match[4]}
        </em>
      );
    } else if (match[5]) {
      // `inline code`
      nodes.push(
        <code
          key={match.index}
          className="bg-white/[0.06] text-violet-300 px-1.5 py-[1px] rounded-md text-[12px] font-mono"
        >
          {match[5]}
        </code>
      );
    } else if (match[6] && match[7]) {
      // [text](url)
      nodes.push(
        <a
          key={match.index}
          href={match[7]}
          target="_blank"
          rel="noopener"
          className="text-violet-400 hover:underline"
        >
          {match[6]}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}
