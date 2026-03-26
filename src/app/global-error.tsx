"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[MindStore Global Error]", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 antialiased">
        <div className="flex flex-col items-center justify-center text-center min-h-screen px-6">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/15 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] mb-1.5">
            Something went wrong
          </h2>
          <p className="text-[13px] text-zinc-500 max-w-sm leading-relaxed mb-6">
            {error.message || "An unexpected error occurred. Please try refreshing the page."}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={reset}
              className="h-9 px-5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-[13px] font-medium text-zinc-300 transition-all active:scale-[0.96] flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Again
            </button>
            <Link href="/">
              <button className="h-9 px-5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] text-[13px] text-zinc-400 font-medium transition-all active:scale-[0.96]">
                Go Home
              </button>
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
