'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Brain, RefreshCw, Loader2, Lightbulb, Network, Link2, Layers, Sparkles, ArrowRight, Zap } from 'lucide-react';
import { usePageTitle } from "@/lib/use-page-title";
import { PageTransition } from "@/components/PageTransition";
import { EmptyFeatureState } from "@/components/EmptyFeatureState";
import { toast } from 'sonner';
import { track } from '@/lib/analytics';

// Dynamic import reagraph (WebGL, can't SSR)
const GraphCanvas = dynamic(
  () => import('reagraph').then(mod => mod.GraphCanvas),
  { ssr: false, loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
    </div>
  )}
);

const SOURCE_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT', text: 'Notes', file: 'Files', url: 'Web',
  kindle: 'Books', youtube: 'YouTube', reddit: 'Reddit',
};

export default function FingerprintPage() {
  usePageTitle("Knowledge Fingerprint");
  const [data, setData] = useState<{
    nodes: any[];
    edges: any[];
    clusters: any[];
    surprisingConnections: any[];
    hasStoredConnections: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [viewMode, setViewMode] = useState<'graph' | 'breakdown'>('graph');

  useEffect(() => { loadFingerprint(); }, []);

  async function loadFingerprint() {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/fingerprint');
      if (!res.ok) throw new Error('Failed');
      setData(await res.json());
    } catch (e) {
      console.error('Failed to generate fingerprint:', e);
    } finally {
      setLoading(false);
    }
  }

  async function discoverConnections() {
    setDiscovering(true);
    try {
      const res = await fetch('/api/v1/fingerprint', { method: 'POST' });
      const result = await res.json();
      if (result.ok) {
        toast.success(`Found ${result.discovered} connections`);
        track.connectionDiscover();
        await loadFingerprint();
      }
    } catch {
      toast.error('Connection discovery failed');
    } finally {
      setDiscovering(false);
    }
  }

  const graphNodes = useMemo(() =>
    data?.nodes.map(n => ({
      id: n.id,
      label: n.label,
      fill: clusterColor(n.group),
      size: n.size,
    })) || [],
  [data]);

  const graphEdges = useMemo(() =>
    data?.edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      size: e.weight * 2,
    })) || [],
  [data]);

  return (
    <PageTransition>
    <div className="space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] md:text-[28px] font-semibold tracking-[-0.03em]">Knowledge Fingerprint</h1>
          <p className="text-[13px] text-zinc-500 mt-0.5">The shape of your thinking, visualized</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-1">
          {/* View toggle */}
          <div className="flex rounded-xl bg-white/[0.04] border border-white/[0.06] p-0.5">
            <button
              onClick={() => setViewMode('graph')}
              className={`px-3 py-1.5 rounded-[10px] text-[12px] font-medium transition-all ${
                viewMode === 'graph'
                  ? 'bg-teal-500/15 text-teal-300 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Graph
            </button>
            <button
              onClick={() => setViewMode('breakdown')}
              className={`px-3 py-1.5 rounded-[10px] text-[12px] font-medium transition-all ${
                viewMode === 'breakdown'
                  ? 'bg-teal-500/15 text-teal-300 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Breakdown
            </button>
          </div>

          {/* Discover connections */}
          <button
            onClick={discoverConnections}
            disabled={discovering || loading}
            title="Discover surprising connections between your memories"
            className="h-8 px-3 flex items-center gap-1.5 rounded-xl border border-teal-500/20 bg-teal-500/[0.06] hover:bg-teal-500/[0.12] text-teal-400 text-[12px] font-medium transition-all active:scale-[0.95] disabled:opacity-40"
          >
            {discovering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            {discovering ? 'Discovering…' : 'Discover'}
          </button>

          {/* Refresh */}
          <button
            onClick={loadFingerprint}
            disabled={loading}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] transition-all active:scale-[0.95] disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Graph View */}
      {viewMode === 'graph' && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden relative" style={{ height: 'calc(100dvh - 220px)', minHeight: '400px' }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#0a0a0b]/80 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <Brain className="w-5 h-5 text-teal-400 animate-pulse" />
                <p className="text-[13px] text-zinc-400">Mapping your mind…</p>
              </div>
            </div>
          )}

          {data && graphNodes.length > 0 && (
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
              </div>
            }>
              <GraphCanvas
                nodes={graphNodes}
                edges={graphEdges}
                cameraMode="rotate"
                labelType="all"
              />
            </Suspense>
          )}

          {/* No-connections nudge overlay */}
          {data && graphNodes.length > 0 && !data.hasStoredConnections && !loading && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
              <button
                onClick={discoverConnections}
                disabled={discovering}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900/90 border border-teal-500/20 text-[12px] text-teal-300 backdrop-blur-sm hover:bg-zinc-800/90 transition-all"
              >
                {discovering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {discovering ? 'Finding connections…' : 'Discover surprising connections'}
              </button>
            </div>
          )}

          {data && graphNodes.length === 0 && !loading && (
            <EmptyFeatureState
              icon={Brain}
              title="See the shape of your thinking"
              description="Your Knowledge Fingerprint maps every connection between your ideas into a living 3D graph. Import conversations, notes, or articles to watch your mind's topology emerge."
              ctaText="Import your first data →"
              ctaHref="/app/import"
              secondaryText="or explore with demo data"
              secondaryHref="/app?demo=true"
            />
          )}
        </div>
      )}

      {/* Breakdown View */}
      {viewMode === 'breakdown' && (
        <div className="space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
            </div>
          )}

          {data && !loading && (
            <>
              {/* Summary — inline row */}
              <div className="flex items-baseline gap-6 text-[13px] text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5 text-teal-400" />
                  <span className="text-zinc-200 font-medium tabular-nums">{data.nodes.length.toLocaleString()}</span> nodes
                </span>
                <span className="flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-zinc-200 font-medium tabular-nums">{data.edges.length.toLocaleString()}</span> connections
                </span>
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-zinc-200 font-medium tabular-nums">{data.clusters.length}</span> clusters
                </span>
              </div>

              {/* Surprising connections */}
              {data.surprisingConnections?.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em]">
                      Surprising connections
                    </p>
                  </div>
                  <div className="space-y-2">
                    {data.surprisingConnections.map((c: any) => (
                      <div key={c.id} className="rounded-2xl bg-white/[0.02] border border-white/[0.04] p-4 hover:bg-white/[0.04] transition-colors">
                        <div className="flex items-center gap-2 mb-3">
                          {c.bridgeConcept && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/[0.08] border border-amber-500/15 text-[11px] text-amber-400 font-medium">
                              {c.bridgeConcept}
                            </span>
                          )}
                          <span className="text-[11px] text-zinc-600">
                            {SOURCE_LABELS[c.aType] || c.aType} × {SOURCE_LABELS[c.bType] || c.bType}
                          </span>
                          <span className="ml-auto text-[11px] text-zinc-700 tabular-nums">
                            {Math.round((c.surprise || 0) * 100)}% surprise
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2">
                            &ldquo;{c.aSnippet}&rdquo;
                          </p>
                          <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2 border-l border-white/[0.04] pl-3">
                            &ldquo;{c.bSnippet}&rdquo;
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No stored connections nudge */}
              {!data.hasStoredConnections && (
                <div className="rounded-2xl border border-teal-500/10 bg-teal-500/[0.03] p-5">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-[13px] font-medium text-zinc-300 mb-1">No connections discovered yet</p>
                      <p className="text-[12px] text-zinc-600 leading-relaxed mb-3">
                        Run connection discovery to find surprising links between your memories — ideas from different sources that share hidden meaning.
                      </p>
                      <button
                        onClick={discoverConnections}
                        disabled={discovering}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[12px] font-medium transition-colors disabled:opacity-50"
                      >
                        {discovering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                        {discovering ? 'Discovering…' : 'Discover connections'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Clusters */}
              {data.clusters.length > 0 && (
                <div className="space-y-4">
                  <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em]">
                    Knowledge Clusters
                  </p>
                  <div className="space-y-3">
                    {data.clusters.map((c: any) => {
                      const maxSize = Math.max(1, ...data.clusters.map((x: any) => x.size));
                      const pct = Math.min(100, (c.size / maxSize) * 100);
                      return (
                        <div key={c.name} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                              <span className="text-[13px] font-medium capitalize">{SOURCE_LABELS[c.name] || c.name}</span>
                            </div>
                            <span className="text-[12px] text-zinc-500 tabular-nums">{c.size} items</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700 ease-out"
                              style={{ backgroundColor: c.color, width: `${pct}%`, opacity: 0.7 }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* About */}
              <div className="border-t border-white/[0.06] pt-5 mt-2">
                <div className="flex items-start gap-2.5">
                  <Lightbulb className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[13px] font-medium text-zinc-400 mb-1">What is a Knowledge Fingerprint?</p>
                    <p className="text-[12px] text-zinc-600 leading-relaxed max-w-lg">
                      A unique topology of your mind. Nodes are pieces of knowledge, edges show semantic connections.
                      Clusters reveal expertise areas; isolated nodes highlight blind spots. It grows as you learn.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
    </PageTransition>
  );
}

function clusterColor(group: string): string {
  const colors: Record<string, string> = {
    chatgpt: '#10b981',
    text: '#38bdf8',
    file: '#f59e0b',
    url: '#3b82f6',
    kindle: '#f97316',
    youtube: '#ef4444',
    reddit: '#f97316',
  };
  return colors[group] || '#6b7280';
}
