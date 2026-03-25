"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Puzzle, Search, X, Loader2, Check, AlertTriangle, ChevronRight,
  Upload, BarChart3, Zap, FolderDown, Cpu, Star, Filter,
  BookOpen, FileText, Play, Bookmark, Gem, MessageCircle, AtSign,
  Highlighter, BookmarkCheck, Send, Music, FileStack,
  Network, SearchX, TrendingUp, PenLine, Heart,
  PenSquare, Layers, Mail, FileUser, UserCheck, Route,
  RefreshCw, Download,
  Mic, Image, Languages, Cog, Dna,
  Power, PowerOff, Settings, Trash2,
  ArrowRight, ExternalLink, Sparkles, Package, Grid3X3, LayoutList,
} from "lucide-react";
import { PageTransition, Stagger } from "@/components/PageTransition";

// ─── Types ────────────────────────────────────────────────────────

type PluginType = 'extension' | 'mcp' | 'prompt';
type PluginCategory = 'import' | 'analysis' | 'action' | 'export' | 'ai';

interface Plugin {
  slug: string;
  name: string;
  description: string;
  version: string;
  type: PluginType;
  category: PluginCategory;
  icon: string;
  author: string;
  installed: boolean;
  status?: 'installed' | 'active' | 'disabled' | 'error';
  featured?: boolean;
  tags?: string[];
  capabilities?: string[];
}

interface PluginSummary {
  total: number;
  installed: number;
  active: number;
  byCategory: Record<string, number>;
}

// ─── Icon Map ─────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  BookOpen, FileText, Play, Bookmark, Gem, MessageCircle, AtSign,
  Highlighter, BookmarkCheck, Send, Music, FileStack,
  Network, SearchX, TrendingUp, PenLine, Heart,
  PenSquare, Layers, Mail, FileUser, UserCheck, Route,
  RefreshCw, Download, FolderDown,
  Mic, Image, Languages, Cog, Dna,
  AlertTriangle, Star, Puzzle,
};

function PluginIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] || Puzzle;
  return <Icon className={className} />;
}

// ─── Category Config ──────────────────────────────────────────────

const CATEGORIES: { key: string; label: string; icon: React.ComponentType<{ className?: string }>; color: string; description: string }[] = [
  { key: 'all', label: 'All Plugins', icon: Puzzle, color: 'text-zinc-400', description: 'Browse the full catalog' },
  { key: 'import', label: 'Import', icon: Upload, color: 'text-blue-400', description: 'Bring in your data' },
  { key: 'analysis', label: 'Analysis', icon: BarChart3, color: 'text-teal-400', description: 'Understand your knowledge' },
  { key: 'action', label: 'Action', icon: Zap, color: 'text-amber-400', description: 'Turn knowledge into output' },
  { key: 'export', label: 'Export & Sync', icon: FolderDown, color: 'text-emerald-400', description: 'Share and sync data' },
  { key: 'ai', label: 'AI Tools', icon: Cpu, color: 'text-sky-400', description: 'Enhanced intelligence' },
];

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; dot: string; gradient: string }> = {
  import:   { bg: 'bg-blue-500/[0.06]',    border: 'border-blue-500/20',    text: 'text-blue-400',    dot: 'bg-blue-400',    gradient: 'from-blue-500/10 to-transparent' },
  analysis: { bg: 'bg-teal-500/[0.06]',    border: 'border-teal-500/20',    text: 'text-teal-400',    dot: 'bg-teal-400',    gradient: 'from-teal-500/10 to-transparent' },
  action:   { bg: 'bg-amber-500/[0.06]',   border: 'border-amber-500/20',   text: 'text-amber-400',   dot: 'bg-amber-400',   gradient: 'from-amber-500/10 to-transparent' },
  export:   { bg: 'bg-emerald-500/[0.06]', border: 'border-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400', gradient: 'from-emerald-500/10 to-transparent' },
  ai:       { bg: 'bg-sky-500/[0.06]',     border: 'border-sky-500/20',     text: 'text-sky-400',     dot: 'bg-sky-400',     gradient: 'from-sky-500/10 to-transparent' },
};

const TYPE_LABELS: Record<string, string> = {
  extension: 'Extension',
  mcp: 'MCP Tool',
  prompt: 'Config',
};

