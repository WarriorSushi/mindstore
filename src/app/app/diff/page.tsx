'use client';

import { useState, useCallback } from 'react';
import {
  ArrowRight, ArrowUpRight, ArrowDownRight, Minus,
  Loader2, Sparkles, GitCompare, RefreshCw, Calendar,
  TrendingUp, TrendingDown, Brain,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageTransition } from '@/components/PageTransition';
import { EmptyFeatureState } from '@/components/EmptyFeatureState';
import { usePageTitle } from '@/lib/use-page-title';

// ─── Types ──────────────────────────────────────────────────────────

interface SourceDiff {
  source: string;
  countA: number;
  countB: number;
  shareA: number;
  shareB: number;
  shareShift: number;
  trend: 'rising' | 'declining' | 'steady';
}

interface DiffResult {
  periodA: { from: string; to: string; total: number };
  periodB: { from: string; to: string; total: number };
  sourceComparison: SourceDiff[];
  synthesis: string | null;
  hasData: boolean;
}

// ─── Source display names ────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  text: 'Notes',
  file: 'Files',
  url: 'Web Articles',
  kindle: 'Kindle',
  document: 'Documents',
  obsidian: 'Obsidian',
  reddit: 'Reddit',
  youtube: 'YouTube',
  twitter: 'Twitter / X',
  notion: 'Notion',
  pdf: 'PDFs',
  audio: 'Audio',
  email: 'Email',
};

function sourceLabel(s: string) {
  return SOURCE_LABELS[s] || s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Preset ranges ───────────────────────────────────────────────────

type Preset = {
  label: string;
  periodB: [number, number]; // [daysAgo start, daysAgo end]
  periodA: [number, number];
};

const PRESETS: Preset[] = [
  { label: 'Last 30 vs prev 30', periodB: [30, 0], periodA: [60, 30] },
  { label: 'Last 90 vs prev 90', periodB: [90, 0], periodA: [180, 90] },
  { label: '3 months vs 6 months ago', periodB: [90, 0], periodA: [270, 180] },
  { label: 'Last year vs year before', periodB: [365, 0], periodA: [730, 365] },
];

function daysAgoISO(daysAgo: number) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
}

// ─── Main Component ──────────────────────────────────────────────────

