'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Brain, RefreshCw, Loader2 } from 'lucide-react';
import { usePageTitle } from "@/lib/use-page-title";

// Dynamic import reagraph (WebGL, can't SSR)
const GraphCanvas = dynamic(
  () => import('reagraph').then(mod => mod.GraphCanvas),
  { ssr: false, loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
    </div>
  )}
);

export default function FingerprintPage() {
  usePageTitle("Knowledge Fingerprint");
  const [data, setData] = useState<{ nodes: any[]; edges: any[]; clusters: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'3d' | 'stats'>('3d');

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
      size: e.weight * 2,
    })) || [],
  [data]);

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] md:text-[28px] font-semibold tracking-[-0.03em]">Mind Map</h1>
          <p className="text-[13px] text-zinc-500 mt-0.5">Your knowledge, visualized as a living graph</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-1">
          {/* View toggle */}
          <div className="flex rounded-xl bg-white/[0.04] border border-white/[0.06] p-0.5">
            <button
              onClick={() => setViewMode('3d')}
              className={`px-3 py-1.5 rounded-[10px] text-[12px] font-medium transition-all ${
                viewMode === '3d'
                  ? 'bg-teal-500/15 text-teal-300 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              3D Graph
            </button>
            <button
              onClick={() => setViewMode('stats')}
              className={`px-3 py-1.5 rounded-[10px] text-[12px] font-medium transition-all ${
                viewMode === 'stats'
                  ? 'bg-teal-500/15 text-teal-300 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Stats
            </button>
          </div>
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

      {/* 3D Graph View */}
      {viewMode === '3d' && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden relative" style={{ height: 'calc(100dvh - 220px)', minHeight: '400px' }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#0a0a0b]/80 backdrop-blur-sm">
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500/20 to-sky-500/10 flex items-center justify-center mx-auto mb-3">
                  <Brain className="w-6 h-6 text-teal-400 animate-pulse" />
                </div>
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

          {data && graphNodes.length === 0 && !loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-xs px-6">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mx-auto mb-4">
                  <Brain className="w-7 h-7 text-zinc-700" />
                </div>
                <p className="text-[15px] font-medium text-zinc-300 mb-1">Your mind is empty</p>
                <p className="text-[12px] text-zinc-600 leading-relaxed mb-4">
                  Import some knowledge first, then come back to see your mind fingerprint.
                </p>
                <Link
                  href="/app/import"
                  className="inline-flex h-9 px-5 items-center rounded-xl bg-teal-600 hover:bg-teal-500 text-[13px] font-medium text-white transition-all active:scale-[0.97]"
                >
                  Import Knowledge
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats View */}
      {viewMode === 'stats' && (
        <div className="space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
            </div>
          )}

          {data && !loading && (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Nodes", value: data.nodes.length, color: "text-teal-400" },
                  { label: "Connections", value: data.edges.length, color: "text-blue-400" },
                  { label: "Clusters", value: data.clusters.length, color: "text-emerald-400" },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <p className={`text-[22px] md:text-[28px] font-semibold tabular-nums ${s.color}`}>
                      {s.value.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-zinc-600 font-medium mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Clusters */}
              {data.clusters.length > 0 && (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 md:p-5 space-y-4">
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
                              <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: c.color }}
                              />
                              <span className="text-[13px] font-medium capitalize">{c.name}</span>
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
              <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-teal-500/[0.04] to-sky-500/[0.02] p-4 md:p-5">
                <p className="text-[13px] font-medium text-zinc-300 mb-2">💡 What is a Knowledge Fingerprint?</p>
                <p className="text-[12px] text-zinc-500 leading-relaxed">
                  Your Knowledge Fingerprint is a unique visualization of your mind's topology.
                  Each node represents a piece of knowledge, and edges show semantic connections.
                  Clusters reveal your areas of expertise, while isolated nodes highlight potential
                  blind spots. As you import more knowledge, your fingerprint grows and evolves —
                  a living map of your intellectual landscape.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function clusterColor(group: string): string {
  const colors: Record<string, string> = {
    chatgpt: '#10b981',
    text: '#38bdf8',
    file: '#f59e0b',
    url: '#3b82f6',
  };
  return colors[group] || '#6b7280';
}