// Plugin slug → app page route mapping
const PLUGIN_ROUTES: Record<string, string> = {
  'mind-map-generator': '/app/mindmap',
  'topic-evolution': '/app/evolution',
  'sentiment-timeline': '/app/sentiment',
  'knowledge-gaps': '/app/gaps',
  'writing-analyzer': '/app/writing',
  'contradiction-finder': '/app/insights',
  'flashcard-maker': '/app/flashcards',
  'blog-draft': '/app/blog',
  'conversation-prep': '/app/prep',
  'learning-paths': '/app/paths',
  'resume-builder': '/app/resume',
  'newsletter-writer': '/app/newsletter',
  'voice-to-memory': '/app/voice',
  'image-to-memory': '/app/vision',
  'custom-rag': '/app/retrieval',
  'multi-language': '/app/languages',
  'domain-embeddings': '/app/domains',
  'anki-export': '/app/anki',
  'markdown-blog-export': '/app/export',
  'notion-sync': '/app/notion-sync',
  'obsidian-sync': '/app/obsidian-sync',
};

// Featured plugin slugs — curated spotlight
const FEATURED_SLUGS = ['mind-map-generator', 'voice-to-memory', 'flashcard-maker'];

// Category section order
const SECTION_ORDER: PluginCategory[] = ['ai', 'analysis', 'action', 'import', 'export'];

// ─── Component ────────────────────────────────────────────────────

