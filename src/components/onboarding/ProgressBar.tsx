"use client";

import { STEPS, STEP_LABELS, type OnboardingStep } from "./types";

/**
 * Progress bar for the onboarding wizard.
 * Animated pill indicators that expand when active.
 */
export function ProgressBar({
  currentStep,
  onSkip,
}: {
  currentStep: OnboardingStep;
  onSkip: () => void;
}) {
  const currentIdx = STEPS.indexOf(currentStep);

  return (
    <div className="flex items-center justify-between w-full">
      {/* Step indicators */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          {STEPS.map((step, i) => (
            <div
              key={step}
              className="relative"
            >
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ease-out ${
                  i < currentIdx
                    ? "bg-teal-500 w-6"
                    : i === currentIdx
                      ? "bg-teal-400 w-10"
                      : "bg-white/[0.08] w-4"
                }`}
              />
            </div>
          ))}
        </div>
        <span className="text-[11px] text-zinc-600 font-medium tabular-nums tracking-wide">
          {currentIdx + 1}/{STEPS.length}
        </span>
      </div>

      {/* Skip */}
      <button
        onClick={onSkip}
        className="text-[12px] text-zinc-600 hover:text-zinc-400 font-medium px-3 py-1.5 rounded-xl transition-colors active:scale-[0.97]"
      >
        Skip setup
      </button>
    </div>
  );
}
