"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, MessageCircle, FileText, Globe, Type, ChevronDown, ChevronUp, X, Trash2, Copy, Check, Loader2, MessageSquare } from "lucide-react";
import { ChatMarkdown } from "@/components/ChatMarkdown";
import { toast } from "sonner";
import { PageTransition, Stagger } from "@/components/PageTransition";

interface Memory {
  id: string;
  content: string;
  source: string;
  sourceId: string;
  sourceTitle: string;
  timestamp: string;
  importedAt: string;
  metadata: Record<string, any>;
}

interface Source {
  id: string;
  type: string;
  title: string;
  itemCount: number;
}

const typeConfig: Record<string, { icon: any; color: string }> = {
  chatgpt: { icon: MessageCircle, color: "text-green-400 bg-green-500/10" },
  text: { icon: Type, color: "text-violet-400 bg-violet-500/10" },
  file: { icon: FileText, color: "text-blue-400 bg-blue-500/10" },
  url: { icon: Globe, color: "text-orange-400 bg-orange-500/10" },
};

export default function ExplorePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [sources, setSources] = useState<Source[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [totalMemories, setTotalMemories] = useState(0);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [filter, setFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Memory | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const [copied, setCopied] = useState(false);

  // Navigate to adjacent memory in detail view
  const navigateMemory = useCallback((direction: 'prev' | 'next') => {
    if (!selected || memories.length === 0) return;
    const currentIdx = selectedIndex >= 0 ? selectedIndex : memories.findIndex(m => m.id === selected.id);
    const nextIdx = direction === 'next'
      ? Math.min(currentIdx + 1, memories.length - 1)
      : Math.max(currentIdx - 1, 0);
    if (nextIdx !== currentIdx && memories[nextIdx]) {
      setSelected(memories[nextIdx]);
      setSelectedIndex(nextIdx);
      setFocusedIndex(nextIdx);
      setCopied(false);
    }
  }, [selected, selectedIndex, memories]);

  // Ask about this memory in chat
  const askAboutMemory = useCallback((memory: Memory) => {
    const snippet = memory.content.slice(0, 300);
    const query = encodeURIComponent(`Tell me more about this from my knowledge: "${snippet}${memory.content.length > 300 ? '…' : ''}"`);
    router.push(`/app/chat?q=${query}`);
  }, [router]);

  // Keyboard: j/k to navigate list, Enter to open, Escape to close, ↑↓ in modal
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const isInput = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA";

      // ─── Detail modal open ───
      if (selected) {
        if (e.key === "Escape") {
          setSelected(null);
          setCopied(false);
          return;
        }
        // j/↓ = next memory, k/↑ = prev memory in detail view
        if ((e.key === "j" || e.key === "ArrowDown") && !isInput) {
          e.preventDefault();
          navigateMemory('next');
          return;
        }
        if ((e.key === "k" || e.key === "ArrowUp") && !isInput) {
          e.preventDefault();
          navigateMemory('prev');
          return;
        }
        return;
      }

      // ─── List view ───
      // "/" focuses search input (like GitHub, Slack)
      if (e.key === "/" && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // j/↓ = move focus down, k/↑ = move focus up
      if ((e.key === "j" || e.key === "ArrowDown") && !isInput) {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = Math.min(prev + 1, memories.length - 1);
          // Scroll the focused item into view
          const el = listRef.current?.children[next] as HTMLElement;
          el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          return next;
        });
        return;
      }
      if ((e.key === "k" || e.key === "ArrowUp") && !isInput) {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = Math.max(prev - 1, 0);
          const el = listRef.current?.children[next] as HTMLElement;
          el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          return next;
        });
        return;
      }

      // Enter = open focused memory
      if (e.key === "Enter" && !isInput && focusedIndex >= 0 && memories[focusedIndex]) {
        e.preventDefault();
        setSelected(memories[focusedIndex]);
        setSelectedIndex(focusedIndex);
        setCopied(false);
        return;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selected, focusedIndex, memories, navigateMemory]);

  // Reset focused index when memories change
  useEffect(() => {
    setFocusedIndex(-1);
  }, [search, filter]);

  // Sync search query to URL (shallow, no navigation)
  useEffect(() => {
    const url = new URL(window.location.href);
    if (search.trim()) {
      url.searchParams.set("q", search.trim());
    } else {
      url.searchParams.delete("q");
    }
    // Only update if different to avoid unnecessary history entries
    if (url.toString() !== window.location.href) {
      window.history.replaceState(null, "", url.toString());
    }
  }, [search]);

  const handleCopy = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, []);

  async function deleteMemory(id: string) {
    if (!confirm("Delete this memory? This can't be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/memories?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setMemories(prev => prev.filter(m => m.id !== id));
      setTotalMemories(prev => prev - 1);
      setSelected(null);
      setCopied(false);
      toast.success("Memory deleted");
    } catch {
      toast.error("Failed to delete memory");
    }
    setDeleting(false);
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/sources').then(r => r.json()),
      fetch('/api/v1/memories?limit=100').then(r => r.json()),
    ]).then(([srcData, memData]) => {
      setSources(srcData.sources || []);
      setMemories(memData.memories || []);
      setTotalMemories(memData.total || 0);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search) {
        // Use BM25 full-text search for queries (better relevance than ILIKE)
        const p = new URLSearchParams({ q: search, limit: '100' });
        if (filter) p.set('source', filter);
        fetch(`/api/v1/search?${p}`).then(r => r.json()).then(d => {
          const results = (d.results || []).map((r: any) => ({
            id: r.memoryId,
            content: r.content,
            source: r.sourceType,
            sourceId: '',
            sourceTitle: r.sourceTitle || '',
            timestamp: r.createdAt,
            importedAt: r.createdAt,
            metadata: r.metadata || {},
          }));
          setMemories(results);
          setTotalMemories(d.totalResults || results.length);
        }).catch(() => {});
      } else {
        // No search query — list all memories
        const p = new URLSearchParams({ limit: '100' });
        if (filter) p.set('source', filter);
        fetch(`/api/v1/memories?${p}`).then(r => r.json()).then(d => {
          setMemories(d.memories || []);
          setTotalMemories(d.total || 0);
        }).catch(() => {});
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search, filter]);

  return (
    <PageTransition className="space-y-4 md:space-y-6">
      {/* Header */}
      <Stagger>
        <div>
          <h1 className="text-[22px] md:text-[28px] font-semibold tracking-[-0.03em]">Explore</h1>
          <p className="text-[13px] text-zinc-500 mt-0.5">{totalMemories.toLocaleString()} memories · {sources.length} sources</p>
        </div>
      </Stagger>

      {/* Search */}
      <Stagger>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input
            ref={searchInputRef}
            placeholder="Search your knowledge…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-16 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500/30 focus:border-violet-500/30 transition-all"
          />
          {search ? (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5">
              <X className="w-3.5 h-3.5 text-zinc-500" />
            </button>
          ) : (
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-zinc-700 bg-white/[0.04] border border-white/[0.08] rounded px-1.5 py-[2px] hidden sm:block">/</kbd>
          )}
        </div>
      </Stagger>

      {/* Filters */}
      <Stagger>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 pb-0.5">
          <FilterPill active={filter === null} onClick={() => setFilter(null)} label="All" />
          {(["chatgpt", "text", "file", "url"] as const).map((type) => {
            const count = sources.filter(s => s.type === type).reduce((sum, s) => sum + s.itemCount, 0);
            if (count === 0) return null;
            const Icon = typeConfig[type]?.icon || FileText;
            return <FilterPill key={type} active={filter === type} onClick={() => setFilter(filter === type ? null : type)} label={type} count={count} icon={<Icon className="w-3 h-3" />} />;
          })}
        </div>
      </Stagger>

      {/* Memory Cards */}
      <div ref={listRef} className="space-y-1.5">
        {memories.map((m, idx) => {
          const cfg = typeConfig[m.source] || { icon: FileText, color: "text-zinc-400 bg-zinc-500/10" };
          const Icon = cfg.icon;
          const isFocused = focusedIndex === idx;
          return (
            <button
              key={m.id}
              onClick={() => { setSelected(m); setSelectedIndex(idx); setFocusedIndex(idx); setCopied(false); }}
              className={`w-full text-left p-3.5 rounded-2xl border transition-all active:scale-[0.99] ${
                isFocused
                  ? "border-violet-500/30 bg-violet-500/[0.06] ring-1 ring-violet-500/20"
                  : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-[2px] rounded-md font-semibold uppercase tracking-wide ${cfg.color}`}>
                  <Icon className="w-2.5 h-2.5" />
                  {m.source}
                </span>
                <span className="text-[11px] text-zinc-600 truncate flex-1">{m.sourceTitle}</span>
                <span className="text-[10px] text-zinc-700 tabular-nums shrink-0">
                  {new Date(m.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <p className="text-[13px] text-zinc-300 line-clamp-2 leading-relaxed">{m.content}</p>
            </button>
          );
        })}

        {totalMemories > memories.length && (
          <button
            onClick={async () => {
              const p = new URLSearchParams({ limit: '100', offset: String(memories.length) });
              if (search) p.set('search', search);
              if (filter) p.set('source', filter);
              const res = await fetch(`/api/v1/memories?${p}`);
              const d = await res.json();
              setMemories(prev => [...prev, ...(d.memories || [])]);
            }}
            className="w-full py-3 rounded-2xl border border-white/[0.06] text-[12px] text-zinc-500 hover:bg-white/[0.04] transition-colors flex items-center justify-center gap-1.5 font-medium"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            Load more ({totalMemories - memories.length} remaining)
          </button>
        )}

        {memories.length === 0 && !loading && (
          <div className="text-center py-20 text-zinc-600 text-[13px]">
            {totalMemories === 0 ? "No memories yet" : "No results"}
          </div>
        )}

        {/* Keyboard hints (desktop only) */}
        {!loading && memories.length > 0 && (
          <div className="hidden md:flex items-center justify-center gap-4 pt-3 pb-1">
            <span className="flex items-center gap-1 text-[10px] text-zinc-700">
              <kbd className="font-mono bg-white/[0.04] border border-white/[0.06] rounded px-1 py-[1px] text-[9px]">j</kbd>
              <kbd className="font-mono bg-white/[0.04] border border-white/[0.06] rounded px-1 py-[1px] text-[9px]">k</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1 text-[10px] text-zinc-700">
              <kbd className="font-mono bg-white/[0.04] border border-white/[0.06] rounded px-1 py-[1px] text-[9px]">↵</kbd>
              open
            </span>
            <span className="flex items-center gap-1 text-[10px] text-zinc-700">
              <kbd className="font-mono bg-white/[0.04] border border-white/[0.06] rounded px-1 py-[1px] text-[9px]">/</kbd>
              search
            </span>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && memories.length === 0 && (
          <div className="space-y-1.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-3.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] animate-pulse">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-14 h-4 rounded-md bg-white/[0.06]" />
                  <div className="flex-1 h-3.5 rounded-md bg-white/[0.04]" />
                  <div className="w-10 h-3 rounded-md bg-white/[0.03]" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-3.5 rounded-md bg-white/[0.04] w-full" />
                  <div className="h-3.5 rounded-md bg-white/[0.04] w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Bottom Sheet */}
      {selected && (
        <div className="fixed inset-0 z-[60]" onClick={() => { setSelected(null); setCopied(false); }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
          <div
            className="absolute bottom-0 inset-x-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg bg-[#111113] border-t md:border border-white/[0.08] rounded-t-3xl md:rounded-3xl overflow-hidden animate-in slide-in-from-bottom shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="md:hidden flex justify-center pt-2.5 pb-1">
              <div className="w-9 h-1 rounded-full bg-white/[0.15]" />
            </div>
            <div className="px-5 py-3 flex items-start justify-between border-b border-white/[0.06]">
              <div className="min-w-0 pr-3">
                <h3 className="text-[15px] font-semibold truncate">{selected.sourceTitle}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] px-1.5 py-[2px] rounded-md font-semibold uppercase tracking-wide ${typeConfig[selected.source]?.color || ""}`}>
                    {selected.source}
                  </span>
                  <span className="text-[11px] text-zinc-500">{new Date(selected.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/* Prev / Next navigation */}
                <button
                  onClick={() => navigateMemory('prev')}
                  disabled={selectedIndex <= 0}
                  className="p-1.5 hover:bg-white/[0.06] rounded-lg disabled:opacity-20 transition-all"
                  title="Previous (↑ or k)"
                >
                  <ChevronUp className="w-4 h-4 text-zinc-500" />
                </button>
                <span className="text-[10px] text-zinc-600 tabular-nums min-w-[2.5rem] text-center">
                  {selectedIndex + 1}/{memories.length}
                </span>
                <button
                  onClick={() => navigateMemory('next')}
                  disabled={selectedIndex >= memories.length - 1}
                  className="p-1.5 hover:bg-white/[0.06] rounded-lg disabled:opacity-20 transition-all"
                  title="Next (↓ or j)"
                >
                  <ChevronDown className="w-4 h-4 text-zinc-500" />
                </button>
                <button onClick={() => { setSelected(null); setCopied(false); }} className="p-1.5 -mr-1 hover:bg-white/[0.06] rounded-lg">
                  <X className="w-4 h-4 text-zinc-500" />
                </button>
              </div>
            </div>
            <div className="px-5 py-4 overflow-y-auto max-h-[55dvh] md:max-h-[50vh]">
              <div className="text-[13px] text-zinc-300 leading-[1.7]">
                <ChatMarkdown content={selected.content} />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-white/[0.06] flex justify-between items-center">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleCopy(selected.content)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-zinc-400 hover:bg-white/[0.06] transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-green-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </>
                  )}
                </button>
                <button
                  onClick={() => askAboutMemory(selected)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-violet-400 hover:bg-violet-500/10 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Ask about this
                </button>
              </div>
              <button
                onClick={() => deleteMemory(selected.id)}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
            {/* Keyboard hint */}
            <div className="hidden md:flex items-center justify-center gap-3 px-5 py-2 border-t border-white/[0.04] bg-white/[0.01]">
              <span className="flex items-center gap-1 text-[10px] text-zinc-700">
                <kbd className="font-mono bg-white/[0.04] border border-white/[0.06] rounded px-1 py-[1px] text-[9px]">↑</kbd>
                <kbd className="font-mono bg-white/[0.04] border border-white/[0.06] rounded px-1 py-[1px] text-[9px]">↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1 text-[10px] text-zinc-700">
                <kbd className="font-mono bg-white/[0.04] border border-white/[0.06] rounded px-1 py-[1px] text-[9px]">esc</kbd>
                close
              </span>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}

function FilterPill({ active, onClick, label, count, icon }: {
  active: boolean; onClick: () => void; label: string; count?: number; icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 flex items-center gap-1.5 px-3 py-[6px] rounded-full text-[12px] font-medium transition-all active:scale-[0.95] ${
        active
          ? "bg-violet-500/15 text-violet-300 border border-violet-500/25 shadow-sm shadow-violet-500/10"
          : "text-zinc-500 border border-white/[0.06] hover:bg-white/[0.04]"
      }`}
    >
      {icon}
      {label}
      {count !== undefined && <span className="text-[10px] opacity-60">{count}</span>}
    </button>
  );
}
