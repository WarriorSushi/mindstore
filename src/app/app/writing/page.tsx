"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CaseSensitive,
  Loader2,
  PenLine,
  Quote,
  RefreshCw,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageTransition, Stagger } from "@/components/PageTransition";

interface Profile {
  avgGradeLevel: number;
  readabilityLevel: string;
  avgReadingEase: number;
  easeLabel: string;
  totalWords: number;
  uniqueWordCount: number;
  avgSentenceLength: number;
  avgWordLength: number;
  avgVocabRichness: number;
  avgQuestionRate: number;
  avgExclamationRate: number;
  avgHedgingRate: number;
  avgConfidenceRate: number;
  complexityScore: number;
  dominantTone: string;
  toneDistribution: Record<string, number>;
  topWords: Array<{ word: string; count: number; pct: number }>;
  topBigrams: Array<{ phrase: string; count: number }>;
  topTrigrams: Array<{ phrase: string; count: number }>;
  styleBySource: Array<{
    source: string;
    count: number;
    avgGrade: number;
    avgEase: number;
    avgSentenceLength: number;
    dominantTone: string;
  }>;
  evolution: Array<{
    month: string;
    avgGrade: number;
    avgEase: number;
    avgSentenceLength: number;
    confidenceRate: number;
  }>;
}

interface ProfileResponse {
  analyzed: number;
  totalEligible: number;
  profile: Profile | null;
}

type MetricKey = "grade" | "ease" | "sentLen" | "confidence";

const toneConfig: Record<string, { label: string; text: string; fill: string }> = {
  formal: { label: "Formal", text: "text-sky-400", fill: "bg-sky-500/40" },
  casual: { label: "Casual", text: "text-amber-400", fill: "bg-amber-500/40" },
  technical: { label: "Technical", text: "text-teal-400", fill: "bg-teal-500/40" },
  conversational: { label: "Conversational", text: "text-emerald-400", fill: "bg-emerald-500/40" },
  neutral: { label: "Neutral", text: "text-zinc-400", fill: "bg-zinc-500/40" },
};

