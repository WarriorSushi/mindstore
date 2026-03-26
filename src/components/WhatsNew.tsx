"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X, Sparkles, Zap, Shield, Search, Brain,
  Layers, PenTool, Puzzle, Globe, Upload,
  BarChart3, Rocket, Star,
} from "lucide-react";

const WHATS_NEW_KEY = "mindstore_whats_new_seen";
const CURRENT_VERSION = "0.3.0";

interface ChangeEntry {
  version: string;
  date: string;
  highlights: {
    icon: typeof Sparkles;
    title: string;
    description: string;
    color: string;
  }[];
}

const CHANGELOG: ChangeEntry[] = [
  {
    version: "0.3.0",
    date: "March 2026",
    highlights: [
      {
        icon: Rocket,
        title: "Production-ready landing page",
        description: "New hero, interactive product preview, import highlight, and full SEO with OG images and structured data.",
        color: "text-teal-400 bg-teal-500/10",
      },
      {
        icon: Shield,
        title: "Error boundaries everywhere",
        description: "Friendly error states on all 33 routes. Graceful failures with retry buttons instead of white screens.",
        color: "text-sky-400 bg-sky-500/10",
      },
      {
        icon: Layers,
        title: "Skeleton loading screens",
        description: "Every page now shows content-shaped placeholders while loading — no more spinners.",
        color: "text-amber-400 bg-amber-500/10",
      },
      {
        icon: Brain,
        title: "First-time onboarding wizard",
        description: "Welcome → Connect AI → Import first data → Done. Step-by-step setup for new users.",
        color: "text-emerald-400 bg-emerald-500/10",
      },
      {
        icon: Search,
        title: "AI-not-configured states",
        description: "Graceful banners and per-page guidance when no AI provider is connected yet.",
        color: "text-teal-400 bg-teal-500/10",
      },
    ],
  },
  {
    version: "0.2.0",
    date: "March 2026",
    highlights: [
      {
        icon: PenTool,
        title: "Premium typography",
        description: "Plus Jakarta Sans for UI, Instrument Serif for display headings, JetBrains Mono for code.",
        color: "text-sky-400 bg-sky-500/10",
      },
      {
        icon: Sparkles,
        title: "Custom MindStore logo",
        description: "The Neural M — a distinctive mark that works at every size. No more generic Brain icon.",
        color: "text-teal-400 bg-teal-500/10",
      },
      {
        icon: Globe,
        title: "MCP Connect page",
        description: "One-click config snippets for Claude Desktop, Cursor, OpenClaw, and any MCP client.",
        color: "text-amber-400 bg-amber-500/10",
      },
      {
        icon: Puzzle,
        title: "35 plugins",
        description: "Blog writer, newsletter, flashcards, resume builder, voice capture, image analysis, and more.",
        color: "text-emerald-400 bg-emerald-500/10",
      },
    ],
  },
  {
    version: "0.1.0",
    date: "February 2026",
    highlights: [
      {
        icon: Upload,
        title: "12+ import sources",
        description: "ChatGPT, Kindle, Obsidian, Notion, YouTube, Reddit, Twitter, Telegram, PDF, EPUB, and more.",
        color: "text-teal-400 bg-teal-500/10",
      },
      {
        icon: Search,
        title: "Semantic search",
        description: "BM25 + vector search with HyDE, reranking, and multiple RAG strategies.",
        color: "text-sky-400 bg-sky-500/10",
      },
      {
        icon: Brain,
        title: "Knowledge Fingerprint",
        description: "3D WebGL visualization of your mind — see clusters, connections, and blind spots.",
        color: "text-amber-400 bg-amber-500/10",
      },
      {
        icon: BarChart3,
        title: "Knowledge analytics",
        description: "Stats, evolution timelines, sentiment analysis, contradiction finder, and knowledge gaps.",
        color: "text-emerald-400 bg-emerald-500/10",
      },
    ],
  },
];

export function WhatsNew() {
  const [open, setOpen] = useState(false);
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(WHATS_NEW_KEY);
    if (seen !== CURRENT_VERSION) {
      setHasNew(true);
    }
  }, []);

  // Listen for custom event to open
  useEffect(() => {
    function handleOpen() {
      setOpen(true);
      setHasNew(false);
      localStorage.setItem(WHATS_NEW_KEY, CURRENT_VERSION);
    }
    window.addEventListener("mindstore:open-whats-new", handleOpen);
    return () => window.removeEventListener("mindstore:open-whats-new", handleOpen);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]" onClick={handleClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div className="absolute inset-x-0 top-[8%] md:top-[12%] flex justify-center px-4">
        <div
          className="w-full max-w-[480px] bg-[#151517] border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500/20 to-sky-500/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-teal-400" />
              </div>
              <div>
                <h2 className="text-[16px] font-semibold tracking-[-0.02em]">What&apos;s New</h2>
                <p className="text-[11px] text-zinc-500">Recent improvements to MindStore</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-4 h-4 text-zinc-500" />
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[60vh] overflow-y-auto px-5 pb-5 space-y-5">
            {CHANGELOG.map((entry, ei) => (
              <div key={entry.version}>
                {/* Version header */}
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="text-[12px] font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-md">
                    v{entry.version}
                  </span>
                  <span className="text-[11px] text-zinc-600">{entry.date}</span>
                  {ei === 0 && (
                    <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      Latest
                    </span>
                  )}
                </div>

                {/* Highlights */}
                <div className="space-y-2">
                  {entry.highlights.map((h) => (
                    <div
                      key={h.title}
                      className="flex items-start gap-3 rounded-xl bg-white/[0.02] border border-white/[0.05] px-3.5 py-3 hover:bg-white/[0.04] transition-colors"
                    >
                      <div className={`w-7 h-7 rounded-lg ${h.color} flex items-center justify-center shrink-0 mt-0.5`}>
                        <h.icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-zinc-200">{h.title}</p>
                        <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                          {h.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06]">
            <a
              href="https://github.com/WarriorSushi/mindstore"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1"
            >
              <Star className="w-3 h-3" />
              Star on GitHub
            </a>
            <button
              onClick={handleClose}
              className="h-8 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 text-[12px] font-medium text-white transition-all active:scale-[0.96]"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Returns true if user hasn't seen the latest changelog */
export function hasUnseenChangelog(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(WHATS_NEW_KEY) !== CURRENT_VERSION;
}
