"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Zap } from "lucide-react";

const ONBOARDING_KEY = "mindstore_onboarding_done";

const slides = [
  {
    emoji: "🧠",
    gradient: "from-violet-600 via-violet-500 to-fuchsia-500",
    bg: "bg-violet-500/[0.03]",
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
    gradient: "from-rose-400 via-pink-500 to-violet-500",
    bg: "bg-rose-500/[0.03]",
    title: "Give any AI\nyour context.",
    body: "One-click MCP setup. Claude, Cursor, VS Code — they all get access to what you know. Your mind becomes their memory.",
  },
];

export function Onboarding() {
  const [show, setShow] = useState(false);
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const done = localStorage.getItem(ONBOARDING_KEY);
      if (!done) setShow(true);
    }
  }, []);

  function finish() {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setShow(false);
  }

  function goTo(i: number) {
    setDirection(i > current ? 1 : -1);
    setCurrent(i);
  }

  function next() {
    if (current < slides.length - 1) {
      setDirection(1);
      setCurrent(current + 1);
    } else {
      finish();
    }
  }

  if (!show) return null;

  const slide = slides[current];
  const isLast = current === slides.length - 1;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-[#0a0a0b]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />

      {/* Content */}
      <motion.div
        className="relative h-full flex flex-col items-center justify-between px-6 py-safe"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
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
          <AnimatePresence mode="wait">
            <motion.div
              key={`emoji-${current}`}
              initial={{ opacity: 0, scale: 0.6, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6, y: -20 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="mb-8"
            >
              <div className={`w-24 h-24 rounded-[28px] bg-gradient-to-br ${slide.gradient} flex items-center justify-center shadow-lg`}>
                <span className="text-5xl">{slide.emoji}</span>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Text */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`text-${current}`}
              initial={{ opacity: 0, x: direction * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -40 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="text-center"
            >
              <h1 className="text-[32px] md:text-[40px] font-bold tracking-[-0.04em] leading-[1.1] whitespace-pre-line mb-4">
                {slide.title}
              </h1>
              <p className="text-[15px] md:text-[16px] text-zinc-400 leading-[1.65] max-w-[320px] mx-auto">
                {slide.body}
              </p>
            </motion.div>
          </AnimatePresence>
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
                ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-500/20"
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
      </motion.div>
    </div>
  );
}
