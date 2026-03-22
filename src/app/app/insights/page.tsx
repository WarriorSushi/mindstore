'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Brain, Zap, AlertTriangle, Clock, TrendingUp, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  findCrossConnections,
  findContradictions,
  getForgettingRisks,
  getMindDiff,
  getMetabolismScore,
  type Connection,
  type Contradiction,
} from '@/lib/engines/consolidation';
import type { Memory } from '@/lib/db';

export default function InsightsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [forgetting, setForgetting] = useState<(Memory & { urgency: number })[]>([]);
  const [metabolism, setMetabolism] = useState<Awaited<ReturnType<typeof getMetabolismScore>> | null>(null);
  const [mindDiff, setMindDiff] = useState<Awaited<ReturnType<typeof getMindDiff>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { runConsolidation(); }, []);

  async function runConsolidation() {
    setLoading(true);
    try {
      const [conn, contra, forget, meta, diff] = await Promise.all([
        findCrossConnections(15),
        findContradictions(),
        getForgettingRisks(15),
        getMetabolismScore(),
        getMindDiff(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
      ]);
      setConnections(conn);
      setContradictions(contra);
      setForgetting(forget);
      setMetabolism(meta);
      setMindDiff(diff);
    } catch (e) {
      console.error('Consolidation failed:', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="border-b border-zinc-800/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/app" className="text-zinc-400 hover:text-zinc-200"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold">🧠 Mind Insights</h1>
            <p className="text-sm text-zinc-500">Your brain's consolidation report</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={runConsolidation} className="border-zinc-700">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Consolidate
        </Button>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Metabolism Score */}
        {metabolism && (
          <div className="mb-8 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5 border border-zinc-800 rounded-2xl p-8">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-zinc-400 mb-1">Knowledge Metabolism</div>
                <div className="text-5xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                  {metabolism.score}/10
                </div>
                <p className="text-zinc-400 mt-2 max-w-md">{metabolism.verdict}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-right">
                <div>
                  <div className="text-2xl font-bold">{metabolism.intake}</div>
                  <div className="text-xs text-zinc-500">New this week</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{metabolism.connections}</div>
                  <div className="text-xs text-zinc-500">Connections</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mind Diff */}
        {mindDiff && mindDiff.newMemories > 0 && (
          <div className="mb-8 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              This Week's Mind Growth
            </h3>
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-2xl font-bold text-emerald-400">+{mindDiff.newMemories}</span>
                <span className="text-zinc-500 ml-2">new memories</span>
              </div>
              <div>
                <span className="text-2xl font-bold text-zinc-300">{mindDiff.growthRate.toFixed(1)}</span>
                <span className="text-zinc-500 ml-2">per day</span>
              </div>
            </div>
            {mindDiff.topNewTopics.length > 0 && (
              <div className="mt-3 flex gap-2 flex-wrap">
                {mindDiff.topNewTopics.slice(0, 5).map(t => (
                  <span key={t} className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-xs">{t}</span>
                ))}
              </div>
            )}
          </div>
        )}

        <Tabs defaultValue="connections" className="space-y-6">
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="connections" className="data-[state=active]:bg-violet-600">
              <Zap className="w-3.5 h-3.5 mr-1.5" /> Connections ({connections.length})
            </TabsTrigger>
            <TabsTrigger value="contradictions" className="data-[state=active]:bg-violet-600">
              <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> Contradictions ({contradictions.length})
            </TabsTrigger>
            <TabsTrigger value="forgetting" className="data-[state=active]:bg-violet-600">
              <Clock className="w-3.5 h-3.5 mr-1.5" /> Forgetting ({forgetting.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connections" className="space-y-4">
            <p className="text-sm text-zinc-500">
              Unexpected bridges between distant pieces of your knowledge. These are ideas you might not have connected yourself.
            </p>
            {connections.length === 0 ? (
              <Empty message="Import more knowledge from different sources to discover cross-pollinations." />
            ) : (
              connections.map((c, i) => (
                <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium text-amber-400">
                      Bridge: {c.bridgeConcept}
                    </span>
                    <span className="text-xs text-zinc-600 ml-auto">
                      Surprise: {(c.surprise * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <MemoryCard memory={c.memoryA} />
                    <MemoryCard memory={c.memoryB} />
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="contradictions" className="space-y-4">
            <p className="text-sm text-zinc-500">
              Places where your own thinking might conflict. Not errors — evolution of thought.
            </p>
            {contradictions.length === 0 ? (
              <Empty message="No contradictions found yet. This gets more interesting with more data." />
            ) : (
              contradictions.map((c, i) => (
                <div key={i} className="bg-zinc-900/50 border border-red-900/20 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-sm text-red-400">{c.description}</span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <MemoryCard memory={c.memoryA} />
                    <MemoryCard memory={c.memoryB} />
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="forgetting" className="space-y-4">
            <p className="text-sm text-zinc-500">
              Knowledge you're at risk of forgetting, based on the Ebbinghaus forgetting curve.
            </p>
            {forgetting.length === 0 ? (
              <Empty message="Nothing at risk yet. Check back after a few days." />
            ) : (
              forgetting.map((m, i) => (
                <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-start gap-4">
                  <div className="shrink-0 text-center">
                    <div className={`text-lg font-bold ${m.urgency > 0.8 ? 'text-red-400' : m.urgency > 0.6 ? 'text-amber-400' : 'text-zinc-400'}`}>
                      {(m.urgency * 100).toFixed(0)}%
                    </div>
                    <div className="text-[10px] text-zinc-600">fade risk</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.sourceTitle || 'Untitled'}</div>
                    <div className="text-xs text-zinc-500 mt-1 line-clamp-2">{m.content.slice(0, 200)}</div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function MemoryCard({ memory }: { memory: Memory }) {
  return (
    <div className="bg-zinc-800/50 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs bg-zinc-700 px-1.5 py-0.5 rounded capitalize">{memory.source}</span>
        <span className="text-xs text-zinc-500 truncate">{memory.sourceTitle}</span>
      </div>
      <p className="text-sm text-zinc-300 line-clamp-3">{memory.content.slice(0, 200)}</p>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl">
      <Brain className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
      <p className="text-zinc-500 text-sm">{message}</p>
    </div>
  );
}
