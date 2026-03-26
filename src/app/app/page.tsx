"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Brain, Upload, MessageSquare, Compass, Database, FileText,
  Globe, MessageCircle, Sparkles, Key, Server, ExternalLink,
  Loader2, GraduationCap, Lightbulb, ChevronRight, ArrowUpRight,
  Fingerprint, Network, TrendingUp, Zap, Search, X, ArrowRight,
  Clock, Pin, BarChart3, BookOpen,
  Layers, AlertTriangle, Target, Copy, FolderOpen,
  type LucideIcon,
} from "lucide-react";
import { getSourceType } from "@/lib/source-types";
import { checkApiKey } from "@/lib/openai";
import { isDemoMode, loadDemoData, clearDemoData } from "@/lib/demo";
import { toast } from "sonner";
import { PageTransition, Stagger } from "@/components/PageTransition";
import { openMemoryDrawer } from "@/components/MemoryDrawer";
import { usePageTitle } from "@/lib/use-page-title";

async function fetchStats() {
  try {
    const res = await fetch('/api/v1/stats');
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function fetchWidgets() {
  try {
    const res = await fetch('/api/v1/dashboard-widgets');
    if (!res.ok) return [];
    const data = await res.json();
    return data.widgets || [];
  } catch { return []; }
}

interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  icon: string;
  color: string;
  href: string;
  data: Record<string, any>;
}

// ─── Widget icon map ──────────────────────────────────────────
const WIDGET_ICONS: Record<string, LucideIcon> = {
  Layers, TrendingUp, Zap, Database, BookOpen, Clock, Network,
  AlertTriangle, Target, BarChart3, Copy, FolderOpen,
};

const WIDGET_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  teal:    { bg: 'bg-teal-500/[0.06]',    border: 'border-teal-500/15',    text: 'text-teal-400',    dot: 'bg-teal-400' },
  sky:     { bg: 'bg-sky-500/[0.06]',     border: 'border-sky-500/15',     text: 'text-sky-400',     dot: 'bg-sky-400' },
  emerald: { bg: 'bg-emerald-500/[0.06]', border: 'border-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  amber:   { bg: 'bg-amber-500/[0.06]',   border: 'border-amber-500/15',   text: 'text-amber-400',   dot: 'bg-amber-400' },
  red:     { bg: 'bg-red-500/[0.06]',     border: 'border-red-500/15',     text: 'text-red-400',     dot: 'bg-red-400' },
  blue:    { bg: 'bg-blue-500/[0.06]',    border: 'border-blue-500/15',    text: 'text-blue-400',    dot: 'bg-blue-400' },
};

type SetupTab = "gemini" | "openai" | "ollama";

export default function DashboardPage() {
  usePageTitle("Home");
  const [hasKey, setHasKey] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [testing, setTesting] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [demo, setDemo] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [setupTab, setSetupTab] = useState<SetupTab>("gemini");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [searchQuery, setSearchQuery] = useState("");
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLayers, setSearchLayers] = useState<{ bm25: number; vector: number; tree: number } | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    Promise.all([
      checkApiKey().then((data) => setHasKey(data.hasApiKey)),
      fetchStats().then(setStats),
      fetchWidgets().then(setWidgets),
    ]).then(() => setLoaded(true));
    setDemo(isDemoMode());
  }, []);

  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("demo") === "true" && !isDemoMode()) {
      checkApiKey().then((data) => {
        if (!data.hasApiKey) handleStartDemo();
      });
    }
  }, [searchParams]);

  // Quick-search debounce
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setSearchLayers(null); return; }
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/v1/search?q=${encodeURIComponent(searchQuery)}&limit=5`)
        .then(r => r.json())
        .then(d => { setSearchResults(d.results || []); setSearchLayers(d.layers || null); setSearching(false); })
        .catch(() => { setSearchResults([]); setSearchLayers(null); setSearching(false); });
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handleStartDemo = async () => {
    setLoadingDemo(true);
    await loadDemoData();
    setDemo(true);
    const s = await fetchStats();
    setStats(s);
    setLoadingDemo(false);
    toast.success("Demo loaded with 24 sample memories");
  };

  const handleExitDemo = async () => {
    await clearDemoData();
    setDemo(false);
    setStats(null);
    toast.success("Demo data cleared");
  };

  const handleSaveProvider = async (provider: string) => {
    const key = keyInput.trim();
    const url = ollamaUrl.trim();
    if (provider === "ollama" && !url) return;
    if (provider !== "ollama" && !key) return;

    setTesting(true);
    try {
      const body: any = {};
      if (provider === "gemini") body.geminiKey = key;
      else if (provider === "openai") body.apiKey = key;
      else if (provider === "ollama") body.ollamaUrl = url;

      const res = await fetch('/api/v1/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.ok) {
        setHasKey(true);
        setKeyInput("");
        toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} connected!`);
        // Refresh stats so dashboard shows current data
        fetchStats().then(setStats);
      } else {
        toast.error(data.error || "Connection failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Connection failed");
    }
    setTesting(false);
  };

  if (!loaded) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
    </div>
  );

  const total = stats?.totalMemories || 0;

  /* ═══════════════════════════════════════════
     SETUP WIZARD — No API key AND no data
     Show setup wizard only for truly new users.
     If they already have data (e.g. imported without AI), show dashboard.
     ═══════════════════════════════════════════ */
  if (!hasKey && !demo && total === 0) {
    return (
      <div className="min-h-[75dvh] flex items-center justify-center">
        <div className="w-full max-w-sm space-y-6">
          {/* Logo + Heading */}
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-sky-600 flex items-center justify-center mx-auto shadow-lg shadow-teal-500/20">
              <Brain className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-[-0.02em]">Set up MindStore</h1>
              <p className="text-[13px] text-zinc-500 mt-1">Connect an AI provider to get started</p>
            </div>
          </div>

          {/* Provider Selector */}
          <div className="space-y-2">
            {([
              { id: "gemini" as SetupTab, name: "Google Gemini", sub: "Free · No credit card", icon: Sparkles, gradient: "from-blue-500/10 to-cyan-500/10", border: "border-blue-500/20", text: "text-blue-400" },
              { id: "openai" as SetupTab, name: "OpenAI", sub: "Pay per use · ~$0.01/10 queries", icon: Key, gradient: "from-emerald-500/10 to-teal-500/10", border: "border-emerald-500/20", text: "text-emerald-400" },
              { id: "ollama" as SetupTab, name: "Ollama", sub: "100% local · Free forever", icon: Server, gradient: "from-orange-500/10 to-amber-500/10", border: "border-orange-500/20", text: "text-orange-400" },
            ]).map((p) => (
              <button
                key={p.id}
                onClick={() => { setSetupTab(p.id); setKeyInput(""); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left active:scale-[0.98] ${
                  setupTab === p.id
                    ? `bg-gradient-to-r ${p.gradient} ${p.border}`
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${setupTab === p.id ? "bg-white/[0.1]" : "bg-white/[0.04]"}`}>
                  <p.icon className={`w-4 h-4 ${setupTab === p.id ? p.text : "text-zinc-500"}`} />
                </div>
                <div className="min-w-0">
                  <p className={`text-[13px] font-medium ${setupTab === p.id ? "text-white" : "text-zinc-300"}`}>{p.name}</p>
                  <p className={`text-[11px] ${setupTab === p.id ? p.text : "text-zinc-600"}`}>{p.sub}</p>
                </div>
                {setupTab === p.id && <div className={`ml-auto w-2 h-2 rounded-full ${p.text} bg-current`} />}
              </button>
            ))}
          </div>

          {/* Input Area */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            {setupTab === "gemini" && (
              <div className="space-y-3">
                <p className="text-[12px] text-zinc-500 leading-relaxed">
                  Get a free API key from{" "}
                  <a href="https://aistudio.google.com/apikey" target="_blank" className="text-blue-400 font-medium hover:underline">
                    Google AI Studio ↗
                  </a>
                  {" "}— takes 30 seconds, no credit card.
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="AIza..."
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveProvider("gemini")}
                    className="flex-1 h-10 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] font-mono placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/30 transition-all"
                  />
                  <button
                    onClick={() => handleSaveProvider("gemini")}
                    disabled={testing || !keyInput.trim()}
                    className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-[13px] font-medium text-white shrink-0 transition-all active:scale-[0.96]"
                  >
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
                  </button>
                </div>
              </div>
            )}
            {setupTab === "openai" && (
              <div className="space-y-3">
                <p className="text-[12px] text-zinc-500 leading-relaxed">
                  Get your API key from{" "}
                  <a href="https://platform.openai.com/api-keys" target="_blank" className="text-emerald-400 font-medium hover:underline">
                    OpenAI Platform ↗
                  </a>
                </p>
                <div className="flex gap-2">
                  <input type="password" placeholder="sk-..." value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveProvider("openai")}
                    className="flex-1 h-10 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] font-mono placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500/30 transition-all"
                  />
                  <button onClick={() => handleSaveProvider("openai")} disabled={testing || !keyInput.trim()}
                    className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-[13px] font-medium text-white shrink-0 transition-all active:scale-[0.96]"
                  >
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
                  </button>
                </div>
              </div>
            )}
            {setupTab === "ollama" && (
              <div className="space-y-3">
                <p className="text-[12px] text-zinc-500 leading-relaxed">
                  Install{" "}
                  <a href="https://ollama.ai" target="_blank" className="text-orange-400 font-medium hover:underline">Ollama ↗</a>
                  , then run <code className="text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded-md font-mono">ollama pull nomic-embed-text</code>
                </p>
                <div className="flex gap-2">
                  <input placeholder="http://localhost:11434" value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveProvider("ollama")}
                    className="flex-1 h-10 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] font-mono placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-orange-500/30 focus:border-orange-500/30 transition-all"
                  />
                  <button onClick={() => handleSaveProvider("ollama")} disabled={testing || !ollamaUrl.trim()}
                    className="h-10 px-5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-[13px] font-medium text-white shrink-0 transition-all active:scale-[0.96]"
                  >
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/[0.06]" /></div>
            <div className="relative flex justify-center"><span className="bg-[#0a0a0b] px-3 text-[11px] text-zinc-600">or</span></div>
          </div>

          {/* Demo CTA */}
          <button
            onClick={handleStartDemo}
            disabled={loadingDemo}
            className="w-full h-10 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] text-[13px] text-zinc-400 font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loadingDemo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {loadingDemo ? "Loading…" : "Try demo — no API key needed"}
          </button>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     MAIN DASHBOARD
     ═══════════════════════════════════════════ */
  const chatgpt = stats?.byType?.chatgpt || 0;
  const notes = (stats?.byType?.file || 0) + (stats?.byType?.text || 0);
  const urls = stats?.byType?.url || 0;

  return (
    <PageTransition className="space-y-6 md:space-y-8">
      {/* Demo Banner */}
      {demo && (
        <Stagger>
          <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-teal-500/[0.08] to-sky-500/[0.08] border border-teal-500/20 px-4 py-2.5">
            <span className="text-[12px] text-teal-300 font-medium">✨ Demo mode — sample data</span>
            <button onClick={handleExitDemo} className="text-[11px] text-teal-400 hover:text-white font-medium px-2 py-1 rounded-lg hover:bg-white/[0.06] transition-colors">
              Exit
            </button>
          </div>
        </Stagger>
      )}

      {/* No AI provider banner */}
      {!hasKey && !demo && total > 0 && (
        <Stagger>
          <Link href="/app/settings">
            <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-blue-500/[0.06] to-cyan-500/[0.06] border border-blue-500/15 px-4 py-2.5 hover:bg-blue-500/[0.1] transition-colors">
              <span className="text-[12px] text-blue-300 font-medium">⚡ Connect an AI provider for semantic search & chat — <span className="text-blue-400">Gemini is free</span></span>
              <ChevronRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            </div>
          </Link>
        </Stagger>
      )}

      {/* Hero Stats */}
      <Stagger>
        <div className="space-y-1">
          <h1 className="text-[22px] md:text-[28px] font-semibold tracking-[-0.03em]">Your Mind</h1>
          <p className="text-[13px] text-zinc-500">
            {total > 0 ? `${total.toLocaleString()} memories across ${stats?.totalSources || 0} sources` : "Import knowledge to get started"}
          </p>
        </div>
      </Stagger>

      {/* Quick Search */}
      {total > 0 && (
        <Stagger>
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input
                placeholder="Quick search your memories…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-9 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-[13px] placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-teal-500/30 focus:border-teal-500/30 transition-all"
              />
              {searchQuery ? (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-white/[0.06] rounded-md transition-colors">
                  <X className="w-3.5 h-3.5 text-zinc-500" />
                </button>
              ) : (
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-zinc-700 bg-white/[0.04] border border-white/[0.08] rounded px-1.5 py-[2px] hidden sm:block">⌘K</kbd>
              )}
            </div>

            {/* Search Results */}
            {searchQuery.trim() && (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                {searching ? (
                  <div className="flex items-center justify-center gap-2 py-6">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-600" />
                    <span className="text-[12px] text-zinc-600">Searching…</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="divide-y divide-white/[0.04]">
                    {/* Search layers indicator */}
                    {searchLayers && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.01]">
                        <span className="text-[10px] text-zinc-600 font-medium">Powered by</span>
                        <div className="flex items-center gap-1.5">
                          {searchLayers.bm25 > 0 && (
                            <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-[2px] rounded-md font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/15">
                              🔤 Keyword
                            </span>
                          )}
                          {searchLayers.vector > 0 && (
                            <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-[2px] rounded-md font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/15">
                              🧠 Semantic
                            </span>
                          )}
                          {searchLayers.tree > 0 && (
                            <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-[2px] rounded-md font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                              🌳 Structure
                            </span>
                          )}
                          {!searchLayers.vector && !searchLayers.tree && (
                            <span className="text-[9px] text-zinc-600 italic">Connect AI for deeper search</span>
                          )}
                        </div>
                      </div>
                    )}
                    {searchResults.map((r: any, i: number) => {
                      const st = getSourceType(r.sourceType);
                      const Icon = st.icon;
                      return (
                        <button
                          key={r.memoryId || i}
                          onClick={() => openMemoryDrawer({
                            id: r.memoryId,
                            content: r.content,
                            source: r.sourceType,
                            sourceId: r.sourceId || "",
                            sourceTitle: r.sourceTitle || "Untitled",
                            timestamp: r.createdAt || "",
                            importedAt: r.importedAt || "",
                            metadata: r.metadata || {},
                            pinned: r.metadata?.pinned === true,
                          })}
                          className="w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors group"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-[1px] rounded-md font-semibold uppercase tracking-wide ${st.badgeClasses}`}>
                              <Icon className="w-2.5 h-2.5" />
                              {r.sourceType}
                            </span>
                            <span className="text-[11px] text-zinc-600 truncate group-hover:text-zinc-400 transition-colors">{r.sourceTitle}</span>
                          </div>
                          <p className="text-[12px] text-zinc-400 line-clamp-2 leading-relaxed">{r.content}</p>
                        </button>
                      );
                    })}
                    <Link href={`/app/explore?q=${encodeURIComponent(searchQuery)}`} className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-[12px] text-teal-400 font-medium hover:bg-teal-500/5 transition-colors">
                      View all in Explore <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-6 text-[12px] text-zinc-600">No results found</div>
                )}
              </div>
            )}
          </div>
        </Stagger>
      )}

      {/* Stat Cards */}
      <Stagger>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {[
            { label: "Total", value: total, icon: Database, color: "from-teal-500/20 to-teal-500/5", iconColor: "text-teal-400" },
            { label: "ChatGPT", value: chatgpt, icon: MessageCircle, color: "from-green-500/20 to-green-500/5", iconColor: "text-green-400" },
            { label: "Notes", value: notes, icon: FileText, color: "from-blue-500/20 to-blue-500/5", iconColor: "text-blue-400" },
            { label: "URLs", value: urls, icon: Globe, color: "from-orange-500/20 to-orange-500/5", iconColor: "text-orange-400" },
          ].map((s) => (
            <div key={s.label} className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className={`absolute inset-0 bg-gradient-to-b ${s.color} pointer-events-none`} />
              <div className="relative">
                <s.icon className={`w-4 h-4 ${s.iconColor} mb-2`} />
                <p className="text-[22px] md:text-[26px] font-semibold tracking-[-0.02em] tabular-nums">{s.value.toLocaleString()}</p>
                <p className="text-[11px] text-zinc-500 font-medium mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </Stagger>

      {/* Activity Chart — 14-day knowledge growth */}
      {stats?.dailyActivity?.length > 0 && total > 0 && (
        <Stagger>
          <ActivityChart data={stats.dailyActivity} />
        </Stagger>
      )}

      {/* ─── Dashboard Widgets — Plugin Insights ─── */}
      {widgets.length > 0 && total > 0 && (
        <Stagger>
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 px-1">
              <Sparkles className="w-3 h-3 text-teal-400" />
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em]">Insights</p>
              <span className="text-[10px] text-zinc-600 tabular-nums">{widgets.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-2.5">
              {widgets.map((w) => {
                const colors = WIDGET_COLORS[w.color] || WIDGET_COLORS.teal;
                const Icon = WIDGET_ICONS[w.icon] || Zap;
                return (
                  <Link key={w.id} href={w.href}>
                    <div className={`group relative rounded-2xl border ${colors.border} ${colors.bg} p-3.5 hover:bg-white/[0.04] transition-all active:scale-[0.97] h-full`}>
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <Icon className={`w-3.5 h-3.5 ${colors.text}`} />
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider truncate">{w.title}</span>
                      </div>
                      
                      {/* Widget-specific content */}
                      {w.id === 'flashcards' && (
                        <div>
                          <p className="text-[20px] font-semibold tracking-[-0.02em] tabular-nums">
                            {w.data.dueCards > 0 ? (
                              <span className="text-amber-400">{w.data.dueCards} due</span>
                            ) : (
                              <span className="text-emerald-400">✓ caught up</span>
                            )}
                          </p>
                          <p className="text-[10px] text-zinc-600 mt-0.5">
                            {w.data.totalCards} cards · {w.data.masteryRate}% mastered
                          </p>
                        </div>
                      )}

                      {w.id === 'growth' && (
                        <div>
                          <div className="flex items-baseline gap-1.5">
                            <p className="text-[20px] font-semibold tracking-[-0.02em] tabular-nums">{w.data.thisWeek}</p>
                            {w.data.trend !== 0 && (
                              <span className={`text-[11px] font-semibold ${w.data.trend > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {w.data.trend > 0 ? '↑' : '↓'}{Math.abs(w.data.trend)}%
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-600 mt-0.5">
                            this week{w.data.today > 0 ? ` · ${w.data.today} today` : ''}
                          </p>
                        </div>
                      )}

                      {w.id === 'embedding-coverage' && (
                        <div>
                          <p className="text-[20px] font-semibold tracking-[-0.02em] tabular-nums">
                            {w.data.coverage}%
                          </p>
                          <p className="text-[10px] text-zinc-600 mt-0.5">
                            {w.data.embedded}/{w.data.total} embedded
                          </p>
                          {w.data.unembedded > 0 && (
                            <div className="mt-1.5 h-1 rounded-full bg-white/[0.04] overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  w.data.coverage >= 90 ? 'bg-emerald-500/60' :
                                  w.data.coverage >= 50 ? 'bg-amber-500/60' : 'bg-red-500/60'
                                }`}
                                style={{ width: `${w.data.coverage}%` }}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {w.id === 'sources-diversity' && (
                        <div>
                          <p className="text-[20px] font-semibold tracking-[-0.02em] tabular-nums">{w.data.sourceCount}</p>
                          <p className="text-[10px] text-zinc-600 mt-0.5">source types</p>
                          <div className="flex gap-0.5 mt-1.5 flex-wrap">
                            {w.data.sources.slice(0, 5).map((s: any) => (
                                <span key={s.type} className="text-[8px] font-bold uppercase tracking-wider text-zinc-600 bg-white/[0.04] rounded px-1 py-[1px]">
                                  {getSourceType(s.type).shortLabel}
                                </span>
                              ))}
                          </div>
                        </div>
                      )}

                      {w.id === 'content-depth' && (
                        <div>
                          <p className="text-[20px] font-semibold tracking-[-0.02em] tabular-nums">{w.data.avgWords}</p>
                          <p className="text-[10px] text-zinc-600 mt-0.5">
                            avg words · {w.data.deepPct}% deep
                          </p>
                        </div>
                      )}

                      {w.id === 'time-span' && (
                        <div>
                          <p className="text-[20px] font-semibold tracking-[-0.02em] tabular-nums">{w.data.spanLabel}</p>
                          <p className="text-[10px] text-zinc-600 mt-0.5">
                            of knowledge history
                          </p>
                        </div>
                      )}

                      {w.id === 'connections' && (
                        <div>
                          <p className="text-[20px] font-semibold tracking-[-0.02em] tabular-nums">{w.data.totalConnections}</p>
                          <p className="text-[10px] text-zinc-600 mt-0.5">
                            cross-references
                          </p>
                        </div>
                      )}

                      {w.id === 'contradictions' && (
                        <div>
                          <p className="text-[20px] font-semibold tracking-[-0.02em] tabular-nums">
                            {w.data.unresolved > 0 ? (
                              <span className="text-amber-400">{w.data.unresolved}</span>
                            ) : (
                              <span className="text-emerald-400">0</span>
                            )}
                          </p>
                          <p className="text-[10px] text-zinc-600 mt-0.5">
                            unresolved · {w.data.resolved} resolved
                          </p>
                        </div>
                      )}

                      {w.id === 'duplicates' && (
                        <div>
                          <p className="text-[20px] font-semibold tracking-[-0.02em] tabular-nums">
                            <span className={w.data.count > 5 ? 'text-amber-400' : 'text-sky-400'}>{w.data.label}</span>
                          </p>
                          <p className="text-[10px] text-zinc-600 mt-0.5">
                            duplicate pairs to review
                          </p>
                        </div>
                      )}

                      {/* Hover arrow */}
                      <ChevronRight className="absolute top-3.5 right-3 w-3 h-3 text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </Stagger>
      )}

      {/* Pinned Memories */}
      {stats?.pinnedMemories?.length > 0 && (
        <Stagger>
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <Pin className="w-3 h-3 text-amber-400 fill-amber-400/30" />
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em]">Pinned</p>
                <span className="text-[10px] text-zinc-600 tabular-nums">{stats.pinnedCount || stats.pinnedMemories.length}</span>
              </div>
              <Link href="/app/explore?filter=pinned" className="text-[11px] text-zinc-600 hover:text-amber-400 font-medium transition-colors">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {stats.pinnedMemories.slice(0, 4).map((mem: any, i: number) => {
                const st = getSourceType(mem.sourceType);
                const Icon = st.icon;
                return (
                  <button
                    key={mem.id || i}
                    onClick={() => openMemoryDrawer({
                      id: mem.id,
                      content: mem.content,
                      source: mem.sourceType,
                      sourceId: mem.sourceId,
                      sourceTitle: mem.sourceTitle,
                      timestamp: mem.createdAt,
                      importedAt: mem.importedAt,
                      metadata: mem.metadata,
                      pinned: mem.metadata?.pinned === true,
                    })}
                    className="text-left w-full"
                  >
                    <div className="group relative flex items-start gap-3 p-3.5 rounded-2xl border border-amber-500/10 bg-gradient-to-br from-amber-500/[0.04] to-amber-500/[0.01] hover:from-amber-500/[0.08] hover:to-amber-500/[0.03] hover:border-amber-500/20 transition-all active:scale-[0.98]">
                      <Pin className="absolute top-2.5 right-2.5 w-2.5 h-2.5 text-amber-500/40 fill-amber-400/20" />
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${st.bgColor}`}>
                        <Icon className={`w-3.5 h-3.5 ${st.textColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-zinc-300 truncate group-hover:text-white transition-colors">{mem.sourceTitle}</p>
                        <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed mt-0.5">{mem.content}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Stagger>
      )}

      {/* Actions Grid */}
      <Stagger>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
          {[
            { href: "/app/import", icon: Upload, label: "Import", desc: "Add knowledge", color: "text-teal-400" },
            { href: "/app/chat", icon: MessageSquare, label: "Chat", desc: "Ask your mind", color: "text-blue-400" },
            { href: "/app/explore", icon: Compass, label: "Explore", desc: "Browse all", color: "text-emerald-400" },
            { href: "/app/learn", icon: GraduationCap, label: "Learn", desc: "Teach AI about you", color: "text-amber-400" },
          ].map((a) => (
            <Link key={a.href} href={a.href}>
              <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] p-4 transition-all active:scale-[0.97] h-full">
                <a.icon className={`w-5 h-5 ${a.color} mb-3 group-hover:scale-110 transition-transform`} />
                <p className="text-[13px] font-medium">{a.label}</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </Stagger>

      {/* Recent Activity */}
      {stats?.recentMemories?.length > 0 && (
        <Stagger>
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em]">Recent Activity</p>
              <Link href="/app/explore" className="text-[11px] text-zinc-600 hover:text-zinc-400 font-medium transition-colors">
                View all →
              </Link>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden divide-y divide-white/[0.04]">
              {stats.recentMemories.map((mem: any, i: number) => {
                const st = getSourceType(mem.sourceType);
                const Icon = st.icon;
                return (
                  <button
                    key={mem.id || i}
                    onClick={() => openMemoryDrawer({
                      id: mem.id,
                      content: mem.content,
                      source: mem.sourceType,
                      sourceId: mem.sourceId,
                      sourceTitle: mem.sourceTitle,
                      timestamp: mem.createdAt,
                      importedAt: mem.importedAt,
                      metadata: mem.metadata,
                      pinned: mem.metadata?.pinned === true,
                    })}
                    className="w-full text-left"
                  >
                    <div className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${st.bgColor}`}>
                        <Icon className={`w-3.5 h-3.5 ${st.textColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-[12px] font-medium text-zinc-300 truncate">{mem.sourceTitle}</p>
                        </div>
                        <p className="text-[11px] text-zinc-500 line-clamp-1 leading-relaxed">{mem.content}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 mt-1">
                        <Clock className="w-2.5 h-2.5 text-zinc-700" />
                        <span className="text-[10px] text-zinc-600 whitespace-nowrap">{formatRelativeTime(mem.createdAt)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Stagger>
      )}

      {/* Feature Cards */}
      <Stagger>
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em] px-1">Discover</p>
          {[
            { href: "/app/fingerprint", emoji: "🧬", label: "Knowledge Fingerprint", desc: "3D map of your mind's topology", tag: "WebGL" },
            { href: "/app/insights", emoji: "⚡", label: "Mind Insights", desc: "Connections, contradictions, metabolism" },
            { href: "/app/connect", emoji: "🔌", label: "Connect to AI", desc: "Use with Claude, Cursor, VS Code", tag: "MCP" },
          ].map((f) => (
            <Link key={f.href} href={f.href}>
              <div className="flex items-center gap-3.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] p-3.5 transition-all active:scale-[0.98] group">
                <span className="text-xl leading-none">{f.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium">{f.label}</p>
                    {f.tag && (
                      <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-1.5 py-[2px] rounded-md bg-teal-500/10 text-teal-400 border border-teal-500/15">
                        {f.tag}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{f.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      </Stagger>

      {/* Sources */}
      {stats?.topSources?.length > 0 && (
        <Stagger>
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em] px-1">Sources</p>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden divide-y divide-white/[0.04]">
              {stats.topSources.slice(0, 6).map((src: any, i: number) => {
                const st = getSourceType(src.type);
                const SrcIcon = st.icon;
                return (
                <div key={src.id || i} className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${st.bgColor}`}>
                    <SrcIcon className={`w-3.5 h-3.5 ${st.textColor}`} />
                  </div>
                  <p className="text-[13px] truncate flex-1 min-w-0">{src.title}</p>
                  <span className="text-[11px] text-zinc-600 tabular-nums font-medium shrink-0">{src.itemCount}</span>
                </div>
                );
              })}
            </div>
          </div>
        </Stagger>
      )}
    </PageTransition>
  );
}

/** Format a timestamp to relative time */
function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Activity chart showing 14-day knowledge growth */
function ActivityChart({ data }: { data: Array<{ day: string; count: number }> }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const max = Math.max(...data.map((d) => d.count), 1);
  const activeDays = data.filter((d) => d.count > 0).length;

  // Calculate streak (consecutive days ending at today/yesterday)
  let streak = 0;
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i].count > 0) streak++;
    else break;
  }

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (total === 0) return null;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5 text-teal-400" />
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em]">
            Activity
          </span>
          <span className="text-[10px] text-zinc-600">· 14 days</span>
        </div>
        <div className="flex items-center gap-3">
          {streak > 1 && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400">
              🔥 {streak}-day streak
            </span>
          )}
          <span className="text-[10px] text-zinc-600 tabular-nums">
            {total} memor{total === 1 ? "y" : "ies"} added
          </span>
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-[3px] h-16 relative">
        {data.map((d, i) => {
          const height = d.count > 0 ? Math.max((d.count / max) * 100, 8) : 0;
          const isToday = i === data.length - 1;
          const date = new Date(d.day);
          const dayLabel = date.toLocaleDateString(undefined, { weekday: "short" });
          const dateLabel = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
          const isHovered = hoveredIdx === i;

          return (
            <div
              key={d.day}
              className="flex-1 flex flex-col items-center justify-end h-full relative group"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Tooltip */}
              {isHovered && d.count > 0 && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-10 px-2 py-1 rounded-lg bg-[#1a1a1d] border border-white/[0.1] shadow-lg shadow-black/40 whitespace-nowrap pointer-events-none">
                  <span className="text-[10px] font-medium text-zinc-300">{d.count}</span>
                  <span className="text-[10px] text-zinc-600 ml-1">{dateLabel}</span>
                </div>
              )}
              {/* Bar */}
              <div
                className={`w-full rounded-t-[3px] rounded-b-[1px] transition-all duration-200 ${
                  d.count === 0
                    ? "bg-white/[0.03] min-h-[2px]"
                    : isToday
                      ? "bg-gradient-to-t from-teal-500 to-teal-400 shadow-sm shadow-teal-500/20"
                      : isHovered
                        ? "bg-teal-400/60"
                        : "bg-teal-500/30"
                }`}
                style={{ height: d.count > 0 ? `${height}%` : "2px" }}
              />
            </div>
          );
        })}
      </div>

      {/* Day labels (show first, middle, and last) */}
      <div className="flex justify-between px-0.5">
        {[0, 6, 13].map((idx) => {
          const d = new Date(data[idx]?.day || "");
          return (
            <span key={idx} className="text-[9px] text-zinc-700 tabular-nums">
              {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          );
        })}
      </div>
    </div>
  );
}
