"use client";

import { useState, useEffect } from "react";
import {
  Search, MessageSquare, Fingerprint, Compass,
  ArrowRight, Sparkles,
} from "lucide-react";
import type { StepProps } from "./types";

/**
 * Explore step — shows what users can do with MindStore.
 * Three animated feature previews with staggered entrance.
 */
export function ExploreStep({ onNext, state }: StepProps) {
  const [visibleIdx, setVisibleIdx] = useState(-1);

  // Stagger the feature cards appearing
  useEffect(() => {
    const timers = [
      setTimeout(() => setVisibleIdx(0), 200),
      setTimeout(() => setVisibleIdx(1), 500),
      setTimeout(() => setVisibleIdx(2), 800),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const features = [
    {
      icon: Search,
      title: "Search everything",
      description: "Find any idea across all your knowledge. Semantic search understands meaning, not just keywords.",
      color: "text-teal-400",
      bg: "bg-teal-500/10 border-teal-500/15",
      preview: (
        <div className="mt-3 rounded-lg bg-white/[0.03] border border-white/[0.04] p-2.5 space-y-1.5">
          <div className="flex items-center gap-2">
            <Search className="w-3 h-3 text-teal-500/50" />
            <span className="text-[11px] text-zinc-500">what did I learn about vector databases?</span>
          </div>
          <div className="flex gap-1">
            <div className="h-1 w-16 rounded-full bg-teal-500/30" />
            <div className="h-1 w-10 rounded-full bg-teal-500/15" />
            <div className="h-1 w-6 rounded-full bg-teal-500/10" />
          </div>
        </div>
      ),
    },
    {
      icon: MessageSquare,
      title: "Chat with your mind",
      description: "Ask questions and get answers sourced from your own knowledge. Like talking to your past self.",
      color: "text-sky-400",
      bg: "bg-sky-500/10 border-sky-500/15",
      preview: (
        <div className="mt-3 rounded-lg bg-white/[0.03] border border-white/[0.04] p-2.5 space-y-2">
          <div className="flex gap-2">
            <div className="w-5 h-5 rounded-md bg-sky-500/15 flex items-center justify-center shrink-0">
              <MessageSquare className="w-2.5 h-2.5 text-sky-400" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="h-1.5 w-full rounded-full bg-sky-500/10" />
              <div className="h-1.5 w-3/4 rounded-full bg-sky-500/8" />
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: Fingerprint,
      title: "Explore insights",
      description: "Discover unexpected connections between ideas. See the shape of your thinking in 3D.",
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/15",
      preview: (
        <div className="mt-3 rounded-lg bg-white/[0.03] border border-white/[0.04] p-2.5">
          <div className="flex items-center justify-between">
            {/* Mini node graph */}
            <svg width="120" height="32" viewBox="0 0 120 32" className="opacity-50">
              <line x1="20" y1="16" x2="55" y2="8" stroke="#14b8a6" strokeWidth="0.5" strokeOpacity="0.4" />
              <line x1="20" y1="16" x2="60" y2="24" stroke="#38bdf8" strokeWidth="0.5" strokeOpacity="0.3" />
              <line x1="55" y1="8" x2="90" y2="16" stroke="#f59e0b" strokeWidth="0.5" strokeOpacity="0.4" />
              <line x1="60" y1="24" x2="90" y2="16" stroke="#14b8a6" strokeWidth="0.5" strokeOpacity="0.3" />
              <circle cx="20" cy="16" r="3" fill="#14b8a6" fillOpacity="0.6" />
              <circle cx="55" cy="8" r="2.5" fill="#38bdf8" fillOpacity="0.5" />
              <circle cx="60" cy="24" r="2" fill="#f59e0b" fillOpacity="0.4" />
              <circle cx="90" cy="16" r="3" fill="#14b8a6" fillOpacity="0.6" />
            </svg>
            <Sparkles className="w-3 h-3 text-amber-500/40" />
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-[24px] md:text-[28px] font-bold tracking-[-0.03em] leading-[1.1]">
          Here&apos;s what
          <br />
          <span className="text-zinc-400">you can do</span>
        </h2>
        {state.hasMemories && (
          <p className="text-[14px] text-zinc-500 mt-2">
            With {state.memoryCount} {state.memoryCount === 1 ? "memory" : "memories"} loaded, try these out:
          </p>
        )}
      </div>

      {/* Feature cards */}
      <div className="space-y-3">
        {features.map(({ icon: Icon, title, description, color, bg, preview }, i) => (
          <div
            key={title}
            className={`rounded-2xl border ${bg} p-4 transition-all duration-500 ${
              i <= visibleIdx
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0`}>
                <Icon className={`w-4.5 h-4.5 ${color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-white">{title}</p>
                <p className="text-[12px] text-zinc-500 mt-0.5 leading-relaxed">{description}</p>
                {preview}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Continue */}
      <button
        onClick={onNext}
        className="w-full h-[52px] rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-[15px] flex items-center justify-center gap-2.5 transition-all active:scale-[0.97]"
      >
        Almost there
        <ArrowRight className="w-4.5 h-4.5" />
      </button>
    </div>
  );
}
