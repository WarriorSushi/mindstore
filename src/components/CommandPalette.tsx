"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search, LayoutDashboard, MessageSquare, Upload, Compass,
  GraduationCap, Fingerprint, Lightbulb, Network, Settings,
  FileText, Globe, MessageCircle, Type, ArrowRight,
  Plus, Download, RefreshCw, Zap, Clock, Bookmark, Layers, Mic, PenLine,
} from "lucide-react";
import { toast } from "sonner";

interface SearchResult {
  id: string;
  content: string;
  sourceType: string;
  sourceTitle: string;
  score: number;
}

interface ChatHistoryConversation {
  id: string;
  title: string;
  messages: unknown[];
  updatedAt: string;
}

interface SearchApiResult {
  memoryId: string;
  content: string;
  sourceType: string;
  sourceTitle?: string | null;
  score: number;
}

type SectionType = "search" | "recent" | "actions" | "navigation";

interface PaletteItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
  action: () => void;
  section: SectionType;
  shortcut?: string;
}

const NAV_ITEMS = [
  { href: "/app", icon: LayoutDashboard, label: "Home", desc: "Dashboard overview" },
  { href: "/app/chat", icon: MessageSquare, label: "Chat", desc: "Ask your mind anything" },
  { href: "/app/import", icon: Upload, label: "Import", desc: "Add knowledge" },
  { href: "/app/explore", icon: Compass, label: "Explore", desc: "Browse all memories" },
  { href: "/app/learn", icon: GraduationCap, label: "Learn", desc: "Teach AI about you" },
  { href: "/app/mindmap", icon: Network, label: "Mind Map", desc: "Topic clusters & knowledge topology" },
  { href: "/app/fingerprint", icon: Fingerprint, label: "3D Graph", desc: "Raw knowledge graph visualization" },
  { href: "/app/insights", icon: Lightbulb, label: "Insights", desc: "Connections & contradictions" },
  { href: "/app/flashcards", icon: Layers, label: "Flashcards", desc: "Spaced repetition from your knowledge" },
  { href: "/app/voice", icon: Mic, label: "Voice", desc: "Record and transcribe thoughts" },
  { href: "/app/writing", icon: PenLine, label: "Writing Style", desc: "Vocabulary, tone, and readability analysis" },
  { href: "/app/connect", icon: Network, label: "Connect AI", desc: "MCP for Claude, Cursor" },
  { href: "/app/settings", icon: Settings, label: "Settings", desc: "Providers & data" },
];

const typeIcons: Record<string, typeof FileText> = {
  chatgpt: MessageCircle,
  text: Type,
  file: FileText,
  url: Globe,
  bookmark: Bookmark,
};

const typeColors: Record<string, string> = {
  chatgpt: "text-green-400",
  text: "text-teal-400",
  file: "text-blue-400",
  url: "text-orange-400",
  kindle: "text-amber-400",
  document: "text-blue-400",
  youtube: "text-red-400",
  bookmark: "text-sky-400",
};

/** Load recent conversations from localStorage for the palette */
function getRecentConversations(): Array<{ id: string; title: string; updatedAt: string; messageCount: number }> {
  try {
    const raw = localStorage.getItem("mindstore-chat-history");
    if (!raw) return [];
    const convos = JSON.parse(raw) as ChatHistoryConversation[];
    return convos
      .filter((c) => c.messages.length > 0)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 4)
      .map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt,
        messageCount: c.messages.length,
      }));
  } catch {
    return [];
  }
}

