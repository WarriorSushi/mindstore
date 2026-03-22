'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Brain, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateFingerprint } from '@/lib/engines/consolidation';

// Dynamic import reagraph (WebGL, can't SSR)
const GraphCanvas = dynamic(
  () => import('reagraph').then(mod => mod.GraphCanvas),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full text-zinc-500">Loading 3D graph...</div> }
);

export default function FingerprintPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof generateFingerprint>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'3d' | 'stats'>('3d');

  useEffect(() => {
    loadFingerprint();
  }, []);

  async function loadFingerprint() {
    setLoading(true);
    try {
      const fp = await generateFingerprint();
      setData(fp);
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
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <div className="border-b border-zinc-800/50 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/app" className="text-zinc-400 hover:text-zinc-200">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Brain className="w-5 h-5 text-violet-400" />
              Knowledge Fingerprint
            </h1>
            <p className="text-sm text-zinc-500">Your mind, visualized as a living graph</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-zinc-900 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('3d')}
              className={`px-3 py-1.5 rounded-md text-sm transition ${viewMode === '3d' ? 'bg-violet-600 text-white' : 'text-zinc-400'}`}
            >
              3D Graph
            </button>
            <button
              onClick={() => setViewMode('stats')}
              className={`px-3 py-1.5 rounded-md text-sm transition ${viewMode === 'stats' ? 'bg-violet-600 text-white' : 'text-zinc-400'}`}
            >
              Statistics
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={loadFingerprint} className="border-zinc-700">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-zinc-950/80">
            <div className="text-center">
              <Brain className="w-12 h-12 text-violet-400 animate-pulse mx-auto mb-4" />
              <p className="text-zinc-400">Mapping your mind...</p>
            </div>
          </div>
        )}

        {viewMode === '3d' && data && (
          <div className="absolute inset-0">
            <Suspense fallback={<div className="flex items-center justify-center h-full text-zinc-500">Loading...</div>}>
              {graphNodes.length > 0 ? (
                <GraphCanvas
                  nodes={graphNodes}
                  edges={graphEdges}
                  cameraMode="rotate"
                  labelType="all"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center max-w-md">
                    <Brain className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Your mind is empty</h2>
                    <p className="text-zinc-500 mb-4">Import some knowledge first, then come back to see your mind fingerprint.</p>
                    <Link href="/app/import">
                      <Button className="bg-violet-600 hover:bg-violet-500">Import Knowledge</Button>
                    </Link>
                  </div>
                </div>
              )}
            </Suspense>
          </div>
        )}

        {viewMode === 'stats' && data && (
          <div className="p-8 max-w-4xl mx-auto space-y-8">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                <div className="text-3xl font-bold">{data.nodes.length}</div>
                <div className="text-sm text-zinc-500">Knowledge Nodes</div>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                <div className="text-3xl font-bold">{data.edges.length}</div>
                <div className="text-sm text-zinc-500">Connections</div>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                <div className="text-3xl font-bold">{data.clusters.length}</div>
                <div className="text-sm text-zinc-500">Knowledge Clusters</div>
              </div>
            </div>

            {data.clusters.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Knowledge Clusters</h3>
                <div className="space-y-3">
                  {data.clusters.map(c => (
                    <div key={c.name} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="capitalize flex-1">{c.name}</span>
                      <span className="text-zinc-500">{c.size} items</span>
                      <div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            backgroundColor: c.color,
                            width: `${Math.min(100, (c.size / Math.max(1, ...data.clusters.map(x => x.size))) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5 border border-zinc-800 rounded-xl p-6">
              <h3 className="font-semibold mb-2">💡 What is a Knowledge Fingerprint?</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Your Knowledge Fingerprint is a unique visualization of your mind's topology. 
                Each node represents a piece of knowledge, and edges show semantic connections. 
                Clusters reveal your areas of expertise, while isolated nodes highlight potential 
                blind spots. As you import more knowledge, your fingerprint grows and evolves — 
                a living map of your intellectual landscape.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function clusterColor(group: string): string {
  const colors: Record<string, string> = {
    chatgpt: '#10b981',
    text: '#8b5cf6',
    file: '#f59e0b',
    url: '#3b82f6',
  };
  return colors[group] || '#6b7280';
}
