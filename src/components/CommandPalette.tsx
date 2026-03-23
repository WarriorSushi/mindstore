"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, LayoutDashboard, MessageSquare, Upload, Compass,
  GraduationCap, Fingerprint, Lightbulb, Network, Settings,
  FileText, Globe, MessageCircle, Type, ArrowRight, Command,
  Hash,
} from "lucide-react";

interface SearchResult {
  id: string;
  content: string;
  sourceType: string;
  sourceTitle: string;
  score: number;
}

interface PaletteItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
  action: () => void;
  section: "navigation" | "search";
}

const NAV_ITEMS = [
  { href: "/app", icon: LayoutDashboard, label: "Home", desc: "Dashboard overview" },
  { href: "/app/chat", icon: MessageSquare, label: "Chat", desc: "Ask your mind anything" },
  { href: "/app/import", icon: Upload, label: "Import", desc: "Add knowledge" },
  { href: "/app/explore", icon: Compass, label: "Explore", desc: "Browse all memories" },
  { href: "/app/learn", icon: GraduationCap, label: "Learn", desc: "Teach AI about you" },
  { href: "/app/fingerprint", icon: Fingerprint, label: "Mind Map", desc: "3D knowledge topology" },
  { href: "/app/insights", icon: Lightbulb, label: "Insights", desc: "Connections & contradictions" },
  { href: "/app/connect", icon: Network, label: "Connect AI", desc: "MCP for Claude, Cursor" },
  { href: "/app/settings", icon: Settings, label: "Settings", desc: "Providers & data" },
];

const typeIcons: Record<string, typeof FileText> = {
  chatgpt: MessageCircle,
  text: Type,
  file: FileText,
  url: Globe,
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Search memories with debounce
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}&limit=6`);
        if (res.ok) {
          const data = await res.json();
          setResults(
            (data.results || []).map((r: any) => ({
              id: r.memoryId,
              content: r.content,
              sourceType: r.sourceType,
              sourceTitle: r.sourceTitle || "Untitled",
              score: r.score,
            }))
          );
        }
      } catch {
        /* ignore */
      }
      setSearching(false);
    }, 200);

    return () => clearTimeout(t);
  }, [query]);

  // Build items list
  const navItems: PaletteItem[] = NAV_ITEMS
    .filter((item) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        item.label.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q)
      );
    })
    .map((item) => ({
      id: `nav-${item.href}`,
      icon: <item.icon className="w-4 h-4" />,
      label: item.label,
      description: item.desc,
      action: () => {
        router.push(item.href);
        setOpen(false);
      },
      section: "navigation" as const,
    }));

  const searchItems: PaletteItem[] = results.map((r) => {
    const Icon = typeIcons[r.sourceType] || FileText;
    return {
      id: `search-${r.id}`,
      icon: <Icon className="w-4 h-4" />,
      label: r.sourceTitle,
      description: r.content.slice(0, 80) + (r.content.length > 80 ? "…" : ""),
      action: () => {
        router.push(`/app/explore?q=${encodeURIComponent(r.sourceTitle)}`);
        setOpen(false);
      },
      section: "search" as const,
    };
  });

  const allItems = [...(query ? searchItems : []), ...navItems];

  // Reset index when items change
  useEffect(() => {
    setActiveIndex(0);
  }, [allItems.length]);

  // Keyboard nav
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, allItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (allItems[activeIndex]) {
          allItems[activeIndex].action();
        }
      }
    },
    [allItems, activeIndex]
  );

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const active = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
      active?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Palette */}
      <div className="absolute inset-x-0 top-[15%] md:top-[20%] flex justify-center px-4">
        <div
          className="w-full max-w-[520px] bg-[#151517] border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 h-12 border-b border-white/[0.06]">
            <Search className={`w-4 h-4 shrink-0 ${searching ? "text-violet-400 animate-pulse" : "text-zinc-500"}`} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search memories, navigate…"
              className="flex-1 bg-transparent text-[14px] placeholder:text-zinc-600 focus:outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            <kbd className="hidden md:flex items-center gap-0.5 text-[10px] text-zinc-600 font-mono bg-white/[0.04] border border-white/[0.08] rounded-md px-1.5 py-0.5">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1.5">
            {/* Search results section */}
            {searchItems.length > 0 && (
              <div className="px-2">
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.08em] px-2 py-1.5">
                  Memories
                </p>
                {searchItems.map((item, i) => {
                  const idx = i;
                  return (
                    <button
                      key={item.id}
                      data-index={idx}
                      onClick={item.action}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                        activeIndex === idx
                          ? "bg-violet-500/10 text-white"
                          : "text-zinc-400 hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        activeIndex === idx ? "bg-violet-500/15 text-violet-400" : "bg-white/[0.04] text-zinc-500"
                      }`}>
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate">{item.label}</p>
                        {item.description && (
                          <p className="text-[11px] text-zinc-600 truncate mt-0.5">{item.description}</p>
                        )}
                      </div>
                      {activeIndex === idx && (
                        <ArrowRight className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Navigation section */}
            {navItems.length > 0 && (
              <div className="px-2">
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.08em] px-2 py-1.5">
                  {query ? "Pages" : "Navigate"}
                </p>
                {navItems.map((item, i) => {
                  const idx = searchItems.length + i;
                  return (
                    <button
                      key={item.id}
                      data-index={idx}
                      onClick={item.action}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                        activeIndex === idx
                          ? "bg-violet-500/10 text-white"
                          : "text-zinc-400 hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        activeIndex === idx ? "bg-violet-500/15 text-violet-400" : "bg-white/[0.04] text-zinc-500"
                      }`}>
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium">{item.label}</p>
                        {item.description && (
                          <p className="text-[11px] text-zinc-600 mt-0.5">{item.description}</p>
                        )}
                      </div>
                      {activeIndex === idx && (
                        <ArrowRight className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Empty state */}
            {query && allItems.length === 0 && !searching && (
              <div className="px-4 py-8 text-center">
                <p className="text-[13px] text-zinc-600">No results for &ldquo;{query}&rdquo;</p>
              </div>
            )}

            {/* Loading indicator */}
            {searching && results.length === 0 && (
              <div className="px-4 py-6 text-center">
                <div className="flex items-center justify-center gap-2 text-[12px] text-zinc-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.06] text-[10px] text-zinc-600">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="font-mono bg-white/[0.04] border border-white/[0.08] rounded px-1 py-[1px]">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="font-mono bg-white/[0.04] border border-white/[0.08] rounded px-1 py-[1px]">↵</kbd>
                open
              </span>
              <span className="flex items-center gap-1">
                <kbd className="font-mono bg-white/[0.04] border border-white/[0.08] rounded px-1 py-[1px]">esc</kbd>
                close
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
