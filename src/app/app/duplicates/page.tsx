'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Copy, Trash2, Loader2, AlertTriangle, Check, X,
  ChevronRight, ArrowRight, Merge, ScanSearch, Shield,
  Clock, FileText, Globe, MessageCircle, Type,
  SlidersHorizontal,
} from 'lucide-react';
import { getSourceType } from '@/lib/source-types';
import { toast } from 'sonner';
import { PageTransition, Stagger } from '@/components/PageTransition';
import { usePageTitle } from "@/lib/use-page-title";

interface MemoryInfo {
  id: string;
  content: string;
  sourceType: string;
  sourceTitle: string;
  sourceId: string;
  createdAt: string;
  metadata: Record<string, any>;
  contentLength: number;
}

interface DuplicatePair {
  similarity: number;
  memoryA: MemoryInfo;
  memoryB: MemoryInfo;
}

type MergeAction = 'keep_a' | 'keep_b' | 'merge' | 'delete_both';

export default function DuplicatesPage() {
  usePageTitle("Duplicates");
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(92);
  const [processing, setProcessing] = useState<string | null>(null);
  const [expandedPair, setExpandedPair] = useState<number | null>(null);
  const [resolvedCount, setResolvedCount] = useState(0);

  const fetchDuplicates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/duplicates?threshold=${threshold / 100}&limit=30`);
      if (res.ok) {
        const data = await res.json();
        setDuplicates(data.duplicates || []);
      }
    } catch {
      toast.error('Failed to scan for duplicates');
    }
    setLoading(false);
  }, [threshold]);

  useEffect(() => { fetchDuplicates(); }, [fetchDuplicates]);

  const handleAction = async (pair: DuplicatePair, action: MergeAction, mergedContent?: string) => {
    const pairKey = `${pair.memoryA.id}-${pair.memoryB.id}`;
    setProcessing(pairKey);
    try {
      const body: any = {
        action,
        idA: pair.memoryA.id,
        idB: pair.memoryB.id,
      };
      if (action === 'merge' && mergedContent) {
        body.mergedContent = mergedContent;
      }

      const res = await fetch('/api/v1/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setDuplicates(prev => prev.filter(d =>
          d.memoryA.id !== pair.memoryA.id || d.memoryB.id !== pair.memoryB.id
        ));
        setResolvedCount(c => c + 1);
        setExpandedPair(null);
        const labels: Record<MergeAction, string> = {
          keep_a: 'Kept first, deleted duplicate',
          keep_b: 'Kept second, deleted duplicate',
          merge: 'Merged into one memory',
          delete_both: 'Deleted both memories',
        };
        toast.success(labels[action]);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Action failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    }
    setProcessing(null);
  };

  /** Highlight differences between two texts */
  function truncateContent(content: string, maxLen: number = 200): string {
    if (content.length <= maxLen) return content;
    return content.slice(0, maxLen) + '…';
  }

  function formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  function wordCount(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  return (
    <PageTransition>
      {/* Header */}
      <Stagger>
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Copy className="w-4.5 h-4.5 text-amber-400" />
              </div>
              <div>
                <h1 className="text-[20px] font-semibold tracking-[-0.02em]">Duplicate Detector</h1>
                <p className="text-[12px] text-zinc-500">Find and resolve near-duplicate memories</p>
              </div>
            </div>
          </div>

          {/* Threshold control */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-[11px] text-zinc-500 font-medium">Similarity</span>
              <input
                type="range"
                min={75}
                max={99}
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value))}
                onMouseUp={fetchDuplicates}
                onTouchEnd={fetchDuplicates}
                className="w-20 h-1 accent-teal-500 bg-white/[0.06] rounded-full appearance-none cursor-pointer"
              />
              <span className="text-[12px] font-semibold text-teal-400 tabular-nums w-8 text-right">{threshold}%</span>
            </div>
            <button
              onClick={fetchDuplicates}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] text-[12px] font-medium text-zinc-300 transition-all active:scale-[0.97] disabled:opacity-50"
            >
              <ScanSearch className={`w-3.5 h-3.5 ${loading ? 'animate-pulse text-teal-400' : 'text-zinc-500'}`} />
              Rescan
            </button>
          </div>
        </div>
      </Stagger>

      {/* Mobile threshold */}
      <Stagger>
        <div className="sm:hidden flex items-center gap-2 mb-4 px-1">
          <SlidersHorizontal className="w-3 h-3 text-zinc-600" />
          <span className="text-[11px] text-zinc-500">Threshold</span>
          <input
            type="range"
            min={75}
            max={99}
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value))}
            onMouseUp={fetchDuplicates}
            onTouchEnd={fetchDuplicates}
            className="flex-1 h-1 accent-teal-500 bg-white/[0.06] rounded-full appearance-none cursor-pointer"
          />
          <span className="text-[12px] font-semibold text-teal-400 tabular-nums">{threshold}%</span>
          <button
            onClick={fetchDuplicates}
            disabled={loading}
            className="ml-1 p-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] transition-all active:scale-[0.95] disabled:opacity-50"
          >
            <ScanSearch className={`w-3.5 h-3.5 ${loading ? 'animate-pulse text-teal-400' : 'text-zinc-500'}`} />
          </button>
        </div>
      </Stagger>

      {/* Stats strip */}
      {(duplicates.length > 0 || resolvedCount > 0) && !loading && (
        <Stagger>
          <div className="flex items-center gap-3 mb-4 px-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-[11px] text-zinc-500">
                <span className="font-semibold text-zinc-300 tabular-nums">{duplicates.length}</span> pair{duplicates.length !== 1 ? 's' : ''} found
              </span>
            </div>
            {resolvedCount > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[11px] text-zinc-500">
                  <span className="font-semibold text-emerald-400 tabular-nums">{resolvedCount}</span> resolved
                </span>
              </div>
            )}
          </div>
        </Stagger>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 flex items-center justify-center">
              <ScanSearch className="w-5 h-5 text-teal-400 animate-pulse" />
            </div>
          </div>
          <p className="text-[13px] text-zinc-500">Scanning for duplicates…</p>
          <p className="text-[11px] text-zinc-600">Comparing embeddings above {threshold}% similarity</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && duplicates.length === 0 && (
        <Stagger>
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-emerald-400" />
            </div>
            <h2 className="text-[15px] font-semibold text-zinc-300">No duplicates found</h2>
            <p className="text-[13px] text-zinc-500 text-center max-w-sm">
              {resolvedCount > 0 
                ? `All duplicates resolved! You cleaned up ${resolvedCount} pair${resolvedCount !== 1 ? 's' : ''}.`
                : `Your knowledge base is clean at ${threshold}% similarity threshold. Try lowering it to find looser matches.`
              }
            </p>
            {threshold > 80 && resolvedCount === 0 && (
              <button
                onClick={() => { setThreshold(80); }}
                className="mt-2 text-[12px] text-teal-400 font-medium hover:text-teal-300 transition-colors"
              >
                Try 80% threshold →
              </button>
            )}
          </div>
        </Stagger>
      )}

      {/* Duplicate pairs */}
      {!loading && duplicates.length > 0 && (
        <div className="space-y-3">
          {duplicates.map((pair, idx) => {
            const isExpanded = expandedPair === idx;
            const pairKey = `${pair.memoryA.id}-${pair.memoryB.id}`;
            const isProcessing = processing === pairKey;
            const stA = getSourceType(pair.memoryA.sourceType);
            const stB = getSourceType(pair.memoryB.sourceType);
            const IconA = stA.icon;
            const IconB = stB.icon;

            // Determine which is likely the "better" version (longer, more recent)
            const aScore = pair.memoryA.contentLength + (new Date(pair.memoryA.createdAt).getTime() > new Date(pair.memoryB.createdAt).getTime() ? 10 : 0);
            const bScore = pair.memoryB.contentLength + (new Date(pair.memoryB.createdAt).getTime() > new Date(pair.memoryA.createdAt).getTime() ? 10 : 0);
            const suggestedKeep = aScore >= bScore ? 'a' : 'b';

            return (
              <Stagger key={pairKey}>
                <div className={`rounded-2xl border transition-all ${
                  isExpanded 
                    ? 'border-amber-500/20 bg-amber-500/[0.03]' 
                    : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.03]'
                }`}>
                  {/* Collapsed header */}
                  <button
                    onClick={() => setExpandedPair(isExpanded ? null : idx)}
                    className="w-full text-left px-4 py-3.5 flex items-center gap-3"
                    disabled={isProcessing}
                  >
                    {/* Similarity badge */}
                    <div className={`shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center ${
                      pair.similarity >= 98 ? 'bg-red-500/10 text-red-400' :
                      pair.similarity >= 95 ? 'bg-amber-500/10 text-amber-400' :
                      'bg-sky-500/10 text-sky-400'
                    }`}>
                      <span className="text-[16px] font-bold tabular-nums leading-none">{pair.similarity}</span>
                      <span className="text-[9px] font-semibold opacity-60">%</span>
                    </div>

                    {/* Preview */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-[1px] rounded-md font-semibold uppercase tracking-wide ${stA.badgeClasses}`}>
                          <IconA className="w-2.5 h-2.5" />
                          {pair.memoryA.sourceType}
                        </span>
                        <span className="text-[10px] text-zinc-600">↔</span>
                        <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-[1px] rounded-md font-semibold uppercase tracking-wide ${stB.badgeClasses}`}>
                          <IconB className="w-2.5 h-2.5" />
                          {pair.memoryB.sourceType}
                        </span>
                        <span className="text-[10px] text-zinc-600 ml-auto hidden sm:block">
                          {wordCount(pair.memoryA.content)} vs {wordCount(pair.memoryB.content)} words
                        </span>
                      </div>
                      <p className="text-[12px] text-zinc-400 line-clamp-1 leading-relaxed">
                        {truncateContent(pair.memoryA.content, 120)}
                      </p>
                    </div>

                    {/* Expand indicator */}
                    <ChevronRight className={`w-4 h-4 text-zinc-600 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>

                  {/* Expanded comparison */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0">
                      <div className="border-t border-white/[0.04] pt-4">
                        {/* Side-by-side on desktop, stacked on mobile */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                          {/* Memory A */}
                          <div className={`rounded-xl border p-3.5 transition-all ${
                            suggestedKeep === 'a' 
                              ? 'border-emerald-500/20 bg-emerald-500/[0.04]' 
                              : 'border-white/[0.06] bg-white/[0.02]'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${stA.bgColor}`}>
                                  <IconA className={`w-3 h-3 ${stA.textColor}`} />
                                </div>
                                <span className="text-[11px] font-medium text-zinc-300 truncate max-w-[140px]">
                                  {pair.memoryA.sourceTitle}
                                </span>
                              </div>
                              {suggestedKeep === 'a' && (
                                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                  Suggested
                                </span>
                              )}
                            </div>
                            <p className="text-[12px] text-zinc-400 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto mb-2">
                              {pair.memoryA.content}
                            </p>
                            <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                              <span className="flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {formatDate(pair.memoryA.createdAt)}
                              </span>
                              <span>{wordCount(pair.memoryA.content)} words</span>
                            </div>
                          </div>

                          {/* Memory B */}
                          <div className={`rounded-xl border p-3.5 transition-all ${
                            suggestedKeep === 'b' 
                              ? 'border-emerald-500/20 bg-emerald-500/[0.04]' 
                              : 'border-white/[0.06] bg-white/[0.02]'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${stB.bgColor}`}>
                                  <IconB className={`w-3 h-3 ${stB.textColor}`} />
                                </div>
                                <span className="text-[11px] font-medium text-zinc-300 truncate max-w-[140px]">
                                  {pair.memoryB.sourceTitle}
                                </span>
                              </div>
                              {suggestedKeep === 'b' && (
                                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                  Suggested
                                </span>
                              )}
                            </div>
                            <p className="text-[12px] text-zinc-400 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto mb-2">
                              {pair.memoryB.content}
                            </p>
                            <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                              <span className="flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {formatDate(pair.memoryB.createdAt)}
                              </span>
                              <span>{wordCount(pair.memoryB.content)} words</span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => handleAction(pair, 'keep_a')}
                            disabled={isProcessing}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 hover:bg-emerald-500/20 transition-all active:scale-[0.97] disabled:opacity-50"
                          >
                            {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            Keep First
                          </button>
                          <button
                            onClick={() => handleAction(pair, 'keep_b')}
                            disabled={isProcessing}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium bg-sky-500/10 text-sky-400 border border-sky-500/15 hover:bg-sky-500/20 transition-all active:scale-[0.97] disabled:opacity-50"
                          >
                            {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            Keep Second
                          </button>
                          <button
                            onClick={() => {
                              // Merge: combine both contents
                              const merged = `${pair.memoryA.content}\n\n---\n\n${pair.memoryB.content}`;
                              handleAction(pair, 'merge', merged);
                            }}
                            disabled={isProcessing}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium bg-teal-500/10 text-teal-400 border border-teal-500/15 hover:bg-teal-500/20 transition-all active:scale-[0.97] disabled:opacity-50"
                          >
                            {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Merge className="w-3 h-3" />}
                            Merge Both
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Delete both memories? This cannot be undone.')) {
                                handleAction(pair, 'delete_both');
                              }
                            }}
                            disabled={isProcessing}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium bg-red-500/10 text-red-400 border border-red-500/15 hover:bg-red-500/20 transition-all active:scale-[0.97] disabled:opacity-50 ml-auto"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span className="hidden sm:inline">Delete Both</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Stagger>
            );
          })}
        </div>
      )}
    </PageTransition>
  );
}
