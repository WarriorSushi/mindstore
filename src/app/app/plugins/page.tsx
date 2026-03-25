"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

const CATEGORIES: { key: string; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { key: 'all', label: 'All', icon: Puzzle, color: 'text-zinc-400' },
  { key: 'import', label: 'Import', icon: Upload, color: 'text-blue-400' },
  { key: 'analysis', label: 'Analysis', icon: BarChart3, color: 'text-teal-400' },
  { key: 'action', label: 'Action', icon: Zap, color: 'text-amber-400' },
  { key: 'export', label: 'Export', icon: FolderDown, color: 'text-emerald-400' },
  { key: 'ai', label: 'AI', icon: Cpu, color: 'text-sky-400' },
];

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  import: { bg: 'bg-blue-500/[0.06]', border: 'border-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-400' },
  analysis: { bg: 'bg-teal-500/[0.06]', border: 'border-teal-500/20', text: 'text-teal-400', dot: 'bg-teal-400' },
  action: { bg: 'bg-amber-500/[0.06]', border: 'border-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-400' },
  export: { bg: 'bg-emerald-500/[0.06]', border: 'border-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  ai: { bg: 'bg-sky-500/[0.06]', border: 'border-sky-500/20', text: 'text-sky-400', dot: 'bg-sky-400' },
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
};

// ─── Component ────────────────────────────────────────────────────

