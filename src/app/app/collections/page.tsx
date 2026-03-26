'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FolderOpen, Loader2, Search, X, ChevronRight, Clock,
  FileText, Globe, MessageCircle, Type, BookOpen, Gem,
  MessageSquare, Play, AtSign, Send, Music, BookmarkCheck,
  Highlighter, StickyNote, Mic, Image, Bookmark, FileStack,
  Hash, BarChart3, ArrowRight, Sparkles, TrendingUp,
  LayoutGrid, LayoutList, RefreshCw, ExternalLink,
} from 'lucide-react';
import { getSourceType } from '@/lib/source-types';
import { PageTransition, Stagger } from '@/components/PageTransition';
import { openMemoryDrawer } from '@/components/MemoryDrawer';
import { toast } from 'sonner';
import { usePageTitle } from "@/lib/use-page-title";

// ─── Types ──────────────────────────────────────────────────────

interface CollectionPreview {
  id: string;
  title: string;
  sourceType: string;
  preview: string;
  createdAt: string;
}

interface CollectionTag {
  name: string;
  count: number;
  color: string;
}

interface Collection {
  id: string;
  label: string;
  description: string;
  icon: string;
  memoryCount: number;
  coherence: number;
  sourceBreakdown: Record<string, number>;
  newestDate: string;
  oldestDate: string;
  previews: CollectionPreview[];
  topTags: CollectionTag[];
  wordCount: number;
  allMemoryIds: string[];
}

interface CollectionDetail extends Collection {
  memories: {
    id: string;
    content: string;
    sourceType: string;
    sourceTitle: string;
    displayTitle: string;
    createdAt: string;
    tags: { name: string; color: string }[];
    preview: string;
  }[];
}

interface CollectionStats {
  totalMemories: number;
  clusteredMemories: number;
  unclustered: number;
  collectionCount: number;
  avgCoherence: number;
  insufficientData?: boolean;
}

// ─── Icon Map ───────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageCircle, MessageSquare, Type, StickyNote, Globe, FileStack,
  Gem, BookOpen, FileText, Play, AtSign, Send, Music, Image, Mic,
  FolderOpen, Bookmark, Highlighter, BookmarkCheck,
};

function CollectionIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] || FolderOpen;
  return <Icon className={className} />;
}

// ─── Source Colors ──────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  chatgpt: 'bg-emerald-500',
  claude: 'bg-amber-500',
  text: 'bg-zinc-400',
  url: 'bg-blue-500',
  notion: 'bg-zinc-300',
  obsidian: 'bg-teal-500',
  kindle: 'bg-amber-600',
  pdf: 'bg-red-500',
  youtube: 'bg-red-500',
  reddit: 'bg-orange-500',
  twitter: 'bg-sky-500',
  telegram: 'bg-sky-400',
  spotify: 'bg-emerald-500',
  document: 'bg-blue-500',
};

// ─── Tag Colors ─────────────────────────────────────────────────

const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  teal: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20' },
  sky: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  red: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  zinc: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/20' },
};

// ─── Helpers ────────────────────────────────────────────────────

