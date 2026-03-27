import { Brain } from "lucide-react";

export default function ChatLoading() {
  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      {/* Top bar skeleton */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] shrink-0">
        <div className="h-8 w-24 rounded-xl bg-white/[0.04] animate-pulse" />
        <div className="flex gap-1.5">
          <div className="w-8 h-8 rounded-xl bg-white/[0.04] animate-pulse" />
          <div className="w-20 h-8 rounded-xl bg-white/[0.04] animate-pulse" />
        </div>
      </div>

      {/* Messages area — empty state skeleton */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 overflow-hidden">
        <div className="w-14 h-14 rounded-2xl bg-teal-500/[0.06] flex items-center justify-center ring-1 ring-teal-500/[0.06]">
          <Brain className="w-6 h-6 text-teal-400/30 animate-pulse" />
        </div>
        <div className="space-y-2 text-center">
          <div className="h-5 w-40 bg-white/[0.04] rounded-lg animate-pulse mx-auto" />
          <div className="h-4 w-56 bg-white/[0.03] rounded-lg animate-pulse mx-auto" />
        </div>
        {/* Suggestion chips skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg px-6 mt-2">
          <div className="h-12 rounded-2xl bg-white/[0.03] border border-white/[0.04] animate-pulse" />
          <div className="h-12 rounded-2xl bg-white/[0.03] border border-white/[0.04] animate-pulse" />
          <div className="h-12 rounded-2xl bg-white/[0.03] border border-white/[0.04] animate-pulse" />
          <div className="h-12 rounded-2xl bg-white/[0.03] border border-white/[0.04] animate-pulse" />
        </div>
      </div>

      {/* Input area skeleton */}
      <div className="border-t border-white/[0.06] px-4 py-3 shrink-0">
        <div className="max-w-2xl mx-auto flex items-end gap-2">
          <div className="flex-1 h-[46px] rounded-2xl bg-white/[0.04] border border-white/[0.06] animate-pulse" />
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] animate-pulse shrink-0" />
        </div>
      </div>
    </div>
  );
}
