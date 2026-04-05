"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Check, Zap } from "lucide-react";
import type { StepProps } from "./types";

/**
 * Done step — celebration with animated particles and CTA.
 * Confetti-like teal/sky particles fly upward, then the checkmark pops in.
 */
export function DoneStep({ onNext, state }: StepProps) {
  const [showCheck, setShowCheck] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // Particle animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
      decay: number;
    }[] = [];

    // Create burst
    const cx = rect.width / 2;
    const cy = rect.height * 0.4;
    const colors = [
      "rgba(20,184,166,", // teal
      "rgba(56,189,248,", // sky
      "rgba(16,185,129,", // emerald
      "rgba(45,212,191,", // teal light
    ];

    for (let i = 0; i < 40; i++) {
      const angle = (Math.PI * 2 * i) / 40 + Math.random() * 0.3;
      const speed = 2 + Math.random() * 4;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.8 + Math.random() * 0.2,
        decay: 0.015 + Math.random() * 0.01,
      });
    }

    function draw() {
      ctx!.clearRect(0, 0, rect.width, rect.height);

      let active = false;
      for (const p of particles) {
        if (p.alpha <= 0) continue;
        active = true;

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06; // gravity
        p.vx *= 0.99;
        p.alpha -= p.decay;

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fillStyle = `${p.color}${Math.max(0, p.alpha)})`;
        ctx!.fill();
      }

      if (active) {
        animRef.current = requestAnimationFrame(draw);
      }
    }

    draw();

    // Sequence the reveal
    const t1 = setTimeout(() => setShowCheck(true), 300);
    const t2 = setTimeout(() => setShowContent(true), 700);

    return () => {
      cancelAnimationFrame(animRef.current);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const handleFinish = useCallback(async () => {
    // Mark onboarding as completed
    await fetch("/api/v1/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    // Redirect to Explore if user has memories (better first-run experience than empty dashboard)
    if (state.hasMemories && state.memoryCount > 0) {
      window.location.href = "/app/explore";
    } else {
      onNext();
    }
  }, [onNext, state.hasMemories, state.memoryCount]);

  const greeting = state.userName
    ? `You're all set, ${state.userName}!`
    : "You're all set!";

  return (
    <div className="relative text-center space-y-8">
      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 1 }}
      />

      {/* Content */}
      <div className="relative" style={{ zIndex: 2 }}>
        {/* Animated check */}
        <div className="relative mx-auto w-20 h-20 mb-8">
          <div
            className={`w-20 h-20 rounded-[22px] bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-xl shadow-teal-500/20 transition-all duration-500 ${
              showCheck ? "scale-100 opacity-100" : "scale-50 opacity-0"
            }`}
            style={{
              transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            <Check className="w-10 h-10 text-white" />
          </div>
        </div>

        <div className={`space-y-3 transition-all duration-500 ${
          showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}>
          <h2 className="text-[28px] md:text-[34px] font-bold tracking-[-0.03em] leading-[1.1]">
            {greeting}
          </h2>
          <p className="text-[15px] text-zinc-400 leading-[1.7] max-w-[340px] mx-auto">
            {state.hasMemories ? (
              <>
                {state.memoryCount} {state.memoryCount === 1 ? "memory" : "memories"} loaded and ready.
                Your knowledge is now searchable, chattable, and explorable.
              </>
            ) : (
              <>
                Your MindStore is ready. Import your knowledge whenever you&apos;re ready
                — ChatGPT exports, notes, URLs, and more.
              </>
            )}
          </p>

          {/* Quick tips */}
          <div className="flex items-center justify-center gap-4 pt-4 text-[12px] text-zinc-600">
            <span>
              Press <kbd className="text-[10px] font-mono bg-white/[0.04] border border-white/[0.08] rounded px-1.5 py-[2px] mx-0.5">&#8984;K</kbd> to search
            </span>
            <span className="text-zinc-800">&middot;</span>
            <span>Drag & drop to import</span>
          </div>
        </div>

        {/* CTA */}
        <div className={`pt-8 transition-all duration-500 delay-200 ${
          showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}>
          <button
            onClick={handleFinish}
            className="w-full max-w-xs mx-auto h-[52px] rounded-2xl bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-500 hover:to-sky-500 text-white font-semibold text-[15px] flex items-center justify-center gap-2.5 transition-all active:scale-[0.97] shadow-lg shadow-teal-500/20"
          >
            <Zap className="w-4.5 h-4.5" />
            {state.hasMemories ? "Explore your mind" : "Open MindStore"}
          </button>
        </div>
      </div>
    </div>
  );
}
