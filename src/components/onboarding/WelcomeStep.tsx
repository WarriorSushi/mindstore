"use client";

import { Brain, Search, MessageSquare, Sparkles } from "lucide-react";
import { MindStoreLogo } from "@/components/MindStoreLogo";
import type { StepProps } from "./types";

/**
 * Welcome step — first impression of MindStore.
 * Large branded intro with a floating logo and three value props.
 */
export function WelcomeStep({ onNext }: StepProps) {
  return (
    <div className="text-center space-y-8">
      {/* Floating logo */}
      <div className="relative mx-auto w-24 h-24">
        {/* Glow ring */}
        <div
          className="absolute inset-0 rounded-[28px] bg-teal-500/20"
          style={{
            animation: "onb-glow 3s ease-in-out infinite",
          }}
        />
        <div
          className="relative w-24 h-24 rounded-[28px] bg-gradient-to-br from-[#0f1a1f] to-[#0a1015] border border-white/[0.08] flex items-center justify-center shadow-2xl shadow-teal-500/10"
          style={{
            animation: "onb-float 4s ease-in-out infinite",
          }}
        >
          <MindStoreLogo className="w-14 h-14" />
        </div>
      </div>

      {/* Heading */}
      <div className="space-y-3">
        <h1 className="text-[36px] md:text-[44px] font-bold tracking-[-0.04em] leading-[1.05]">
          Welcome to
          <br />
          <span className="bg-gradient-to-r from-teal-400 to-sky-400 bg-clip-text text-transparent">
            MindStore
          </span>
        </h1>
        <p className="text-[15px] text-zinc-400 leading-[1.7] max-w-[360px] mx-auto">
          Your personal knowledge engine. Import everything you&apos;ve
          learned, search it instantly, and connect ideas across your mind.
        </p>
      </div>

      {/* Value props — three horizontal pills */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {[
          { icon: Search, label: "Semantic search", color: "text-teal-400 bg-teal-500/10 border-teal-500/15" },
          { icon: MessageSquare, label: "Chat with your knowledge", color: "text-sky-400 bg-sky-500/10 border-sky-500/15" },
          { icon: Sparkles, label: "Discover connections", color: "text-amber-400 bg-amber-500/10 border-amber-500/15" },
        ].map(({ icon: Icon, label, color }, i) => (
          <div
            key={label}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full border ${color}`}
            style={{
              animation: `onb-fade-up 0.5s cubic-bezier(0.25,0.46,0.45,0.94) ${400 + i * 100}ms both`,
            }}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="text-[12px] font-medium">{label}</span>
          </div>
        ))}
      </div>

      {/* Attributes */}
      <div className="flex items-center justify-center gap-6 text-[12px] text-zinc-600">
        <span className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Open source
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
          Self-hosted
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          Your data stays yours
        </span>
      </div>
    </div>
  );
}
