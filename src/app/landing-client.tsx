"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight, Upload, MessageSquare, Search,
  Fingerprint, Network, Layers, Heart, Target,
  PenTool, Route, Mail, Mic, Camera,
  Lock, Globe, Zap, AlertTriangle, BookOpen,
  FileText, Dna, Puzzle, Users, GitBranch,
  type LucideIcon,
} from "lucide-react";
import { MindStoreLogo, MindStoreLogoMono } from "@/components/MindStoreLogo";

/* ═══════════════════════════════════════════
   MindStore Landing Page v3
   
   Direction: Silicon Valley unicorn.
   References: Linear, Vercel, Resend, Raycast
   
   Principles:
   - Bold headline, one sentence
   - Show product, don't describe it
   - MCP front and center (differentiator)
   - Community & extensibility story
   - Tight, confident, zero filler
   - No serif. No editorial. Clean sans.
   ═══════════════════════════════════════════ */

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: `opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

function Counter({ end, suffix = "" }: { end: number; suffix?: string }) {
  const { ref, visible } = useInView();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let frame: number;
    const duration = 1000;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setCount(Math.round((1 - Math.pow(1 - p, 4)) * end));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [visible, end]);
  return <span ref={ref}>{count}{suffix}</span>;
}

export function LandingClient() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 selection:bg-teal-500/20">
      {/* Structured data */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "SoftwareApplication",
        name: "MindStore", applicationCategory: "ProductivityApplication",
        operatingSystem: "Web", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        description: "The personal knowledge OS. 35 plugins, 12+ import sources, MCP protocol. Free, open source, MIT licensed.",
      }) }} />

      {/* ═══════ NAV ═══════ */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <MindStoreLogo className="w-6 h-6" />
            <span className="font-semibold text-[14px] tracking-[-0.02em]">MindStore</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/docs" className="text-[13px] text-zinc-500 hover:text-zinc-200 transition-colors hidden sm:block">Docs</Link>
            <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer" className="text-[13px] text-zinc-500 hover:text-zinc-200 transition-colors hidden sm:block">GitHub</a>
            <Link href="/app/plugins" className="text-[13px] text-zinc-500 hover:text-zinc-200 transition-colors hidden md:block">Plugins</Link>
            <Link href="/app">
              <button className="h-8 px-4 rounded-lg bg-zinc-100 text-zinc-900 text-[13px] font-semibold hover:bg-white transition-colors">
                Open App
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══════ HERO ═══════ */}
      <section className="pt-32 pb-16 md:pt-44 md:pb-24">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <Reveal>
            <div className="flex justify-center mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/[0.08] border border-teal-500/15 text-[12px] font-medium text-teal-400">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                Open source · Community driven · 35 plugins
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className="text-[clamp(2.25rem,5.5vw,4.25rem)] font-extrabold leading-[1.08] tracking-[-0.04em]">
              The personal knowledge{" "}
              <br className="hidden sm:block" />
              operating system
            </h1>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="text-[16px] md:text-[18px] text-zinc-400 mt-5 max-w-2xl mx-auto leading-[1.7]">
              Import from 12+ sources. Chat with your own knowledge. 
              Extend with 35 plugins. Connect to any AI via MCP.
              <br className="hidden md:block" />
              Self-hosted. Private. Free forever.
            </p>
          </Reveal>

          <Reveal delay={0.18}>
            <div className="flex flex-wrap gap-3 justify-center mt-8">
              <Link href="/app">
                <button className="h-11 px-7 rounded-xl bg-zinc-100 text-zinc-900 text-[14px] font-semibold hover:bg-white transition-all active:scale-[0.97] shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
                  Get Started — Free
                </button>
              </Link>
              <Link href="/app?demo=true">
                <button className="h-11 px-7 rounded-xl border border-zinc-800 text-[14px] font-medium text-zinc-300 hover:border-zinc-600 hover:text-white transition-all active:scale-[0.97]">
                  Live Demo
                </button>
              </Link>
              <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer">
                <button className="h-11 px-7 rounded-xl border border-zinc-800 text-[14px] font-medium text-zinc-400 hover:border-zinc-600 hover:text-white transition-all active:scale-[0.97] flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                  Star on GitHub
                </button>
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ MCP — the differentiator, RIGHT UP FRONT ═══════ */}
      <section className="border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-6 py-20 md:py-28">
          <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
            <div>
              <Reveal>
                <p className="text-[12px] font-semibold text-teal-400 tracking-[0.1em] uppercase mb-3">MCP Protocol</p>
                <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.03em]">
                  Your mind as a tool{" "}
                  <span className="text-zinc-500">for any AI.</span>
                </h2>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="text-[14px] text-zinc-500 mt-4 leading-[1.75] max-w-md">
                  MindStore is an MCP server. Connect Claude, ChatGPT, Cursor, or any 
                  MCP-compatible AI — they can search your knowledge, pull context, 
                  and understand who you are. Three lines of config.
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <div className="mt-6 space-y-2.5">
                  {[
                    { fn: "search_mind", desc: "Semantic search across all knowledge" },
                    { fn: "get_profile", desc: "AI-generated knowledge profile" },
                    { fn: "get_context", desc: "Relevant context for any topic" },
                  ].map((t) => (
                    <div key={t.fn} className="flex items-center gap-3">
                      <code className="text-[11px] font-mono text-teal-400/80 bg-teal-500/[0.06] px-2 py-0.5 rounded border border-teal-500/10">{t.fn}</code>
                      <span className="text-[12px] text-zinc-600">{t.desc}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
            <Reveal delay={0.1}>
              <div className="rounded-xl bg-[#0c0c0e] border border-zinc-800/50 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800/40 bg-zinc-900/30">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-700/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-700/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-700/60" />
                  </div>
                  <span className="text-[10px] text-zinc-600 ml-2 font-mono">claude_desktop_config.json</span>
                </div>
                <div className="p-5 font-mono text-[13px] leading-relaxed">
                  <pre className="text-zinc-500"><code>{`{
  `}<span className="text-zinc-300">{`"mcpServers"`}</span>{`: {
    `}<span className="text-zinc-300">{`"mindstore"`}</span>{`: {
      `}<span className="text-zinc-300">{`"url"`}</span>{`: `}<span className="text-teal-400/80">{`"https://mindstore.org/api/mcp"`}</span>{`
    }
  }
}`}</code></pre>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════ PLUGIN ECOSYSTEM — community & extensibility ═══════ */}
      <section className="border-t border-white/[0.04] bg-[#0a0a0c]">
        <div className="max-w-5xl mx-auto px-6 py-20 md:py-28">
          <div className="text-center mb-14">
            <Reveal>
              <p className="text-[12px] font-semibold text-teal-400 tracking-[0.1em] uppercase mb-3">Plugin Ecosystem</p>
              <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.03em]">
                35 plugins. Your MindStore, your way.
              </h2>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="text-[14px] text-zinc-500 mt-3 max-w-xl mx-auto leading-[1.7]">
                Every plugin is free and built-in. Install what you need, skip what you don&apos;t.
                Community-driven — new plugins and integrations ship regularly.
              </p>
            </Reveal>
          </div>

          {/* Plugin categories */}
          <Reveal delay={0.1}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {[
                { label: "Import", count: 12, icon: Upload, desc: "ChatGPT, Kindle, YouTube, Notion, Reddit, Twitter & more" },
                { label: "Analysis", count: 6, icon: Search, desc: "Mind maps, sentiment, gaps, contradictions, evolution" },
                { label: "Creation", count: 6, icon: PenTool, desc: "Flashcards, blog, newsletter, resume, learning paths" },
                { label: "Export", count: 4, icon: ArrowRight, desc: "Anki, Obsidian, Notion, Markdown" },
                { label: "AI Tools", count: 5, icon: Zap, desc: "Voice, vision, RAG, multi-language, domains" },
              ].map((cat) => (
                <div key={cat.label} className="rounded-xl bg-zinc-900/50 border border-zinc-800/50 p-4 hover:border-zinc-700/60 transition-colors group">
                  <div className="flex items-center gap-2 mb-3">
                    <cat.icon className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                    <span className="text-[13px] font-semibold text-zinc-200">{cat.label}</span>
                    <span className="ml-auto text-[11px] text-zinc-600 tabular-nums">{cat.count}</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 leading-[1.6]">{cat.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Community message */}
          <Reveal delay={0.2}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
              <div className="flex items-center gap-2 text-[13px] text-zinc-500">
                <GitBranch className="w-3.5 h-3.5" />
                <span>Open source plugin SDK</span>
              </div>
              <div className="flex items-center gap-2 text-[13px] text-zinc-500">
                <Users className="w-3.5 h-3.5" />
                <span>Community-built plugins welcome</span>
              </div>
              <div className="flex items-center gap-2 text-[13px] text-zinc-500">
                <Puzzle className="w-3.5 h-3.5" />
                <span>Install only what you need</span>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.25}>
            <div className="mt-8 text-center">
              <Link href="/app/plugins">
                <button className="h-9 px-5 rounded-lg border border-zinc-800 text-[13px] font-medium text-zinc-400 hover:border-zinc-600 hover:text-white transition-all inline-flex items-center gap-2">
                  Explore all plugins <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ CAPABILITIES — what it actually does ═══════ */}
      <section className="border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-6 py-20 md:py-28">
          <Reveal>
            <p className="text-[12px] font-semibold text-teal-400 tracking-[0.1em] uppercase mb-3">Capabilities</p>
            <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.03em] mb-14">
              Not a notebook. <span className="text-zinc-500">An intelligence layer.</span>
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-x-16 gap-y-10">
            {[
              {
                icon: MessageSquare,
                title: "Chat with your knowledge",
                desc: "Ask questions. Get synthesized answers from your own data with source citations. Supports OpenAI, Gemini, Ollama, OpenRouter, or any compatible API.",
              },
              {
                icon: Fingerprint,
                title: "Knowledge fingerprint",
                desc: "Interactive 3D visualization of your mind's topology. See clusters, connections, and blind spots in your thinking.",
              },
              {
                icon: AlertTriangle,
                title: "Contradiction detection",
                desc: "Surfaces where your own thinking conflicts across time. Your 2024 self disagrees with your 2025 self — MindStore finds it.",
              },
              {
                icon: Layers,
                title: "Auto-generate flashcards",
                desc: "AI creates flashcard decks from your knowledge. Spaced repetition review built in. Learn from your own brain.",
              },
              {
                icon: Heart,
                title: "Sentiment & evolution",
                desc: "Track how your interests evolve. See emotional patterns across years of thinking. Topic evolution over time.",
              },
              {
                icon: Target,
                title: "Knowledge gap analysis",
                desc: "AI analyzes what you know and maps what's missing. Personalized learning suggestions based on your actual knowledge.",
              },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 0.05}>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                    <f.icon className="w-4 h-4 text-zinc-500" />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold text-zinc-200 tracking-[-0.01em]">{f.title}</h3>
                    <p className="text-[13px] text-zinc-500 mt-1.5 leading-[1.7]">{f.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ IMPORT — clean, no fluff ═══════ */}
      <section className="border-t border-white/[0.04] bg-[#0a0a0c]">
        <div className="max-w-5xl mx-auto px-6 py-20 md:py-28">
          <div className="grid md:grid-cols-[1fr_1.3fr] gap-12 md:gap-16 items-center">
            <div>
              <Reveal>
                <p className="text-[12px] font-semibold text-teal-400 tracking-[0.1em] uppercase mb-3">Universal Import</p>
                <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.03em]">
                  Every source.{" "}
                  <span className="text-zinc-500">One search.</span>
                </h2>
              </Reveal>
              <Reveal delay={0.08}>
                <p className="text-[14px] text-zinc-500 mt-4 leading-[1.75]">
                  12 built-in importers. Drag & drop files, paste URLs, or connect services.
                  Your scattered knowledge, unified and searchable by meaning.
                </p>
              </Reveal>
            </div>
            <Reveal delay={0.1}>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-px bg-zinc-800/30 rounded-xl overflow-hidden">
                {[
                  "ChatGPT", "Kindle", "YouTube", "Notion",
                  "Obsidian", "Reddit", "PDF/EPUB", "Twitter",
                  "Telegram", "Pocket", "Spotify", "Readwise",
                ].map((name) => (
                  <div key={name} className="bg-[#0a0a0c] px-4 py-3.5 text-center">
                    <p className="text-[12px] font-medium text-zinc-300">{name}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════ OPEN SOURCE TRUST ═══════ */}
      <section className="border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-6 py-20 md:py-28">
          <div className="text-center mb-14">
            <Reveal>
              <p className="text-[12px] font-semibold text-teal-400 tracking-[0.1em] uppercase mb-3">Open Source</p>
              <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.03em]">
                Community trusted. Actively developed.
              </h2>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="text-[14px] text-zinc-500 mt-3 max-w-lg mx-auto leading-[1.7]">
                MIT licensed. Full source code. Every commit DCO-signed. 
                Governance, security policy, and contribution guide from day one.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.12}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 text-center">
              {[
                { value: 336, suffix: "", label: "Tests passing" },
                { value: 103, suffix: "", label: "Pages of docs" },
                { value: 35, suffix: "", label: "Built-in plugins" },
                { value: 66, suffix: "", label: "API endpoints" },
              ].map((s, i) => (
                <div key={s.label}>
                  <p className="text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold tracking-[-0.03em] tabular-nums">
                    <Counter end={s.value} suffix={s.suffix} />
                  </p>
                  <p className="text-[12px] text-zinc-600 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="mt-12 grid sm:grid-cols-3 gap-6">
              {[
                { icon: Lock, title: "Self-hosted & private", desc: "Your data stays on your server. No analytics, no tracking, no third-party access." },
                { icon: Globe, title: "Bring your own AI", desc: "Gemini (free), OpenAI, Ollama (local), OpenRouter, or any OpenAI-compatible endpoint." },
                { icon: Puzzle, title: "Extensible by design", desc: "Plugin SDK for community extensions. New importers, analyzers, and exporters ship weekly." },
              ].map((p) => (
                <div key={p.title} className="text-center">
                  <p.icon className="w-5 h-5 text-zinc-600 mx-auto mb-3" />
                  <h3 className="text-[14px] font-semibold text-zinc-200">{p.title}</h3>
                  <p className="text-[12px] text-zinc-500 mt-1.5 leading-[1.7]">{p.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ CTA ═══════ */}
      <section className="border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-6 py-20 md:py-28 text-center">
          <Reveal>
            <MindStoreLogo className="w-14 h-14 mx-auto mb-6 opacity-30" />
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="text-[clamp(1.5rem,3.5vw,2.5rem)] font-bold tracking-[-0.03em]">
              Start building your knowledge OS.
            </h2>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="text-[14px] text-zinc-500 mt-3">
              Free. Private. No sign-up required. No credit card.
            </p>
          </Reveal>
          <Reveal delay={0.18}>
            <div className="flex flex-wrap gap-3 justify-center mt-8">
              <Link href="/app">
                <button className="h-11 px-8 rounded-xl bg-zinc-100 text-zinc-900 text-[14px] font-semibold hover:bg-white transition-all active:scale-[0.97]">
                  Open MindStore <ArrowRight className="w-4 h-4 inline ml-1" />
                </button>
              </Link>
              <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer">
                <button className="h-11 px-7 rounded-xl border border-zinc-800 text-[14px] font-medium text-zinc-400 hover:border-zinc-600 hover:text-white transition-all active:scale-[0.97]">
                  View on GitHub
                </button>
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="border-t border-white/[0.04] py-8">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-zinc-700">
            <div className="flex items-center gap-3">
              <MindStoreLogoMono className="w-3.5 h-3.5" />
              <span>MindStore</span>
              <span className="text-zinc-800">·</span>
              <span>MIT License</span>
              <span className="text-zinc-800">·</span>
              <span>Open Source</span>
            </div>
            <div className="flex items-center gap-5">
              <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">GitHub</a>
              <Link href="/docs" className="hover:text-zinc-400 transition-colors">Docs</Link>
              <Link href="/app/plugins" className="hover:text-zinc-400 transition-colors">Plugins</Link>
              <a href="https://github.com/WarriorSushi" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">WarriorSushi</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