export default function PluginsPage() {
  const router = useRouter();
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [summary, setSummary] = useState<PluginSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [filter, setFilter] = useState<'all' | 'installed' | 'available'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedPlugin, setExpandedPlugin] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // ─── Fetch plugins ──────────────────────────────────────────

  const fetchPlugins = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (category !== 'all') params.set('category', category);
      const res = await fetch(`/api/v1/plugins?${params}`);
      const data = await res.json();
      setPlugins(data.plugins || []);
      setSummary(data.summary || null);
    } catch (err) {
      console.error('Failed to fetch plugins:', err);
    } finally {
      setLoading(false);
    }
  }, [category]);

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

  // ─── Filter plugins ────────────────────────────────────────

  const filtered = plugins.filter((p) => {
    if (filter === 'installed' && !p.installed) return false;
    if (filter === 'available' && p.installed) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q)
        || p.description.toLowerCase().includes(q)
        || p.slug.includes(q)
        || p.tags?.some(t => t.includes(q));
    }
    return true;
  });

  // ─── Keyboard shortcuts ────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ─── Loading skeleton ──────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-white/[0.04] rounded-lg" />
        <div className="h-10 w-full bg-white/[0.04] rounded-xl" />
        <div className="grid gap-3">
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="h-24 bg-white/[0.02] rounded-2xl border border-white/[0.04]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <PageTransition>
      {/* ═══ HEADER ═══ */}
      <Stagger>
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[22px] sm:text-[28px] font-semibold tracking-[-0.03em]">
              Plugins
            </h1>
            <p className="text-[13px] text-zinc-500 mt-1">
              Extend MindStore with importers, analyzers, and AI tools
            </p>
          </div>
          {summary && (
            <div className="hidden sm:flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[12px] font-medium text-zinc-400 tabular-nums">
                  {summary.active} active
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
                <span className="text-[12px] font-medium text-zinc-500 tabular-nums">
                  {summary.total} available
                </span>
              </div>
            </div>
          )}
        </div>
      </Stagger>

      {/* ═══ SEARCH ═══ */}
      <Stagger>
        <div className="relative mb-5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plugins…"
            className="w-full h-10 pl-10 pr-10 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[13px] text-white placeholder:text-zinc-600 outline-none focus:border-white/[0.12] focus:bg-white/[0.04] transition-all"
          />
          {search ? (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/[0.06]"
            >
              <X className="w-3.5 h-3.5 text-zinc-500" />
            </button>
          ) : (
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline text-[10px] font-mono text-zinc-600 bg-white/[0.04] border border-white/[0.08] rounded px-1.5 py-[1px]">/</kbd>
          )}
        </div>
      </Stagger>

      {/* ═══ CATEGORY PILLS + FILTER ═══ */}
      <Stagger>
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
          {/* Category pills */}
          <div className="flex items-center gap-1.5 shrink-0">
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
                {cat.key !== 'all' && summary?.byCategory && (
                  <span className="text-[10px] text-zinc-600 tabular-nums">
                    {summary.byCategory[cat.key] || 0}
                  </span>
                )}
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
        </div>
      </Stagger>

      {/* ═══ PLUGIN LIST ═══ */}
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
              {search ? 'Try a different search term' : 'Check back as we add more plugins'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((plugin, i) => {
              const colors = CATEGORY_COLORS[plugin.category] || CATEGORY_COLORS.import;
              const isExpanded = expandedPlugin === plugin.slug;
              const isActioning = actionLoading?.startsWith(plugin.slug);

              return (
                <div
                  key={plugin.slug}
                  className="group rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:bg-white/[0.03] hover:border-white/[0.09] transition-all duration-200"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  {/* Main row */}
                  <div
                    className="flex items-center gap-3.5 px-4 py-3.5 cursor-pointer"
                    onClick={() => setExpandedPlugin(isExpanded ? null : plugin.slug)}
                  >
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center shrink-0`}>
                      <PluginIcon name={plugin.icon} className={`w-[18px] h-[18px] ${colors.text}`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-[14px] font-medium text-white truncate">
                          {plugin.name}
                        </h3>
                        {plugin.featured && (
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-[12px] text-zinc-500 line-clamp-1">
                        {plugin.description}
                      </p>
                    </div>

                    {/* Badges + Action */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Type badge */}
                      <span className="hidden sm:inline-flex text-[10px] font-medium text-zinc-600 bg-white/[0.04] border border-white/[0.06] rounded-md px-1.5 py-0.5">
                        {TYPE_LABELS[plugin.type]}
                      </span>

                      {/* Status / Install button */}
                      {plugin.installed ? (
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
                             plugin.status === 'disabled' ? 'Disabled' :
                             plugin.status === 'error' ? 'Error' : 'Installed'}
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); pluginAction(plugin.slug, 'install'); }}
                          disabled={!!isActioning}
                          className="h-7 px-3 rounded-lg bg-teal-500/10 border border-teal-500/20 text-[12px] font-medium text-teal-400 hover:bg-teal-500/15 hover:border-teal-500/30 active:scale-[0.97] transition-all disabled:opacity-50"
                        >
                          {isActioning ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            'Install'
                          )}
                        </button>
                      )}

                      {/* Chevron */}
                      <ChevronRight className={`w-4 h-4 text-zinc-600 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t border-white/[0.04] mt-0">
                      <div className="pt-3.5 space-y-3">
                        {/* Meta row */}
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                          <span>v{plugin.version}</span>
                          <span className="text-zinc-700">·</span>
                          <span>by {plugin.author}</span>
                          <span className="text-zinc-700">·</span>
                          <span className={`${colors.text}`}>{plugin.category}</span>
                          <span className="text-zinc-700">·</span>
                          <span>{TYPE_LABELS[plugin.type]}</span>
                        </div>

                        {/* Description */}
                        <p className="text-[13px] text-zinc-400 leading-relaxed">
                          {plugin.description}
                        </p>

                        {/* Capabilities */}
                        {plugin.capabilities && plugin.capabilities.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {plugin.capabilities.map((cap) => (
                              <span
                                key={cap}
                                className="text-[10px] font-mono text-zinc-600 bg-white/[0.03] border border-white/[0.05] rounded-md px-2 py-0.5"
                              >
                                {cap}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 pt-1">
                          {plugin.installed ? (
                            <>
                              {/* Open button for plugins with a page */}
                              {plugin.status === 'active' && PLUGIN_ROUTES[plugin.slug] && (
                                <button
                                  onClick={() => router.push(PLUGIN_ROUTES[plugin.slug])}
                                  className="h-8 px-4 rounded-lg bg-teal-500/10 border border-teal-500/20 text-[12px] font-medium text-teal-400 hover:bg-teal-500/15 active:scale-[0.97] transition-all flex items-center gap-1.5"
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                  Open
                                </button>
                              )}
                              {plugin.status === 'active' ? (
                                <button
                                  onClick={() => pluginAction(plugin.slug, 'disable')}
                                  disabled={!!isActioning}
                                  className="h-8 px-3.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] font-medium text-zinc-400 hover:bg-white/[0.06] active:scale-[0.97] transition-all flex items-center gap-1.5 disabled:opacity-50"
                                >
                                  {actionLoading === `${plugin.slug}:disable` ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <PowerOff className="w-3.5 h-3.5" />
                                  )}
                                  Disable
                                </button>
                              ) : (
                                <button
                                  onClick={() => pluginAction(plugin.slug, 'enable')}
                                  disabled={!!isActioning}
                                  className="h-8 px-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[12px] font-medium text-emerald-400 hover:bg-emerald-500/15 active:scale-[0.97] transition-all flex items-center gap-1.5 disabled:opacity-50"
                                >
                                  {actionLoading === `${plugin.slug}:enable` ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Power className="w-3.5 h-3.5" />
                                  )}
                                  Enable
                                </button>
                              )}
                              <button
                                onClick={() => pluginAction(plugin.slug, 'uninstall')}
                                disabled={!!isActioning}
                                className="h-8 px-3.5 rounded-lg bg-red-500/[0.06] border border-red-500/15 text-[12px] font-medium text-red-400/80 hover:bg-red-500/10 hover:text-red-400 active:scale-[0.97] transition-all flex items-center gap-1.5 disabled:opacity-50"
                              >
                                {actionLoading === `${plugin.slug}:uninstall` ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                                Uninstall
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => pluginAction(plugin.slug, 'install')}
                              disabled={!!isActioning}
                              className="h-8 px-4 rounded-lg bg-teal-600 text-[12px] font-medium text-white hover:bg-teal-500 active:scale-[0.97] transition-all flex items-center gap-1.5 disabled:opacity-50"
                            >
                              {actionLoading === `${plugin.slug}:install` ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              Install Plugin
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Stagger>

      {/* ═══ FOOTER ═══ */}
      <Stagger>
        <div className="mt-8 pt-6 border-t border-white/[0.04] text-center">
          <p className="text-[11px] text-zinc-600">
            {summary?.total || 0} plugins available · {summary?.installed || 0} installed · {summary?.active || 0} active
          </p>
          <p className="text-[10px] text-zinc-700 mt-1">
            All plugins are free. More coming soon.
          </p>
        </div>
      </Stagger>
    </PageTransition>
  );
}