function timeAgo(date: string): string {
  const now = Date.now();
  const d = new Date(date).getTime();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${(days / 365).toFixed(1)}y ago`;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ─── Component ──────────────────────────────────────────────────

export default function CollectionsPage() {
  usePageTitle("Collections");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<CollectionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // ─── Fetch collections ─────────────────────────────────────

  const fetchCollections = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch('/api/v1/collections');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setCollections(data.collections || []);
      setStats(data.stats || null);
    } catch (err) {
      console.error('Failed to load collections:', err);
      toast.error('Failed to load collections');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchCollections(); }, [fetchCollections]);

  // ─── Open collection detail ────────────────────────────────

  const openCollection = async (collection: Collection) => {
    setDetailLoading(true);
    setSelectedCollection(null);
    try {
      const res = await fetch(`/api/v1/collections?id=${encodeURIComponent(collection.id)}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setSelectedCollection(data.collection);
    } catch (err) {
      console.error('Failed to load collection:', err);
      toast.error('Failed to load collection');
    } finally {
      setDetailLoading(false);
    }
  };

  // ─── Filter ────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!search) return collections;
    const q = search.toLowerCase();
    return collections.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.topTags.some(t => t.name.toLowerCase().includes(q))
    );
  }, [collections, search]);

  // ─── Keyboard ──────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedCollection) {
        setSelectedCollection(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedCollection]);

  // ─── Render ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="animate-pulse rounded-xl bg-white/[0.04] h-7 w-36" />
            <div className="animate-pulse rounded-xl bg-white/[0.04] h-4 w-52" />
          </div>
          <div className="animate-pulse rounded-xl bg-white/[0.04] h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="animate-pulse rounded-xl bg-white/[0.04] w-10 h-10" />
                <div className="flex-1 space-y-1.5">
                  <div className="animate-pulse rounded-xl bg-white/[0.04] h-4 w-28" />
                  <div className="animate-pulse rounded-xl bg-white/[0.04] h-3 w-40" />
                </div>
              </div>
              <div className="animate-pulse rounded-xl bg-white/[0.04] h-3 w-full" />
              <div className="animate-pulse rounded-xl bg-white/[0.04] h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Collection Detail View ────────────────────────────────

  if (selectedCollection) {
    return (
      <PageTransition>
        <div className="space-y-5 md:space-y-6 max-w-5xl mx-auto">
          {/* Back button */}
          <button
            onClick={() => setSelectedCollection(null)}
            className="flex items-center gap-2 text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors group"
          >
            <ChevronRight className="w-3.5 h-3.5 rotate-180 group-hover:-translate-x-0.5 transition-transform" />
            Back to Collections
          </button>

          {/* Header */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 md:p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-teal-500/[0.08] border border-teal-500/20 flex items-center justify-center shrink-0">
                <CollectionIcon name={selectedCollection.icon} className="w-5 h-5 text-teal-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-[20px] md:text-[24px] font-semibold tracking-[-0.02em] text-white">
                  {selectedCollection.label}
                </h1>
                <p className="text-[13px] text-zinc-500 mt-1">{selectedCollection.description}</p>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <span className="text-[12px] text-zinc-500">
                    {selectedCollection.memoryCount} memories
                  </span>
                  <span className="text-[10px] text-zinc-700">·</span>
                  <span className="text-[12px] text-zinc-500">
                    {formatNumber(selectedCollection.wordCount)} words
                  </span>
                  <span className="text-[10px] text-zinc-700">·</span>
                  <span className="text-[12px] text-zinc-500">
                    {selectedCollection.coherence}% coherence
                  </span>
                </div>
              </div>
            </div>

            {/* Source breakdown bar */}
            {Object.keys(selectedCollection.sourceBreakdown).length > 1 && (
              <div className="mt-4 pt-4 border-t border-white/[0.04]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] text-zinc-600 font-medium uppercase tracking-wider">Sources</span>
                </div>
                <div className="flex rounded-full h-2 overflow-hidden bg-white/[0.03]">
                  {Object.entries(selectedCollection.sourceBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([source, count]) => (
                      <div
                        key={source}
                        className={`${SOURCE_COLORS[source] || 'bg-zinc-500'} transition-all`}
                        style={{ width: `${(count / selectedCollection.memoryCount) * 100}%` }}
                        title={`${source}: ${count}`}
                      />
                    ))}
                </div>
                <div className="flex flex-wrap gap-3 mt-2">
                  {Object.entries(selectedCollection.sourceBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([source, count]) => (
                      <span key={source} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                        <span className={`w-2 h-2 rounded-full ${SOURCE_COLORS[source] || 'bg-zinc-500'}`} />
                        {source} ({count})
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {selectedCollection.topTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {selectedCollection.topTags.map(tag => {
                  const colors = TAG_COLORS[tag.color] || TAG_COLORS.teal;
                  return (
                    <span
                      key={tag.name}
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}
                    >
                      {tag.name} ({tag.count})
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Memories list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-medium text-zinc-300">
                Memories in this collection
              </h2>
              <span className="text-[12px] text-zinc-600">
                {selectedCollection.memories?.length || 0} items
              </span>
            </div>

            {selectedCollection.memories?.map((memory, idx) => {
              const src = getSourceType(memory.sourceType);
              return (
                <Stagger key={memory.id}>
                  <button
                    onClick={() => openMemoryDrawer({
                      id: memory.id,
                      content: memory.content,
                      source: memory.sourceType,
                      sourceTitle: memory.sourceTitle || memory.displayTitle || '',
                      timestamp: memory.createdAt,
                    })}
                    className="w-full text-left rounded-xl border border-white/[0.05] bg-white/[0.015] hover:bg-white/[0.03] hover:border-white/[0.08] transition-all p-4 group"
                  >
                    <div className="flex items-start gap-3">
                      {/* Source indicator */}
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${src.bgColor} ${src.borderColor} border`}
                      >
                        <span className={`text-[11px] ${src.textColor}`}>
                          {src.label.slice(0, 2).toUpperCase()}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[13px] font-medium text-zinc-200 truncate">
                            {memory.displayTitle || memory.sourceTitle || 'Untitled'}
                          </span>
                          <ArrowRight className="w-3 h-3 text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                        <p className="text-[12px] text-zinc-500 line-clamp-2 leading-relaxed">
                          {memory.preview}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] text-zinc-600">{src.label}</span>
                          <span className="text-[8px] text-zinc-700">·</span>
                          <span className="text-[10px] text-zinc-600">{timeAgo(memory.createdAt)}</span>
                          {memory.tags.length > 0 && (
                            <>
                              <span className="text-[8px] text-zinc-700">·</span>
                              {memory.tags.slice(0, 3).map(t => (
                                <span key={t.name} className="text-[9px] text-teal-400/60">
                                  #{t.name}
                                </span>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                </Stagger>
              );
            })}
          </div>
        </div>
      </PageTransition>
    );
  }

  // ─── Main Collections View ─────────────────────────────────

  return (
    <PageTransition>
      <div className="space-y-5 md:space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[22px] md:text-[28px] font-semibold tracking-[-0.03em]">
              Collections
            </h1>
            <p className="text-[13px] text-zinc-500 mt-0.5">
              Auto-organized groups based on your knowledge topology
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* View toggle */}
            <div className="flex rounded-xl bg-white/[0.04] border border-white/[0.06] p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-[10px] transition-all ${
                  viewMode === 'grid'
                    ? 'bg-teal-500/15 text-teal-300'
                    : 'text-zinc-600 hover:text-zinc-400'
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-[10px] transition-all ${
                  viewMode === 'list'
                    ? 'bg-teal-500/15 text-teal-300'
                    : 'text-zinc-600 hover:text-zinc-400'
                }`}
                title="List view"
              >
                <LayoutList className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              onClick={() => fetchCollections(true)}
              disabled={refreshing}
              className="h-8 px-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[12px] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats bar */}
        {stats && !stats.insufficientData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Collections', value: stats.collectionCount, icon: FolderOpen, color: 'teal' },
              { label: 'Organized', value: stats.clusteredMemories, icon: Sparkles, color: 'sky' },
              { label: 'Uncategorized', value: stats.unclustered, icon: Hash, color: 'zinc' },
              { label: 'Avg Coherence', value: `${stats.avgCoherence}%`, icon: TrendingUp, color: 'emerald' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 flex items-center gap-3"
              >
                <div className={`w-8 h-8 rounded-lg bg-${stat.color}-500/[0.08] border border-${stat.color}-500/15 flex items-center justify-center`}>
                  <stat.icon className={`w-3.5 h-3.5 text-${stat.color}-400`} />
                </div>
                <div>
                  <p className="text-[16px] font-semibold text-white tracking-[-0.01em]">
                    {typeof stat.value === 'number' ? formatNumber(stat.value) : stat.value}
                  </p>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search collections..."
            className="w-full h-10 pl-10 pr-9 rounded-xl border border-white/[0.06] bg-white/[0.02] text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500/30 focus:ring-1 focus:ring-teal-500/20 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Empty state */}
        {stats?.insufficientData && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-teal-500/[0.08] border border-teal-500/15 flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="w-6 h-6 text-teal-400" />
            </div>
            <h2 className="text-[16px] font-semibold text-zinc-200 mb-1.5">Not enough data yet</h2>
            <p className="text-[13px] text-zinc-500 max-w-md mx-auto">
              Import at least 3 memories with embeddings enabled to see your knowledge automatically organized into collections.
            </p>
          </div>
        )}

        {/* No results */}
        {!stats?.insufficientData && filtered.length === 0 && search && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <p className="text-[14px] text-zinc-400 mb-1">No collections match "{search}"</p>
            <p className="text-[12px] text-zinc-600">Try a different search term</p>
          </div>
        )}

        {/* Collections Grid */}
        {viewMode === 'grid' && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((collection, idx) => (
              <Stagger key={collection.id}>
                <button
                  onClick={() => openCollection(collection)}
                  className="w-full text-left rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.10] transition-all group overflow-hidden"
                >
                  {/* Source bar at top */}
                  <div className="flex h-1.5 overflow-hidden">
                    {Object.entries(collection.sourceBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([source, count]) => (
                        <div
                          key={source}
                          className={`${SOURCE_COLORS[source] || 'bg-zinc-500'} opacity-60`}
                          style={{ width: `${(count / collection.memoryCount) * 100}%` }}
                        />
                      ))}
                  </div>

                  <div className="p-4 md:p-5">
                    {/* Icon + label */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-500/[0.06] border border-teal-500/15 flex items-center justify-center shrink-0">
                        <CollectionIcon name={collection.icon} className="w-4 h-4 text-teal-400/80" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[14px] font-semibold text-zinc-200 tracking-[-0.01em] truncate group-hover:text-white transition-colors">
                          {collection.label}
                        </h3>
                        <p className="text-[11px] text-zinc-600 mt-0.5 truncate">
                          {collection.description}
                        </p>
                      </div>
                    </div>

                    {/* Preview snippets */}
                    <div className="space-y-1.5 mb-3">
                      {collection.previews.slice(0, 3).map(preview => (
                        <div
                          key={preview.id}
                          className="text-[11px] text-zinc-500 truncate pl-3 border-l border-white/[0.04]"
                        >
                          {preview.preview}
                        </div>
                      ))}
                    </div>

                    {/* Tags */}
                    {collection.topTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {collection.topTags.slice(0, 3).map(tag => {
                          const colors = TAG_COLORS[tag.color] || TAG_COLORS.teal;
                          return (
                            <span
                              key={tag.name}
                              className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}
                            >
                              #{tag.name}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Footer stats */}
                    <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                          <BarChart3 className="w-3 h-3" />
                          {collection.memoryCount}
                        </span>
                        <span className="text-[11px] text-zinc-600">
                          {formatNumber(collection.wordCount)} words
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          collection.coherence >= 70 ? 'bg-emerald-500/10 text-emerald-400' :
                          collection.coherence >= 40 ? 'bg-amber-500/10 text-amber-400' :
                          'bg-zinc-500/10 text-zinc-500'
                        }`}>
                          {collection.coherence}%
                        </span>
                        <ChevronRight className="w-3 h-3 text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </div>
                </button>
              </Stagger>
            ))}
          </div>
        )}

        {/* Collections List */}
        {viewMode === 'list' && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((collection, idx) => (
              <Stagger key={collection.id}>
                <button
                  onClick={() => openCollection(collection)}
                  className="w-full text-left rounded-xl border border-white/[0.05] bg-white/[0.015] hover:bg-white/[0.03] hover:border-white/[0.08] transition-all p-4 group flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-teal-500/[0.06] border border-teal-500/15 flex items-center justify-center shrink-0">
                    <CollectionIcon name={collection.icon} className="w-4 h-4 text-teal-400/80" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[13px] font-semibold text-zinc-200 truncate group-hover:text-white transition-colors">
                        {collection.label}
                      </h3>
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
                        collection.coherence >= 70 ? 'bg-emerald-500/10 text-emerald-400' :
                        collection.coherence >= 40 ? 'bg-amber-500/10 text-amber-400' :
                        'bg-zinc-500/10 text-zinc-500'
                      }`}>
                        {collection.coherence}%
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 truncate mt-0.5">{collection.description}</p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-[12px] text-zinc-500 hidden sm:block">
                      {collection.memoryCount} memories
                    </span>
                    <span className="text-[11px] text-zinc-600 hidden md:block">
                      {timeAgo(collection.newestDate)}
                    </span>

                    {/* Mini source bar */}
                    <div className="flex rounded-full h-1.5 w-16 overflow-hidden bg-white/[0.03] hidden sm:flex">
                      {Object.entries(collection.sourceBreakdown)
                        .sort((a, b) => b[1] - a[1])
                        .map(([source, count]) => (
                          <div
                            key={source}
                            className={`${SOURCE_COLORS[source] || 'bg-zinc-500'} opacity-60`}
                            style={{ width: `${(count / collection.memoryCount) * 100}%` }}
                          />
                        ))}
                    </div>

                    <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              </Stagger>
            ))}
          </div>
        )}

        {/* Detail loading overlay */}
        {detailLoading && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
              <p className="text-[13px] text-zinc-400">Loading collection...</p>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
