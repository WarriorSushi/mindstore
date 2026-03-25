"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Clock,
  Loader2,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { PageTransition, Stagger } from "@/components/PageTransition";

interface PeriodTopic {
  topicId: string;
  count: number;
}

interface TimelinePeriod {
  label: string;
  shortLabel: string;
  totalCount: number;
  topics: PeriodTopic[];
}

interface Topic {
  id: string;
  label: string;
  keywords: string[];
  memoryCount: number;
  coherence: number;
  color: string;
  peakPeriod?: string;
  firstSeen?: string;
  lastSeen?: string;
}

interface Shift {
  topicId: string;
  topicLabel: string;
  type: "rising" | "declining" | "new" | "dormant" | "resurgent" | "steady";
  description: string;
  periodLabel: string;
}

interface EvolutionResponse {
  timeline: TimelinePeriod[];
  topics: Topic[];
  shifts: Shift[];
  stats: {
    totalMemories: number;
    topicCount: number;
    periodCount: number;
    granularity: "week" | "month" | "quarter";
    dateRange: { start: string; end: string } | null;
    mostActiveMonth: string;
    insufficientData: boolean;
  };
}

const shiftText = {
  new: "text-teal-400",
  rising: "text-emerald-400",
  resurgent: "text-sky-400",
  steady: "text-zinc-400",
  declining: "text-amber-400",
  dormant: "text-zinc-500",
} as const;

export default function TopicEvolutionPage() {
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<"week" | "month" | "quarter">("month");
  const [timeline, setTimeline] = useState<TimelinePeriod[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [stats, setStats] = useState<EvolutionResponse["stats"] | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/v1/plugins/topic-evolution?granularity=${granularity}`);
    const data = await res.json() as EvolutionResponse;
    setTimeline(data.timeline || []);
    setTopics(data.topics || []);
    setShifts(data.shifts || []);
    setStats(data.stats || null);
    setLoading(false);
  }, [granularity]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchData]);

  const maxTopicCount = useMemo(() => Math.max(...topics.map((topic) => topic.memoryCount), 1), [topics]);

  useEffect(() => {
    if (!canvasRef.current || !timeline.length || !topics.length) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const width = rect.width;
    const height = rect.height;
    const padLeft = 40;
    const padRight = 12;
    const padTop = 20;
    const padBottom = 26;
    const chartWidth = width - padLeft - padRight;
    const chartHeight = height - padTop - padBottom;
    const maxValue = Math.max(...timeline.map((period) => period.totalCount), 1);
    const step = chartWidth / Math.max(1, timeline.length - 1);

    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let index = 0; index <= 4; index += 1) {
      const y = padTop + (index / 4) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();
    }

    for (const topic of topics.slice(0, 6).reverse()) {
      const points = timeline.map((period, index) => {
        const count = period.topics.find((entry) => entry.topicId === topic.id)?.count || 0;
        return [
          padLeft + step * index,
          padTop + chartHeight - ((count / maxValue) * chartHeight),
        ] as const;
      });

      if (points.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const current = points[index];
        const controlX = (previous[0] + current[0]) / 2;
        ctx.bezierCurveTo(controlX, previous[1], controlX, current[1], current[0], current[1]);
      }
      ctx.strokeStyle = topic.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [timeline, topics]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/10">
            <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
          </div>
          <p className="text-[13px] text-zinc-400">Mapping your topic evolution...</p>
        </div>
      </div>
    );
  }

  if (stats?.insufficientData) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-3xl px-4 py-8">
          <Stagger>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
              <TrendingUp className="mx-auto h-8 w-8 text-teal-400" />
              <h1 className="mt-4 text-[22px] font-semibold tracking-[-0.03em] text-zinc-100 md:text-[28px]">Topic Evolution</h1>
              <p className="mt-2 text-[13px] text-zinc-500">Import at least 5 memories to see how your interests changed over time.</p>
            </div>
          </Stagger>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="space-y-6">
      <Stagger>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-zinc-100 md:text-[28px]">Topic Evolution</h1>
            <p className="mt-1 text-[13px] text-zinc-500">Track when topics appeared, peaked, and faded from attention</p>
          </div>
          <button
            onClick={() => void fetchData()}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 text-[12px] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-300"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </Stagger>

      <Stagger>
        <div className="flex flex-wrap gap-2">
          {(["week", "month", "quarter"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setGranularity(value)}
              className={`h-8 rounded-full border px-3 text-xs ${
                granularity === value ? "border-teal-500/20 bg-teal-500/15 text-teal-400" : "border-white/[0.06] bg-white/[0.04] text-zinc-500"
              }`}
            >
              {value}
            </button>
          ))}
          {stats && (
            <>
              <div className="flex h-8 items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.04] px-3 text-xs text-zinc-400">
                <Calendar className="h-3.5 w-3.5 text-sky-400" />
                {stats.periodCount} periods
              </div>
              <div className="flex h-8 items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.04] px-3 text-xs text-zinc-400">
                <Clock className="h-3.5 w-3.5 text-amber-400" />
                Peak: {stats.mostActiveMonth}
              </div>
            </>
          )}
        </div>
      </Stagger>

      <Stagger>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-teal-400" />
            <span className="text-[13px] font-medium text-zinc-200">Knowledge Stream</span>
          </div>
          <div className="h-[240px]">
            <canvas ref={canvasRef} className="h-full w-full" />
          </div>
        </div>
      </Stagger>

      <Stagger>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="mb-4 text-[13px] font-medium text-zinc-200">Topics</div>
            <div className="space-y-3">
              {topics.map((topic) => (
                <div key={topic.id} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-zinc-200">{topic.label}</div>
                      <div className="mt-1 text-[11px] text-zinc-600">
                        {topic.memoryCount} memories · {Math.round(topic.coherence * 100)}% coherence
                      </div>
                    </div>
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: topic.color }} />
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                    <div className="h-full rounded-full" style={{ width: `${(topic.memoryCount / maxTopicCount) * 100}%`, backgroundColor: topic.color }} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {topic.keywords.slice(0, 4).map((keyword) => (
                      <span key={keyword} className="rounded-md bg-white/[0.04] px-2 py-1 text-[10px] text-zinc-500">
                        {keyword}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 text-[11px] text-zinc-600">
                    Peak: {topic.peakPeriod || "n/a"} · Range: {topic.firstSeen || "n/a"} → {topic.lastSeen || "n/a"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="mb-4 text-[13px] font-medium text-zinc-200">Interest Shifts</div>
            <div className="space-y-3">
              {shifts.map((shift) => (
                <div key={`${shift.topicId}-${shift.type}`} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
                  <div className={`text-[11px] font-medium uppercase tracking-wide ${shiftText[shift.type]}`}>{shift.type}</div>
                  <div className="mt-1 text-[13px] font-medium text-zinc-200">{shift.topicLabel}</div>
                  <div className="mt-1 text-[11px] leading-relaxed text-zinc-500">{shift.description}</div>
                  {shift.periodLabel ? <div className="mt-2 text-[10px] text-zinc-600">{shift.periodLabel}</div> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Stagger>
    </PageTransition>
  );
}
