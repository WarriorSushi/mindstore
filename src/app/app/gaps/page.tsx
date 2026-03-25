"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Compass,
  Layers,
  Loader2,
  RefreshCw,
  Target,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageTransition, Stagger } from "@/components/PageTransition";

interface Topic {
  id: string;
  label: string;
  keywords: string[];
  memoryCount: number;
  coherence: number;
  density: "deep" | "moderate" | "thin" | "sparse";
  sourceTypes: Record<string, number>;
  avgAge: number;
  recentActivity: boolean;
}

interface Gap {
  id: string;
  type: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  suggestion: string;
}

interface Suggestion {
  topic: string;
  reason: string;
  relatedTo: string;
}

interface GapsResponse {
  topics: Topic[];
  gaps: Gap[];
  suggestions: Suggestion[];
  stats: {
    totalMemories: number;
    topicCount: number;
    gapCount: number;
    overallCoverage: number;
    deepTopics: number;
    moderateTopics: number;
    thinTopics: number;
    sparseTopics: number;
    staleTopics: number;
    avgCoherence: number;
    insufficientData?: boolean;
  };
}

const densityConfig = {
  deep: { label: "Deep", text: "text-emerald-400", fill: "bg-emerald-500/40" },
  moderate: { label: "Moderate", text: "text-teal-400", fill: "bg-teal-500/40" },
  thin: { label: "Thin", text: "text-amber-400", fill: "bg-amber-500/40" },
  sparse: { label: "Sparse", text: "text-rose-400", fill: "bg-rose-500/40" },
} as const;

const severityConfig = {
  high: "text-rose-400",
  medium: "text-amber-400",
  low: "text-zinc-400",
} as const;

