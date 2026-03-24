"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, MessageCircle, FileText, Globe, Type, ChevronDown, ChevronUp, X, Trash2, Copy, Check, Loader2, MessageSquare, CheckSquare, Square, Download, Pencil, Save } from "lucide-react";
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

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);

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
      setEditing(false);
      setEditContent("");
      setEditTitle("");
    }
  }, [selected, selectedIndex, memories]);

  // Ask about this memory in chat
  const askAboutMemory = useCallback((memory: Memory) => {
    const snippet = memory.content.slice(0, 300);
    const query = encodeURIComponent(`Tell me more about this from my knowledge: "${snippet}${memory.content.length > 300 ? '…' : ''}"`);
    router.push(`/app/chat?q=${query}`);
  }, [router]);

  // ── Multi-select helpers ──────────────────
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(memories.map(m => m.id)));
  }, [memories]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!confirm(`Delete ${count} memor${count === 1 ? 'y' : 'ies'}? This can't be undone.`)) return;
    setBatchDeleting(true);
    let deleted = 0;
    const ids = Array.from(selectedIds);
    // Delete in parallel batches of 10
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map(id => fetch(`/api/v1/memories?id=${id}`, { method: 'DELETE' }))
      );
      deleted += results.filter(r => r.status === 'fulfilled').length;
    }
    setMemories(prev => prev.filter(m => !selectedIds.has(m.id)));
    setTotalMemories(prev => prev - deleted);
    exitSelectMode();
    setBatchDeleting(false);
    toast.success(`Deleted ${deleted} memor${deleted === 1 ? 'y' : 'ies'}`);
  }, [selectedIds, exitSelectMode]);

  const handleBatchExport = useCallback(() => {
    if (selectedIds.size === 0) return;
    const selected = memories.filter(m => selectedIds.has(m.id));
    const md = selected.map(m => {
      const date = new Date(m.timestamp).toLocaleDateString();
      return `## ${m.sourceTitle || 'Untitled'}\n*${m.source} · ${date}*\n\n${m.content}`;
    }).join('\n\n---\n\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mindstore-export-${selectedIds.size}-memories.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(`Exported ${selectedIds.size} memor${selectedIds.size === 1 ? 'y' : 'ies'}`);
  }, [selectedIds, memories]);

  const handleBatchCopy = useCallback(() => {
    if (selectedIds.size === 0) return;
    const selected = memories.filter(m => selectedIds.has(m.id));
    const text = selected.map(m => {
      return `[${m.source}] ${m.sourceTitle || 'Untitled'}\n${m.content}`;
    }).join('\n\n---\n\n');
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`Copied ${selectedIds.size} memor${selectedIds.size === 1 ? 'y' : 'ies'} to clipboard`);
    });
  }, [selectedIds, memories]);

  // ── Edit memory ──────────────────
  const startEditing = useCallback(() => {
    if (!selected) return;
    setEditContent(selected.content);
    setEditTitle(selected.sourceTitle);
    setEditing(true);
    // Focus textarea after render
    setTimeout(() => editTextareaRef.current?.focus(), 50);
  }, [selected]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setEditContent("");
    setEditTitle("");
  }, []);

  const saveEdit = useCallback(async () => {
    if (!selected || saving) return;
    const trimmedContent = editContent.trim();
    const trimmedTitle = editTitle.trim();
    if (!trimmedContent) { toast.error("Content can't be empty"); return; }

    // Check if anything actually changed
    const contentChanged = trimmedContent !== selected.content;
    const titleChanged = trimmedTitle !== (selected.sourceTitle || '');
    if (!contentChanged && !titleChanged) { setEditing(false); return; }

    setSaving(true);
    try {
      const body: any = { id: selected.id };
      if (contentChanged) body.content = trimmedContent;
      if (titleChanged) body.title = trimmedTitle;

      const res = await fetch('/api/v1/memories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || 'Update failed');
      }

      // Update local state
      const updatedMemory = {
        ...selected,
        content: trimmedContent,
        sourceTitle: trimmedTitle,
      };
      setSelected(updatedMemory);
      setMemories(prev => prev.map(m => m.id === selected.id ? updatedMemory : m));
      setEditing(false);
      toast.success("Memory updated" + (contentChanged ? " · embedding refreshed" : ""));
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    }
    setSaving(false);
  }, [selected, editContent, editTitle, saving]);

  // Keyboard: j/k to navigate list, Enter to open, Escape to close, ↑↓ in modal
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const isInput = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA";

      // ─── Detail modal open ───
      if (selected) {
        if (e.key === "Escape") {
          if (editing) {
            cancelEditing();
          } else {
            setSelected(null);
            setCopied(false);
            setEditing(false);
          }
          return;
        }
        // "e" to start editing (when not already editing and not in an input)
        if (e.key === "e" && !editing && !isInput) {
          e.preventDefault();
          startEditing();
          return;
        }
        // j/↓ = next memory, k/↑ = prev memory in detail view (only when not editing)
        if ((e.key === "j" || e.key === "ArrowDown") && !isInput && !editing) {
          e.preventDefault();
          navigateMemory('next');
          return;
        }
        if ((e.key === "k" || e.key === "ArrowUp") && !isInput && !editing) {
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

      // Escape exits select mode
      if (e.key === "Escape" && selectMode) {
        e.preventDefault();
        exitSelectMode();
        return;
      }

      // "s" toggles select mode (like Gmail)
      if (e.key === "s" && !isInput && !selectMode) {
        e.preventDefault();
        setSelectMode(true);
        return;
      }

      // Space toggles selection of focused item in select mode
      if (e.key === " " && !isInput && selectMode && focusedIndex >= 0 && memories[focusedIndex]) {
        e.preventDefault();
        toggleSelect(memories[focusedIndex].id);
        return;
      }

      // "a" selects all in select mode
      if (e.key === "a" && !isInput && selectMode && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (selectedIds.size === memories.length) deselectAll();
        else selectAll();
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
  }, [selected, focusedIndex, memories, navigateMemory, selectMode, selectedIds, exitSelectMode, toggleSelect, selectAll, deselectAll, editing, startEditing, cancelEditing]);

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
      setEditing(false);
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] md:text-[28px] font-semibold tracking-[-0.03em]">Explore</h1>
            <p className="text-[13px] text-zinc-500 mt-0.5">{totalMemories.toLocaleString()} memories · {sources.length} sources</p>
          </div>
          {memories.length > 0 && (
            <button
              onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-all active:scale-[0.96] ${
                selectMode
                  ? "text-violet-300 bg-violet-500/10"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]"
              }`}
              title={selectMode ? "Exit select mode (Esc)" : "Select memories (s)"}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{selectMode ? "Cancel" : "Select"}</span>
            </button>
          )}
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

      {/* ═══ Selection Toolbar ═══ */}
      {selectMode && (
        <div className="sticky top-12 md:top-0 z-20 -mx-4 px-4 py-2 bg-[#0a0a0b]/90 backdrop-blur-xl border-b border-white/[0.06]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => selectedIds.size === memories.length ? deselectAll() : selectAll()}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all active:scale-[0.96] shrink-0"
              >
                {selectedIds.size === memories.length ? (
                  <CheckSquare className="w-3.5 h-3.5 text-violet-400" />
                ) : (
                  <Square className="w-3.5 h-3.5" />
                )}
                {selectedIds.size === memories.length ? "Deselect all" : "Select all"}
              </button>
              {selectedIds.size > 0 && (
                <span className="text-[11px] text-violet-400 font-medium tabular-nums shrink-0">
                  {selectedIds.size} selected
                </span>
              )}
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleBatchCopy}
                  className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all active:scale-[0.96]"
                  title="Copy selected"
                >
                  <Copy className="w-3 h-3" />
                  <span className="hidden sm:inline">Copy</span>
                </button>
                <button
                  onClick={handleBatchExport}
                  className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all active:scale-[0.96]"
                  title="Export selected as Markdown"
                >
                  <Download className="w-3 h-3" />
                  <span className="hidden sm:inline">Export</span>
                </button>
                <button
                  onClick={handleBatchDelete}
                  disabled={batchDeleting}
                  className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all active:scale-[0.96] disabled:opacity-50"
                  title="Delete selected"
                >
                  {batchDeleting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                  <span className="hidden sm:inline">{batchDeleting ? "Deleting…" : "Delete"}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Memory Cards */}
      <div ref={listRef} className="space-y-1.5">
        {memories.map((m, idx) => {
          const cfg = typeConfig[m.source] || { icon: FileText, color: "text-zinc-400 bg-zinc-500/10" };
          const Icon = cfg.icon;
          const isFocused = focusedIndex === idx;
          const isSelected = selectedIds.has(m.id);
          return (
            <button
              key={m.id}
              onClick={() => {
                if (selectMode) {
                  toggleSelect(m.id);
                } else {
                  setSelected(m); setSelectedIndex(idx); setFocusedIndex(idx); setCopied(false);
                }
              }}
              className={`w-full text-left p-3.5 rounded-2xl border transition-all active:scale-[0.99] ${
                isSelected
                  ? "border-violet-500/30 bg-violet-500/[0.08] ring-1 ring-violet-500/20"
                  : isFocused
                  ? "border-violet-500/30 bg-violet-500/[0.06] ring-1 ring-violet-500/20"
                  : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                {selectMode && (
                  <div className={`w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 transition-all ${
                    isSelected
                      ? "bg-violet-500 border-violet-500"
                      : "border-white/[0.15] bg-white/[0.02]"
                  }`}>
                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                )}
                <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-[2px] rounded-md font-semibold uppercase tracking-wide ${cfg.color}`}>
                  <Icon className="w-2.5 h-2.5" />
                  {m.source}
                </span>
                <span className="text-[11px] text-zinc-600 truncate flex-1">{m.sourceTitle}</span>
                <span className="text-[10px] text-zinc-700 tabular-nums shrink-0">
                  {new Date(m.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <p className={`text-[13px] text-zinc-300 line-clamp-2 leading-relaxed ${selectMode ? 'pl-6' : ''}`}>{m.content}</p>
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
            <span className="flex items-center gap-1 text-[10px] text-zinc-700">
              <kbd className="font-mono bg-white/[0.04] border border-white/[0.06] rounded px-1 py-[1px] text-[9px]">s</kbd>
              {selectMode ? "select mode" : "select"}
            </span>
            {selectMode && (
              <>
                <span className="flex items-center gap-1 text-[10px] text-zinc-700">
                  <kbd className="font-mono bg-white/[0.04] border border-white/[0.06] rounded px-1 py-[1px] text-[9px]">␣</kbd>
                  toggle
                </span>
                <span className="flex items-center gap-1 text-[10px] text-zinc-700">
                  <kbd className="font-mono bg-white/[0.04] border border-white/[0.06] rounded px-1 py-[1px] text-[9px]">a</kbd>
                  all
                </span>
              </>
            )}
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
        <div className="fixed inset-0 z-[60]" onClick={() => { if (!editing) { setSelected(null); setCopied(false); setEditing(false); } }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
          <div
            className="absolute bottom-0 inset-x-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg bg-[#111113] border-t md:border border-white/[0.08] rounded-t-3xl md:rounded-3xl overflow-hidden animate-in slide-in-from-bottom shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="md:hidden flex justify-center pt-2.5 pb-1">
              <div className="w-9 h-1 rounded-full bg-white/[0.15]" />
            </div>
            <div className="px-5 py-3 flex items-start justify-between border-b border-white/[0.06]">
              <div className="min-w-0 pr-3 flex-1">
                {editing ? (
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Title"
                    className="w-full text-[15px] font-semibold bg-transparent border-b border-violet-500/30 focus:border-violet-500/60 outline-none pb-0.5 transition-colors placeholder:text-zinc-600"
                  />
                ) : (
                  <h3 className="text-[15px] font-semibold truncate">{selected.sourceTitle}</h3>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] px-1.5 py-[2px] rounded-md font-semibold uppercase tracking-wide ${typeConfig[selected.source]?.color || ""}`}>
                    {selected.source}
                  </span>
                  <span className="text-[11px] text-zinc-500">{new Date(selected.timestamp).toLocaleDateString()}</span>
                  {editing && (
                    <span className="text-[10px] text-violet-400 font-medium animate-pulse">Editing</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/* Prev / Next navigation (hidden during edit) */}
                {!editing && (
                  <>
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
                  </>
                )}
                <button onClick={() => { if (editing) cancelEditing(); setSelected(null); setCopied(false); setEditing(false); }} className="p-1.5 -mr-1 hover:bg-white/[0.06] rounded-lg">
                  <X className="w-4 h-4 text-zinc-500" />
                </button>
              </div>
            </div>

            {/* Content area — view or edit */}
            <div className="px-5 py-4 overflow-y-auto max-h-[55dvh] md:max-h-[50vh]">
              {editing ? (
                <textarea
                  ref={editTextareaRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full min-h-[200px] text-[13px] text-zinc-300 leading-[1.7] bg-white/[0.02] border border-white/[0.08] rounded-xl p-3.5 focus:outline-none focus:ring-1 focus:ring-violet-500/30 focus:border-violet-500/30 resize-y transition-all placeholder:text-zinc-600 font-mono"
                  placeholder="Memory content…"
                  onKeyDown={(e) => {
                    // Cmd/Ctrl+Enter to save
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      saveEdit();
                    }
                    // Escape to cancel
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelEditing();
                    }
                  }}
                />
              ) : (
                <div className="text-[13px] text-zinc-300 leading-[1.7]">
                  <ChatMarkdown content={selected.content} />
                </div>
              )}
            </div>

            {/* Footer — different buttons for view vs edit mode */}
            <div className="px-5 py-3 border-t border-white/[0.06] flex justify-between items-center">
              {editing ? (
                <>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={cancelEditing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-zinc-400 hover:bg-white/[0.06] transition-colors"
                    >
                      Cancel
                    </button>
                    <span className="text-[10px] text-zinc-700 hidden sm:inline">
                      ⌘↵ save · Esc cancel
                    </span>
                  </div>
                  <button
                    onClick={saveEdit}
                    disabled={saving || !editContent.trim()}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-medium bg-violet-600 hover:bg-violet-500 text-white transition-all active:scale-[0.97] disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    {saving ? "Saving…" : "Save"}
                  </button>
                </>
              ) : (
                <>
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
                      onClick={startEditing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-zinc-400 hover:bg-white/[0.06] transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
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
                </>
              )}
            </div>
            {/* Keyboard hint */}
            <div className="hidden md:flex items-center justify-center gap-3 px-5 py-2 border-t border-white/[0.04] bg-white/[0.01]">
              {editing ? (
                <>
                  <span className="flex items-center gap-1 text-[10px] text-zinc-700">
                    <kbd className="font-mono bg-white/[0.04] border border-white/[0.06] rounded px-1 py-[1px] text-[9px]">⌘↵</kbd>
                    save
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-zinc-700">
                    <kbd className="font-mono bg-white/[0.04] border border-white/[0.06] rounded px-1 py-[1px] text-[9px]">esc</kbd>
                    cancel edit
                  </span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1 text-[10px] text-zinc-700">
                    <kbd className="font-mono bg-white/[0.04] border border-white/[0.06] rounded px-1 py-[1px] text-[9px]">↑</kbd>
                    <kbd className="font-mono bg-white/[0.04] border border-white/[0.06] rounded px-1 py-[1px] text-[9px]">↓</kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-zinc-700">
                    <kbd className="font-mono bg-white/[0.04] border border-white/[0.06] rounded px-1 py-[1px] text-[9px]">e</kbd>
                    edit
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-zinc-700">
                    <kbd className="font-mono bg-white/[0.04] border border-white/[0.06] rounded px-1 py-[1px] text-[9px]">esc</kbd>
                    close
                  </span>
                </>
              )}
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
