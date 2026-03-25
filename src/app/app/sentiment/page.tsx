"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Calendar,
  FileText,
  Globe,
  Heart,
  Loader2,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { PageTransition, Stagger } from "@/components/PageTransition";

interface DailyMood {
  date: string;
  avgScore: number;
  count: number;
  dominantMood: "positive" | "negative" | "neutral" | "mixed";
}

interface MonthlyTrend {
  month: string;
  avgScore: number;
  count: number;
  label: "positive" | "negative" | "neutral" | "mixed";
}

interface MemoryHighlight {
  id: string;
  title: string;
  content: string;
  score: number;
  sourceType: string;
  createdAt: string | null;
}

interface SummaryData {
  analyzed: number;
  total: number;
  overallMood: "positive" | "negative" | "neutral" | "mixed" | "unknown";
  overallScore: number;
  distribution: Record<string, number>;
  happiest: MemoryHighlight[];
  saddest: MemoryHighlight[];
  moodBySource: Record<string, { count: number; avgScore: number; label: "positive" | "negative" | "neutral" | "mixed" }>;
  trends: MonthlyTrend[];
}

const sourceLabels: Record<string, { icon: typeof FileText; label: string; color: string }> = {
  chatgpt: { icon: MessageCircle, label: "ChatGPT", color: "text-green-400" },
  text: { icon: Type, label: "Text", color: "text-teal-400" },
  file: { icon: FileText, label: "File", color: "text-blue-400" },
  url: { icon: Globe, label: "URL", color: "text-orange-400" },
  reddit: { icon: MessageSquare, label: "Reddit", color: "text-orange-400" },
};

function scoreColor(score: number) {
  if (score >= 0.3) return "text-emerald-400";
  if (score >= 0.1) return "text-teal-400";
  if (score <= -0.3) return "text-rose-400";
  if (score <= -0.1) return "text-amber-400";
  return "text-zinc-400";
}

function heatColor(score: number, count: number) {
  if (!count) return "bg-white/[0.02]";
  if (score >= 0.4) return "bg-emerald-500/55";
  if (score >= 0.15) return "bg-teal-500/35";
  if (score <= -0.4) return "bg-rose-500/45";
  if (score <= -0.15) return "bg-amber-500/35";
  return "bg-zinc-500/20";
}