/** Format relative time compactly */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1d";
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentConvos, setRecentConvos] = useState<ReturnType<typeof getRecentConversations>>([]);
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

  // Focus input when opened + load recent conversations
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
      setRecentConvos(getRecentConversations());
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
            ((data.results as SearchApiResult[] | undefined) || []).map((r) => ({
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

  // ─── Quick Actions ───
  const actionItems: PaletteItem[] = useMemo(() => {
    const actions: Array<{
      id: string;
      icon: typeof Plus;
      iconColor: string;
      label: string;
      desc: string;
      keywords: string[];
      action: () => void;
      shortcut?: string;
    }> = [
      {
        id: "new-chat",
        icon: Plus,
        iconColor: "text-teal-400",
        label: "New Chat",
        desc: "Start a fresh conversation",
        keywords: ["new", "chat", "conversation", "ask", "fresh"],
        action: () => {
          router.push("/app/chat");
          // Clear current conversation by dispatching a custom event
          window.dispatchEvent(new CustomEvent("mindstore:new-chat"));
          setOpen(false);
        },
        shortcut: "N",
      },
      {
        id: "import-text",
        icon: Type,
        iconColor: "text-teal-400",
        label: "Import Text",
        desc: "Paste notes or text content",
        keywords: ["import", "text", "paste", "note", "write"],
        action: () => {
          router.push("/app/import");
          setOpen(false);
        },
      },
      {
        id: "import-chatgpt",
        icon: MessageCircle,
        iconColor: "text-green-400",
        label: "Import ChatGPT",
        desc: "Upload ChatGPT export ZIP",
        keywords: ["import", "chatgpt", "openai", "zip", "export", "conversation"],
        action: () => {
          router.push("/app/import");
          setOpen(false);
        },
      },
      {
        id: "import-url",
        icon: Globe,
        iconColor: "text-orange-400",
        label: "Import URL",
        desc: "Extract text from a webpage",
        keywords: ["import", "url", "web", "page", "link", "website", "article"],
        action: () => {
          router.push("/app/import");
          setOpen(false);
        },
      },
      {
        id: "export-data",
        icon: Download,
        iconColor: "text-blue-400",
        label: "Export All Data",
        desc: "Download full backup as JSON",
        keywords: ["export", "backup", "download", "data", "save", "json"],
        action: async () => {
          setOpen(false);
          try {
            const res = await fetch("/api/v1/export");
            if (!res.ok) throw new Error("Export failed");
            const data = await res.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `mindstore-backup-${new Date().toISOString().split("T")[0]}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
            toast.success("Backup downloaded");
          } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Export failed");
          }
        },
      },
      {
        id: "reindex",
        icon: RefreshCw,
        iconColor: "text-amber-400",
        label: "Reindex Embeddings",
        desc: "Generate missing embeddings",
        keywords: ["reindex", "embeddings", "search", "index", "rebuild", "semantic"],
        action: () => {
          router.push("/app/settings");
          setOpen(false);
          toast("Navigate to Settings to start reindex");
        },
      },
      {
        id: "learn-about-me",
        icon: GraduationCap,
        iconColor: "text-amber-400",
        label: "Teach AI About You",
        desc: "Start an interview session",
        keywords: ["learn", "teach", "interview", "about me", "personal", "know"],
        action: () => {
          router.push("/app/learn");
          setOpen(false);
        },
      },
      {
        id: "mind-map",
        icon: Network,
        iconColor: "text-sky-400",
        label: "View Mind Map",
        desc: "Topic clusters & knowledge topology",
        keywords: ["map", "mind", "graph", "topology", "visual", "cluster", "topics"],
        action: () => {
          router.push("/app/mindmap");
          setOpen(false);
        },
      },
    ];

    // Filter by query
    if (!query) return [];
    const q = query.toLowerCase();
    return actions
      .filter((a) =>
        a.label.toLowerCase().includes(q) ||
        a.desc.toLowerCase().includes(q) ||
        a.keywords.some((k) => k.includes(q))
      )
      .map((a) => ({
        id: `action-${a.id}`,
        icon: <a.icon className={`w-4 h-4 ${a.iconColor}`} />,
        label: a.label,
        description: a.desc,
        action: a.action,
        section: "actions" as const,
        shortcut: a.shortcut,
      }));
  }, [query, router]);

  // ─── Recent Conversations (no-query state only) ───
  const recentItems: PaletteItem[] = useMemo(() => {
    if (query) return [];
    return recentConvos.map((c) => ({
      id: `recent-${c.id}`,
      icon: <MessageSquare className="w-4 h-4" />,
      label: c.title,
      description: `${c.messageCount} messages · ${relativeTime(c.updatedAt)}`,
      action: () => {
        // Navigate to chat and load conversation via custom event
        router.push("/app/chat");
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("mindstore:load-chat", { detail: { id: c.id } }));
        }, 100);
        setOpen(false);
      },
      section: "recent" as const,
    }));
  }, [query, recentConvos, router]);

  // Build items list
  const navItems: PaletteItem[] = useMemo(() => (
    NAV_ITEMS
      .filter((item) => {
        if (!query) return true;
        const q = query.toLowerCase();
        return item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q);
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
      }))
  ), [query, router]);

  const searchItems: PaletteItem[] = useMemo(() => (
    results.map((result) => {
      const Icon = typeIcons[result.sourceType] || FileText;
      const color = typeColors[result.sourceType] || "text-zinc-400";
      return {
        id: `search-${result.id}`,
        icon: <Icon className={`w-4 h-4 ${color}`} />,
        label: result.sourceTitle,
        description: result.content.slice(0, 80) + (result.content.length > 80 ? "…" : ""),
        action: () => {
          router.push(`/app/explore?q=${encodeURIComponent(result.sourceTitle)}`);
          setOpen(false);
        },
        section: "search" as const,
      };
    })
  ), [results, router]);

  const allItems = useMemo(() => ([
    ...(query ? searchItems : []),
    ...(query ? actionItems : []),
    ...(!query ? recentItems : []),
    ...navItems,
  ]), [actionItems, navItems, query, recentItems, searchItems]);

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

  // Group items by section for rendering with headers
  const sections: Array<{ key: SectionType; label: string; items: Array<PaletteItem & { globalIndex: number }> }> = [];
  let globalIdx = 0;

  const sectionOrder: SectionType[] = ["search", "actions", "recent", "navigation"];
  const sectionLabels: Record<SectionType, string> = {
    search: "Memories",
    actions: "Quick Actions",
    recent: "Recent Chats",
    navigation: query ? "Pages" : "Navigate",
  };

  for (const sectionKey of sectionOrder) {
    const sectionItems = allItems.filter((item) => item.section === sectionKey);
    if (sectionItems.length > 0) {
      sections.push({
        key: sectionKey,
        label: sectionLabels[sectionKey],
        items: sectionItems.map((item) => ({
          ...item,
          globalIndex: globalIdx++,
        })),
      });
    }
  }

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
            <Search className={`w-4 h-4 shrink-0 ${searching ? "text-teal-400 animate-pulse" : "text-zinc-500"}`} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search, navigate, or run actions…"
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
            {sections.map((section) => (
              <div key={section.key} className="px-2">
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.08em]">
                    {section.label}
                  </p>
                  {section.key === "actions" && (
                    <Zap className="w-2.5 h-2.5 text-zinc-700" />
                  )}
                  {section.key === "recent" && (
                    <Clock className="w-2.5 h-2.5 text-zinc-700" />
                  )}
                </div>
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    data-index={item.globalIndex}
                    onClick={item.action}
                    onMouseEnter={() => setActiveIndex(item.globalIndex)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                      activeIndex === item.globalIndex
                        ? "bg-teal-500/10 text-white"
                        : "text-zinc-400 hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      activeIndex === item.globalIndex ? "bg-teal-500/15 text-teal-400" : "bg-white/[0.04] text-zinc-500"
                    }`}>
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate">{item.label}</p>
                      {item.description && (
                        <p className="text-[11px] text-zinc-600 truncate mt-0.5">{item.description}</p>
                      )}
                    </div>
                    {item.shortcut && activeIndex === item.globalIndex && (
                      <kbd className="text-[10px] font-mono text-zinc-600 bg-white/[0.04] border border-white/[0.08] rounded px-1.5 py-[1px] shrink-0">
                        {item.shortcut}
                      </kbd>
                    )}
                    {activeIndex === item.globalIndex && !item.shortcut && (
                      <ArrowRight className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            ))}

            {/* Empty state */}
            {query && sections.length === 0 && !searching && (
              <div className="px-4 py-8 text-center">
                <p className="text-[13px] text-zinc-600">No results for &ldquo;{query}&rdquo;</p>
                <p className="text-[11px] text-zinc-700 mt-1">Try searching for memories, pages, or actions</p>
              </div>
            )}

            {/* Loading indicator */}
            {searching && results.length === 0 && (
              <div className="px-4 py-6 text-center">
                <div className="flex items-center justify-center gap-2 text-[12px] text-zinc-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: "300ms" }} />
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
            <span className="hidden sm:block text-zinc-700">
              {allItems.length} result{allItems.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
