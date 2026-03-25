"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Search, MessageCircle, FileText, Globe, Type, ChevronDown, ChevronUp, X, Trash2, Copy, Check, Loader2, MessageSquare, CheckSquare, Square, Download, Pencil, Save, MoreHorizontal, ArrowUpDown, ArrowDownNarrowWide, ArrowUpNarrowWide, ArrowDownAZ, ArrowUpAZ, AlignLeft, AlignRight, Clock, Hash, BookOpen, Pin, PinOff, Sparkles, ExternalLink, PlayCircle, Bookmark, Gem, Mic, Camera, StickyNote, AtSign, Send, BookmarkCheck, Music, Highlighter, LayoutList, LayoutGrid, Tag, Plus, Palette, Star, Heart } from "lucide-react";
import { getSourceType } from "@/lib/source-types";
import { ChatMarkdown } from "@/components/ChatMarkdown";
import { toast } from "sonner";
import { PageTransition, Stagger } from "@/components/PageTransition";
import {
  type SavedSearch,
  getSavedSearches,
  createSavedSearch,
  useSavedSearch as applySavedSearch,
  deleteSavedSearch,
  togglePinSavedSearch,
  findMatchingSavedSearch,
  describeSavedSearch,
} from "@/lib/saved-searches";
import {
  addSearchToHistory,
  getSearchHistory,
  clearSearchHistory,
  removeSearchFromHistory,
  type SearchHistoryItem,
} from "@/lib/search-history";

interface TagData {
  id: string;
  name: string;
  color: string;
  memory_count?: number;
}

interface Memory {
  id: string;
  content: string;
  source: string;
  sourceId: string;
  sourceTitle: string;
  timestamp: string;
  importedAt: string;
  metadata: Record<string, any>;
  layers?: Record<string, any>;
  score?: number;
  pinned?: boolean;
  tags?: TagData[];
}

interface Source {
  id: string;
  type: string;
  title: string;
  itemCount: number;
}

// Source type config — delegated to shared module
// Usage: const st = getSourceType(type); st.icon, st.textColor, st.bgColor, st.badgeClasses

// Tag color utility
const TAG_COLOR_MAP: Record<string, string> = {
  teal:    'text-teal-400 bg-teal-500/10 border-teal-500/15',
  sky:     'text-sky-400 bg-sky-500/10 border-sky-500/15',
  emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/15',
  amber:   'text-amber-400 bg-amber-500/10 border-amber-500/15',
  red:     'text-red-400 bg-red-500/10 border-red-500/15',
  blue:    'text-blue-400 bg-blue-500/10 border-blue-500/15',
  orange:  'text-orange-400 bg-orange-500/10 border-orange-500/15',
  zinc:    'text-zinc-400 bg-zinc-500/10 border-zinc-500/15',
};
function tagColorClasses(color: string): string {
  return TAG_COLOR_MAP[color] || TAG_COLOR_MAP.teal;
}
function tagDotColor(color: string): string {
  const m: Record<string, string> = {
    teal: 'bg-teal-400', sky: 'bg-sky-400', emerald: 'bg-emerald-400',
    amber: 'bg-amber-400', red: 'bg-red-400', blue: 'bg-blue-400',
    orange: 'bg-orange-400', zinc: 'bg-zinc-400',
  };
  return m[color] || m.teal;
}

