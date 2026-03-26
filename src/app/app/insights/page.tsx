'use client';

import { useState, useEffect } from 'react';
import {
  Brain, Zap, AlertTriangle, Clock, TrendingUp, RefreshCw,
  Loader2, MessageCircle, FileText, Globe, Type, Sparkles,
  ChevronRight, Activity, Search, Check, X, ArrowRight,
  Gem, BookOpenCheck, MessageSquare, Shield, Trash2, Eye,
} from 'lucide-react';
import { PageTransition, Stagger } from '@/components/PageTransition';
import { toast } from 'sonner';
import { usePageTitle } from "@/lib/use-page-title";

interface MemoryLike {
  id: string;
  content: string;
  source: string;
  sourceTitle: string;
  createdAt?: string;
  urgency?: number;
}

interface Connection {
  memoryA: MemoryLike;
  memoryB: MemoryLike;
  similarity: number;
  bridgeConcept: string;
  surprise: number;
}

interface Contradiction {
  id?: string;
  memoryA: MemoryLike;
  memoryB: MemoryLike;
  topic: string;
  description: string;
  detectedAt?: string;
}

type TabId = 'connections' | 'contradictions' | 'forgetting';

const sourceConfig: Record<string, { icon: any; color: string }> = {
  chatgpt: { icon: MessageCircle, color: 'text-green-400 bg-green-500/10' },
  text: { icon: Type, color: 'text-teal-400 bg-teal-500/10' },
  file: { icon: FileText, color: 'text-blue-400 bg-blue-500/10' },
  url: { icon: Globe, color: 'text-orange-400 bg-orange-500/10' },
  kindle: { icon: BookOpenCheck, color: 'text-amber-400 bg-amber-500/10' },
  document: { icon: FileText, color: 'text-blue-400 bg-blue-500/10' },
  obsidian: { icon: Gem, color: 'text-sky-400 bg-sky-500/10' },
  reddit: { icon: MessageSquare, color: 'text-orange-400 bg-orange-500/10' },
};

