"use client";

import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Animated pulsing dots for thinking state */
export function PulsingDots({ label }: { label?: string }) {
  return (
    <span className="flex items-center gap-2 text-zinc-500">
      <span className="flex gap-[3px] items-center">
        <span
          className="w-[5px] h-[5px] rounded-full bg-teal-400/60"
          style={{ animation: "ms-pulse 1.4s ease-in-out infinite", animationDelay: "0ms" }}
        />
        <span
          className="w-[5px] h-[5px] rounded-full bg-teal-400/60"
          style={{ animation: "ms-pulse 1.4s ease-in-out infinite", animationDelay: "200ms" }}
        />
        <span
          className="w-[5px] h-[5px] rounded-full bg-teal-400/60"
          style={{ animation: "ms-pulse 1.4s ease-in-out infinite", animationDelay: "400ms" }}
        />
      </span>
      {label && <span className="text-[12px] text-zinc-600">{label}</span>}
    </span>
  );
}

/** Multi-step thinking indicator for AI response generation */
export function ThinkingIndicator({
  step,
  searchResultCount,
}: {
  step: "searching" | "found" | "generating" | null;
  searchResultCount: number;
}) {
  if (!step) return null;

  return (
    <div className="flex flex-col gap-2">
      {/* Step 1: Searching */}
      <span className="flex items-center gap-2">
        {step === "searching" ? (
          <PulsingDots />
        ) : step === "found" || step === "generating" ? (
          <Check className="w-3.5 h-3.5 text-teal-400/70" />
        ) : null}
        <span
          className={cn(
            "text-[12px]",
            step === "searching" ? "text-zinc-400" : "text-zinc-600"
          )}
        >
          {step === "searching"
            ? "Searching memories…"
            : searchResultCount > 0
              ? `Found ${searchResultCount} relevant ${searchResultCount === 1 ? "memory" : "memories"}`
              : "Searching memories…"}
        </span>
      </span>

      {/* Step 2: Generating */}
      {(step === "found" || step === "generating") && (
        <span className="flex items-center gap-2">
          {step === "generating" ? (
            <PulsingDots />
          ) : (
            <Loader2 className="w-3.5 h-3.5 text-teal-400/60 animate-spin" />
          )}
          <span className="text-[12px] text-zinc-400">Generating response…</span>
        </span>
      )}
    </div>
  );
}