export default function KnowledgeGapsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [stats, setStats] = useState<GapsResponse["stats"] | null>(null);

  const fetchData = useCallback(async (action: "analyze" | "suggest" = "analyze") => {
    try {
      if (action === "suggest") {
        setSuggesting(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const res = await fetch(`/api/v1/plugins/knowledge-gaps?action=${action}`);
      if (!res.ok) throw new Error("Failed to analyze knowledge gaps");
      const data = await res.json() as GapsResponse;
      setTopics(data.topics || []);
      setGaps(data.gaps || []);
      setStats(data.stats || null);
      if (action === "suggest") {
        setSuggestions(data.suggestions || []);
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
      setSuggesting(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/10">
            <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
          </div>
          <p className="text-[13px] text-zinc-400">Analyzing your knowledge gaps...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10">
            <AlertTriangle className="h-6 w-6 text-rose-400" />
          </div>
          <p className="text-[13px] text-zinc-400">{error}</p>
          <button onClick={() => void fetchData()} className="text-[12px] text-teal-400 hover:text-teal-300">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (stats?.insufficientData) {
    return (
      <PageTransition>
        <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4 py-8">
          <div className="max-w-sm space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-teal-500/20 bg-teal-500/10">
              <Target className="h-7 w-7 text-teal-400" />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-zinc-100 md:text-[28px]">Knowledge Gaps</h1>
              <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
                Import at least 5 embedded memories to map your topics and detect blind spots.
              </p>
            </div>
            <button
              onClick={() => router.push("/app/import")}
              className="mx-auto flex h-10 items-center gap-2 rounded-xl bg-teal-600 px-5 text-[13px] font-medium text-white hover:bg-teal-500"
            >
              <BookOpen className="h-4 w-4" />
              Import knowledge
            </button>
          </div>
        </div>
      </PageTransition>
    );
  }

  const maxTopicCount = Math.max(...topics.map((topic) => topic.memoryCount), 1);

  return (
    <PageTransition className="space-y-6">
      <Stagger>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-zinc-100 md:text-[28px]">Knowledge Gaps</h1>
            <p className="mt-1 text-[13px] text-zinc-500">
              Find sparse topics, stale areas, and missing bridges in your knowledge base
            </p>
          </div>
          <button
            onClick={() => void fetchData()}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 text-[12px] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-300"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Re-analyze
          </button>
        </div>
      </Stagger>

      {stats && (
        <Stagger>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <MiniStat label="Topics" value={stats.topicCount} />
            <MiniStat label="Gaps" value={stats.gapCount} />
            <MiniStat label="Coverage" value={`${stats.overallCoverage}%`} />
            <MiniStat label="Deep" value={stats.deepTopics} />
            <MiniStat label="Coherence" value={`${Math.round(stats.avgCoherence * 100)}%`} />
          </div>
        </Stagger>
      )}

      <Stagger>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="mb-4 flex items-center gap-2">
              <Layers className="h-4 w-4 text-teal-400" />
              <span className="text-[13px] font-medium text-zinc-200">Topic Coverage</span>
            </div>
            <div className="space-y-3">
              {topics.map((topic) => {
                const density = densityConfig[topic.density];
                const sourceCount = Object.keys(topic.sourceTypes).length;
                return (
                  <div key={topic.id} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-zinc-200">{topic.label}</div>
                        <div className="mt-1 text-[11px] text-zinc-600">
                          {topic.memoryCount} memories · {Math.round(topic.coherence * 100)}% coherence · {sourceCount} source{sourceCount !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <span className={`text-[11px] font-medium ${density.text}`}>{density.label}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                      <div className={`h-full rounded-full ${density.fill}`} style={{ width: `${(topic.memoryCount / maxTopicCount) * 100}%` }} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {topic.keywords.slice(0, 4).map((keyword) => (
                        <span key={keyword} className="rounded-md bg-white/[0.04] px-2 py-1 text-[10px] text-zinc-500">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Compass className="h-4 w-4 text-teal-400" />
                  <span className="text-[13px] font-medium text-zinc-200">Learning Suggestions</span>
                </div>
                <button
                  onClick={async () => {
                    await fetchData("suggest");
                    if (!suggestions.length) {
                      toast("Generated suggestions if an AI provider is configured.");
                    }
                  }}
                  disabled={suggesting}
                  className="flex items-center gap-1 text-[11px] text-teal-400 hover:text-teal-300 disabled:opacity-50"
                >
                  {suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                  Generate
                </button>
              </div>
              <div className="space-y-2">
                {suggestions.length > 0 ? suggestions.map((suggestion) => (
                  <div key={`${suggestion.topic}-${suggestion.relatedTo}`} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
                    <div className="text-[12px] font-medium text-zinc-200">{suggestion.topic}</div>
                    <div className="mt-1 text-[11px] text-zinc-500">{suggestion.reason}</div>
                    <div className="mt-1 text-[10px] text-teal-400/80">Connects to: {suggestion.relatedTo}</div>
                  </div>
                )) : (
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3 text-[11px] text-zinc-600">
                    Ask MindStore for adjacent topics to explore once an AI provider is configured.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="mb-4 flex items-center gap-2">
                <Target className="h-4 w-4 text-teal-400" />
                <span className="text-[13px] font-medium text-zinc-200">Detected Gaps</span>
              </div>
              <div className="space-y-3">
                {gaps.length > 0 ? gaps.map((gap) => (
                  <div key={gap.id} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
                    <div className={`text-[11px] font-medium uppercase tracking-wide ${severityConfig[gap.severity]}`}>{gap.severity}</div>
                    <div className="mt-1 text-[13px] font-medium text-zinc-200">{gap.title}</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-zinc-500">{gap.description}</div>
                    <div className="mt-2 text-[11px] text-teal-400/80">{gap.suggestion}</div>
                  </div>
                )) : (
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3 text-[11px] text-zinc-600">
                    No major gaps detected right now.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Stagger>
    </PageTransition>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-2 text-[20px] font-bold leading-none text-zinc-100 tabular-nums">{value}</div>
    </div>
  );
}
