"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/15 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="text-[16px] font-semibold tracking-[-0.01em] mb-1.5">Something went wrong</h2>
          <p className="text-[13px] text-zinc-500 max-w-sm leading-relaxed mb-4">
            {this.state.error?.message || "An unexpected error occurred. Try refreshing the page."}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: undefined });
              window.location.reload();
            }}
            className="h-9 px-5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-[13px] font-medium text-zinc-300 transition-all active:scale-[0.96] flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/* ─── Inline error message for API failures ─── */
export function InlineError({
  message = "Failed to load data",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-500/10 bg-red-500/[0.04] p-4 flex items-center gap-3">
      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
      <p className="text-[13px] text-zinc-400 flex-1">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-[12px] text-red-400 hover:text-red-300 font-medium px-3 py-1 rounded-lg hover:bg-red-500/10 transition-colors shrink-0"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/* ─── "No AI Provider" banner — reusable ─── */
export function NoAIBanner({ compact = false }: { compact?: boolean }) {
  return (
    <a href="/app/settings">
      <div className={`flex items-center justify-between rounded-2xl bg-gradient-to-r from-amber-500/[0.06] to-amber-500/[0.02] border border-amber-500/15 ${compact ? "px-3 py-2" : "px-4 py-3"} hover:from-amber-500/[0.1] hover:to-amber-500/[0.04] transition-all`}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div>
            <p className="text-[12px] text-amber-300 font-medium">AI provider required</p>
            {!compact && (
              <p className="text-[11px] text-zinc-500">Connect Gemini (free), OpenAI, or Ollama in Settings</p>
            )}
          </div>
        </div>
        <span className="text-[11px] text-amber-400 font-medium shrink-0">Set up →</span>
      </div>
    </a>
  );
}
