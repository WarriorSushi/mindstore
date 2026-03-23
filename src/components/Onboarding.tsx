"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Upload, MessageSquare, Compass, Fingerprint, Network, ArrowRight, X, Sparkles, Zap } from "lucide-react";

const ONBOARDING_KEY = "mindstore_onboarding_done";

const slides = [
  {
    icon: Brain,
    emoji: "🧠",
    gradient: "from-violet-500 to-fuchsia-600",
    title: "Your mind, searchable",
    body: "MindStore turns your conversations, notes, and articles into a personal knowledge base — searchable by meaning, not just keywords.",
  },
  {
    icon: Upload,
    emoji: "📥",
    gradient: "from-blue-500 to-cyan-500",
    title: "Import everything",
    body: "Drop your ChatGPT export ZIP, paste notes, upload files, or extract any URL. Your knowledge lands in one place.",
  },
  {
    icon: MessageSquare,
    emoji: "💬",
    gradient: "from-emerald-500 to-teal-500",
    title: "Chat with your brain",
    body: "Ask questions and get answers sourced from your own knowledge. MindStore searches, then synthesizes — with citations.",
  },
  {
    icon: Fingerprint,
    emoji: "🧬",
    gradient: "from-amber-500 to-orange-500",
    title: "See your mind's shape",
    body: "Knowledge Fingerprint shows a 3D map of your brain's topology. Insights reveal connections you didn't know existed.",
  },
  {
    icon: Network,
    emoji: "🔌",
    gradient: "from-rose-500 to-pink-500",
    title: "Connect to any AI",
    body: "One-click MCP setup for Claude Desktop, Cursor, VS Code. Give any AI access to your personal knowledge.",
  },
];

export function Onboarding() {
  const [show, setShow] = useState(false);
  const [current, setCurrent] = useState(0);

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

  function next() {
    if (current < slides.length - 1) setCurrent(current + 1);
    else finish();
  }

  if (!show) return null;

  const slide = slides[current];
  const isLast = current === slides.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />

      {/* Card */}
      <motion.div
        className="relative w-[90vw] max-w-[380px] mx-auto"
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
      >
        {/* Skip button */}
        <button
          onClick={finish}
          className="absolute -top-10 right-0 text-[12px] text-zinc-500 hover:text-zinc-300 font-medium px-2 py-1 rounded-lg transition-colors"
        >
          Skip
        </button>

        <div className="rounded-[28px] border border-white/[0.08] bg-[#111113] overflow-hidden shadow-2xl shadow-black/60">
          {/* Icon area */}
          <div className={`bg-gradient-to-br ${slide.gradient} p-8 flex items-center justify-center`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="text-6xl"
              >
                {slide.emoji}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Content */}
          <div className="px-7 pt-6 pb-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-[20px] font-bold tracking-[-0.02em] mb-2">{slide.title}</h2>
                <p className="text-[14px] text-zinc-400 leading-[1.6]">{slide.body}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-7 pb-7 pt-3 flex items-center justify-between">
            {/* Dots */}
            <div className="flex gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === current ? "w-6 bg-white" : "w-1.5 bg-white/20"
                  }`}
                />
              ))}
            </div>

            {/* Next button */}
            <button
              onClick={next}
              className={`h-11 rounded-2xl font-semibold text-[14px] flex items-center gap-2 transition-all active:scale-[0.95] ${
                isLast
                  ? "bg-violet-600 hover:bg-violet-500 text-white px-6"
                  : "bg-white/[0.08] hover:bg-white/[0.12] text-white px-5"
              }`}
            >
              {isLast ? (
                <>
                  Get started
                  <Zap className="w-4 h-4" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