export default function WritingStylePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [analyzed, setAnalyzed] = useState(0);
  const [totalEligible, setTotalEligible] = useState(0);
  const [metric, setMetric] = useState<MetricKey>("grade");
  const chartRef = useRef<HTMLCanvasElement>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/v1/plugins/writing-style?action=profile");
      if (!res.ok) throw new Error("Failed to load writing style data");
      const data = await res.json() as ProfileResponse;
      setProfile(data.profile);
      setAnalyzed(data.analyzed);
      setTotalEligible(data.totalEligible);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile?.evolution?.length && chartRef.current) {
      drawEvolutionChart(chartRef.current, profile.evolution, metric);
    }
  }, [metric, profile]);

  const toneEntries = useMemo(
    () => profile ? Object.entries(profile.toneDistribution).sort((left, right) => right[1] - left[1]) : [],
    [profile],
  );

  async function runAnalysis() {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/v1/plugins/writing-style?action=analyze");
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json() as { analyzed?: number; message?: string };
      toast.success(`Analyzed ${data.analyzed || 0} memories`, { description: data.message || "Done." });
      await fetchProfile();
    } catch (error: unknown) {
      toast.error("Analysis failed", { description: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/10">
            <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
          </div>
          <p className="text-[13px] text-zinc-400">Analyzing your writing style...</p>
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
          <button onClick={() => { setLoading(true); void fetchProfile(); }} className="text-[12px] text-teal-400 hover:text-teal-300">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <PageTransition>
        <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4 py-8">
          <div className="max-w-sm space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-teal-500/20 bg-teal-500/10">
              <PenLine className="h-7 w-7 text-teal-400" />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-zinc-100 md:text-[28px]">Writing Style</h1>
              <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
                {totalEligible > 0
                  ? `Analyze vocabulary richness, readability, tone, and recurring phrases across ${totalEligible} memories.`
                  : "Import or write a few memories first, then run the analyzer to build your writing fingerprint."}
              </p>
            </div>
            {totalEligible > 0 ? (
              <button
                onClick={() => void runAnalysis()}
                disabled={analyzing}
                className="mx-auto flex h-10 items-center gap-2 rounded-xl bg-teal-600 px-5 text-[13px] font-medium text-white hover:bg-teal-500 disabled:opacity-50"
              >
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Analyze {totalEligible} memories
              </button>
            ) : (
              <button
                onClick={() => router.push("/app/import")}
                className="mx-auto flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 text-[13px] font-medium text-zinc-200 hover:bg-white/[0.06]"
              >
                <BookOpen className="h-4 w-4 text-teal-400" />
                Import memories first
              </button>
            )}
          </div>
        </div>
      </PageTransition>
    );
  }

  const maxWordCount = profile.topWords[0]?.count || 1;
  const maxBigramCount = profile.topBigrams[0]?.count || 1;
  const maxTrigramCount = profile.topTrigrams[0]?.count || 1;
  const confidenceDelta = profile.avgConfidenceRate - profile.avgHedgingRate;

  return (
    <PageTransition className="space-y-6">
      <Stagger>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-zinc-100 md:text-[28px]">Writing Style</h1>
            <p className="mt-1 text-[13px] text-zinc-500">
              Your writing fingerprint across {analyzed.toLocaleString()} analyzed memories
            </p>
          </div>
          <button
            onClick={() => void runAnalysis()}
            disabled={analyzing}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 text-[12px] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-300"
          >
            {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Re-analyze
          </button>
        </div>
      </Stagger>

      <Stagger>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/[0.04] to-transparent" />
            <div className="relative">
              <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-zinc-500">Complexity Score</div>
              <div className="text-[48px] font-bold leading-none tracking-tight text-zinc-100 tabular-nums">{profile.complexityScore}</div>
              <div className="mt-1 text-[13px] font-medium text-teal-400">{profile.readabilityLevel}</div>
              <div className="mt-3 text-[11px] text-zinc-500">
                Grade {profile.avgGradeLevel} · Ease {profile.avgReadingEase} ({profile.easeLabel})
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Vocabulary" value={profile.uniqueWordCount.toLocaleString()} sub="unique words" />
            <MiniStat label="Total Words" value={profile.totalWords.toLocaleString()} sub="all analyzed content" />
            <MiniStat label="Avg Sentence" value={`${profile.avgSentenceLength}`} sub="words / sentence" />
            <MiniStat label="Avg Word" value={`${profile.avgWordLength}`} sub="characters" />
          </div>
        </div>
      </Stagger>

      <Stagger>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="mb-4 flex items-center gap-2">
              <Quote className="h-4 w-4 text-teal-400" />
              <span className="text-[13px] font-medium text-zinc-200">Tone Distribution</span>
            </div>
            <div className="space-y-2.5">
              {toneEntries.map(([tone, count]) => {
                const config = toneConfig[tone] || toneConfig.neutral;
                const pct = analyzed > 0 ? (count / analyzed) * 100 : 0;
                return (
                  <div key={tone}>
                    <div className="mb-1 flex items-center justify-between text-[12px]">
                      <span className={config.text}>{config.label}</span>
                      <span className="text-zinc-500 tabular-nums">{count} · {pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                      <div className={`h-full rounded-full ${config.fill}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 border-t border-white/[0.04] pt-3 text-[11px] text-zinc-500">
              Dominant tone: <span className={toneConfig[profile.dominantTone]?.text || "text-zinc-400"}>{toneConfig[profile.dominantTone]?.label || profile.dominantTone}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-teal-400" />
              <span className="text-[13px] font-medium text-zinc-200">Writing Patterns</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Vocab richness" value={`${(profile.avgVocabRichness * 100).toFixed(1)}%`} sub="type-token ratio" />
              <MiniStat label="Questions" value={`${(profile.avgQuestionRate * 100).toFixed(1)}%`} sub="of sentences" />
              <MiniStat label="Exclamations" value={`${(profile.avgExclamationRate * 100).toFixed(1)}%`} sub="of sentences" />
              <MiniStat
                label="Confidence"
                value={confidenceDelta > 0.05 ? "Confident" : confidenceDelta < -0.05 ? "Hedging" : "Balanced"}
                sub={`${(profile.avgConfidenceRate * 100).toFixed(1)}% vs ${(profile.avgHedgingRate * 100).toFixed(1)}%`}
              />
            </div>
          </div>
        </div>
      </Stagger>

      <Stagger>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <PhraseList title="Top Words" icon={<CaseSensitive className="h-4 w-4 text-sky-400" />} items={profile.topWords.slice(0, 15).map((item) => ({ label: item.word, count: item.count }))} maxCount={maxWordCount} fillClass="bg-sky-500/40" />
          <PhraseList title="Top Phrases (2-word)" icon={<Quote className="h-4 w-4 text-teal-400" />} items={profile.topBigrams.slice(0, 12).map((item) => ({ label: item.phrase, count: item.count }))} maxCount={maxBigramCount} fillClass="bg-teal-500/40" />
          <PhraseList title="Top Phrases (3-word)" icon={<Quote className="h-4 w-4 text-emerald-400" />} items={profile.topTrigrams.slice(0, 10).map((item) => ({ label: item.phrase, count: item.count }))} maxCount={maxTrigramCount} fillClass="bg-emerald-500/40" />
        </div>
      </Stagger>

      <Stagger>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-teal-400" />
              <span className="text-[13px] font-medium text-zinc-200">Style Evolution</span>
            </div>
            <div className="flex items-center gap-1">
              {[
                { key: "grade" as const, label: "Grade" },
                { key: "ease" as const, label: "Ease" },
                { key: "sentLen" as const, label: "Sentence" },
                { key: "confidence" as const, label: "Confidence" },
              ].map((entry) => (
                <button
                  key={entry.key}
                  onClick={() => setMetric(entry.key)}
                  className={`h-6 rounded-lg border px-2.5 text-[11px] ${
                    metric === entry.key ? "border-teal-500/20 bg-teal-500/15 text-teal-400" : "border-transparent text-zinc-500 hover:bg-white/[0.04]"
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[200px]">
            <canvas ref={chartRef} className="h-full w-full" />
          </div>
        </div>
      </Stagger>

      <Stagger>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-teal-400" />
            <span className="text-[13px] font-medium text-zinc-200">Style by Source</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="py-2 pr-4 text-left font-medium text-zinc-500">Source</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500">Memories</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500">Grade</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500">Ease</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500">Avg Sent.</th>
                  <th className="py-2 pl-3 text-left font-medium text-zinc-500">Tone</th>
                </tr>
              </thead>
              <tbody>
                {profile.styleBySource.sort((left, right) => right.count - left.count).map((source) => (
                  <tr key={source.source} className="border-b border-white/[0.03]">
                    <td className="py-2.5 pr-4 text-zinc-300">{source.source}</td>
                    <td className="px-3 py-2.5 text-right text-zinc-400 tabular-nums">{source.count}</td>
                    <td className="px-3 py-2.5 text-right text-zinc-300 tabular-nums">{source.avgGrade}</td>
                    <td className="px-3 py-2.5 text-right text-zinc-300 tabular-nums">{source.avgEase}</td>
                    <td className="px-3 py-2.5 text-right text-zinc-300 tabular-nums">{source.avgSentenceLength}</td>
                    <td className="py-2.5 pl-3">
                      <span className={toneConfig[source.dominantTone]?.text || "text-zinc-400"}>
                        {toneConfig[source.dominantTone]?.label || source.dominantTone}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Stagger>
    </PageTransition>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-2 text-[20px] font-bold leading-none text-zinc-100 tabular-nums">{value}</div>
      <div className="mt-1 text-[11px] text-zinc-600">{sub}</div>
    </div>
  );
}

function PhraseList({
  title,
  icon,
  items,
  maxCount,
  fillClass,
}: {
  title: string;
  icon: React.ReactNode;
  items: Array<{ label: string; count: number }>;
  maxCount: number;
  fillClass: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <span className="text-[13px] font-medium text-zinc-200">{title}</span>
      </div>
      <div className="space-y-1.5">
        {items.map((item, index) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="w-4 text-right text-[10px] text-zinc-700 tabular-nums">{index + 1}</span>
            <span className="flex-1 truncate font-mono text-[12px] text-zinc-300">{item.label}</span>
            <div className="flex items-center gap-1.5">
              <div className="h-1 w-12 overflow-hidden rounded-full bg-white/[0.04]">
                <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${Math.min(100, (item.count / maxCount) * 100)}%` }} />
              </div>
              <span className="w-8 text-right text-[10px] text-zinc-600 tabular-nums">{item.count}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function drawEvolutionChart(canvas: HTMLCanvasElement, evolution: Profile["evolution"], metric: MetricKey) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const values = evolution.map((entry) => {
    if (metric === "grade") return entry.avgGrade;
    if (metric === "ease") return entry.avgEase;
    if (metric === "sentLen") return entry.avgSentenceLength;
    return entry.confidenceRate;
  });

  const min = Math.min(...values) * 0.85;
  const max = Math.max(...values) * 1.15;
  const range = max - min || 1;
  const padLeft = 42;
  const padRight = 12;
  const padTop = 20;
  const padBottom = 26;
  const chartWidth = rect.width - padLeft - padRight;
  const chartHeight = rect.height - padTop - padBottom;

  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const y = padTop + (index / 4) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(rect.width - padRight, y);
    ctx.stroke();
  }

  const points: Array<[number, number]> = values.map((value, index) => [
    padLeft + (index / Math.max(1, values.length - 1)) * chartWidth,
    padTop + (1 - (value - min) / range) * chartHeight,
  ]);

  if (points.length > 1) {
    ctx.beginPath();
    ctx.moveTo(points[0]?.[0] || 0, points[0]?.[1] || 0);
    for (let index = 1; index < points.length; index += 1) {
      const prev = points[index - 1];
      const curr = points[index];
      if (!prev || !curr) continue;
      const controlX = (prev[0] + curr[0]) / 2;
      ctx.bezierCurveTo(controlX, prev[1], controlX, curr[1], curr[0], curr[1]);
    }
    ctx.strokeStyle = "#14b8a6";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  for (const [x, y] of points) {
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#14b8a6";
    ctx.fill();
  }
}
