"use client";

import React, { useState, useCallback, createContext, useContext } from "react";
import { Check, Copy } from "lucide-react";

/** Citation interaction context — threaded through the markdown tree */
const CitationContext = createContext<{
  onHover?: (index: number | null) => void;
  onClick?: (index: number) => void;
}>({});

/**
 * Lightweight markdown renderer for chat messages.
 * Handles: **bold**, *italic*, `code`, ```code blocks```, [links](url),
 * --- dividers, bullet lists (- / *), numbered lists (1.), headings,
 * | tables |, task lists (- [ ] / - [x]), \n
 * No heavy dependencies — just regex + React.
 */
export function ChatMarkdown({
  content,
  onCitationHover,
  onCitationClick,
}: {
  content: string;
  onCitationHover?: (index: number | null) => void;
  onCitationClick?: (index: number) => void;
}) {
  if (!content) return null;

  const blocks = parseBlocks(content);

  if (onCitationHover || onCitationClick) {
    return (
      <CitationContext.Provider value={{ onHover: onCitationHover, onClick: onCitationClick }}>
        <div className="space-y-2 break-words [overflow-wrap:anywhere]">{blocks}</div>
      </CitationContext.Provider>
    );
  }

  return <div className="space-y-2 break-words [overflow-wrap:anywhere]">{blocks}</div>;
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

    // ── Markdown table ────────────────────────────
    // Detect table: line starts with | or is followed by a separator line |---|
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i]);
        i++;
        // Skip the separator line (|---|---|) but include it for alignment parsing
        if (tableLines.length === 1 && i < lines.length && isTableSeparator(lines[i])) {
          tableLines.push(lines[i]);
          i++;
        }
      }
      elements.push(<MarkdownTable key={key++} rows={tableLines} />);
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
        <div key={key++} className="font-semibold text-zinc-200 mt-3 mb-1 text-[14px]">
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
        <div key={key++} className="font-semibold text-zinc-100 mt-4 mb-1 text-[15px]">
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
        <div key={key++} className="font-bold text-zinc-100 mt-4 mb-1 text-[16px]">
          {parseInline(h1Match[1])}
        </div>
      );
      i++;
      continue;
    }

    // ── Task list (- [ ] / - [x]) ─────────────────
    if (/^[\-\*]\s\[[ xX]\]\s/.test(line)) {
      const items: { checked: boolean; content: string }[] = [];
      while (i < lines.length && /^[\-\*]\s\[[ xX]\]\s/.test(lines[i])) {
        const m = lines[i].match(/^[\-\*]\s\[([ xX])\]\s(.+)/);
        if (m) {
          items.push({ checked: m[1].toLowerCase() === "x", content: m[2] });
        }
        i++;
      }
      elements.push(<TaskList key={key++} items={items} />);
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
          className="border-l-2 border-teal-500/30 pl-3 py-0.5 text-[14px] text-zinc-400 leading-relaxed"
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
      !/^>\s/.test(lines[i]) &&
      !(isTableRow(lines[i]) && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      elements.push(
        <p key={key++} className="text-[14px] leading-[1.7] whitespace-pre-wrap">
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
    <ul className="space-y-1 text-[14px] leading-[1.7]">
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
    <ol className="space-y-1 text-[14px] leading-[1.7]">
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

/** Check if a line looks like a table row (starts and ends with |, or has | separators) */
function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.split("|").length >= 3;
}

/** Check if a line is a table separator (|---|---|) */
function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return false;
  const cells = trimmed.slice(1, -1).split("|");
  return cells.every(c => /^\s*:?-{2,}:?\s*$/.test(c));
}

/** Parse alignment from separator row */
function parseAlignments(separator: string): Array<"left" | "center" | "right"> {
  const cells = separator.trim().slice(1, -1).split("|");
  return cells.map(c => {
    const t = c.trim();
    if (t.startsWith(":") && t.endsWith(":")) return "center";
    if (t.endsWith(":")) return "right";
    return "left";
  });
}

/** Parse cells from a table row */
function parseTableCells(row: string): string[] {
  const trimmed = row.trim();
  // Remove leading and trailing |, then split
  return trimmed.slice(1, -1).split("|").map(c => c.trim());
}

/** Markdown table component */
function MarkdownTable({ rows }: { rows: string[] }) {
  if (rows.length < 2) return null;

  const headerCells = parseTableCells(rows[0]);
  const hasSeparator = rows.length > 1 && isTableSeparator(rows[1]);
  const alignments = hasSeparator ? parseAlignments(rows[1]) : headerCells.map(() => "left" as const);
  const dataRows = rows.slice(hasSeparator ? 2 : 1);

  const alignClass = (i: number) => {
    const a = alignments[i] || "left";
    if (a === "center") return "text-center";
    if (a === "right") return "text-right";
    return "text-left";
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.06] my-1">
      <table className="w-full text-[12px] leading-[1.5]">
        <thead>
          <tr className="bg-white/[0.04] border-b border-white/[0.06]">
            {headerCells.map((cell, ci) => (
              <th
                key={ci}
                className={`px-3 py-2 font-semibold text-zinc-300 ${alignClass(ci)} whitespace-nowrap`}
              >
                {parseInline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, ri) => {
            const cells = parseTableCells(row);
            return (
              <tr
                key={ri}
                className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors"
              >
                {headerCells.map((_, ci) => (
                  <td
                    key={ci}
                    className={`px-3 py-1.5 text-zinc-400 ${alignClass(ci)}`}
                  >
                    {parseInline(cells[ci] || "")}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Task list component (- [ ] unchecked / - [x] checked) */
function TaskList({ items }: { items: { checked: boolean; content: string }[] }) {
  return (
    <ul className="space-y-1 text-[14px] leading-[1.7]">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <span
            className={`w-[15px] h-[15px] rounded-[4px] border mt-[3px] shrink-0 flex items-center justify-center ${
              item.checked
                ? "bg-teal-500 border-teal-500 text-white"
                : "border-zinc-600 bg-transparent"
            }`}
          >
            {item.checked && (
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
          <span className={`min-w-0 ${item.checked ? "text-zinc-500 line-through" : ""}`}>
            {parseInline(item.content)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Parse inline markdown: **bold**, *italic*, `code`, [links](url), [N] citations */
function parseInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Match inline patterns: **bold**, *italic*, _italic_, `code`, [text](url), [N] bare citation
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_|`(.+?)`|\[(.+?)\]\((.+?)\)|\[(\d{1,2})\](?!\())/g;

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
          className="bg-white/[0.06] text-teal-300 px-1.5 py-[1px] rounded-md text-[12px] font-mono"
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
          className="text-teal-400 hover:underline"
        >
          {match[6]}
        </a>
      );
    } else if (match[8]) {
      // [N] citation reference — render as interactive badge
      nodes.push(
        <CitationBadge key={match.index} index={parseInt(match[8], 10)} />
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

/** Interactive citation badge — [1], [2], etc. in AI responses */
function CitationBadge({ index }: { index: number }) {
  const { onHover, onClick } = useContext(CitationContext);
  const sourceIndex = index - 1; // Convert 1-based citation to 0-based array index

  if (!onHover && !onClick) {
    // No handlers — render as plain styled badge
    return (
      <span className="inline-flex items-center justify-center w-[16px] h-[16px] rounded text-[9px] font-bold tabular-nums bg-white/[0.06] text-zinc-500 align-[1px] mx-[1px]">
        {index}
      </span>
    );
  }

  return (
    <button
      type="button"
      className="inline-flex items-center justify-center w-[16px] h-[16px] rounded text-[9px] font-bold tabular-nums bg-teal-500/10 text-teal-400 border border-teal-500/15 hover:bg-teal-500/20 hover:border-teal-500/25 transition-all cursor-pointer align-[1px] mx-[1px] active:scale-90"
      onMouseEnter={() => onHover?.(sourceIndex)}
      onMouseLeave={() => onHover?.(null)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.(sourceIndex);
      }}
      title={`Source [${index}]`}
    >
      {index}
    </button>
  );
}