const SORT_OPTIONS: { id: string; label: string; icon: any }[] = [
  { id: "newest", label: "Newest first", icon: ArrowDownNarrowWide },
  { id: "oldest", label: "Oldest first", icon: ArrowUpNarrowWide },
  { id: "alpha-asc", label: "Title A → Z", icon: ArrowDownAZ },
  { id: "alpha-desc", label: "Title Z → A", icon: ArrowUpAZ },
  { id: "longest", label: "Longest first", icon: AlignLeft },
  { id: "shortest", label: "Shortest first", icon: AlignRight },
];

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
  const [sortBy, setSortBy] = useState<string>("newest");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
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

  // View mode state
  const [viewMode, setViewMode] = useState<"list" | "compact">("list");

  // Infinite scroll state
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchLayers, setSearchLayers] = useState<{ bm25: number; vector: number; tree: number } | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── Tags state ──────────────────
  const [allTags, setAllTags] = useState<TagData[]>([]);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const [tagAssignOpen, setTagAssignOpen] = useState(false); // in detail view
  const [batchTagMenuOpen, setBatchTagMenuOpen] = useState(false); // in select mode toolbar

  // Saved searches
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [savedSearchMenuOpen, setSavedSearchMenuOpen] = useState(false);
  const [saveSearchDialogOpen, setSaveSearchDialogOpen] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [saveSearchColor, setSaveSearchColor] = useState<SavedSearch['color']>('teal');
  const [activeSavedSearchId, setActiveSavedSearchId] = useState<string | null>(null);

  // Search history
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);

  // Load saved searches and search history on mount
  useEffect(() => {
    setSavedSearches(getSavedSearches());
    setSearchHistory(getSearchHistory());
  }, []);

  const handleSaveSearch = useCallback(() => {
    if (!saveSearchName.trim()) return;
    const ss = createSavedSearch({
      name: saveSearchName.trim(),
      query: search,
      sourceFilter: filter,
      tagFilter: tagFilter,
      sortBy,
      color: saveSearchColor,
    });
    setSavedSearches(getSavedSearches());
    setSaveSearchDialogOpen(false);
    setSaveSearchName('');
    setActiveSavedSearchId(ss.id);
    toast.success(`Saved "${ss.name}"`);
  }, [saveSearchName, search, filter, tagFilter, sortBy, saveSearchColor]);

  const handleApplySavedSearch = useCallback((ss: SavedSearch) => {
    applySavedSearch(ss.id);
    setSearch(ss.query);
    setFilter(ss.sourceFilter);
    setTagFilter(ss.tagFilter);
    setSortBy(ss.sortBy);
    setActiveSavedSearchId(ss.id);
    setSavedSearchMenuOpen(false);
    setSavedSearches(getSavedSearches());
    toast.success(`Applied "${ss.name}"`);
  }, []);

  const handleDeleteSavedSearch = useCallback((id: string, name: string) => {
    deleteSavedSearch(id);
    if (activeSavedSearchId === id) setActiveSavedSearchId(null);
    setSavedSearches(getSavedSearches());
    toast.success(`Deleted "${name}"`);
  }, [activeSavedSearchId]);

  const handleTogglePinSavedSearch = useCallback((id: string) => {
    togglePinSavedSearch(id);
    setSavedSearches(getSavedSearches());
  }, []);

  // Check if current search matches a saved search
  const currentMatchesSaved = findMatchingSavedSearch({ query: search, sourceFilter: filter, tagFilter, sortBy });
  const hasActiveFilters = search || filter || tagFilter || sortBy !== 'newest';

  // Derive unique source types from actual data
  const sourceTypeCounts = sources.reduce((acc, s) => {
    acc[s.type] = (acc[s.type] || 0) + s.itemCount;
    return acc;
  }, {} as Record<string, number>);
  const activeSourceTypes = Object.entries(sourceTypeCounts)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]); // Sort by count descending

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

  // ── Batch Pin/Unpin ──────────────────
  const [batchPinning, setBatchPinning] = useState(false);

  const handleBatchPin = useCallback(async (pinState: boolean) => {
    if (selectedIds.size === 0) return;
    setBatchPinning(true);
    let updated = 0;
    const ids = Array.from(selectedIds);
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map(id =>
          fetch('/api/v1/memories', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, pinned: pinState }),
          })
        )
      );
      updated += results.filter(r => r.status === 'fulfilled').length;
    }
    setMemories(prev => prev.map(m => selectedIds.has(m.id) ? { ...m, pinned: pinState } : m));
    setBatchPinning(false);
    toast.success(`${pinState ? 'Pinned' : 'Unpinned'} ${updated} memor${updated === 1 ? 'y' : 'ies'}`);
  }, [selectedIds]);

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

  // ── Pin/Unpin memory ──────────────────
  const [pinning, setPinning] = useState(false);

  // Related memories state
  const [relatedMemories, setRelatedMemories] = useState<Array<{ id: string; title: string; type: string; score: number; preview: string }>>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const relatedAbortRef = useRef<AbortController | null>(null);
  const togglePin = useCallback(async (memory: Memory) => {
    if (pinning) return;
    setPinning(true);
    const newPinned = !memory.pinned;
    try {
      const res = await fetch('/api/v1/memories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: memory.id, pinned: newPinned }),
      });
      if (!res.ok) throw new Error('Failed to update');
      // Update local state
      const updatedMemory = { ...memory, pinned: newPinned, metadata: { ...memory.metadata, pinned: newPinned || undefined } };
      if (!newPinned) delete updatedMemory.metadata.pinned;
      setMemories(prev => prev.map(m => m.id === memory.id ? { ...m, pinned: newPinned } : m));
      if (selected?.id === memory.id) {
        setSelected({ ...selected, pinned: newPinned });
      }
      toast.success(newPinned ? "Pinned to top" : "Unpinned");
    } catch (err: any) {
      toast.error(err.message || "Failed to pin");
    }
    setPinning(false);
  }, [pinning, selected]);

  // Fetch related memories when detail view opens
  useEffect(() => {
    if (!selected) {
      setRelatedMemories([]);
      setRelatedLoading(false);
      return;
    }

    // Abort previous request
    if (relatedAbortRef.current) relatedAbortRef.current.abort();
    const controller = new AbortController();
    relatedAbortRef.current = controller;

    setRelatedLoading(true);
    setRelatedMemories([]);

    // Use first 200 chars of content + title as search query for semantic similarity
    const searchQuery = (selected.sourceTitle ? selected.sourceTitle + " " : "") +
      selected.content.slice(0, 200).replace(/\n/g, " ");

    fetch(`/api/v1/search?q=${encodeURIComponent(searchQuery)}&limit=6`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (controller.signal.aborted) return;
        const results = (data.results || [])
          // Filter out the current memory itself
          .filter((r: any) => r.id !== selected.id)
          .slice(0, 4)
          .map((r: any) => ({
            id: r.id,
            title: r.sourceTitle || "Untitled",
            type: r.sourceType || "text",
            score: r.score || 0,
            preview: (r.content || "").slice(0, 100).replace(/\n/g, " ").trim(),
          }));
        setRelatedMemories(results);
        setRelatedLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setRelatedLoading(false);
        }
      });

    return () => controller.abort();
  }, [selected?.id]);

  // Close tag dropdowns when selected memory changes
  useEffect(() => {
    setTagAssignOpen(false);
  }, [selected?.id]);

  // Navigate to a related memory
  const openRelatedMemory = useCallback((relatedId: string) => {
    const mem = memories.find(m => m.id === relatedId);
    if (mem) {
      // Memory is already loaded in the list — select it directly
      const idx = memories.indexOf(mem);
      setSelected(mem);
      setSelectedIndex(idx);
      setFocusedIndex(idx);
      setCopied(false);
      setEditing(false);
      setEditContent("");
      setEditTitle("");
    } else {
      // Memory isn't in the current filtered list — fetch all memories and search
      fetch(`/api/v1/memories?limit=2000`)
        .then(r => r.json())
        .then(data => {
          const found = (data.memories || []).find((m: any) => m.id === relatedId);
          if (found) {
            const m: Memory = {
              id: found.id,
              content: found.content,
              source: found.source,
              sourceId: found.sourceId,
              sourceTitle: found.sourceTitle || "Untitled",
              timestamp: found.timestamp,
              importedAt: found.importedAt,
              metadata: found.metadata || {},
              pinned: found.pinned || false,
            };
            setSelected(m);
            setSelectedIndex(-1);
            setCopied(false);
            setEditing(false);
          } else {
            toast.error("Memory not found");
          }
        })
        .catch(() => toast.error("Could not load memory"));
    }
  }, [memories]);

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
        // "p" to toggle pin (when not editing and not in an input)
        if (e.key === "p" && !editing && !isInput) {
          e.preventDefault();
          togglePin(selected);
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
  }, [selected, focusedIndex, memories, navigateMemory, selectMode, selectedIds, exitSelectMode, toggleSelect, selectAll, deselectAll, editing, startEditing, cancelEditing, togglePin]);

  // Reset focused index when memories change
  useEffect(() => {
    setFocusedIndex(-1);
  }, [search, filter, sortBy, tagFilter]);

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
      fetch(`/api/v1/memories?limit=100&sort=${sortBy}`).then(r => r.json()),
      fetch('/api/v1/tags').then(r => r.json()).catch(() => ({ tags: [] })),
    ]).then(([srcData, memData, tagData]) => {
      setSources(srcData.sources || []);
      setMemories(memData.memories || []);
      setTotalMemories(memData.total || 0);
      setAllTags(tagData.tags || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search) {
        // Use BM25 full-text search for queries (better relevance than ILIKE)
        const p = new URLSearchParams({ q: search, limit: '100' });
        if (filter && filter !== 'pinned') p.set('source', filter);
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
            layers: r.layers || {},
            score: r.score || 0,
            pinned: r.metadata?.pinned === true,
            tags: r.tags || [],
          }));
          setMemories(results);
          setTotalMemories(d.totalResults || results.length);
          setSearchLayers(d.layers || null);
          // Track search in history
          addSearchToHistory(search, results.length);
        }).catch(() => {});
      } else {
        // No search query — list all memories
        setSearchLayers(null);
        const p = new URLSearchParams({ limit: '100', sort: sortBy });
        if (filter && filter !== 'pinned') p.set('source', filter);
        if (filter === 'pinned') p.set('pinned', 'true');
        if (tagFilter) p.set('tagId', tagFilter);
        fetch(`/api/v1/memories?${p}`).then(r => r.json()).then(d => {
          setMemories(d.memories || []);
          setTotalMemories(d.total || 0);
        }).catch(() => {});
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search, filter, sortBy, tagFilter]);

  // ── Infinite scroll with Intersection Observer ──────────────────
  const loadMore = useCallback(async () => {
    if (loadingMore || memories.length >= totalMemories || search) return;
    setLoadingMore(true);
    try {
      const p = new URLSearchParams({ limit: '100', offset: String(memories.length), sort: sortBy });
      if (filter && filter !== 'pinned') p.set('source', filter);
      if (filter === 'pinned') p.set('pinned', 'true');
      if (tagFilter) p.set('tagId', tagFilter);
      const res = await fetch(`/api/v1/memories?${p}`);
      const d = await res.json();
      setMemories(prev => [...prev, ...(d.memories || [])]);
    } catch { /* ignore */ }
    setLoadingMore(false);
  }, [loadingMore, memories.length, totalMemories, search, filter, sortBy, tagFilter]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore && memories.length < totalMemories && !search) {
          loadMore();
        }
      },
      { rootMargin: '200px' } // trigger 200px before the sentinel is visible
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, loadingMore, memories.length, totalMemories, search]);

  // ── Tag helpers ──────────────────
  const refreshTags = useCallback(async () => {
    try {
      const r = await fetch('/api/v1/tags');
      const d = await r.json();
      setAllTags(d.tags || []);
    } catch { /* ignore */ }
  }, []);

  const createTag = useCallback(async (name: string, color?: string) => {
    if (!name.trim()) return null;
    setCreatingTag(true);
    try {
      const res = await fetch('/api/v1/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color: color || 'teal' }),
      });
      const data = await res.json();
      if (data.tag) {
        if (!data.existed) {
          toast.success(`Tag "${data.tag.name}" created`);
        }
        await refreshTags();
        setNewTagName('');
        return data.tag;
      }
      if (data.error) toast.error(data.error);
      return null;
    } catch { toast.error('Failed to create tag'); return null; }
    finally { setCreatingTag(false); }
  }, [refreshTags]);

  const assignTag = useCallback(async (tagId: string, memoryIds: string[]) => {
    try {
      const res = await fetch('/api/v1/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign', tagId, memoryIds }),
      });
      const data = await res.json();
      if (data.ok) {
        // Update local state — add tag to affected memories
        const tag = allTags.find(t => t.id === tagId);
        if (tag) {
          setMemories(prev => prev.map(m =>
            memoryIds.includes(m.id) && !m.tags?.some(t => t.id === tagId)
              ? { ...m, tags: [...(m.tags || []), tag] }
              : m
          ));
          if (selected && memoryIds.includes(selected.id)) {
            setSelected(prev => prev ? {
              ...prev,
              tags: [...(prev.tags || []), tag].filter((t, i, arr) => arr.findIndex(a => a.id === t.id) === i),
            } : null);
          }
        }
        await refreshTags();
        toast.success(`Tagged ${memoryIds.length} memor${memoryIds.length === 1 ? 'y' : 'ies'}`);
      }
    } catch { toast.error('Failed to tag'); }
  }, [allTags, selected, refreshTags]);

  const unassignTag = useCallback(async (tagId: string, memoryIds: string[]) => {
    try {
      await fetch('/api/v1/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unassign', tagId, memoryIds }),
      });
      // Update local state
      setMemories(prev => prev.map(m =>
        memoryIds.includes(m.id)
          ? { ...m, tags: (m.tags || []).filter(t => t.id !== tagId) }
          : m
      ));
      if (selected && memoryIds.includes(selected.id)) {
        setSelected(prev => prev ? {
          ...prev,
          tags: (prev.tags || []).filter(t => t.id !== tagId),
        } : null);
      }
      await refreshTags();
      toast.success('Tag removed');
    } catch { toast.error('Failed to remove tag'); }
  }, [selected, refreshTags]);

  const deleteTag = useCallback(async (tagId: string) => {
    const tag = allTags.find(t => t.id === tagId);
    if (!confirm(`Delete tag "${tag?.name}"? It will be removed from all memories.`)) return;
    try {
      await fetch(`/api/v1/tags?id=${tagId}`, { method: 'DELETE' });
      // Remove from local state
      setMemories(prev => prev.map(m => ({
        ...m,
        tags: (m.tags || []).filter(t => t.id !== tagId),
      })));
      if (selected) {
        setSelected(prev => prev ? {
          ...prev,
          tags: (prev.tags || []).filter(t => t.id !== tagId),
        } : null);
      }
      if (tagFilter === tagId) setTagFilter(null);
      await refreshTags();
      toast.success(`Tag "${tag?.name}" deleted`);
    } catch { toast.error('Failed to delete tag'); }
  }, [allTags, selected, tagFilter, refreshTags]);

  const handleBatchTag = useCallback(async (tagId: string) => {
    if (selectedIds.size === 0) return;
    await assignTag(tagId, Array.from(selectedIds));
    setBatchTagMenuOpen(false);
  }, [selectedIds, assignTag]);

  return (
    <PageTransition className="space-y-4 md:space-y-6">
      {/* Header */}
      <Stagger>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] md:text-[28px] font-semibold tracking-[-0.03em]">Explore</h1>
            <p className="text-[13px] text-zinc-500 mt-0.5">{totalMemories.toLocaleString()} memories · {sources.length} sources</p>
            {/* Source distribution mini-bar */}
            {totalMemories > 0 && activeSourceTypes.length > 1 && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className="flex h-[4px] rounded-full overflow-hidden bg-white/[0.04] w-32 sm:w-48">
                  {activeSourceTypes.map(([type, count]) => {
                    const pct = (count / totalMemories) * 100;
                    const colorMap: Record<string, string> = {
                      chatgpt: "bg-green-500/70", text: "bg-teal-500/70", file: "bg-blue-500/70",
                      url: "bg-orange-500/70", kindle: "bg-amber-500/70", document: "bg-blue-500/70",
                      youtube: "bg-red-500/70", bookmark: "bg-sky-500/70", obsidian: "bg-teal-500/70",
                      reddit: "bg-orange-500/70", audio: "bg-teal-500/70", image: "bg-sky-500/70",
                      notion: "bg-zinc-400/70", twitter: "bg-sky-500/70", telegram: "bg-teal-500/70",
                      pocket: "bg-emerald-500/70", instapaper: "bg-emerald-500/70",
                      spotify: "bg-emerald-500/70", readwise: "bg-amber-500/70",
                    };
                    return (
                      <div
                        key={type}
                        className={`h-full ${colorMap[type] || "bg-zinc-500/70"}`}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                        title={`${type}: ${count} (${Math.round(pct)}%)`}
                      />
                    );
                  })}
                </div>
                <span className="text-[9px] text-zinc-700">{activeSourceTypes.length} types</span>
              </div>
            )}
          </div>
          {memories.length > 0 && (
            <button
              onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-all active:scale-[0.96] ${
                selectMode
                  ? "text-teal-300 bg-teal-500/10"
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
            onChange={(e) => { setSearch(e.target.value); setActiveSavedSearchId(null); }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => { /* delay so click events on history items fire first */ setTimeout(() => setSearchFocused(false), 200); }}
            className="w-full h-10 pl-10 pr-24 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-teal-500/30 focus:border-teal-500/30 transition-all"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {/* Saved searches toggle */}
            {savedSearches.length > 0 && (
              <button
                onClick={() => setSavedSearchMenuOpen(!savedSearchMenuOpen)}
                className={`p-1.5 rounded-lg transition-all ${
                  savedSearchMenuOpen || activeSavedSearchId
                    ? 'text-teal-400 bg-teal-500/10'
                    : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.06]'
                }`}
                title="Saved searches"
              >
                <Star className="w-3.5 h-3.5" />
              </button>
            )}
            {/* Save current search */}
            {hasActiveFilters && !currentMatchesSaved && (
              <button
                onClick={() => { setSaveSearchDialogOpen(true); setSaveSearchName(search || 'My search'); }}
                className="p-1.5 rounded-lg text-zinc-600 hover:text-teal-400 hover:bg-teal-500/10 transition-all"
                title="Save this search"
              >
                <Bookmark className="w-3.5 h-3.5" />
              </button>
            )}
            {search ? (
              <button onClick={() => { setSearch(""); setActiveSavedSearchId(null); }} className="p-0.5">
                <X className="w-3.5 h-3.5 text-zinc-500" />
              </button>
            ) : (
              <kbd className="text-[10px] font-mono text-zinc-700 bg-white/[0.04] border border-white/[0.08] rounded px-1.5 py-[2px] hidden sm:block">/</kbd>
            )}
          </div>
        </div>

        {/* Saved Searches Dropdown */}
        {savedSearchMenuOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setSavedSearchMenuOpen(false)} />
            <div className="relative z-30 mt-2 rounded-xl border border-white/[0.08] bg-[#131315] shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Saved Searches</span>
                <span className="text-[10px] text-zinc-600">{savedSearches.length} saved</span>
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {savedSearches.map((ss) => {
                  const colors: Record<string, string> = {
                    teal: 'text-teal-400', sky: 'text-sky-400', emerald: 'text-emerald-400',
                    amber: 'text-amber-400', red: 'text-red-400', blue: 'text-blue-400',
                  };
                  return (
                    <div
                      key={ss.id}
                      className={`group flex items-center gap-2 px-3 py-2 hover:bg-white/[0.04] transition-colors cursor-pointer ${
                        activeSavedSearchId === ss.id ? 'bg-teal-500/[0.06]' : ''
                      }`}
                      onClick={() => handleApplySavedSearch(ss)}
                    >
                      <Star className={`w-3 h-3 shrink-0 ${ss.pinned ? 'fill-current' : ''} ${colors[ss.color] || colors.teal}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-zinc-200 truncate">{ss.name}</p>
                        <p className="text-[10px] text-zinc-600 truncate">{describeSavedSearch(ss)}</p>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleTogglePinSavedSearch(ss.id); }}
                          className="p-1 rounded-md hover:bg-white/[0.08] transition-colors"
                          title={ss.pinned ? 'Unpin' : 'Pin'}
                        >
                          <Pin className={`w-2.5 h-2.5 ${ss.pinned ? 'text-amber-400 fill-amber-400/30' : 'text-zinc-600'}`} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteSavedSearch(ss.id, ss.name); }}
                          className="p-1 rounded-md hover:bg-red-500/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-2.5 h-2.5 text-zinc-600 hover:text-red-400" />
                        </button>
                      </div>
                      {ss.useCount > 0 && (
                        <span className="text-[9px] text-zinc-700 tabular-nums shrink-0">{ss.useCount}×</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Save Search Dialog */}
        {saveSearchDialogOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setSaveSearchDialogOpen(false)} />
            <div className="relative z-30 mt-2 rounded-xl border border-white/[0.08] bg-[#131315] shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 p-4">
              <h3 className="text-[13px] font-medium text-zinc-200 mb-3">Save this search</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  value={saveSearchName}
                  onChange={(e) => setSaveSearchName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveSearch(); if (e.key === 'Escape') setSaveSearchDialogOpen(false); }}
                  placeholder="Search name..."
                  className="w-full h-8 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] placeholder:text-zinc-600 focus:outline-none focus:border-teal-500/30 transition-all"
                  autoFocus
                />
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-600 mr-1">Color:</span>
                  {(['teal', 'sky', 'emerald', 'amber', 'red', 'blue'] as const).map(c => (
                    <button
                      key={c}
                      onClick={() => setSaveSearchColor(c)}
                      className={`w-5 h-5 rounded-full transition-all ${
                        saveSearchColor === c ? 'ring-2 ring-offset-1 ring-offset-[#131315]' : ''
                      } ${
                        c === 'teal' ? 'bg-teal-500 ring-teal-400' :
                        c === 'sky' ? 'bg-sky-500 ring-sky-400' :
                        c === 'emerald' ? 'bg-emerald-500 ring-emerald-400' :
                        c === 'amber' ? 'bg-amber-500 ring-amber-400' :
                        c === 'red' ? 'bg-red-500 ring-red-400' :
                        'bg-blue-500 ring-blue-400'
                      }`}
                    />
                  ))}
                </div>
                <div className="text-[10px] text-zinc-600 space-y-0.5">
                  {search && <p>Query: "{search}"</p>}
                  {filter && <p>Source: {filter}</p>}
                  {tagFilter && <p>Tag: {tagFilter}</p>}
                  {sortBy !== 'newest' && <p>Sort: {sortBy}</p>}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setSaveSearchDialogOpen(false)}
                    className="h-7 px-3 rounded-lg text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSearch}
                    disabled={!saveSearchName.trim()}
                    className="h-7 px-3 rounded-lg text-[11px] font-medium text-black bg-teal-500 hover:bg-teal-400 transition-all disabled:opacity-50 active:scale-[0.97]"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Active saved search indicator */}
        {activeSavedSearchId && (() => {
          const active = savedSearches.find(s => s.id === activeSavedSearchId);
          if (!active) return null;
          const colors: Record<string, string> = {
            teal: 'border-teal-500/20 bg-teal-500/[0.06] text-teal-400',
            sky: 'border-sky-500/20 bg-sky-500/[0.06] text-sky-400',
            emerald: 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400',
            amber: 'border-amber-500/20 bg-amber-500/[0.06] text-amber-400',
            red: 'border-red-500/20 bg-red-500/[0.06] text-red-400',
            blue: 'border-blue-500/20 bg-blue-500/[0.06] text-blue-400',
          };
          return (
            <div className={`mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colors[active.color] || colors.teal}`}>
              <Star className="w-3 h-3 fill-current" />
              <span className="text-[11px] font-medium">{active.name}</span>
              <button
                onClick={() => { setActiveSavedSearchId(null); setSearch(''); setFilter(null); setTagFilter(null); setSortBy('newest'); }}
                className="ml-auto p-0.5 hover:bg-white/[0.08] rounded transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })()}

        {/* Search History — shown when search is focused and empty */}
        {searchFocused && !search && searchHistory.length > 0 && !savedSearchMenuOpen && !saveSearchDialogOpen && (
          <>
            <div className="fixed inset-0 z-15" onClick={() => setSearchFocused(false)} />
            <div className="relative z-20 mt-2 rounded-xl border border-white/[0.08] bg-[#131315] shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
                <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  Recent Searches
                </span>
                <button
                  onClick={() => { clearSearchHistory(); setSearchHistory([]); }}
                  className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="py-1 max-h-48 overflow-y-auto">
                {searchHistory.slice(0, 8).map((item) => (
                  <div
                    key={item.query}
                    className="group flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.04] transition-colors cursor-pointer"
                    onClick={() => { setSearch(item.query); setSearchFocused(false); }}
                  >
                    <Search className="w-3 h-3 text-zinc-700 shrink-0" />
                    <span className="text-[12px] text-zinc-300 truncate flex-1">{item.query}</span>
                    {item.resultCount !== undefined && (
                      <span className="text-[10px] text-zinc-600 tabular-nums shrink-0">{item.resultCount} results</span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSearchFromHistory(item.query);
                        setSearchHistory(getSearchHistory());
                      }}
                      className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/[0.08] transition-all"
                    >
                      <X className="w-2.5 h-2.5 text-zinc-600" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </Stagger>

      {/* Filters + View + Sort */}
      <Stagger>
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 pb-0.5 min-w-0">
            <FilterPill active={filter === null} onClick={() => setFilter(null)} label="All" />
            <FilterPill
              active={filter === "pinned"}
              onClick={() => setFilter(filter === "pinned" ? null : "pinned")}
              label="Pinned"
              icon={<Pin className="w-3 h-3" />}
            />
            {activeSourceTypes.map(([type, count]) => {
              const cfg = getSourceType(type);
              const Icon = cfg.icon;
              return <FilterPill key={type} active={filter === type} onClick={() => setFilter(filter === type ? null : type)} label={type} count={count} icon={<Icon className="w-3 h-3" />} />;
            })}
            {/* Tag filter pills */}
            {allTags.length > 0 && (
              <>
                <div className="w-px h-4 bg-white/[0.08] shrink-0 mx-0.5" />
                {allTags.map(tag => (
                  <FilterPill
                    key={`tag-${tag.id}`}
                    active={tagFilter === tag.id}
                    onClick={() => setTagFilter(tagFilter === tag.id ? null : tag.id)}
                    label={tag.name}
                    count={tag.memory_count}
                    icon={<Tag className="w-3 h-3" />}
                    tagColor={tag.color}
                  />
                ))}
              </>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* View Mode Toggle */}
            {memories.length > 0 && (
              <div className="hidden sm:flex items-center bg-white/[0.03] border border-white/[0.06] rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 transition-all ${
                    viewMode === "list"
                      ? "bg-teal-500/15 text-teal-300"
                      : "text-zinc-600 hover:text-zinc-400"
                  }`}
                  title="List view"
                >
                  <LayoutList className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("compact")}
                  className={`p-1.5 transition-all ${
                    viewMode === "compact"
                      ? "bg-teal-500/15 text-teal-300"
                      : "text-zinc-600 hover:text-zinc-400"
                  }`}
                  title="Compact view"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Sort Dropdown */}
            {!search.trim() && memories.length > 0 && (
            <div className="relative shrink-0">
              <button
                onClick={() => setSortMenuOpen(!sortMenuOpen)}
                className={`flex items-center gap-1.5 h-[30px] px-2.5 rounded-full text-[11px] font-medium transition-all active:scale-[0.95] ${
                  sortMenuOpen
                    ? "bg-teal-500/15 text-teal-300 border border-teal-500/25"
                    : "text-zinc-500 border border-white/[0.06] hover:bg-white/[0.04] hover:text-zinc-300"
                }`}
              >
                <ArrowUpDown className="w-3 h-3" />
                <span className="hidden sm:inline">{SORT_OPTIONS.find(s => s.id === sortBy)?.label || 'Sort'}</span>
              </button>

              {sortMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setSortMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 z-40 w-44 bg-[#151517] border border-white/[0.1] rounded-xl shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="py-1">
                      {SORT_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => { setSortBy(opt.id); setSortMenuOpen(false); }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12px] transition-colors ${
                            sortBy === opt.id
                              ? "text-teal-300 bg-teal-500/10"
                              : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                          }`}
                        >
                          <opt.icon className={`w-3.5 h-3.5 shrink-0 ${sortBy === opt.id ? "text-teal-400" : "text-zinc-600"}`} />
                          <span className="flex-1">{opt.label}</span>
                          {sortBy === opt.id && (
                            <div className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          </div>
        </div>
      </Stagger>

      {/* Search Intelligence Indicators */}
      {search.trim() && !loading && (
        <Stagger>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-teal-400/80 font-semibold tabular-nums">
              {memories.length} result{memories.length !== 1 ? "s" : ""}
            </span>
            {searchLayers && (
              <>
                <span className="w-[3px] h-[3px] rounded-full bg-zinc-700" />
                <span className="text-[10px] text-zinc-600 font-medium">via</span>
                <div className="flex items-center gap-1.5">
                  {searchLayers.bm25 > 0 && (
                    <span className="inline-flex items-center gap-1 text-[9px] px-2 py-[3px] rounded-lg font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/15">
                      🔤 Keyword <span className="text-[8px] opacity-60 ml-0.5">{searchLayers.bm25}</span>
                    </span>
                  )}
                  {searchLayers.vector > 0 && (
                    <span className="inline-flex items-center gap-1 text-[9px] px-2 py-[3px] rounded-lg font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/15">
                      🧠 Semantic <span className="text-[8px] opacity-60 ml-0.5">{searchLayers.vector}</span>
                    </span>
                  )}
                  {searchLayers.tree > 0 && (
                    <span className="inline-flex items-center gap-1 text-[9px] px-2 py-[3px] rounded-lg font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                      🌳 Structure <span className="text-[8px] opacity-60 ml-0.5">{searchLayers.tree}</span>
                    </span>
                  )}
                </div>
                {searchLayers.bm25 > 0 && !searchLayers.vector && !searchLayers.tree && (
                  <Link href="/app/settings" className="text-[9px] text-zinc-600 hover:text-teal-400 transition-colors italic">
                    Connect AI for semantic search →
                  </Link>
                )}
              </>
            )}
          </div>
        </Stagger>
      )}

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
                  <CheckSquare className="w-3.5 h-3.5 text-teal-400" />
                ) : (
                  <Square className="w-3.5 h-3.5" />
                )}
                {selectedIds.size === memories.length ? "Deselect all" : "Select all"}
              </button>
              {selectedIds.size > 0 && (
                <span className="text-[11px] text-teal-400 font-medium tabular-nums shrink-0">
                  {selectedIds.size} selected
                </span>
              )}
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-1">
                {/* Batch tag */}
                <div className="relative">
                  <button
                    onClick={() => setBatchTagMenuOpen(!batchTagMenuOpen)}
                    className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium text-teal-400 hover:text-teal-300 hover:bg-teal-500/10 transition-all active:scale-[0.96]"
                    title="Tag selected memories"
                  >
                    <Tag className="w-3 h-3" />
                    <span className="hidden sm:inline">Tag</span>
                  </button>
                  {batchTagMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setBatchTagMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-1.5 z-40 w-48 bg-[#151517] border border-white/[0.1] rounded-xl shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        <div className="p-2 border-b border-white/[0.06]">
                          <div className="flex gap-1.5">
                            <input
                              placeholder="New tag…"
                              value={newTagName}
                              onChange={(e) => setNewTagName(e.target.value)}
                              onKeyDown={async (e) => {
                                if (e.key === 'Enter' && newTagName.trim()) {
                                  const tag = await createTag(newTagName);
                                  if (tag) {
                                    await handleBatchTag(tag.id);
                                  }
                                }
                              }}
                              className="flex-1 h-7 px-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] placeholder:text-zinc-600 focus:outline-none focus:border-teal-500/30 transition-all"
                              autoFocus
                            />
                          </div>
                        </div>
                        {allTags.length > 0 ? (
                          <div className="py-1 max-h-40 overflow-y-auto">
                            {allTags.map(tag => (
                              <button
                                key={tag.id}
                                onClick={() => handleBatchTag(tag.id)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-white/[0.06] transition-colors"
                              >
                                <div className={`w-2 h-2 rounded-full ${tagDotColor(tag.color)}`} />
                                <span className="text-[12px] text-zinc-300">{tag.name}</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="px-3 py-2 text-[11px] text-zinc-600 italic">Type to create a tag</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
                {/* Batch Pin/Unpin */}
                {(() => {
                  const selectedMems = memories.filter(m => selectedIds.has(m.id));
                  const allPinned = selectedMems.length > 0 && selectedMems.every(m => m.pinned);
                  return (
                    <button
                      onClick={() => handleBatchPin(!allPinned)}
                      disabled={batchPinning}
                      className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-all active:scale-[0.96] disabled:opacity-50"
                      title={allPinned ? "Unpin selected" : "Pin selected"}
                    >
                      {batchPinning ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : allPinned ? (
                        <PinOff className="w-3 h-3" />
                      ) : (
                        <Pin className="w-3 h-3" />
                      )}
                      <span className="hidden sm:inline">{allPinned ? "Unpin" : "Pin"}</span>
                    </button>
                  );
                })()}
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
      <div ref={listRef} className={viewMode === "compact" ? "space-y-px" : "space-y-1.5"}>
        {memories.map((m, idx) => {
          const cfg = getSourceType(m.source);
          const Icon = cfg.icon;
          const isFocused = focusedIndex === idx;
          const isSelected = selectedIds.has(m.id);
          const scorePercent = m.score ? Math.round(m.score * 100) : 0;

          if (viewMode === "compact") {
            // ═══ Compact View — dense rows for power users ═══
            return (
              <button
                key={m.id}
                onClick={() => {
                  if (selectMode) { toggleSelect(m.id); }
                  else { setSelected(m); setSelectedIndex(idx); setFocusedIndex(idx); setCopied(false); }
                }}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2 transition-all ${
                  isSelected
                    ? "bg-teal-500/[0.08] ring-1 ring-teal-500/20"
                    : isFocused
                    ? "bg-teal-500/[0.06]"
                    : "hover:bg-white/[0.04]"
                } ${idx === 0 ? "rounded-t-xl" : ""} ${idx === memories.length - 1 ? "rounded-b-xl" : ""}`}
              >
                {selectMode && (
                  <div className={`w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center shrink-0 transition-all ${
                    isSelected ? "bg-teal-500 border-teal-500" : "border-white/[0.15] bg-white/[0.02]"
                  }`}>
                    {isSelected && <Check className="w-2 h-2 text-white" />}
                  </div>
                )}
                <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${cfg.bgColor}`}>
                  <Icon className={`w-2.5 h-2.5 ${cfg.textColor}`} />
                </div>
                <span className="text-[12px] text-zinc-400 truncate w-28 shrink-0">{m.sourceTitle || "Untitled"}</span>
                <span className="text-[12px] text-zinc-500 truncate flex-1">{m.content.replace(/\n/g, " ").slice(0, 120)}</span>
                {search.trim() && scorePercent > 0 && (
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="w-10 h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full rounded-full bg-teal-500/60" style={{ width: `${Math.max(scorePercent, 8)}%` }} />
                    </div>
                    <span className="text-[9px] text-zinc-600 tabular-nums font-mono w-6 text-right">{scorePercent}%</span>
                  </div>
                )}
                <span className="text-[10px] text-zinc-700 tabular-nums shrink-0 w-10 text-right">
                  {new Date(m.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                {m.tags && m.tags.length > 0 && (
                  <span className="flex items-center gap-[2px] shrink-0">
                    {m.tags.slice(0, 3).map(tag => (
                      <span key={tag.id} className={`w-[5px] h-[5px] rounded-full ${tagDotColor(tag.color)}`} title={tag.name} />
                    ))}
                    {m.tags.length > 3 && <span className="text-[8px] text-zinc-600">+{m.tags.length - 3}</span>}
                  </span>
                )}
                {m.pinned && <Pin className="w-2.5 h-2.5 text-amber-400 shrink-0 fill-amber-400/30" />}
                {search.trim() && m.layers && (
                  <span className="flex items-center gap-[2px] shrink-0" title={
                    [m.layers.bm25 && 'Keyword', m.layers.vector && 'Semantic', m.layers.tree && 'Structure'].filter(Boolean).join(' + ')
                  }>
                    {m.layers.bm25 && <span className="w-[4px] h-[4px] rounded-full bg-blue-400/70" />}
                    {m.layers.vector && <span className="w-[4px] h-[4px] rounded-full bg-teal-400/70" />}
                    {m.layers.tree && <span className="w-[4px] h-[4px] rounded-full bg-emerald-400/70" />}
                  </span>
                )}
              </button>
            );
          }

          // ═══ List View — rich cards (default) ═══
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
                  ? "border-teal-500/30 bg-teal-500/[0.08] ring-1 ring-teal-500/20"
                  : isFocused
                  ? "border-teal-500/30 bg-teal-500/[0.06] ring-1 ring-teal-500/20"
                  : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                {selectMode && (
                  <div className={`w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 transition-all ${
                    isSelected
                      ? "bg-teal-500 border-teal-500"
                      : "border-white/[0.15] bg-white/[0.02]"
                  }`}>
                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                )}
                <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-[2px] rounded-md font-semibold uppercase tracking-wide ${cfg.badgeClasses}`}>
                  <Icon className="w-2.5 h-2.5" />
                  {m.source}
                </span>
                <span className="text-[11px] text-zinc-600 truncate flex-1">{m.sourceTitle}</span>
                {/* Search relevance score */}
                {search.trim() && scorePercent > 0 && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="w-12 h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          scorePercent > 70 ? "bg-emerald-500/60" :
                          scorePercent > 40 ? "bg-teal-500/60" :
                          "bg-sky-500/60"
                        }`}
                        style={{ width: `${Math.max(scorePercent, 8)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-zinc-600 tabular-nums font-mono">{scorePercent}%</span>
                  </div>
                )}
                <span className="text-[10px] text-zinc-700 tabular-nums shrink-0">
                  {new Date(m.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                {m.pinned && (
                  <Pin className="w-3 h-3 text-amber-400 shrink-0 fill-amber-400/30" />
                )}
                {/* Layer indicators per result (when searching) */}
                {search.trim() && m.layers && (
                  <span className="flex items-center gap-[3px] shrink-0 ml-0.5" title={
                    [m.layers.bm25 && 'Keyword', m.layers.vector && 'Semantic', m.layers.tree && 'Structure'].filter(Boolean).join(' + ')
                  }>
                    {m.layers.bm25 && <span className="w-[5px] h-[5px] rounded-full bg-blue-400/70" />}
                    {m.layers.vector && <span className="w-[5px] h-[5px] rounded-full bg-teal-400/70" />}
                    {m.layers.tree && <span className="w-[5px] h-[5px] rounded-full bg-emerald-400/70" />}
                  </span>
                )}
              </div>
              <p className={`text-[13px] text-zinc-300 line-clamp-2 leading-relaxed ${selectMode ? 'pl-6' : ''}`}>{m.content}</p>
              {/* Tags + Word count hint in list view */}
              <div className={`flex items-center gap-2 mt-1.5 flex-wrap ${selectMode ? 'pl-6' : ''}`}>
                {m.tags && m.tags.length > 0 && m.tags.map(tag => (
                  <span key={tag.id} className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-[2px] rounded-md font-semibold ${tagColorClasses(tag.color)}`}>
                    <Tag className="w-2 h-2" />
                    {tag.name}
                  </span>
                ))}
                {!search.trim() && (
                  <span className="text-[10px] text-zinc-700">
                    {m.content.trim().split(/\s+/).length} words
                  </span>
                )}
              </div>
            </button>
          );
        })}

        {/* Infinite scroll sentinel */}
        {totalMemories > memories.length && !search && (
          <div ref={sentinelRef} className="flex items-center justify-center py-4">
            {loadingMore ? (
              <div className="flex items-center gap-2 text-[12px] text-zinc-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />
                Loading more…
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-600">
                <MoreHorizontal className="w-3.5 h-3.5" />
                {totalMemories - memories.length} more
              </div>
            )}
          </div>
        )}

        {memories.length === 0 && !loading && (
          <div className="text-center py-16">
            {totalMemories === 0 ? (
              <div className="space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto">
                  <Search className="w-6 h-6 text-zinc-700" />
                </div>
                <div>
                  <p className="text-[14px] text-zinc-400 font-medium">Your knowledge base is empty</p>
                  <p className="text-[12px] text-zinc-600 mt-1">Import conversations, notes, or files to get started</p>
                </div>
                <Link
                  href="/app/import"
                  className="inline-flex items-center gap-1.5 h-9 px-5 rounded-xl bg-teal-600 hover:bg-teal-500 text-[13px] font-medium text-white transition-all active:scale-[0.97] mt-2"
                >
                  Import your first memory
                </Link>
              </div>
            ) : search.trim() ? (
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto">
                  <Search className="w-5 h-5 text-zinc-700" />
                </div>
                <p className="text-[13px] text-zinc-500">No results for &ldquo;{search}&rdquo;</p>
                <p className="text-[11px] text-zinc-700">Try a different query or remove filters</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[13px] text-zinc-500">No memories match this filter</p>
                <button
                  onClick={() => setFilter(null)}
                  className="text-[12px] text-teal-400 hover:text-teal-300 transition-colors"
                >
                  Clear filter →
                </button>
              </div>
            )}
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
        <div className="fixed inset-0 z-[60]" onClick={() => { if (!editing) { setSelected(null); setCopied(false); setEditing(false); setTagAssignOpen(false); } }}>
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
                    className="w-full text-[15px] font-semibold bg-transparent border-b border-teal-500/30 focus:border-teal-500/60 outline-none pb-0.5 transition-colors placeholder:text-zinc-600"
                  />
                ) : (
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-[15px] font-semibold truncate">{selected.sourceTitle}</h3>
                    {selected.pinned && (
                      <Pin className="w-3.5 h-3.5 text-amber-400 fill-amber-400/30 shrink-0" />
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] px-1.5 py-[2px] rounded-md font-semibold uppercase tracking-wide ${getSourceType(selected.source).badgeClasses}`}>
                    {selected.source}
                  </span>
                  <span className="text-[11px] text-zinc-500">{new Date(selected.timestamp).toLocaleDateString()}</span>
                  {editing && (
                    <span className="text-[10px] text-teal-400 font-medium animate-pulse">Editing</span>
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
                <button onClick={() => { if (editing) cancelEditing(); setSelected(null); setCopied(false); setEditing(false); setTagAssignOpen(false); }} className="p-1.5 -mr-1 hover:bg-white/[0.06] rounded-lg">
                  <X className="w-4 h-4 text-zinc-500" />
                </button>
              </div>
            </div>

            {/* Content Stats Bar */}
            {!editing && selected.content && (
              <div className="px-5 py-2 border-b border-white/[0.04] bg-white/[0.01] flex items-center gap-3 flex-wrap">
                {(() => {
                  const words = selected.content.trim().split(/\s+/).filter(Boolean).length;
                  const chars = selected.content.length;
                  const readMins = Math.max(1, Math.round(words / 225));
                  return (
                    <>
                      <span className="flex items-center gap-1 text-[10px] text-zinc-600" title={`${words.toLocaleString()} words`}>
                        <Hash className="w-2.5 h-2.5 text-zinc-700" />
                        {words.toLocaleString()} words
                      </span>
                      <span className="w-[3px] h-[3px] rounded-full bg-zinc-800" />
                      <span className="flex items-center gap-1 text-[10px] text-zinc-600" title={`${chars.toLocaleString()} characters`}>
                        {chars.toLocaleString()} chars
                      </span>
                      <span className="w-[3px] h-[3px] rounded-full bg-zinc-800" />
                      <span className="flex items-center gap-1 text-[10px] text-zinc-600" title="Estimated reading time at 225 wpm">
                        <BookOpen className="w-2.5 h-2.5 text-zinc-700" />
                        {readMins} min read
                      </span>
                      {selected.importedAt && selected.importedAt !== selected.timestamp && (
                        <>
                          <span className="w-[3px] h-[3px] rounded-full bg-zinc-800" />
                          <span className="flex items-center gap-1 text-[10px] text-zinc-600" title={`Imported ${new Date(selected.importedAt).toLocaleString()}`}>
                            <Clock className="w-2.5 h-2.5 text-zinc-700" />
                            Imported {new Date(selected.importedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* Content area — view or edit */}
            <div className="px-5 py-4 overflow-y-auto max-h-[55dvh] md:max-h-[50vh]">
              {editing ? (
                <textarea
                  ref={editTextareaRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full min-h-[200px] text-[13px] text-zinc-300 leading-[1.7] bg-white/[0.02] border border-white/[0.08] rounded-xl p-3.5 focus:outline-none focus:ring-1 focus:ring-teal-500/30 focus:border-teal-500/30 resize-y transition-all placeholder:text-zinc-600 font-mono"
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

            {/* Related Memories — semantic connections */}
            {!editing && (relatedLoading || relatedMemories.length > 0) && (
              <div className="px-5 py-3 border-t border-white/[0.04] bg-white/[0.01]">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-3 h-3 text-teal-400/70" />
                  <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.08em]">
                    Related memories
                  </span>
                  {relatedLoading && (
                    <Loader2 className="w-2.5 h-2.5 text-zinc-600 animate-spin ml-1" />
                  )}
                </div>
                {relatedMemories.length > 0 ? (
                  <div className="space-y-1">
                    {relatedMemories.map((rel) => {
                      const relSt = getSourceType(rel.type);
                      const Icon = relSt.icon;
                      const scorePercent = Math.round(rel.score * 100);
                      return (
                        <button
                          key={rel.id}
                          onClick={() => openRelatedMemory(rel.id)}
                          className="w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] hover:border-white/[0.08] transition-all group/rel active:scale-[0.99]"
                        >
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${relSt.bgColor}`}>
                            <Icon className={`w-3 h-3 ${relSt.textColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] text-zinc-300 font-medium truncate group-hover/rel:text-white transition-colors">
                              {rel.title}
                            </p>
                            <p className="text-[11px] text-zinc-600 truncate mt-0.5">
                              {rel.preview || "No preview"}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 opacity-60 group-hover/rel:opacity-100 transition-opacity">
                            <div className="w-8 h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-teal-500/50"
                                style={{ width: `${Math.max(scorePercent, 10)}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-zinc-600 tabular-nums font-mono w-5 text-right">
                              {scorePercent}%
                            </span>
                            <ExternalLink className="w-2.5 h-2.5 text-zinc-700 group-hover/rel:text-teal-400 transition-colors" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : relatedLoading ? (
                  <div className="flex items-center gap-2 py-2 px-2.5">
                    <div className="w-6 h-6 rounded-lg bg-white/[0.04] animate-pulse" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-2/3 bg-white/[0.04] rounded animate-pulse" />
                      <div className="h-2.5 w-1/2 bg-white/[0.03] rounded animate-pulse" />
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Tags — view & manage tags on this memory */}
            {!editing && (
              <div className="px-5 py-3 border-t border-white/[0.04] bg-white/[0.01]">
                <div className="flex items-center gap-1.5 mb-2">
                  <Tag className="w-3 h-3 text-teal-400/70" />
                  <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.08em]">
                    Tags
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Existing tags on this memory */}
                  {(selected.tags || []).map(tag => (
                    <span key={tag.id} className={`inline-flex items-center gap-1 text-[10px] px-2 py-[3px] rounded-lg font-semibold border ${tagColorClasses(tag.color)} group/tag`}>
                      <Tag className="w-2.5 h-2.5" />
                      {tag.name}
                      <button
                        onClick={(e) => { e.stopPropagation(); unassignTag(tag.id, [selected.id]); }}
                        className="ml-0.5 opacity-0 group-hover/tag:opacity-100 hover:text-white transition-all"
                        title="Remove tag"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                  {/* Add tag button */}
                  <div className="relative">
                    <button
                      onClick={() => setTagAssignOpen(!tagAssignOpen)}
                      className="inline-flex items-center gap-1 text-[10px] px-2 py-[3px] rounded-lg font-medium text-zinc-600 border border-dashed border-white/[0.1] hover:border-teal-500/30 hover:text-teal-400 transition-all"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      Add tag
                    </button>
                    {/* Tag assign dropdown */}
                    {tagAssignOpen && (
                      <>
                        <div className="fixed inset-0 z-[70]" onClick={() => setTagAssignOpen(false)} />
                        <div className="absolute bottom-full mb-1.5 left-0 z-[80] w-52 bg-[#151517] border border-white/[0.1] rounded-xl shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                          <div className="p-2 border-b border-white/[0.06]">
                            <div className="flex gap-1.5">
                              <input
                                placeholder="New tag…"
                                value={newTagName}
                                onChange={(e) => setNewTagName(e.target.value)}
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter' && newTagName.trim()) {
                                    const tag = await createTag(newTagName);
                                    if (tag) {
                                      await assignTag(tag.id, [selected.id]);
                                      setTagAssignOpen(false);
                                    }
                                  }
                                }}
                                className="flex-1 h-7 px-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] placeholder:text-zinc-600 focus:outline-none focus:border-teal-500/30 transition-all"
                                autoFocus
                              />
                              {newTagName.trim() && (
                                <button
                                  onClick={async () => {
                                    const tag = await createTag(newTagName);
                                    if (tag) {
                                      await assignTag(tag.id, [selected.id]);
                                      setTagAssignOpen(false);
                                    }
                                  }}
                                  disabled={creatingTag}
                                  className="h-7 px-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-[11px] font-medium text-white shrink-0 transition-all disabled:opacity-50"
                                >
                                  {creatingTag ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          </div>
                          {allTags.length > 0 && (
                            <div className="py-1 max-h-40 overflow-y-auto">
                              {allTags
                                .filter(tag => !selected.tags?.some(t => t.id === tag.id))
                                .map(tag => (
                                  <button
                                    key={tag.id}
                                    onClick={async () => {
                                      await assignTag(tag.id, [selected.id]);
                                      setTagAssignOpen(false);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-white/[0.06] transition-colors"
                                  >
                                    <div className={`w-2 h-2 rounded-full ${tagDotColor(tag.color)}`} />
                                    <span className="text-[12px] text-zinc-300">{tag.name}</span>
                                    <span className="text-[10px] text-zinc-600 ml-auto">{tag.memory_count}</span>
                                  </button>
                                ))}
                              {allTags.filter(tag => !selected.tags?.some(t => t.id === tag.id)).length === 0 && (
                                <p className="px-3 py-2 text-[11px] text-zinc-600 italic">All tags assigned</p>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

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
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-medium bg-teal-600 hover:bg-teal-500 text-white transition-all active:scale-[0.97] disabled:opacity-50"
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
                      onClick={() => togglePin(selected)}
                      disabled={pinning}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                        selected.pinned
                          ? "text-amber-400 hover:bg-amber-500/10"
                          : "text-zinc-400 hover:bg-white/[0.06]"
                      }`}
                      title={selected.pinned ? "Unpin (p)" : "Pin to top (p)"}
                    >
                      {pinning ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : selected.pinned ? (
                        <PinOff className="w-3.5 h-3.5" />
                      ) : (
                        <Pin className="w-3.5 h-3.5" />
                      )}
                      {selected.pinned ? "Unpin" : "Pin"}
                    </button>
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
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-teal-400 hover:bg-teal-500/10 transition-colors"
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
                    <kbd className="font-mono bg-white/[0.04] border border-white/[0.06] rounded px-1 py-[1px] text-[9px]">p</kbd>
                    pin
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

function FilterPill({ active, onClick, label, count, icon, tagColor }: {
  active: boolean; onClick: () => void; label: string; count?: number; icon?: React.ReactNode; tagColor?: string;
}) {
  // For tag pills, use their color when active
  const activeStyle = tagColor
    ? `${tagColorClasses(tagColor).replace('border-', 'border border-')} shadow-sm`
    : "bg-teal-500/15 text-teal-300 border border-teal-500/25 shadow-sm shadow-teal-500/10";
  return (
    <button
      onClick={onClick}
      className={`shrink-0 flex items-center gap-1.5 px-3 py-[6px] rounded-full text-[12px] font-medium transition-all active:scale-[0.95] ${
        active ? activeStyle : "text-zinc-500 border border-white/[0.06] hover:bg-white/[0.04]"
      }`}
    >
      {icon}
      {label}
      {count !== undefined && count > 0 && <span className="text-[10px] opacity-60">{count}</span>}
    </button>
  );
}
