"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home, MessageSquare, ArrowLeft, Copy, Check } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error("MindStore app error:", error);
  }, [error]);

  const errorInfo = error.digest
    ? `Error: ${error.message}\nDigest: ${error.digest}`
    : `Error: ${error.message}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(errorInfo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-center min-h-[65vh]">
      <div className="text-center space-y-6 px-6 max-w-md">
        {/* Icon with subtle animation */}
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6 text-amber-400" />
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em]">Something went wrong</h2>
          <p className="text-[13px] text-zinc-500 leading-relaxed">
            {error.message || "An unexpected error occurred. Your data is safe."}
          </p>
        </div>

        {/* Error details (collapsible) */}
        {error.digest && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Error ID</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <code className="text-[11px] font-mono text-zinc-500">{error.digest}</code>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={reset}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-[13px] font-medium text-white transition-all active:scale-[0.97]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Try Again
          </button>
          <div className="flex gap-2">
            <Link
              href="/app"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-[12px] font-medium text-zinc-400 transition-all active:scale-[0.97]"
            >
              <Home className="w-3 h-3" />
              Home
            </Link>
            <Link
              href="/app/chat"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-[12px] font-medium text-zinc-400 transition-all active:scale-[0.97]"
            >
              <MessageSquare className="w-3 h-3" />
              Chat
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
