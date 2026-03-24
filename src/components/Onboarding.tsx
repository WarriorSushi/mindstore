"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowRight, Zap } from "lucide-react";

const ONBOARDING_KEY = "mindstore_onboarding_done";

const slides = [
  {
    emoji: "🧠",
    gradient: "from-teal-600 via-teal-500 to-sky-500",
    bg: "bg-teal-500/[0.03]",
    title: "Your mind,\nsearchable.",
    body: "Every conversation you've had with AI, every note you've written — it's all knowledge. MindStore makes it findable.",
  },
  {
    emoji: "📥",
    gradient: "from-blue-500 via-cyan-400 to-emerald-400",
    bg: "bg-blue-500/[0.03]",
    title: "Drop it in,\nforget about it.",
    body: "ChatGPT exports, text notes, web pages, Obsidian vaults — one drop, instantly chunked and indexed.",
  },
  {
    emoji: "💬",
    gradient: "from-emerald-400 via-teal-400 to-cyan-400",
    bg: "bg-emerald-500/[0.03]",
    title: "Ask your own\nbrain.",
    body: "Search finds what you know. Chat synthesizes answers from your memories — with sources, so you can trust it.",
  },
  {
    emoji: "🧬",
    gradient: "from-amber-400 via-orange-400 to-rose-400",
    bg: "bg-amber-500/[0.03]",
    title: "See how\nyou think.",
    body: "Knowledge Fingerprint maps your mind in 3D. Insights surface connections between ideas you never linked yourself.",
  },
  {
    emoji: "🔌",
    gradient: "from-rose-400 via-pink-500 to-teal-500",
    bg: "bg-rose-500/[0.03]",
    title: "Give any AI\nyour context.",
    body: "One-click MCP setup. Claude, Cursor, VS Code — they all get access to what you know. Your mind becomes their memory.",
  },
];

export function Onboarding() {
  const [show, setShow] = useState(false);
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState(1);
  const [fadeIn, setFadeIn] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const done = localStorage.getItem(ONBOARDING_KEY);
      if (!done) {
        setShow(true);
        // Trigger entrance animation
        requestAnimationFrame(() => setFadeIn(true));
      }
    }
  }, []);

  function finish() {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setFadeIn(false);
    setTimeout(() => setShow(false), 300);
  }

  function goTo(i: number) {
    if (animating || i === current) return;
    setDirection(i > current ? 1 : -1);
    setAnimating(true);
    // Brief exit, then switch
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setCurrent(i);
      setAnimating(false);
    }, 200);
  }

  function next() {
    if (current < slides.length - 1) {
      goTo(current + 1);
    } else {
      finish();
    }
  }

  if (!show) return null;

  const slide = slides[current];
  const isLast = current === slides.length - 1;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Inline keyframes for onboarding animations */}
      <style>{`
        @keyframes onboard-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes onboard-emoji-in {
          from { opacity: 0; transform: scale(0.6) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes onboard-text-in {
          from { opacity: 0; transform: translateX(var(--slide-dir, 40px)); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes onboard-exit {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(var(--slide-exit-dir, -40px)); }
        }
        @keyframes onboard-emoji-exit {
          from { opacity: 1; transform: scale(1) translateY(0); }
          to { opacity: 0; transform: scale(0.6) translateY(-20px); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#0a0a0b] transition-opacity duration-300"
        style={{ opacity: fadeIn ? 1 : 0 }}
      />

      {/* Content */}
      <div
        className="relative h-full flex flex-col items-center justify-between px-6 py-safe transition-opacity duration-300"
        style={{ opacity: fadeIn ? 1 : 0, transitionDelay: "100ms" }}
      >
        {/* Skip */}
        <div className="w-full flex justify-end pt-4 md:pt-6">
          <button
            onClick={finish}
            className="text-[13px] text-zinc-600 hover:text-zinc-400 font-medium px-3 py-1.5 rounded-xl transition-colors"
          >
            Skip
          </button>
        </div>

        {/* Main slide area */}
        <div className="flex-1 flex flex-col items-center justify-center max-w-md w-full -mt-8">
          {/* Emoji */}
          <div
            key={`emoji-${current}`}
            className="mb-8"
            style={{
              animation: animating
                ? "onboard-emoji-exit 0.2s ease-out forwards"
                : "onboard-emoji-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
            }}
          >
            <div className={`w-24 h-24 rounded-[28px] bg-gradient-to-br ${slide.gradient} flex items-center justify-center shadow-lg`}>
              <span className="text-5xl">{slide.emoji}</span>
            </div>
          </div>

          {/* Text */}
          <div
            key={`text-${current}`}
            className="text-center"
            style={{
              "--slide-dir": `${direction * 40}px`,
              "--slide-exit-dir": `${direction * -40}px`,
              animation: animating
                ? "onboard-exit 0.2s ease-out forwards"
                : "onboard-text-in 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
            } as React.CSSProperties}
          >
            <h1 className="text-[32px] md:text-[40px] font-bold tracking-[-0.04em] leading-[1.1] whitespace-pre-line mb-4">
              {slide.title}
            </h1>
            <p className="text-[15px] md:text-[16px] text-zinc-400 leading-[1.65] max-w-[320px] mx-auto">
              {slide.body}
            </p>
          </div>
        </div>

        {/* Bottom controls */}
        <div className="w-full max-w-md pb-6 md:pb-10 space-y-6">
          {/* Dots */}
          <div className="flex justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className="group p-1"
              >
                <div className={`rounded-full transition-all duration-400 ${
                  i === current
                    ? "w-8 h-2 bg-white"
                    : "w-2 h-2 bg-white/15 group-hover:bg-white/30"
                }`} />
              </button>
            ))}
          </div>

          {/* CTA button */}
          <button
            onClick={next}
            className={`w-full h-[52px] rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2.5 transition-all active:scale-[0.97] ${
              isLast
                ? "bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-500 hover:to-sky-500 text-white shadow-lg shadow-teal-500/20"
                : "bg-white/[0.08] hover:bg-white/[0.12] text-white"
            }`}
          >
            {isLast ? (
              <>
                Get started
                <Zap className="w-4.5 h-4.5" />
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-4.5 h-4.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