function monthLabel(month: string) {
  return new Date(`${month}-01`).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export default function SentimentPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [daily, setDaily] = useState<DailyMood[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [resultsRes, summaryRes] = await Promise.all([
        fetch("/api/v1/plugins/sentiment-timeline?action=results"),
        fetch("/api/v1/plugins/sentiment-timeline?action=summary"),
      ]);

      if (!resultsRes.ok || !summaryRes.ok) {
        throw new Error("Failed to load");
      }

      const results = await resultsRes.json() as { daily?: DailyMood[] };
      const summaryData = await summaryRes.json() as SummaryData;
      setDaily(results.daily || []);
      setSummary(summaryData);
    } catch {
      setError("Failed to load sentiment data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/v1/plugins/sentiment-timeline?action=analyze");
      if (!res.ok) {
        throw new Error("Analysis failed");
      }
      const data = await res.json() as { analyzed: number; aiPowered?: boolean; message?: string };
      if (data.analyzed > 0) {
        toast.success(`Analyzed ${data.analyzed} memories`, {
          description: data.aiPowered ? "AI-powered run completed" : "Lexicon fallback run completed",
        });
        await fetchData();
      } else {
        toast.info(data.message || "No new memories to analyze");
      }
    } catch {
      toast.error("Sentiment analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }, [fetchData]);

  const calendarWeeks = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 83);
    start.setHours(0, 0, 0, 0);
    const byDay = Object.fromEntries(daily.map((entry) => [entry.date, entry]));
    const weeks: DailyMood[][] = [];
    let current: DailyMood[] = [];

    for (let index = 0; index < 84; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = date.toISOString().slice(0, 10);
      current.push(byDay[key] || {
        date: key,
        avgScore: 0,
        count: 0,
        dominantMood: "neutral",
      });
      if (current.length === 7) {
        weeks.push(current);
        current = [];
      }
    }

    return weeks;
  }, [daily]);

  if (loading && !summary) {
    return (
      <PageTransition className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
          <p className="text-[13px] text-zinc-500">Loading sentiment data...</p>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="space-y-6">
      <Stagger>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.03em] md:text-[28px]">Sentiment Timeline</h1>
            <p className="mt-0.5 text-[13px] text-zinc-500">The emotional arc of your knowledge</p>
          </div>
          <div className="flex items-center gap-2">
            {summary && summary.analyzed < summary.total && (
              <button
                onClick={() => void runAnalysis()}
                disabled={analyzing}
                className="flex h-8 items-center gap-1.5 rounded-xl border border-teal-500/20 bg-teal-500/10 px-3 text-[12px] font-medium text-teal-400 transition-all hover:bg-teal-500/15 disabled:opacity-50"
              >
                {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                <span>{analyzing ? "Analyzing..." : "Analyze"}</span>
              </button>
            )}
            <button
              onClick={() => void fetchData()}
              disabled={loading}
              className="flex h-8 items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 text-[12px] font-medium text-zinc-400 transition-all hover:bg-white/[0.05] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </Stagger>

      {error && (
        <Stagger>
          <div className="rounded-2xl border border-rose-500/15 bg-rose-500/5 p-4 text-[13px] text-rose-300">{error}</div>
        </Stagger>
      )}

      {summary && summary.analyzed === 0 && !loading && (
        <Stagger>
          <div className="rounded-2xl border border-dashed border-white/[0.08] py-16 text-center">
            <Heart className="mx-auto mb-4 h-8 w-8 text-teal-400" />
            <h3 className="text-[16px] font-medium">No sentiment data yet</h3>
            <p className="mx-auto mt-2 max-w-md text-[13px] text-zinc-500">
              Run analysis to score your existing memories. MindStore uses AI when configured and a local fallback otherwise.
            </p>
          </div>
        </Stagger>
      )}

      {summary && summary.analyzed > 0 && (
        <>
          <Stagger>
            <div className="grid gap-3 md:grid-cols-4">
              <MetricCard
                title="Overall"
                value={summary.overallMood}
                subtitle={`${summary.analyzed} analyzed`}
                accent={scoreColor(summary.overallScore)}
                icon={Heart}
              />
              <MetricCard
                title="Score"
                value={`${summary.overallScore >= 0 ? "+" : ""}${summary.overallScore.toFixed(2)}`}
                subtitle="Average sentiment"
                accent={scoreColor(summary.overallScore)}
                icon={BarChart3}
              />
              <MetricCard
                title="Positive"
                value={`${Math.round(((summary.distribution.positive || 0) / summary.analyzed) * 100)}%`}
                subtitle={`${summary.distribution.positive || 0} memories`}
                accent="text-emerald-400"
                icon={TrendingUp}
              />
              <MetricCard
                title="Negative"
                value={`${Math.round(((summary.distribution.negative || 0) / summary.analyzed) * 100)}%`}
                subtitle={`${summary.distribution.negative || 0} memories`}
                accent="text-rose-400"
                icon={TrendingDown}
              />
            </div>
          </Stagger>

          <Stagger>
            <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 md:p-5">
              <div className="mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-teal-400" />
                <span className="text-[13px] font-medium text-zinc-300">Recent Mood Calendar</span>
              </div>
              <div className="grid grid-cols-12 gap-1">
                {calendarWeeks.map((week, weekIndex) => (
                  <div key={`week-${weekIndex}`} className="grid gap-1">
                    {week.map((day) => (
                      <div
                        key={day.date}
                        title={`${day.date} · ${day.count} memories · ${day.avgScore >= 0 ? "+" : ""}${day.avgScore.toFixed(2)}`}
                        className={`h-3 w-3 rounded-[3px] ${heatColor(day.avgScore, day.count)}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </section>
          </Stagger>

          <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
            <Stagger>
              <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 md:p-5">
                <div className="mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-teal-400" />
                  <span className="text-[13px] font-medium text-zinc-300">Monthly Trend</span>
                </div>
                <div className="space-y-3">
                  {summary.trends.map((trend) => (
                    <div key={trend.month} className="space-y-1">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-zinc-400">{monthLabel(trend.month)}</span>
                        <span className={`font-medium ${scoreColor(trend.avgScore)}`}>
                          {trend.avgScore >= 0 ? "+" : ""}{trend.avgScore.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/[0.04]">
                        <div
                          className={`h-full rounded-full ${
                            trend.avgScore >= 0.1 ? "bg-emerald-500/70" :
                            trend.avgScore <= -0.1 ? "bg-rose-500/70" :
                            "bg-zinc-500/50"
                          }`}
                          style={{ width: `${Math.max(8, Math.round(((trend.avgScore + 1) / 2) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </Stagger>

            <Stagger>
              <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 md:p-5">
                <div className="mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-teal-400" />
                  <span className="text-[13px] font-medium text-zinc-300">Mood by Source</span>
                </div>
                <div className="space-y-3">
                  {Object.entries(summary.moodBySource)
                    .sort((left, right) => right[1].count - left[1].count)
                    .map(([source, data]) => {
                      const cfg = sourceLabels[source] || { icon: FileText, label: source, color: "text-zinc-400" };
                      const Icon = cfg.icon;
                      return (
                        <div key={source} className="flex items-center gap-3">
                          <div className="flex w-[120px] items-center gap-2">
                            <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                            <span className="truncate text-[11px] text-zinc-400">{cfg.label}</span>
                          </div>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                            <div
                              className={`h-full rounded-full ${
                                data.avgScore >= 0.1 ? "bg-emerald-500/70" :
                                data.avgScore <= -0.1 ? "bg-rose-500/70" :
                                "bg-zinc-500/50"
                              }`}
                              style={{ width: `${Math.max(8, Math.round(((data.avgScore + 1) / 2) * 100))}%` }}
                            />
                          </div>
                          <span className={`w-[44px] text-right text-[11px] font-medium tabular-nums ${scoreColor(data.avgScore)}`}>
                            {data.avgScore >= 0 ? "+" : ""}{data.avgScore.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </section>
            </Stagger>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Stagger><HighlightList title="Most Positive" memories={summary.happiest} /></Stagger>
            <Stagger><HighlightList title="Most Negative" memories={summary.saddest} /></Stagger>
          </div>
        </>
      )}
    </PageTransition>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  accent,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  accent: string;
  icon: typeof Heart;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04]">
          <Icon className="h-3.5 w-3.5 text-zinc-400" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">{title}</span>
      </div>
      <div className={`text-[24px] font-bold tracking-[-0.03em] ${accent}`}>{value}</div>
      <p className="mt-1 text-[11px] text-zinc-600">{subtitle}</p>
    </div>
  );
}

function HighlightList({ title, memories }: { title: string; memories: MemoryHighlight[] }) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 md:p-5">
      <h2 className="mb-4 text-[13px] font-medium text-zinc-300">{title}</h2>
      <div className="space-y-3">
        {memories.map((memory) => (
          <div key={memory.id} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-[12px] font-medium text-zinc-300">{memory.title}</span>
              <span className={`text-[11px] font-semibold tabular-nums ${scoreColor(memory.score)}`}>
                {memory.score >= 0 ? "+" : ""}{memory.score.toFixed(2)}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-zinc-500">{memory.content}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
