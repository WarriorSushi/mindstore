import { MessageSquare } from "lucide-react";

export default function ChatLoading() {
  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] animate-in fade-in duration-300">
      {/* Header skeleton */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/[0.04] animate-pulse" />
          <div className="h-4 w-32 bg-white/[0.05] rounded-lg animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/[0.04] animate-pulse" />
          <div className="w-8 h-8 rounded-lg bg-white/[0.04] animate-pulse" />
        </div>
      </div>

      {/* Messages area skeleton */}
      <div className="flex-1 p-4 space-y-6 overflow-hidden">
        {/* Empty state placeholder */}
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-teal-400/40 animate-pulse" />
          </div>
          <div className="space-y-2 text-center">
            <div className="h-5 w-40 bg-white/[0.04] rounded-lg animate-pulse mx-auto" />
            <div className="h-3 w-56 bg-white/[0.03] rounded animate-pulse mx-auto" />
          </div>
          {/* Suggestion chips skeleton */}
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            <div className="h-8 w-36 rounded-xl bg-white/[0.03] animate-pulse" />
            <div className="h-8 w-44 rounded-xl bg-white/[0.03] animate-pulse" />
            <div className="h-8 w-40 rounded-xl bg-white/[0.03] animate-pulse" />
          </div>
        </div>
      </div>

      {/* Input area skeleton */}
      <div className="px-4 pb-4 pt-2">
        <div className="h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] animate-pulse" />
      </div>
    </div>
  );
}
