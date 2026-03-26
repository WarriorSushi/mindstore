"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  BarChart3, ArrowUpRight,
} from "lucide-react";
import { PageTransition, Stagger } from "@/components/PageTransition";
import { EmptyState } from "@/components/EmptyState";
import { getSourceType } from "@/lib/source-types";
import { usePageTitle } from "@/lib/use-page-title";

interface StatsData {
  total: number;
  sources: Array<{ type: string; count: number }>;
  monthlyGrowth: Array<{ month: string; count: number; cumulative: number }>;
  words: { total: number; avg: number; min: number; max: number; avgChars: number };
  embeddings: { total: number; covered: number; percentage: number };
  dateRange: { earliest: string | null; latest: string | null };
  topSources: Array<{ type: string; title: string; count: number }>;
  weeklyActivity: Array<{ week: string; count: number }>;
  contentDepth: Record<string, number>;
  diversityScore: number;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatMonth(monthStr: string): string {
  const [y, m] = monthStr.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[parseInt(m) - 1] || m;
}

export default function StatsPage() {
  usePageTitle("Stats");
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const growthCanvasRef = useRef<HTMLCanvasElement>(null);
  const depthCanvasRef = useRef<HTMLCanvasElement>(null);

  const loadStats = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/v1/knowledge-stats")
      .then((r) => { if (!r.ok) throw new Error("Failed to load stats"); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message || "Something went wrong"); setLoading(false); });
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  // ─── Growth chart (Canvas) ────────────────────
  useEffect(() => {
    if (!data || !growthCanvasRef.current) return;
    const canvas = growthCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    const months = data.monthlyGrowth;
    if (months.length === 0) return;

    const maxCumulative = Math.max(...months.map((m) => m.cumulative), 1);
    const maxMonthly = Math.max(...months.map((m) => m.count), 1);
    const padTop = 20;
    const padBottom = 24;
    const padLeft = 4;
    const padRight = 4;
    const chartW = W - padLeft - padRight;
    const chartH = H - padTop - padBottom;

    ctx.clearRect(0, 0, W, H);

    // ── Monthly bars ──
    const barW = Math.max(4, (chartW / months.length) * 0.55);
    const gap = chartW / months.length;

    for (let i = 0; i < months.length; i++) {
      const m = months[i];
      const x = padLeft + gap * i + (gap - barW) / 2;
      const barH = maxMonthly > 0 ? (m.count / maxMonthly) * chartH * 0.4 : 0;
      const y = H - padBottom - barH;

      // Bar
      ctx.fillStyle = m.count > 0 ? "rgba(20, 184, 166, 0.35)" : "rgba(255, 255, 255, 0.02)";
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH || 2, [2, 2, 0, 0]);
      ctx.fill();

      // Month label
      if (i % 2 === 0 || months.length <= 6) {
        ctx.fillStyle = "rgba(113, 113, 122, 0.6)";
        ctx.font = "9px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(formatMonth(m.month), padLeft + gap * i + gap / 2, H - 4);
      }
    }

    // ── Cumulative line ──
    ctx.beginPath();
    ctx.strokeStyle = "rgba(20, 184, 166, 0.8)";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const linePoints: Array<[number, number]> = [];
    for (let i = 0; i < months.length; i++) {
      const m = months[i];
      const x = padLeft + gap * i + gap / 2;
      const y = padTop + chartH - (m.cumulative / maxCumulative) * chartH;
      linePoints.push([x, y]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // ── Data points ──
    for (const [x, y] of linePoints) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#0a0a0b";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(20, 184, 166, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // ── Gradient fill under line ──
    if (linePoints.length > 1) {
      ctx.beginPath();
      ctx.moveTo(linePoints[0][0], linePoints[0][1]);
      for (let i = 1; i < linePoints.length; i++) {
        ctx.lineTo(linePoints[i][0], linePoints[i][1]);
      }
      ctx.lineTo(linePoints[linePoints.length - 1][0], H - padBottom);
      ctx.lineTo(linePoints[0][0], H - padBottom);
      ctx.closePath();

      const gradient = ctx.createLinearGradient(0, padTop, 0, H - padBottom);
      gradient.addColorStop(0, "rgba(20, 184, 166, 0.15)");
      gradient.addColorStop(1, "rgba(20, 184, 166, 0.02)");
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }, [data]);

  // ─── Content depth chart (Canvas) ────────────────────
  useEffect(() => {
    if (!data || !depthCanvasRef.current) return;
    const canvas = depthCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    const buckets = [
      { key: "brief", label: "<50w", color: "rgba(56, 189, 248, 0.6)" },
      { key: "medium", label: "50–200w", color: "rgba(20, 184, 166, 0.6)" },
      { key: "detailed", label: "200–500w", color: "rgba(52, 211, 153, 0.6)" },
      { key: "deep", label: "500–1Kw", color: "rgba(251, 191, 36, 0.6)" },
      { key: "extensive", label: "1K+w", color: "rgba(248, 113, 113, 0.5)" },
    ];

    const maxCount = Math.max(...buckets.map((b) => data.contentDepth[b.key] || 0), 1);
    const padTop = 12;
    const padBottom = 20;
    const padLeft = 4;
    const padRight = 4;
    const chartW = W - padLeft - padRight;
    const chartH = H - padTop - padBottom;
    const barW = Math.max(16, (chartW / buckets.length) * 0.6);
    const gap = chartW / buckets.length;

    ctx.clearRect(0, 0, W, H);

    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i];
      const count = data.contentDepth[b.key] || 0;
      const x = padLeft + gap * i + (gap - barW) / 2;
      const barH = maxCount > 0 ? (count / maxCount) * chartH : 0;
      const y = H - padBottom - barH;

      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH || 2, [4, 4, 0, 0]);
      ctx.fill();

      // Count label
      if (count > 0) {
        ctx.fillStyle = "rgba(244, 244, 245, 0.7)";
        ctx.font = "bold 10px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(count), x + barW / 2, y - 4);
      }

      // Bucket label
      ctx.fillStyle = "rgba(113, 113, 122, 0.6)";
      ctx.font = "9px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(b.label, padLeft + gap * i + gap / 2, H - 3);
    }
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-6 md:space-y-10">
        <div className="space-y-2">
          <div className="animate-pulse rounded-xl bg-white/[0.04] h-7 w-40" />
          <div className="animate-pulse rounded-xl bg-white/[0.04] h-4 w-72" />
        </div>
        <div className="space-y-3">
          <div className="animate-pulse rounded-xl bg-white/[0.04] h-4 w-28" />
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="animate-pulse rounded-xl bg-white/[0.04] h-44 w-full" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="animate-pulse rounded-xl bg-white/[0.04] h-4 w-48" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="animate-pulse rounded bg-white/[0.04] w-3.5 h-3.5" />
              <div className="animate-pulse rounded bg-white/[0.04] h-3 w-16" />
              <div className="flex-1 h-[5px] rounded-full bg-white/[0.04]" />
              <div className="animate-pulse rounded bg-white/[0.04] h-3 w-8" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <PageTransition className="space-y-6">
        <Stagger>
          <h1 className="text-[22px] md:text-[28px] font-semibold tracking-[-0.03em]">Knowledge Stats</h1>
        </Stagger>
        <Stagger>
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-red-500/[0.06] border border-red-500/10 flex items-center justify-center mx-auto mb-3">
              <BarChart3 className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-[14px] text-zinc-400 font-medium mb-1">{error}</p>
            <button onClick={loadStats} className="text-[13px] text-teal-400 hover:text-teal-300 transition-colors">
              Try again
            </button>
          </div>
        </Stagger>
      </PageTransition>
    );
  }

  if (!data || data.total === 0) {
    return (
      <PageTransition className="space-y-6">
        <Stagger>
          <h1 className="text-[22px] md:text-[28px] font-semibold tracking-[-0.03em]">Knowledge Stats</h1>
        </Stagger>
        <EmptyState
          icon={BarChart3}
          title="No stats yet"
          description="Import knowledge to see detailed analytics about your memories — growth over time, source breakdown, content depth, and more."
          action={{ label: "Import knowledge", href: "/app/import" }}
          secondaryAction={{ label: "Try demo data", href: "/app?demo=true" }}
          color="teal"
        />
      </PageTransition>
    );
  }

  // Knowledge span in days
  const knowledgeSpanDays = data.dateRange.earliest && data.dateRange.latest
    ? Math.max(1, Math.round((new Date(data.dateRange.latest).getTime() - new Date(data.dateRange.earliest).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const knowledgeSpanLabel = knowledgeSpanDays > 365
    ? `${(knowledgeSpanDays / 365).toFixed(1)} years`
    : knowledgeSpanDays > 30
    ? `${Math.round(knowledgeSpanDays / 30)} months`
    : `${knowledgeSpanDays} days`;

  // Reading time estimate (225 wpm average reading speed)
  const totalReadingMins = Math.round(data.words.total / 225);
  const readingTimeLabel = totalReadingMins > 60
    ? `${(totalReadingMins / 60).toFixed(1)}h`
    : `${totalReadingMins}m`;

  return (
    <PageTransition className="space-y-6 md:space-y-10">
      {/* Header with inline summary — replaces hero metric cards */}
      <Stagger>
        <div>
          <h1 className="text-[22px] md:text-[28px] font-semibold tracking-[-0.03em]">Knowledge Stats</h1>
          <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 mt-1">
            <span className="text-[13px] text-zinc-400">
              <span className="text-zinc-200 font-medium tabular-nums">{formatNumber(data.total)}</span> memories
            </span>
            <span className="text-zinc-700 text-[13px]">·</span>
            <span className="text-[13px] text-zinc-400">
              <span className="text-zinc-200 font-medium tabular-nums">{formatNumber(data.words.total)}</span> words
            </span>
            <span className="text-zinc-700 text-[13px]">·</span>
            <span className="text-[13px] text-zinc-400">
              <span className="text-zinc-200 font-medium tabular-nums">{data.sources.length}</span> source types
            </span>
            <span className="text-zinc-700 text-[13px]">·</span>
            <span className="text-[13px] text-zinc-400">
              spanning <span className="text-zinc-200 font-medium">{knowledgeSpanLabel}</span>
            </span>
            <span className="text-zinc-700 text-[13px]">·</span>
            <span className="text-[13px] text-zinc-400">
              ~<span className="text-zinc-200 font-medium">{readingTimeLabel}</span> to read
            </span>
          </div>
        </div>
      </Stagger>

      {/* ═══ Knowledge Growth ═══ */}
      <Stagger>
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-medium text-zinc-300">Growth over time</h2>
            <span className="text-[11px] text-zinc-600">Last 12 months</span>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 md:p-5">
            <canvas
              ref={growthCanvasRef}
              className="w-full"
              style={{ height: "180px" }}
            />
            <div className="flex items-center gap-4 mt-3">
              <span className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                <span className="w-3 h-[3px] rounded-full bg-teal-500/40" />
                Monthly
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                <span className="w-3 h-[2px] rounded-full bg-teal-500/80" />
                Cumulative
              </span>
            </div>
          </div>
        </div>
      </Stagger>

      {/* ═══ Source Distribution — bare, no card wrapper ═══ */}
      <Stagger>
        <div>
          <h2 className="text-[14px] font-medium text-zinc-300 mb-3">Where your knowledge comes from</h2>
          <div className="space-y-1.5">
            {data.sources.map((s) => {
              const cfg = getSourceType(s.type);
              const Icon = cfg.icon;
              const pct = data.total > 0 ? Math.round((s.count / data.total) * 100) : 0;
              return (
                <div key={s.type} className="flex items-center gap-2.5 group">
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${cfg.textColor}`} />
                  <span className="text-[12px] text-zinc-400 w-20 shrink-0 truncate">{cfg.label}</span>
                  <div className="flex-1 h-[5px] rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-teal-500/50 transition-all duration-500`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-zinc-600 tabular-nums shrink-0">
                    {s.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Stagger>

      {/* ═══ Content Depth + Semantic Coverage — side by side ═══ */}
      <div className="grid md:grid-cols-5 gap-6 md:gap-8">
        {/* Content Depth — takes 3 cols */}
        <Stagger>
          <div className="md:col-span-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-medium text-zinc-300">Content depth</h2>
              <span className="text-[11px] text-zinc-600">Avg {data.words.avg} words/memory</span>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <canvas
                ref={depthCanvasRef}
                className="w-full"
                style={{ height: "140px" }}
              />
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-[9px] text-zinc-600">
                  <span className="text-sky-400/60">■</span> Brief
                </span>
                <span className="text-[9px] text-zinc-600">
                  <span className="text-teal-400/60">■</span> Medium
                </span>
                <span className="text-[9px] text-zinc-600">
                  <span className="text-emerald-400/60">■</span> Detailed
                </span>
                <span className="text-[9px] text-zinc-600">
                  <span className="text-amber-400/60">■</span> Deep
                </span>
                <span className="text-[9px] text-zinc-600">
                  <span className="text-red-400/50">■</span> Extensive
                </span>
              </div>
            </div>
          </div>
        </Stagger>

        {/* Semantic Coverage — takes 2 cols, no card wrapper */}
        <Stagger>
          <div className="md:col-span-2">
            <h2 className="text-[14px] font-medium text-zinc-300 mb-3">Semantic coverage</h2>
            <div className="flex items-start gap-4">
              {/* Progress ring */}
              <div className="relative w-16 h-16 shrink-0">
                <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
                  <circle
                    cx="40" cy="40" r="34" fill="none"
                    stroke="rgba(20, 184, 166, 0.6)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${(data.embeddings.percentage / 100) * 2 * Math.PI * 34} ${2 * Math.PI * 34}`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[15px] font-semibold tabular-nums text-zinc-200">{data.embeddings.percentage}%</span>
                </div>
              </div>
              <div className="pt-1">
                <p className="text-[13px] text-zinc-300">
                  <span className="font-medium">{data.embeddings.covered.toLocaleString()}</span>
                  <span className="text-zinc-600"> / </span>
                  <span className="text-zinc-500">{data.embeddings.total.toLocaleString()}</span>
                  <span className="text-zinc-600 text-[12px]"> indexed</span>
                </p>
                {data.embeddings.percentage < 100 && (
                  <Link
                    href="/app/settings"
                    className="inline-flex items-center gap-1 text-[11px] text-teal-400/80 hover:text-teal-300 mt-1.5 transition-colors"
                  >
                    Reindex to 100%
                    <ArrowUpRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>

            {/* Word range — compact, no card */}
            <div className="mt-6 space-y-2">
              <h2 className="text-[14px] font-medium text-zinc-300">Word range</h2>
              <div className="flex items-baseline gap-4">
                <div>
                  <span className="text-[18px] font-semibold tabular-nums text-zinc-200">{data.words.min}</span>
                  <span className="text-[11px] text-zinc-600 ml-1">shortest</span>
                </div>
                <span className="text-zinc-700">→</span>
                <div>
                  <span className="text-[18px] font-semibold tabular-nums text-zinc-200">{formatNumber(data.words.max)}</span>
                  <span className="text-[11px] text-zinc-600 ml-1">longest</span>
                </div>
              </div>
            </div>
          </div>
        </Stagger>
      </div>

      {/* ═══ Top Sources — bare list ═══ */}
      <Stagger>
        <div>
          <h2 className="text-[14px] font-medium text-zinc-300 mb-2">Top sources</h2>
          <div className="divide-y divide-white/[0.04]">
            {data.topSources.slice(0, 8).map((s, i) => {
              const cfg = getSourceType(s.type);
              const Icon = cfg.icon;
              return (
                <div
                  key={`${s.type}-${s.title}-${i}`}
                  className="flex items-center gap-3 py-2 group"
                >
                  <span className="text-[11px] text-zinc-700 tabular-nums w-4 text-right shrink-0">
                    {i + 1}
                  </span>
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${cfg.textColor}`} />
                  <span className="text-[13px] text-zinc-300 truncate flex-1 group-hover:text-zinc-100 transition-colors">{s.title}</span>
                  <span className="text-[11px] text-zinc-600 tabular-nums shrink-0">{s.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Stagger>
    </PageTransition>
  );
}
