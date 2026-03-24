"use client";

import Link from "next/link";
import { Brain, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
      <div className="text-center space-y-6 px-6">
        <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/15 flex items-center justify-center mx-auto">
          <Brain className="w-7 h-7 text-teal-400/60" />
        </div>
        <div>
          <h1 className="text-[48px] md:text-[64px] font-bold tracking-[-0.04em] bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">404</h1>
          <p className="text-[15px] text-zinc-500 mt-1">This thought doesn't exist yet.</p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-[13px] font-medium text-zinc-300 transition-all active:scale-[0.97]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to MindStore
        </Link>
      </div>
    </div>
  );
}