export default function MindDiffPage() {
  usePageTitle('Mind Diff');

  const [preset, setPreset] = useState<number>(0);
  const [result, setResult] = useState<DiffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runDiff = useCallback(async (presetIndex: number) => {
    const p = PRESETS[presetIndex];
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const params = new URLSearchParams({
        from: daysAgoISO(p.periodB[0]),
        to: daysAgoISO(p.periodB[1]),
        baseFrom: daysAgoISO(p.periodA[0]),
        baseTo: daysAgoISO(p.periodA[1]),
      });
      const res = await fetch(`/api/v1/diff?${params}`);
      if (!res.ok) throw new Error('Failed to compare periods');
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePreset = (idx: number) => {
    setPreset(idx);
    runDiff(idx);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <PageTransition>
      <div className="p-6 max-w-3xl mx-auto">
        {/* ─── Header ─── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center ring-1 ring-teal-500/15">
              <GitCompare className="w-4.5 h-4.5 text-teal-400" />
            </div>
            <h1 className="text-[22px] font-bold text-zinc-100 tracking-tight">Mind Diff</h1>
          </div>
          <p className="text-[14px] text-zinc-500 pl-12">
            Compare two periods of your knowledge — see what you&apos;ve explored more, what&apos;s faded, and how your thinking has shifted.
          </p>
        </div>

        {/* ─── Preset selector ─── */}
        <div className="mb-6">
          <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.08em] mb-2">
            Compare
          </p>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p, i) => (
              <button
                key={i}
                onClick={() => handlePreset(i)}
                disabled={loading}
                className={cn(
                  'text-left px-4 py-3 rounded-xl border text-[13px] font-medium transition-all active:scale-[0.98]',
                  preset === i && result
                    ? 'bg-teal-500/10 border-teal-500/25 text-teal-300'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Loading ─── */}
        {loading && (
          <div className="flex items-center justify-center py-16 gap-3 text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-[14px]">Comparing periods…</span>
          </div>
        )}

        {/* ─── Error ─── */}
        {!loading && error && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.05] px-4 py-3 text-[14px] text-rose-400">
            {error}
          </div>
        )}

        {/* ─── Empty state before first run ─── */}
        {!loading && !error && !result && (
          <EmptyFeatureState
            icon={GitCompare}
            title="Select a comparison range"
            description="Pick two periods above to see how your knowledge focus has shifted over time."
          />
        )}

        {/* ─── Results ─── */}
        {!loading && result && (
          <div className="space-y-5">
            {/* Period labels */}
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-center">
                <p className="text-[11px] text-zinc-600 uppercase tracking-[0.07em] font-semibold mb-0.5">Before</p>
                <p className="text-[13px] font-medium text-zinc-300">
                  {formatDate(result.periodA.from)} — {formatDate(result.periodA.to)}
                </p>
                <p className="text-[12px] text-zinc-500 mt-0.5">{result.periodA.total.toLocaleString()} memories</p>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600 shrink-0" />
              <div className="flex-1 rounded-xl border border-teal-500/20 bg-teal-500/[0.05] px-4 py-2.5 text-center">
                <p className="text-[11px] text-teal-600 uppercase tracking-[0.07em] font-semibold mb-0.5">After</p>
                <p className="text-[13px] font-medium text-teal-300">
                  {formatDate(result.periodB.from)} — {formatDate(result.periodB.to)}
                </p>
                <p className="text-[12px] text-teal-500/70 mt-0.5">{result.periodB.total.toLocaleString()} memories</p>
              </div>
            </div>

            {!result.hasData ? (
              <EmptyFeatureState
                icon={Calendar}
                title="No data in these periods"
                description="Try importing more content or selecting a wider date range."
              />
            ) : (
              <>
                {/* AI Synthesis */}
                {result.synthesis && (
                  <div className="rounded-2xl border border-teal-500/15 bg-teal-500/[0.04] px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Brain className="w-3.5 h-3.5 text-teal-400" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-teal-500 uppercase tracking-[0.07em] mb-1.5">
                          Knowledge Diff
                        </p>
                        <p className="text-[14px] text-zinc-300 leading-relaxed">{result.synthesis}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Source comparison */}
                {result.sourceComparison.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.08em] mb-3">
                      By source
                    </p>
                    <div className="space-y-2">
                      {result.sourceComparison.map((s) => (
                        <SourceDiffRow key={s.source} item={s} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Re-run */}
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => runDiff(preset)}
                    className="flex items-center gap-1.5 h-8 px-4 rounded-full border border-white/[0.06] text-[12px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all active:scale-[0.97]"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}

// ─── Source Diff Row ─────────────────────────────────────────────────

function SourceDiffRow({ item }: { item: SourceDiff }) {
  const max = Math.max(item.shareA, item.shareB, 1);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[13px] font-medium text-zinc-300">{sourceLabel(item.source)}</span>
        <div className="flex items-center gap-1.5">
          {item.trend === 'rising' && (
            <span className="flex items-center gap-1 text-[12px] text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
              +{item.shareShift}pp
            </span>
          )}
          {item.trend === 'declining' && (
            <span className="flex items-center gap-1 text-[12px] text-amber-400">
              <TrendingDown className="w-3.5 h-3.5" />
              {item.shareShift}pp
            </span>
          )}
          {item.trend === 'steady' && (
            <span className="flex items-center gap-1 text-[12px] text-zinc-600">
              <Minus className="w-3.5 h-3.5" />
              steady
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        {/* Period A bar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-600 w-10 text-right shrink-0">Before</span>
          <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
            <div
              className="h-full rounded-full bg-zinc-600 transition-all duration-500"
              style={{ width: `${(item.shareA / max) * 100}%` }}
            />
          </div>
          <span className="text-[11px] text-zinc-500 w-10 text-right shrink-0 tabular-nums">
            {item.shareA}%
          </span>
        </div>
        {/* Period B bar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-600 w-10 text-right shrink-0">After</span>
          <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                item.trend === 'rising' ? 'bg-teal-500' : item.trend === 'declining' ? 'bg-amber-500' : 'bg-zinc-500',
              )}
              style={{ width: `${(item.shareB / max) * 100}%` }}
            />
          </div>
          <span className="text-[11px] text-zinc-400 w-10 text-right shrink-0 tabular-nums">
            {item.shareB}%
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-2.5">
        <span className="text-[11px] text-zinc-600">
          {item.countA.toLocaleString()} → {item.countB.toLocaleString()} memories
        </span>
      </div>
    </div>
  );
}