export default function PluginsPage() {
  const router = useRouter();
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [summary, setSummary] = useState<PluginSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [filter, setFilter] = useState<'all' | 'installed' | 'available'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedPlugin, setExpandedPlugin] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // ─── Fetch plugins ──────────────────────────────────────────

  const fetchPlugins = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/plugins');
      const data = await res.json();
      setPlugins(data.plugins || []);
      setSummary(data.summary || null);
    } catch (err) {
      console.error('Failed to fetch plugins:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlugins(); }, [fetchPlugins]);

  // ─── Plugin action ─────────────────────────────────────────

  const pluginAction = async (slug: string, action: string) => {
    setActionLoading(`${slug}:${action}`);
    try {
      const res = await fetch('/api/v1/plugins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, action }),
      });
      if (res.ok) {
        await fetchPlugins();
      }
    } catch (err) {
      console.error('Plugin action failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Derived data ──────────────────────────────────────────

  const isSearching = search.length > 0;

  const filtered = useMemo(() => {
    return plugins.filter((p) => {
      // Category filter
      if (category !== 'all' && p.category !== category) return false;
      // Install filter
      if (filter === 'installed' && !p.installed) return false;
      if (filter === 'available' && p.installed) return false;
      // Search filter
      if (search) {
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q)
          || p.description.toLowerCase().includes(q)
          || p.slug.includes(q)
          || p.tags?.some(t => t.includes(q));
      }
      return true;
    });
  }, [plugins, category, filter, search]);

  const featuredPlugins = useMemo(() => {
    return FEATURED_SLUGS.map(s => plugins.find(p => p.slug === s)).filter(Boolean) as Plugin[];
  }, [plugins]);

  const pluginsByCategory = useMemo(() => {
    const groups: Record<string, Plugin[]> = {};
    for (const cat of SECTION_ORDER) {
      groups[cat] = filtered.filter(p => p.category === cat);
    }
    return groups;
  }, [filtered]);

  // ─── Keyboard shortcuts ────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape' && search) {
        setSearch('');
        searchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [search]);

  // ─── Render helpers ────────────────────────────────────────

  const renderPluginCard = (plugin: Plugin, size: 'sm' | 'md' | 'lg' = 'md') => {
    const colors = CATEGORY_COLORS[plugin.category] || CATEGORY_COLORS.import;
    const isActioning = actionLoading?.startsWith(plugin.slug);
    const hasRoute = PLUGIN_ROUTES[plugin.slug];
    const isActive = plugin.installed && plugin.status === 'active';

    if (size === 'lg') {
      // ─── Featured card (large) ────────────
      return (
        <div
          key={plugin.slug}
          className="group relative rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-white/[0.01] overflow-hidden transition-all duration-300 hover:border-white/[0.14] hover:shadow-lg hover:shadow-black/20"
        >
          {/* Gradient accent glow */}
          <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} opacity-60 pointer-events-none`} />
          
          <div className="relative p-5 sm:p-6 flex flex-col h-full">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center`}>
                <PluginIcon name={plugin.icon} className={`w-5 h-5 ${colors.text}`} />
              </div>
              <div className="flex items-center gap-1.5">
                {plugin.featured && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-amber-400/80 bg-amber-500/[0.08] border border-amber-500/15 rounded-full px-2 py-0.5">
                    <Star className="w-2.5 h-2.5 fill-amber-400" />
                    Featured
                  </span>
                )}
                <span className={`text-[10px] font-medium ${colors.text} bg-white/[0.04] border border-white/[0.06] rounded-full px-2 py-0.5`}>
                  {TYPE_LABELS[plugin.type]}
                </span>
              </div>
            </div>

            {/* Body */}
            <h3 className="text-[16px] font-semibold text-white mb-1.5 tracking-[-0.01em]">
              {plugin.name}
            </h3>
            <p className="text-[13px] text-zinc-400 leading-relaxed mb-5 flex-1">
              {plugin.description}
            </p>

            {/* Capabilities */}
            {plugin.capabilities && plugin.capabilities.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-4">
                {plugin.capabilities.slice(0, 3).map((cap) => (
                  <span
                    key={cap}
                    className="text-[9px] font-mono text-zinc-600 bg-white/[0.03] border border-white/[0.05] rounded px-1.5 py-0.5"
                  >
                    {cap}
                  </span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              {isActive && hasRoute ? (
                <button
                  onClick={() => router.push(PLUGIN_ROUTES[plugin.slug])}
                  className="h-8 px-4 rounded-lg bg-teal-500/15 border border-teal-500/25 text-[12px] font-semibold text-teal-400 hover:bg-teal-500/20 active:scale-[0.97] transition-all flex items-center gap-1.5"
                >
                  Open
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : plugin.installed ? (
                <span className="flex items-center gap-1.5 text-[12px] text-emerald-400/80 font-medium">
                  <Check className="w-3.5 h-3.5" />
                  Installed
                </span>
              ) : (
                <button
                  onClick={() => pluginAction(plugin.slug, 'install')}
                  disabled={!!isActioning}
                  className="h-8 px-4 rounded-lg bg-teal-600 text-[12px] font-semibold text-white hover:bg-teal-500 active:scale-[0.97] transition-all disabled:opacity-50"
                >
                  {isActioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Install'}
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    // ─── Standard card (grid / list) ────────────
    return (
      <div
        key={plugin.slug}
        className={`group rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:bg-white/[0.03] hover:border-white/[0.1] transition-all duration-200 ${
          viewMode === 'list' ? '' : 'flex flex-col'
        }`}
      >
        <div className={`${viewMode === 'list' ? 'flex items-center gap-3.5 px-4 py-3' : 'p-4 flex flex-col flex-1'}`}>
          {/* Icon + info */}
          <div className={viewMode === 'list' ? 'flex items-center gap-3.5 flex-1 min-w-0' : ''}>
            <div className={`${viewMode === 'list' ? 'w-9 h-9' : 'w-10 h-10 mb-3'} rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center shrink-0`}>
              <PluginIcon name={plugin.icon} className={`${viewMode === 'list' ? 'w-4 h-4' : 'w-[18px] h-[18px]'} ${colors.text}`} />
            </div>
            <div className={`${viewMode === 'list' ? 'flex-1 min-w-0' : ''}`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <h3 className={`${viewMode === 'list' ? 'text-[13px]' : 'text-[14px]'} font-medium text-white truncate`}>
                  {plugin.name}
                </h3>
                {plugin.featured && (
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                )}
              </div>
              <p className={`text-[12px] text-zinc-500 ${viewMode === 'list' ? 'line-clamp-1' : 'line-clamp-2 leading-relaxed'}`}>
                {plugin.description}
              </p>
            </div>
          </div>

          {/* Badges + Actions */}
          <div className={`flex items-center gap-2 shrink-0 ${viewMode === 'list' ? '' : 'mt-3 pt-3 border-t border-white/[0.04]'}`}>
            {/* Type badge (grid only) */}
            {viewMode === 'grid' && (
              <span className="text-[10px] font-medium text-zinc-600 bg-white/[0.04] border border-white/[0.06] rounded-md px-1.5 py-0.5">
                {TYPE_LABELS[plugin.type]}
              </span>
            )}
            
            <div className="flex-1" />

            {/* Status + action */}
            {isActive && hasRoute ? (
              <button
                onClick={() => router.push(PLUGIN_ROUTES[plugin.slug])}
                className="h-7 px-3 rounded-lg bg-teal-500/10 border border-teal-500/20 text-[11px] font-medium text-teal-400 hover:bg-teal-500/15 active:scale-[0.97] transition-all flex items-center gap-1"
              >
                Open
                <ArrowRight className="w-3 h-3" />
              </button>
            ) : plugin.installed ? (
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  plugin.status === 'active' ? 'bg-emerald-400' :
                  plugin.status === 'disabled' ? 'bg-zinc-600' :
                  plugin.status === 'error' ? 'bg-red-400' : 'bg-zinc-500'
                }`} />
                <span className={`text-[11px] font-medium ${
                  plugin.status === 'active' ? 'text-emerald-400' :
                  plugin.status === 'disabled' ? 'text-zinc-600' :
                  plugin.status === 'error' ? 'text-red-400' : 'text-zinc-500'
                }`}>
                  {plugin.status === 'active' ? 'Active' :
                   plugin.status === 'disabled' ? 'Off' :
                   plugin.status === 'error' ? 'Error' : 'Installed'}
                </span>
              </div>
            ) : (
              <button
                onClick={() => pluginAction(plugin.slug, 'install')}
                disabled={!!isActioning}
                className="h-7 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[11px] font-medium text-zinc-400 hover:bg-teal-500/10 hover:border-teal-500/20 hover:text-teal-400 active:scale-[0.97] transition-all disabled:opacity-50"
              >
                {isActioning ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Install'}
              </button>
            )}
          </div>
        </div>

        {/* Expanded detail (list mode only) */}
        {viewMode === 'list' && expandedPlugin === plugin.slug && (
          <div className="px-4 pb-4 border-t border-white/[0.04]">
            <div className="pt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                <span>v{plugin.version}</span>
                <span className="text-zinc-700">·</span>
                <span>by {plugin.author}</span>
                <span className="text-zinc-700">·</span>
                <span className={colors.text}>{plugin.category}</span>
                <span className="text-zinc-700">·</span>
                <span>{TYPE_LABELS[plugin.type]}</span>
              </div>
              <p className="text-[13px] text-zinc-400 leading-relaxed">{plugin.description}</p>
              {plugin.capabilities && plugin.capabilities.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {plugin.capabilities.map((cap) => (
                    <span key={cap} className="text-[10px] font-mono text-zinc-600 bg-white/[0.03] border border-white/[0.05] rounded-md px-2 py-0.5">
                      {cap}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                {plugin.installed && (
                  <>
                    {isActive && hasRoute && (
                      <button
                        onClick={() => router.push(PLUGIN_ROUTES[plugin.slug])}
                        className="h-8 px-4 rounded-lg bg-teal-500/10 border border-teal-500/20 text-[12px] font-medium text-teal-400 hover:bg-teal-500/15 active:scale-[0.97] transition-all flex items-center gap-1.5"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                        Open
                      </button>
                    )}
                    {isActive ? (
                      <button
                        onClick={() => pluginAction(plugin.slug, 'disable')}
                        disabled={!!isActioning}
                        className="h-8 px-3.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] font-medium text-zinc-400 hover:bg-white/[0.06] active:scale-[0.97] transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <PowerOff className="w-3.5 h-3.5" />
                        Disable
                      </button>
                    ) : (
                      <button
                        onClick={() => pluginAction(plugin.slug, 'enable')}
                        disabled={!!isActioning}
                        className="h-8 px-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[12px] font-medium text-emerald-400 hover:bg-emerald-500/15 active:scale-[0.97] transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Power className="w-3.5 h-3.5" />
                        Enable
                      </button>
                    )}
                    <button
                      onClick={() => pluginAction(plugin.slug, 'uninstall')}
                      disabled={!!isActioning}
                      className="h-8 px-3.5 rounded-lg bg-red-500/[0.06] border border-red-500/15 text-[12px] font-medium text-red-400/80 hover:bg-red-500/10 hover:text-red-400 active:scale-[0.97] transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Uninstall
                    </button>
                  </>
                )}
                {!plugin.installed && (
                  <button
                    onClick={() => pluginAction(plugin.slug, 'install')}
                    disabled={!!isActioning}
                    className="h-8 px-4 rounded-lg bg-teal-600 text-[12px] font-medium text-white hover:bg-teal-500 active:scale-[0.97] transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isActioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Install Plugin
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Loading skeleton ──────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        {/* Hero skeleton */}
        <div className="space-y-3">
          <div className="h-7 w-32 bg-white/[0.04] rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1,2,3].map(i => (
              <div key={i} className="h-48 bg-white/[0.02] rounded-2xl border border-white/[0.04]" />
            ))}
          </div>
        </div>
        {/* List skeleton */}
        <div className="space-y-3">
          <div className="h-10 w-full bg-white/[0.03] rounded-xl" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-36 bg-white/[0.02] rounded-2xl border border-white/[0.04]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Main render ───────────────────────────────────────────

  const showBrowseView = !isSearching && category === 'all' && filter === 'all';

  return (
    <PageTransition>
      {/* ═══════════════════════════════════════════════════════════
          HEADER — Title, stats strip, search bar
      ═══════════════════════════════════════════════════════════ */}
      <Stagger>
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-[22px] sm:text-[28px] font-semibold tracking-[-0.03em]">
                Plugin Store
              </h1>
              <p className="text-[13px] text-zinc-500 mt-0.5">
                33 plugins to extend your knowledge base
              </p>
            </div>
          </div>

          {/* Stats strip */}
          {summary && (
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.025] border border-white/[0.05]">
                <Package className="w-3 h-3 text-zinc-500" />
                <span className="text-[11px] font-medium text-zinc-400 tabular-nums">{summary.total} total</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/15">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[11px] font-medium text-emerald-400/80 tabular-nums">{summary.active} active</span>
              </div>
              {summary.installed > 0 && summary.installed !== summary.active && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.025] border border-white/[0.05]">
                  <Check className="w-3 h-3 text-zinc-500" />
                  <span className="text-[11px] font-medium text-zinc-400 tabular-nums">{summary.installed} installed</span>
                </div>
              )}
              <div className="hidden sm:flex items-center gap-1.5 ml-auto">
                {SECTION_ORDER.map(cat => {
                  const c = CATEGORY_COLORS[cat];
                  const count = summary.byCategory[cat] || 0;
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      <div className={`w-1 h-1 rounded-full ${c.dot}`} />
                      {count}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search plugins…"
              className="w-full h-10 pl-10 pr-20 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[13px] text-white placeholder:text-zinc-600 outline-none focus:border-teal-500/30 focus:bg-white/[0.04] transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {search ? (
                <>
                  <span className="text-[10px] text-zinc-600 tabular-nums">{filtered.length} found</span>
                  <button
                    onClick={() => setSearch('')}
                    className="p-0.5 rounded hover:bg-white/[0.06]"
                  >
                    <X className="w-3.5 h-3.5 text-zinc-500" />
                  </button>
                </>
              ) : (
                <kbd className="hidden sm:inline text-[10px] font-mono text-zinc-600 bg-white/[0.04] border border-white/[0.08] rounded px-1.5 py-[1px]">/</kbd>
              )}
            </div>
          </div>
        </div>
      </Stagger>

      {/* ═══════════════════════════════════════════════════════════
          FILTER BAR — Categories + Install filter + View toggle
      ═══════════════════════════════════════════════════════════ */}
      <Stagger>
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
          {/* Category pills */}
          <div className="flex items-center gap-1 shrink-0">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={`flex items-center gap-1.5 h-[30px] px-3 rounded-full text-[12px] font-medium whitespace-nowrap transition-all ${
                  category === cat.key
                    ? 'bg-white/[0.1] text-white border border-white/[0.1]'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <cat.icon className={`w-3 h-3 ${category === cat.key ? cat.color : ''}`} />
                {cat.label}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-white/[0.06] shrink-0 mx-1" />

          {/* Install filter */}
          <div className="flex items-center gap-1 shrink-0">
            {(['all', 'installed', 'available'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`h-[30px] px-2.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-all ${
                  filter === f
                    ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                    : 'text-zinc-600 hover:text-zinc-400 border border-transparent'
                }`}
              >
                {f === 'all' ? 'All' : f === 'installed' ? 'Installed' : 'Available'}
              </button>
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* View toggle */}
          <div className="flex items-center gap-0.5 bg-white/[0.03] border border-white/[0.06] rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white/[0.08] text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
              title="Grid view"
            >
              <Grid3X3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white/[0.08] text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
              title="List view"
            >
              <LayoutList className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </Stagger>

      {/* ═══════════════════════════════════════════════════════════
          BROWSE VIEW — Featured + Category sections
      ═══════════════════════════════════════════════════════════ */}
      {showBrowseView && (
        <>
          {/* ── Featured Spotlight ── */}
          {featuredPlugins.length > 0 && (
            <Stagger>
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h2 className="text-[14px] font-semibold text-white tracking-[-0.01em]">Spotlight</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {featuredPlugins.map((p) => renderPluginCard(p, 'lg'))}
                </div>
              </div>
            </Stagger>
          )}

          {/* ── Category Sections ── */}
          {SECTION_ORDER.map((cat) => {
            const catPlugins = pluginsByCategory[cat];
            if (!catPlugins || catPlugins.length === 0) return null;
            const catConfig = CATEGORIES.find(c => c.key === cat);
            const colors = CATEGORY_COLORS[cat];
            if (!catConfig) return null;

            return (
              <Stagger key={cat}>
                <div className="mb-7">
                  {/* Section header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <catConfig.icon className={`w-4 h-4 ${catConfig.color}`} />
                      <h2 className="text-[14px] font-semibold text-white tracking-[-0.01em]">{catConfig.label}</h2>
                      <span className="text-[11px] text-zinc-600 tabular-nums">{catPlugins.length}</span>
                    </div>
                    <button
                      onClick={() => setCategory(cat)}
                      className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1"
                    >
                      View all
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Plugin cards */}
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {catPlugins.map((p) => renderPluginCard(p, 'md'))}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {catPlugins.map((p) => (
                        <div
                          key={p.slug}
                          onClick={() => setExpandedPlugin(expandedPlugin === p.slug ? null : p.slug)}
                          className="cursor-pointer"
                        >
                          {renderPluginCard(p, 'md')}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Stagger>
            );
          })}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          SEARCH / FILTERED VIEW — Flat grid or list
      ═══════════════════════════════════════════════════════════ */}
      {!showBrowseView && (
        <Stagger>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
                <Puzzle className="w-5 h-5 text-zinc-600" />
              </div>
              <p className="text-[14px] text-zinc-400 font-medium mb-1">
                {search ? `No plugins match "${search}"` : 'No plugins in this category'}
              </p>
              <p className="text-[12px] text-zinc-600">
                {search ? 'Try a different search term' : 'Switch categories or clear filters'}
              </p>
              {(search || filter !== 'all' || category !== 'all') && (
                <button
                  onClick={() => { setSearch(''); setFilter('all'); setCategory('all'); }}
                  className="mt-4 h-8 px-4 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[12px] font-medium text-zinc-400 hover:bg-white/[0.06] transition-all"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((p) => renderPluginCard(p, 'md'))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((p) => (
                <div
                  key={p.slug}
                  onClick={() => setExpandedPlugin(expandedPlugin === p.slug ? null : p.slug)}
                  className="cursor-pointer"
                >
                  {renderPluginCard(p, 'md')}
                </div>
              ))}
            </div>
          )}
        </Stagger>
      )}

      {/* ═══════════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════════ */}
      <Stagger>
        <div className="mt-10 pt-6 border-t border-white/[0.04] text-center">
          <p className="text-[11px] text-zinc-600">
            {summary?.total || 0} plugins · {summary?.active || 0} active · All free
          </p>
        </div>
      </Stagger>
    </PageTransition>
  );
}
