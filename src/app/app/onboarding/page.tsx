"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { STEPS, type OnboardingStep, type OnboardingState } from "@/components/onboarding/types";
import { ProgressBar } from "@/components/onboarding/ProgressBar";
import { WelcomeStep } from "@/components/onboarding/WelcomeStep";
import { SetupStep } from "@/components/onboarding/SetupStep";
import { ImportStep } from "@/components/onboarding/ImportStep";
import { ExploreStep } from "@/components/onboarding/ExploreStep";
import { DoneStep } from "@/components/onboarding/DoneStep";

/**
 * Onboarding wizard page — /app/onboarding
 * 
 * Multi-step flow that guides new users through:
 * 1. Welcome — intro to MindStore
 * 2. Setup — name + AI provider  
 * 3. Import — first data import
 * 4. Explore — what they can do
 * 5. Done — celebration, redirect to dashboard
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [slideDir, setSlideDir] = useState(1);
  const [transitioning, setTransitioning] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);

  const [state, setState] = useState<OnboardingState>({
    completed: false,
    currentStep: 0,
    userName: null,
    aiProviderChoice: null,
    hasAiProvider: false,
    hasMemories: false,
    memoryCount: 0,
  });

  // Load onboarding state
  useEffect(() => {
    fetch("/api/v1/onboarding")
      .then((r) => r.json())
      .then((data) => {
        if (data.completed) {
          // Already completed, redirect to dashboard
          router.replace("/app");
          return;
        }
        setState(data);
        // Resume from saved step
        if (data.currentStep > 0 && data.currentStep < STEPS.length) {
          setStep(STEPS[data.currentStep]);
        }
        setLoaded(true);
        requestAnimationFrame(() => setFadeIn(true));
      })
      .catch(() => {
        setLoaded(true);
        requestAnimationFrame(() => setFadeIn(true));
      });
  }, [router]);

  const goTo = useCallback(
    (next: OnboardingStep) => {
      const curIdx = STEPS.indexOf(step);
      const nextIdx = STEPS.indexOf(next);
      setSlideDir(nextIdx > curIdx ? 1 : -1);
      setTransitioning(true);

      // Save progress
      fetch("/api/v1/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: nextIdx }),
      }).catch(() => {});

      setTimeout(() => {
        setStep(next);
        setTransitioning(false);
      }, 200);
    },
    [step]
  );

  const handleNext = useCallback(() => {
    const currentIdx = STEPS.indexOf(step);
    if (currentIdx < STEPS.length - 1) {
      goTo(STEPS[currentIdx + 1]);
    } else {
      // Done — navigate to dashboard
      router.push("/app");
    }
  }, [step, goTo, router]);

  const handleSkip = useCallback(async () => {
    // Mark as completed and go to dashboard
    await fetch("/api/v1/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    }).catch(() => {});
    router.push("/app");
  }, [router]);

  if (!loaded) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0b] flex items-center justify-center">
        <div className="w-8 h-8 rounded-xl bg-teal-500/10 animate-pulse" />
      </div>
    );
  }

  const stepProps = {
    onNext: handleNext,
    onSkip: handleSkip,
    state,
    setState,
  };

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Animations */}
      <style>{`
        @keyframes onb-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes onb-glow {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.08); }
        }
        @keyframes onb-fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes onb-check-pop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes onb-slide-in {
          from { opacity: 0; transform: translateX(calc(var(--dir, 1) * 60px)); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes onb-slide-out {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(calc(var(--dir, 1) * -60px)); }
        }
      `}</style>

      {/* Background */}
      <div
        className="absolute inset-0 bg-[#0a0a0b] transition-opacity duration-300"
        style={{ opacity: fadeIn ? 1 : 0 }}
      />

      {/* Subtle background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full opacity-[0.03]"
          style={{
            background: "radial-gradient(ellipse, #14b8a6 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Content */}
      <div
        className="relative h-full flex flex-col transition-opacity duration-500"
        style={{ opacity: fadeIn ? 1 : 0, transitionDelay: "100ms" }}
      >
        {/* Progress bar */}
        <div className="px-6 pt-5 pb-2">
          <ProgressBar currentStep={step} onSkip={handleSkip} />
        </div>

        {/* Step content — centered */}
        <div className="flex-1 flex items-center justify-center px-6 overflow-hidden">
          <div
            key={step}
            className="w-full max-w-md"
            style={{
              "--dir": slideDir,
              animation: transitioning
                ? "onb-slide-out 0.2s ease-out forwards"
                : "onb-slide-in 0.4s cubic-bezier(0.25,0.46,0.45,0.94) forwards",
            } as React.CSSProperties}
          >
            {step === "welcome" && <WelcomeStep {...stepProps} />}
            {step === "setup" && <SetupStep {...stepProps} />}
            {step === "import" && <ImportStep {...stepProps} />}
            {step === "explore" && <ExploreStep {...stepProps} />}
            {step === "done" && <DoneStep {...stepProps} />}
          </div>
        </div>

        {/* Bottom nav — only for welcome step */}
        {step === "welcome" && (
          <div className="px-6 pb-8 pt-4 max-w-md mx-auto w-full">
            <button
              onClick={handleNext}
              className="w-full h-[52px] rounded-2xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-semibold text-[15px] flex items-center justify-center gap-2.5 transition-all active:scale-[0.97] shadow-lg shadow-teal-500/20"
            >
              Get started
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
