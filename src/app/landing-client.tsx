"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight, Upload, MessageSquare, Search,
  Fingerprint, Network, Layers, Heart, Target,
  PenTool, Route, Mail, Mic, Camera,
  Lock, Globe, Zap, AlertTriangle,
  BookOpen, FileText, Dna,
} from "lucide-react";
import { MindStoreLogo, MindStoreLogoMono } from "@/components/MindStoreLogo";

/* ═══════════════════════════════════════════
   MindStore Landing Page
   
   Design direction: Editorial luxury. 
   Inspired by: Stripe's annual letters, Linear's homepage,
   Arc's visual identity, Apple product pages.
   
   NOT: Card grids. Not SaaS template. Not "AI slop."
   
   Typography: Instrument Serif (display) + Plus Jakarta Sans (body)
   Palette: OLED black base, teal accent used SPARINGLY (10% rule)
   Layout: Asymmetric, editorial, generous whitespace
   Motion: Scroll-driven reveals, no bounce/elastic
   ═══════════════════════════════════════════ */

function useInView(threshold = 0.15) {
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
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: `opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

/* ─── Number counter for stats ─── */
function Counter({ end, suffix = "" }: { end: number; suffix?: string }) {
  const { ref, visible } = useInView();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let frame: number;
    const duration = 1200;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4); // ease-out-quart
      setCount(Math.round(eased * end));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [visible, end]);
  return <span ref={ref}>{count}{suffix}</span>;
}

export function LandingClient() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "MindStore",
    applicationCategory: "ProductivityApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description: "The personal knowledge operating system. Import from 12+ sources, chat with your knowledge, discover hidden connections. 35 plugins, MCP protocol, MIT licensed.",
  };

  return (
    <div className="min-h-screen bg-[#08080a] text-zinc-100 selection:bg-teal-500/20 selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ═══════ NAV ═══════ */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#08080a]/70 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <MindStoreLogo className="w-6 h-6" />
            <span className="font-semibold text-[14px] tracking-[-0.02em] text-zinc-200">MindStore</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/docs" className="text-[13px] text-zinc-500 hover:text-zinc-200 transition-colors hidden sm:block">Docs</Link>
            <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer" className="text-[13px] text-zinc-500 hover:text-zinc-200 transition-colors hidden sm:block">GitHub</a>
            <Link href="/app">
              <button className="h-8 px-4 rounded-lg bg-zinc-100 text-[#08080a] text-[13px] font-semibold hover:bg-white transition-colors active:scale-[0.97]">
                Open App
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══════ HERO ═══════ */}
      <section className="relative pt-32 pb-24 md:pt-44 md:pb-40 overflow-hidden">
        {/* Subtle teal glow — NOT neon, just a whisper */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-teal-500/[0.03] blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative max-w-[1200px] mx-auto px-6">
          <Reveal>
            <p className="text-[13px] text-teal-400 font-medium tracking-[0.08em] uppercase mb-6">
              Open source · MIT licensed · 35 plugins
            </p>
          </Reveal>
          
          <Reveal delay={0.1}>
            <h1 className="text-[clamp(2.5rem,6vw,5rem)] font-serif font-normal leading-[1.05] tracking-[-0.03em] max-w-3xl">
              The operating system{" "}
              <span className="italic text-zinc-400">for everything</span>{" "}
              you know.
            </h1>
          </Reveal>

          <Reveal delay={0.2}>
            <p className="text-[17px] md:text-[19px] text-zinc-500 mt-8 max-w-xl leading-[1.75]">
              MindStore ingests your entire digital life — conversations, books, articles, 
              notes, podcasts — and turns it into a queryable intelligence layer. 
              Not a notebook. Not a chatbot. A <em className="text-zinc-300 not-italic font-medium">knowledge operating system</em>.
            </p>
          </Reveal>

          <Reveal delay={0.3}>
            <div className="flex flex-wrap gap-3 mt-10">
              <Link href="/app">
                <button className="h-12 px-8 rounded-xl bg-zinc-100 text-[#08080a] text-[15px] font-semibold hover:bg-white transition-all active:scale-[0.97]">
                  Get Started — Free
                </button>
              </Link>
              <Link href="/app?demo=true">
                <button className="h-12 px-8 rounded-xl border border-zinc-800 text-[15px] font-medium text-zinc-300 hover:border-zinc-600 hover:text-white transition-all active:scale-[0.97]">
                  Try Demo
                </button>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ STATS BAR — editorial, not cards ═══════ */}
      <section className="border-t border-white/[0.04]">
        <div className="max-w-[1200px] mx-auto px-6 py-16 md:py-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {[
              { value: 33, suffix: "", label: "Plugins" },
              { value: 12, suffix: "+", label: "Import sources" },
              { value: 336, suffix: "", label: "Tests passing" },
              { value: 103, suffix: "", label: "Pages of docs" },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i * 0.1}>
                <div>
                  <p className="text-[clamp(2rem,4vw,3.5rem)] font-serif font-normal tracking-[-0.03em] text-zinc-100 tabular-nums">
                    <Counter end={s.value} suffix={s.suffix} />
                  </p>
                  <p className="text-[13px] text-zinc-600 mt-1 tracking-[0.02em]">{s.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ THE PITCH — asymmetric editorial ═══════ */}
      <section className="border-t border-white/[0.04]">
        <div className="max-w-[1200px] mx-auto px-6 py-24 md:py-32">
          <div className="grid md:grid-cols-[1.2fr_1fr] gap-16 md:gap-24 items-start">
            <div>
              <Reveal>
                <p className="text-[13px] text-teal-400 font-medium tracking-[0.08em] uppercase mb-4">Why MindStore</p>
              </Reveal>
              <Reveal delay={0.1}>
                <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] font-serif font-normal leading-[1.15] tracking-[-0.02em]">
                  Your AI conversations disappear. Your highlights rot in Kindle. Your bookmarks collect dust.
                </h2>
              </Reveal>
              <Reveal delay={0.2}>
                <p className="text-[15px] text-zinc-500 mt-6 leading-[1.8] max-w-lg">
                  MindStore unifies every source of knowledge into a single semantic layer. 
                  Import once. Search by meaning forever. Ask questions and get answers pulled from 
                  <em> your own thinking</em> — not the internet.
                </p>
              </Reveal>
            </div>
            <div className="space-y-6 md:pt-16">
              {[
                { icon: Search, title: "Semantic search", desc: "Find ideas by meaning, not keywords. Ask 'what did I learn about pricing strategy?' and get real answers." },
                { icon: AlertTriangle, title: "Contradiction detection", desc: "Your 2024 self disagrees with your 2025 self. MindStore finds it." },
                { icon: Fingerprint, title: "Knowledge fingerprint", desc: "A 3D topology of your mind. See where you're deep, where you're shallow, where you're blind." },
              ].map((f, i) => (
                <Reveal key={f.title} delay={i * 0.1}>
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                      <f.icon className="w-4 h-4 text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-zinc-200">{f.title}</p>
                      <p className="text-[13px] text-zinc-500 mt-1 leading-[1.7]">{f.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ IMPORT UNIVERSE ═══════ */}
      <section className="border-t border-white/[0.04] bg-[#0a0a0c]">
        <div className="max-w-[1200px] mx-auto px-6 py-24 md:py-32">
          <Reveal>
            <p className="text-[13px] text-teal-400 font-medium tracking-[0.08em] uppercase mb-4">Universal import</p>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] font-serif font-normal leading-[1.15] tracking-[-0.02em] max-w-2xl">
              Twelve importers. Every corner of your digital life.
            </h2>
          </Reveal>
          
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-px bg-white/[0.04] rounded-2xl overflow-hidden">
            {[
              { name: "ChatGPT", desc: "ZIP export → searchable in 30s" },
              { name: "Kindle", desc: "Highlights & notes" },
              { name: "YouTube", desc: "Transcripts from any video" },
              { name: "Notion", desc: "Full workspace export" },
              { name: "Obsidian", desc: "Vault import with links" },
              { name: "Reddit", desc: "Saved posts & comments" },
              { name: "PDF & EPUB", desc: "Books, papers, documents" },
              { name: "Twitter", desc: "Bookmarks & threads" },
              { name: "Telegram", desc: "Saved messages" },
              { name: "Pocket", desc: "Read-later archive" },
              { name: "Spotify", desc: "Podcast transcripts" },
              { name: "Readwise", desc: "All your highlights" },
            ].map((src, i) => (
              <Reveal key={src.name} delay={i * 0.03}>
                <div className="bg-[#0a0a0c] p-5 md:p-6 h-full">
                  <p className="text-[14px] font-semibold text-zinc-200">{src.name}</p>
                  <p className="text-[12px] text-zinc-600 mt-1">{src.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.3}>
            <p className="text-[13px] text-zinc-600 mt-6">
              Plus voice memos, images, URLs, bookmarks, and plain text. Drag and drop anything.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ═══════ THE ENGINE — what makes it different ═══════ */}
      <section className="border-t border-white/[0.04]">
        <div className="max-w-[1200px] mx-auto px-6 py-24 md:py-32">
          <Reveal>
            <p className="text-[13px] text-teal-400 font-medium tracking-[0.08em] uppercase mb-4">Intelligence layer</p>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] font-serif font-normal leading-[1.15] tracking-[-0.02em] max-w-2xl mb-16">
              Not storage. <span className="italic text-zinc-400">Understanding.</span>
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-px bg-white/[0.04] rounded-2xl overflow-hidden">
            {[
              {
                title: "Chat with your mind",
                desc: "Ask questions in natural language. Get answers synthesized from your own knowledge, with source citations. Supports OpenAI, Gemini, Ollama, OpenRouter, or any OpenAI-compatible API.",
                detail: "Multi-provider · Streaming · Citations",
              },
              {
                title: "Create from knowledge",
                desc: "Auto-generate flashcards from what you've learned. Write blog posts from your own ideas. Build newsletters, resumes, learning paths — all grounded in your actual knowledge.",
                detail: "Flashcards · Blog · Newsletter · Resume",
              },
              {
                title: "Analyze your thinking",
                desc: "Track how your interests evolve. See sentiment patterns across years. Detect knowledge gaps. Find contradictions in your own reasoning. Map your mind's topology.",
                detail: "Evolution · Sentiment · Gaps · Mind maps",
              },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 0.1}>
                <div className="bg-[#08080a] p-8 md:p-10 h-full flex flex-col">
                  <h3 className="text-[18px] font-semibold tracking-[-0.01em]">{f.title}</h3>
                  <p className="text-[13px] text-zinc-500 mt-3 leading-[1.75] flex-1">{f.desc}</p>
                  <p className="text-[11px] text-zinc-700 mt-6 tracking-[0.02em] font-medium">{f.detail}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ MCP — the protocol story ═══════ */}
      <section className="border-t border-white/[0.04] bg-[#0a0a0c]">
        <div className="max-w-[1200px] mx-auto px-6 py-24 md:py-32">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <Reveal>
                <p className="text-[13px] text-teal-400 font-medium tracking-[0.08em] uppercase mb-4">MCP Protocol</p>
              </Reveal>
              <Reveal delay={0.1}>
                <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] font-serif font-normal leading-[1.15] tracking-[-0.02em]">
                  Your mind as a tool for any AI.
                </h2>
              </Reveal>
              <Reveal delay={0.2}>
                <p className="text-[15px] text-zinc-500 mt-6 leading-[1.8]">
                  MindStore speaks MCP (Model Context Protocol). Connect Claude, ChatGPT, Cursor, 
                  or any MCP-compatible AI and give it access to <em>your</em> knowledge.
                </p>
              </Reveal>
              <Reveal delay={0.3}>
                <div className="mt-8 space-y-3">
                  {[
                    { fn: "search_mind", desc: "Semantic search across all knowledge" },
                    { fn: "get_profile", desc: "Your AI-generated knowledge profile" },
                    { fn: "get_context", desc: "Relevant context for any topic" },
                  ].map((t) => (
                    <div key={t.fn} className="flex items-center gap-3">
                      <code className="text-[12px] font-mono text-teal-400/80 bg-teal-500/[0.06] px-2 py-1 rounded-md border border-teal-500/10">{t.fn}</code>
                      <span className="text-[13px] text-zinc-600">{t.desc}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
            <Reveal delay={0.2}>
              <div className="rounded-xl bg-[#0d0d0f] border border-zinc-800/60 p-6 font-mono text-[13px] leading-relaxed">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-800/40">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                  <span className="text-[10px] text-zinc-700 ml-2">claude_desktop_config.json</span>
                </div>
                <pre className="text-zinc-500"><code>{`{
  `}<span className="text-zinc-400">{`"mcpServers"`}</span>{`: {
    `}<span className="text-zinc-400">{`"mindstore"`}</span>{`: {
      `}<span className="text-zinc-400">{`"url"`}</span>{`: `}<span className="text-teal-400/70">{`"https://mindstore.org/api/mcp"`}</span>{`
    }
  }
}`}</code></pre>
                <p className="text-[11px] text-zinc-700 mt-4 font-sans">Three lines. That&apos;s it.</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════ PRINCIPLES — editorial, not cards ═══════ */}
      <section className="border-t border-white/[0.04]">
        <div className="max-w-[1200px] mx-auto px-6 py-24 md:py-32">
          <Reveal>
            <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] font-serif font-normal leading-[1.15] tracking-[-0.02em] max-w-2xl mb-16">
              Built on principles, not trends.
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-x-16 gap-y-12">
            {[
              {
                title: "Your data. Your server.",
                desc: "Self-hosted. Nothing phones home. All AI calls are server-side between you and your chosen provider. No analytics, no tracking, no third-party access.",
              },
              {
                title: "Bring your own AI.",
                desc: "Gemini (free), OpenAI, Ollama (local), OpenRouter (200+ models), or any OpenAI-compatible endpoint. No vendor lock-in. Switch providers without losing anything.",
              },
              {
                title: "Open source. MIT licensed.",
                desc: "Full source code. 336 tests. 103 pages of documentation. DCO-signed commits. Governance, security policy, contribution guide. Built in public.",
              },
              {
                title: "Plugins are first-class.",
                desc: "33 built-in plugins across import, analysis, creation, export, and AI. Every one free. Plugin SDK for community extensions. MCP for protocol-level integration.",
              },
            ].map((p, i) => (
              <Reveal key={p.title} delay={i * 0.08}>
                <div>
                  <h3 className="text-[16px] font-semibold text-zinc-200 tracking-[-0.01em]">{p.title}</h3>
                  <p className="text-[14px] text-zinc-500 mt-2 leading-[1.75]">{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ CTA ═══════ */}
      <section className="border-t border-white/[0.04]">
        <div className="max-w-[1200px] mx-auto px-6 py-24 md:py-32 text-center">
          <Reveal>
            {/* Large logo mark */}
            <div className="flex justify-center mb-8">
              <MindStoreLogo className="w-16 h-16 md:w-20 md:h-20 opacity-40" />
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="text-[clamp(1.75rem,4vw,3rem)] font-serif font-normal leading-[1.1] tracking-[-0.02em]">
              Start searching your mind.
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="text-[15px] text-zinc-500 mt-4 max-w-md mx-auto">
              Free. Private. Self-hosted. No credit card. No sign-up required.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="flex flex-wrap gap-3 justify-center mt-8">
              <Link href="/app">
                <button className="h-12 px-10 rounded-xl bg-zinc-100 text-[#08080a] text-[15px] font-semibold hover:bg-white transition-all active:scale-[0.97]">
                  Open MindStore
                </button>
              </Link>
              <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer">
                <button className="h-12 px-8 rounded-xl border border-zinc-800 text-[15px] font-medium text-zinc-400 hover:border-zinc-600 hover:text-white transition-all active:scale-[0.97]">
                  View Source
                </button>
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="border-t border-white/[0.04] py-8">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-zinc-700">
            <div className="flex items-center gap-3">
              <MindStoreLogoMono className="w-4 h-4" />
              <span>MindStore</span>
              <span>·</span>
              <span>MIT License</span>
            </div>
            <div className="flex items-center gap-5">
              <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">GitHub</a>
              <Link href="/docs" className="hover:text-zinc-400 transition-colors">Docs</Link>
              <a href="https://github.com/WarriorSushi" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">Built by WarriorSushi</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
