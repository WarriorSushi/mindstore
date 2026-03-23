"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("MindStore app error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-6 px-6 max-w-md">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-0.02em]">Something went wrong</h2>
          <p className="text-[13px] text-zinc-500 mt-2 leading-relaxed">
            {error.message || "An unexpected error occurred. Your data is safe."}
          </p>
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-[13px] font-medium text-zinc-300 transition-all active:scale-[0.97]"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Try Again
        </button>
      </div>
    </div>
  );
}