export default function InsightsPage() {
  usePageTitle("Insights");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [forgetting, setForgetting] = useState<(MemoryLike & { urgency: number })[]>([]);
  const [metabolism, setMetabolism] = useState<any>(null);
  const [mindDiff, setMindDiff] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('connections');
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => { runConsolidation(); }, []);

  async function runConsolidation() {
    setLoading(true);
    try {
      // Fetch insights + contradiction scan results in parallel
      const [insightsRes, contradictionsRes] = await Promise.all([
        fetch('/api/v1/insights'),
        fetch('/api/v1/plugins/contradiction-finder?action=results'),
      ]);
      
      if (insightsRes.ok) {
        const data = await insightsRes.json();
        setConnections(data.connections || []);
        setForgetting(data.forgetting || []);
        setMetabolism(data.metabolism || null);
        setMindDiff(data.mindDiff || null);
      }
      
      if (contradictionsRes.ok) {
        const cData = await contradictionsRes.json();
        setContradictions(cData.contradictions || []);
      }
    } catch (e) {
      console.error('Consolidation failed:', e);
    } finally {
      setLoading(false);
    }
  }

  async function runContradictionScan() {
    setScanning(true);
    setScanMessage('');
    try {
      const res = await fetch('/api/v1/plugins/contradiction-finder?action=scan');
      if (!res.ok) throw new Error('Scan failed');
      const data = await res.json();
      setContradictions(data.contradictions || []);
      setScanMessage(data.message || '');
      if (data.newFound > 0) {
        toast.success(`Found ${data.newFound} new contradiction${data.newFound > 1 ? 's' : ''}`, {
          description: `Scanned ${data.scanned} memory pairs`,
        });
      } else {
        toast.info('No new contradictions found', {
          description: `Scanned ${data.scanned} memory pairs`,
        });
      }
    } catch (e) {
      toast.error('Contradiction scan failed');
    } finally {
      setScanning(false);
    }
  }

  async function resolveContradiction(contradictionId: string, resolution: 'dismiss' | 'keep-a' | 'keep-b') {
    setResolving(contradictionId);
    try {
      const res = await fetch('/api/v1/plugins/contradiction-finder?action=resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contradictionId, resolution }),
      });
      if (!res.ok) throw new Error('Resolve failed');
      
      // Remove from local state
      setContradictions(prev => prev.filter(c => c.id !== contradictionId));
      
      const labels: Record<string, string> = {
        'dismiss': 'Contradiction dismissed',
        'keep-a': 'Kept first memory, removed second',
        'keep-b': 'Kept second memory, removed first',
      };
      toast.success(labels[resolution] || 'Resolved');
    } catch (e) {
      toast.error('Failed to resolve contradiction');
    } finally {
      setResolving(null);
    }
  }

  const tabs: { id: TabId; icon: any; label: string; count: number; color: string }[] = [
    { id: 'connections', icon: Zap, label: 'Connections', count: connections.length, color: 'text-amber-400' },
    { id: 'contradictions', icon: AlertTriangle, label: 'Conflicts', count: contradictions.length, color: 'text-red-400' },
    { id: 'forgetting', icon: Clock, label: 'Fading', count: forgetting.length, color: 'text-blue-400' },
  ];

  return (
    <PageTransition className="space-y-6 md:space-y-8">
      {/* Header */}
      <Stagger>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] md:text-[28px] font-semibold tracking-[-0.03em]">Mind Insights</h1>
            <p className="text-[13px] text-zinc-500 mt-0.5">Connections, contradictions &amp; memory health</p>
          </div>
          <button
            onClick={runConsolidation}
            disabled={loading}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] text-[12px] font-medium text-zinc-400 transition-all active:scale-[0.96] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{loading ? 'Analyzing…' : 'Refresh'}</span>
          </button>
        </div>
      </Stagger>

      {/* Loading State */}
      {loading && !metabolism && (
        <Stagger>
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500/20 to-sky-500/20 flex items-center justify-center mb-4">
              <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
            </div>
            <p className="text-[13px] text-zinc-500">Analyzing your knowledge…</p>
          </div>
        </Stagger>
      )}

      {/* Metabolism Score Card */}
      {metabolism && (
        <Stagger>
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/[0.08] to-sky-500/[0.04] pointer-events-none" />
          <div className="relative p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-teal-400" />
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em]">Knowledge Metabolism</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[40px] md:text-[48px] font-bold tracking-[-0.04em] bg-gradient-to-r from-teal-400 to-sky-400 bg-clip-text text-transparent leading-none">
                    {metabolism.score}
                  </span>
                  <span className="text-[16px] text-zinc-600 font-medium">/10</span>
                </div>
                <p className="text-[13px] text-zinc-400 leading-relaxed max-w-sm">{metabolism.verdict}</p>
              </div>
              <div className="flex gap-4 md:gap-6 shrink-0">
                <div className="text-right">
                  <p className="text-[22px] md:text-[26px] font-semibold tabular-nums">{metabolism.intake}</p>
                  <p className="text-[10px] text-zinc-600 font-medium mt-0.5">New this week</p>
                </div>
                <div className="text-right">
                  <p className="text-[22px] md:text-[26px] font-semibold tabular-nums">{metabolism.connections}</p>
                  <p className="text-[10px] text-zinc-600 font-medium mt-0.5">Connections</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        </Stagger>
      )}

      {/* Mind Growth Card */}
      {mindDiff && mindDiff.newMemories > 0 && (
        <Stagger>
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.06] to-emerald-500/[0.02] pointer-events-none" />
          <div className="relative p-4 md:p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-[13px] font-medium text-zinc-300">This Week&apos;s Growth</span>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-baseline gap-1">
                <span className="text-[22px] font-semibold text-emerald-400 tabular-nums">+{mindDiff.newMemories}</span>
                <span className="text-[12px] text-zinc-500 ml-1">memories</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[22px] font-semibold tabular-nums">{mindDiff.growthRate.toFixed(1)}</span>
                <span className="text-[12px] text-zinc-500 ml-1">per day</span>
              </div>
            </div>
            {mindDiff.topNewTopics?.length > 0 && (
              <div className="mt-3 flex gap-1.5 flex-wrap">
                {mindDiff.topNewTopics.slice(0, 5).map((t: string) => (
                  <span key={t} className="text-[11px] px-2 py-[3px] rounded-lg bg-white/[0.04] border border-white/[0.06] text-zinc-400 font-medium">{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        </Stagger>
      )}

      {/* Tab Selector */}
      {!loading && (
        <>
          <Stagger>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 pb-0.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-[6px] rounded-full text-[12px] font-medium transition-all active:scale-[0.95] ${
                  activeTab === t.id
                    ? 'bg-teal-500/15 text-teal-300 border border-teal-500/25 shadow-sm shadow-teal-500/10'
                    : 'text-zinc-500 border border-white/[0.06] hover:bg-white/[0.04]'
                }`}
              >
                <t.icon className={`w-3 h-3 ${activeTab === t.id ? t.color : ''}`} />
                {t.label}
                <span className="text-[10px] opacity-60 tabular-nums">{t.count}</span>
              </button>
            ))}
          </div>
          </Stagger>

          <Stagger>
          {/* Tab Content */}
          <div className="space-y-2">
            {/* ─── Connections ─── */}
            {activeTab === 'connections' && (
              <>
                <p className="text-[12px] text-zinc-500 px-1 leading-relaxed">
                  Unexpected bridges between distant pieces of your knowledge — ideas you might not have connected.
                </p>
                {connections.length === 0 ? (
                  <EmptyState message="Import more knowledge from different sources to discover cross-pollinations." />
                ) : (
                  <div className="space-y-2.5">
                    {connections.map((c, i) => (
                      <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                        {/* Bridge Header */}
                        <div className="px-4 py-2.5 flex items-center gap-2 border-b border-white/[0.04]">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-[12px] font-medium text-amber-300 flex-1 min-w-0 truncate">
                            {c.bridgeConcept}
                          </span>
                          <span className="text-[10px] text-zinc-600 font-medium tabular-nums shrink-0">
                            {(c.surprise * 100).toFixed(0)}% surprise
                          </span>
                        </div>
                        {/* Memory Pair */}
                        <div className="p-3 grid md:grid-cols-2 gap-2">
                          <MemoryCard memory={c.memoryA} />
                          <MemoryCard memory={c.memoryB} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ─── Contradictions (Enhanced with Contradiction Finder Plugin) ─── */}
            {activeTab === 'contradictions' && (
              <>
                <div className="flex items-center justify-between px-1">
                  <p className="text-[12px] text-zinc-500 leading-relaxed flex-1">
                    Conflicting beliefs and inconsistencies in your knowledge. AI-verified when available.
                  </p>
                  <button
                    onClick={runContradictionScan}
                    disabled={scanning}
                    className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-medium transition-all hover:bg-red-500/15 active:scale-[0.96] disabled:opacity-50 shrink-0 ml-3"
                  >
                    {scanning ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Search className="w-3 h-3" />
                    )}
                    <span className="hidden sm:inline">{scanning ? 'Scanning…' : 'Deep Scan'}</span>
                  </button>
                </div>

                {/* Scan progress message */}
                {scanMessage && (
                  <div className="px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06] text-[11px] text-zinc-400">
                    {scanMessage}
                  </div>
                )}

                {contradictions.length === 0 ? (
                  <EmptyState
                    message={scanning ? 'Scanning your knowledge for contradictions…' : 'No contradictions found. Hit "Deep Scan" to run an AI-powered analysis.'}
                    icon={scanning ? Loader2 : Shield}
                    iconClass={scanning ? 'animate-spin text-red-400' : 'text-emerald-500'}
                  />
                ) : (
                  <div className="space-y-3">
                    {contradictions.map((c, i) => (
                      <ContradictionCard
                        key={c.id || i}
                        contradiction={c}
                        index={i}
                        resolving={resolving === c.id}
                        onResolve={(resolution) => c.id && resolveContradiction(c.id, resolution)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ─── Forgetting ─── */}
            {activeTab === 'forgetting' && (
              <>
                <p className="text-[12px] text-zinc-500 px-1 leading-relaxed">
                  Knowledge at risk of fading, based on the Ebbinghaus forgetting curve.
                </p>
                {forgetting.length === 0 ? (
                  <EmptyState message="Nothing at risk yet. Check back after a few days." />
                ) : (
                  <div className="space-y-1.5">
                    {forgetting.map((m, i) => {
                      const urgencyColor = m.urgency > 0.8
                        ? 'text-red-400 bg-red-500/10 border-red-500/15'
                        : m.urgency > 0.6
                          ? 'text-amber-400 bg-amber-500/10 border-amber-500/15'
                          : 'text-blue-400 bg-blue-500/10 border-blue-500/15';
                      const barColor = m.urgency > 0.8
                        ? 'bg-red-500'
                        : m.urgency > 0.6
                          ? 'bg-amber-500'
                          : 'bg-blue-500';
                      const cfg = sourceConfig[m.source] || { icon: FileText, color: 'text-zinc-400 bg-zinc-500/10' };
                      const SrcIcon = cfg.icon;

                      return (
                        <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5 transition-all hover:bg-white/[0.04]">
                          <div className="flex items-start gap-3">
                            {/* Fade Risk Badge */}
                            <div className={`shrink-0 w-12 h-12 rounded-xl border flex flex-col items-center justify-center ${urgencyColor}`}>
                              <span className="text-[15px] font-bold tabular-nums leading-none">{(m.urgency * 100).toFixed(0)}</span>
                              <span className="text-[8px] font-semibold uppercase tracking-wide opacity-70 mt-0.5">risk</span>
                            </div>
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-[2px] rounded-md font-semibold uppercase tracking-wide ${cfg.color}`}>
                                  <SrcIcon className="w-2.5 h-2.5" />
                                  {m.source}
                                </span>
                                <span className="text-[11px] text-zinc-600 truncate">{m.sourceTitle || 'Untitled'}</span>
                              </div>
                              <p className="text-[13px] text-zinc-300 line-clamp-2 leading-relaxed">{m.content.slice(0, 200)}</p>
                            </div>
                          </div>
                          {/* Fade Bar */}
                          <div className="mt-2.5 h-1 rounded-full bg-white/[0.04] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${barColor} transition-all`}
                              style={{ width: `${m.urgency * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
          </Stagger>
        </>
      )}
    </PageTransition>
  );
}

// ──────────────────────────────────────────────────────────────
// Contradiction Card — side-by-side with resolution actions
// ──────────────────────────────────────────────────────────────

function ContradictionCard({ contradiction, index, resolving, onResolve }: {
  contradiction: Contradiction;
  index: number;
  resolving: boolean;
  onResolve: (resolution: 'dismiss' | 'keep-a' | 'keep-b') => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const formatDate = (date?: string) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="rounded-2xl border border-red-500/10 bg-white/[0.02] overflow-hidden transition-all hover:border-red-500/15">
      {/* Conflict Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-start gap-3 border-b border-red-500/[0.06] text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="shrink-0 w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center mt-0.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {contradiction.topic && (
              <span className="text-[10px] font-semibold text-red-400/80 uppercase tracking-[0.06em]">
                {contradiction.topic}
              </span>
            )}
          </div>
          <p className="text-[12px] text-zinc-300 leading-relaxed">
            {contradiction.description}
          </p>
          {contradiction.detectedAt && (
            <p className="text-[10px] text-zinc-600 mt-1">
              Detected {formatDate(contradiction.detectedAt)}
            </p>
          )}
        </div>
        <ChevronRight className={`w-3.5 h-3.5 text-zinc-600 shrink-0 mt-1 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="p-3 space-y-3">
          {/* Side-by-side comparison */}
          <div className="grid md:grid-cols-2 gap-2">
            <ContradictionMemoryCard
              label="A"
              memory={contradiction.memoryA}
              accentColor="red"
            />
            <ContradictionMemoryCard
              label="B"
              memory={contradiction.memoryB}
              accentColor="red"
            />
          </div>

          {/* VS divider on mobile */}
          <div className="md:hidden flex items-center gap-2 -my-1">
            <div className="flex-1 h-px bg-red-500/10" />
            <span className="text-[10px] font-bold text-red-400/60 tracking-wider">VS</span>
            <div className="flex-1 h-px bg-red-500/10" />
          </div>

          {/* Resolution Actions */}
          {contradiction.id && (
            <div className="pt-1">
              {!showActions ? (
                <button
                  onClick={() => setShowActions(true)}
                  className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  Resolve this conflict
                  <ArrowRight className="w-3 h-3" />
                </button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onResolve('dismiss')}
                    disabled={resolving}
                    className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-white/[0.08] bg-white/[0.03] text-[11px] text-zinc-400 font-medium transition-all hover:bg-white/[0.06] active:scale-[0.96] disabled:opacity-50"
                  >
                    {resolving ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                    Not a conflict
                  </button>
                  <button
                    onClick={() => onResolve('keep-a')}
                    disabled={resolving}
                    className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-teal-500/20 bg-teal-500/[0.06] text-[11px] text-teal-400 font-medium transition-all hover:bg-teal-500/10 active:scale-[0.96] disabled:opacity-50"
                  >
                    {resolving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Keep A
                  </button>
                  <button
                    onClick={() => onResolve('keep-b')}
                    disabled={resolving}
                    className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-teal-500/20 bg-teal-500/[0.06] text-[11px] text-teal-400 font-medium transition-all hover:bg-teal-500/10 active:scale-[0.96] disabled:opacity-50"
                  >
                    {resolving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Keep B
                  </button>
                  <button
                    onClick={() => setShowActions(false)}
                    className="flex items-center h-7 px-2 rounded-lg text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Contradiction Memory Card — enhanced with date and label
// ──────────────────────────────────────────────────────────────

function ContradictionMemoryCard({ label, memory, accentColor }: {
  label: string;
  memory: MemoryLike;
  accentColor: string;
}) {
  const cfg = sourceConfig[memory.source] || { icon: FileText, color: 'text-zinc-400 bg-zinc-500/10' };
  const SrcIcon = cfg.icon;

  const formatDate = (date?: string) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.04] p-3 relative">
      {/* Label badge */}
      <div className="absolute top-2 right-2 w-5 h-5 rounded-md bg-red-500/10 flex items-center justify-center">
        <span className="text-[9px] font-bold text-red-400">{label}</span>
      </div>
      
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-[2px] rounded-md font-semibold uppercase tracking-wide ${cfg.color}`}>
          <SrcIcon className="w-2.5 h-2.5" />
          {memory.source}
        </span>
        <span className="text-[10px] text-zinc-600 truncate flex-1">{memory.sourceTitle}</span>
      </div>
      <p className="text-[12px] text-zinc-400 leading-relaxed line-clamp-4">{memory.content.slice(0, 300)}</p>
      {memory.createdAt && (
        <p className="text-[10px] text-zinc-600 mt-2">{formatDate(memory.createdAt)}</p>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Shared components
// ──────────────────────────────────────────────────────────────

function MemoryCard({ memory }: { memory: MemoryLike }) {
  const cfg = sourceConfig[memory.source] || { icon: FileText, color: 'text-zinc-400 bg-zinc-500/10' };
  const SrcIcon = cfg.icon;

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.04] p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-[2px] rounded-md font-semibold uppercase tracking-wide ${cfg.color}`}>
          <SrcIcon className="w-2.5 h-2.5" />
          {memory.source}
        </span>
        <span className="text-[11px] text-zinc-600 truncate flex-1">{memory.sourceTitle}</span>
      </div>
      <p className="text-[12px] text-zinc-400 line-clamp-3 leading-relaxed">{memory.content.slice(0, 200)}</p>
    </div>
  );
}

function EmptyState({ message, icon, iconClass }: { message: string; icon?: any; iconClass?: string }) {
  const Icon = icon || Brain;
  return (
    <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-white/[0.08]">
      <div className="w-10 h-10 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-3">
        <Icon className={`w-5 h-5 ${iconClass || 'text-zinc-600'}`} />
      </div>
      <p className="text-[13px] text-zinc-500 text-center max-w-xs">{message}</p>
    </div>
  );
}
