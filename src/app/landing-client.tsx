"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight, Upload, MessageSquare, Search,
  Fingerprint, Network, Layers, Heart, Target,
  PenTool, Mic, Lock, Globe, Zap, AlertTriangle,
  Puzzle, GitBranch, ChevronDown, Sparkles,
  TrendingUp, BookOpen, FileText, Eye,
  Terminal, Database, Cpu, Radio,
  type LucideIcon,
} from "lucide-react";
import { MindStoreLogo, MindStoreLogoMono } from "@/components/MindStoreLogo";

/* ═══════════════════════════════════════════
   MindStore Landing v5 — "Show, don't tell"
   
   For dev early adopters. Visual. Scannable. Impressive.
   Personality through DESIGN, not words.
   ═══════════════════════════════════════════ */

function useInView(t = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); o.unobserve(el); } }, { threshold: t });
    o.observe(el);
    return () => o.disconnect();
  }, [t]);
  return { ref, visible: v };
}

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useInView();
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(24px)",
      transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
    }}>{children}</div>
  );
}

/* Typing animation for the terminal */
function TypeWriter({ lines, startDelay = 0 }: { lines: { text: string; color?: string; delay: number }[]; startDelay?: number }) {
  const { ref, visible } = useInView();
  const [visibleLines, setVisibleLines] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let i = 0;
    const timers: NodeJS.Timeout[] = [];
    lines.forEach((line, idx) => {
      timers.push(setTimeout(() => setVisibleLines(idx + 1), (startDelay + line.delay) * 1000));
    });
    return () => timers.forEach(clearTimeout);
  }, [visible, lines, startDelay]);
  return (
    <div ref={ref} className="font-mono text-[12px] md:text-[13px] leading-[1.8]">
      {lines.slice(0, visibleLines).map((l, i) => (
        <div key={i} className={l.color || "text-zinc-500"} style={{
          animation: "fadeSlideIn 0.3s ease-out forwards",
        }}>{l.text}</div>
      ))}
      {visibleLines < lines.length && visibleLines > 0 && (
        <span className="inline-block w-2 h-4 bg-teal-400 animate-pulse ml-0.5" />
      )}
    </div>
  );
}

/* Animated counter */
function Counter({ end, suffix = "" }: { end: number; suffix?: string }) {
  const { ref, visible } = useInView();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let f: number;
    const dur = 1000, start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      setCount(Math.round((1 - Math.pow(1 - p, 4)) * end));
      if (p < 1) f = requestAnimationFrame(step);
    };
    f = requestAnimationFrame(step);
    return () => cancelAnimationFrame(f);
  }, [visible, end]);
  return <span ref={ref}>{count}{suffix}</span>;
}

/* ─── Feature card with hover expand ─── */
function FeatureCard({ icon: Icon, color, title, desc, tags }: {
  icon: LucideIcon; color: string; title: string; desc: string; tags: string[];
}) {
  return (
    <div className="group relative rounded-2xl bg-zinc-900/40 border border-zinc-800/50 p-5 hover:border-zinc-700/60 hover:bg-zinc-900/60 transition-all duration-300">
      <Icon className={`w-5 h-5 ${color} mb-3 group-hover:scale-110 transition-transform duration-300`} />
      <h3 className="text-[14px] font-semibold tracking-[-0.01em]">{title}</h3>
      <p className="text-[12px] text-zinc-500 mt-1.5 leading-[1.65]">{desc}</p>
      <div className="flex flex-wrap gap-1.5 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        {tags.map(t => (
          <span key={t} className="text-[9px] font-medium text-zinc-600 bg-zinc-800/60 px-2 py-0.5 rounded-full">{t}</span>
        ))}
      </div>
    </div>
  );
}

/* ─── Product Preview — CSS-rendered app mockups ─── */
function ProductPreview() {
  const [activeTab, setActiveTab] = useState(0);
  const tabs = [
    { label: "Dashboard", icon: "◈" },
    { label: "Chat", icon: "◉" },
    { label: "Explore", icon: "◎" },
  ];

  return (
    <section className="border-t border-white/[0.04] overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 py-16 md:py-24">
        <Reveal>
          <p className="text-[12px] font-semibold text-teal-400 tracking-[0.1em] uppercase mb-3">See it in action</p>
          <h2 className="text-[clamp(1.4rem,2.5vw,2rem)] font-bold tracking-[-0.03em] mb-3">
            Not another note app. A knowledge OS.
          </h2>
          <p className="text-[13px] text-zinc-500 max-w-lg leading-[1.7] mb-8">
            Every feature designed for depth. Every pixel considered.
          </p>
        </Reveal>

        {/* Tab switcher */}
        <Reveal delay={0.06}>
          <div className="flex gap-1 mb-6 bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-1 w-fit">
            {tabs.map((tab, i) => (
              <button
                key={tab.label}
                onClick={() => setActiveTab(i)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
                  activeTab === i
                    ? "bg-white/[0.08] text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <span className="text-[11px]">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </Reveal>

        {/* App mockup frame */}
        <Reveal delay={0.1}>
          <div className="rounded-2xl bg-[#0c0c0e] border border-zinc-800/50 overflow-hidden shadow-2xl shadow-black/40">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800/40 bg-zinc-900/20">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
              </div>
              <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center gap-2 px-4 py-1 rounded-lg bg-zinc-900/60 border border-zinc-800/30">
                  <Lock className="w-3 h-3 text-zinc-600" />
                  <span className="text-[11px] text-zinc-500 font-mono">mindstore.org/app</span>
                </div>
              </div>
              <div className="w-12" />
            </div>

            {/* App content — CSS rendered mockup */}
            <div className="flex min-h-[340px] md:min-h-[420px]">
              {/* Sidebar mockup */}
              <div className="w-[180px] md:w-[200px] border-r border-zinc-800/40 bg-[#0a0a0c] p-3 hidden sm:block">
                <div className="flex items-center gap-2 mb-5 px-1">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-teal-500 to-sky-600 flex items-center justify-center">
                    <span className="text-[10px] text-white font-bold">M</span>
                  </div>
                  <span className="text-[12px] font-semibold text-zinc-200">MindStore</span>
                </div>
                {[
                  { label: "Dashboard", active: activeTab === 0 },
                  { label: "Chat", active: activeTab === 1 },
                  { label: "Explore", active: activeTab === 2 },
                  { label: "Import", active: false },
                  { label: "Fingerprint", active: false },
                  { label: "Insights", active: false },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`px-2.5 py-1.5 rounded-lg text-[12px] mb-0.5 transition-colors ${
                      item.active
                        ? "bg-teal-500/10 text-teal-400 font-medium"
                        : "text-zinc-600 hover:text-zinc-400"
                    }`}
                  >
                    {item.label}
                  </div>
                ))}
                <div className="mt-4 pt-3 border-t border-zinc-800/40 space-y-0.5">
                  {["Flashcards", "Blog Writer", "Mind Map", "Collections"].map((p) => (
                    <div key={p} className="px-2.5 py-1.5 text-[11px] text-zinc-700">{p}</div>
                  ))}
                  <div className="px-2.5 py-1 text-[10px] text-zinc-700">+31 more plugins</div>
                </div>
              </div>

              {/* Main content area */}
              <div className="flex-1 p-5 md:p-6 overflow-hidden">
                {activeTab === 0 && <DashboardMockup />}
                {activeTab === 1 && <ChatMockup />}
                {activeTab === 2 && <ExploreMockup />}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* Mockup sub-components — pure CSS, no real data */
function DashboardMockup() {
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div>
        <p className="text-[16px] font-semibold tracking-[-0.01em] text-zinc-200">Good afternoon</p>
        <p className="text-[11px] text-zinc-600 mt-0.5">8,392 memories · last import 2h ago</p>
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: "Memories", value: "8,392", color: "text-teal-400" },
          { label: "Sources", value: "12", color: "text-sky-400" },
          { label: "Topics", value: "147", color: "text-emerald-400" },
          { label: "This Week", value: "+234", color: "text-amber-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-3">
            <p className="text-[10px] text-zinc-600">{s.label}</p>
            <p className={`text-[18px] font-bold tracking-tight ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
      {/* Search bar */}
      <div className="h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center px-3 gap-2">
        <Search className="w-3.5 h-3.5 text-zinc-600" />
        <span className="text-[12px] text-zinc-600">Search your knowledge...</span>
      </div>
      {/* Recent memories */}
      <div className="space-y-1.5">
        {[
          { title: "Pricing strategy for SaaS", source: "ChatGPT", time: "2h ago" },
          { title: "React Server Components deep dive", source: "ChatGPT", time: "5h ago" },
          { title: "The Bitter Lesson — Rich Sutton", source: "URL", time: "1d ago" },
        ].map((m) => (
          <div key={m.title} className="flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/[0.04] p-3">
            <div className="w-7 h-7 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0">
              <FileText className="w-3 h-3 text-teal-400/60" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-zinc-300 truncate">{m.title}</p>
              <p className="text-[10px] text-zinc-600">{m.source} · {m.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatMockup() {
  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300" style={{ minHeight: 300 }}>
      <div className="flex-1 space-y-4 pb-4">
        {/* User message */}
        <div className="flex justify-end">
          <div className="max-w-[75%] rounded-2xl rounded-br-md bg-teal-600/20 border border-teal-500/15 px-4 py-2.5">
            <p className="text-[12px] text-zinc-200 leading-relaxed">What did I learn about pricing strategy?</p>
          </div>
        </div>
        {/* AI response */}
        <div className="flex justify-start">
          <div className="max-w-[85%] space-y-2.5">
            <div className="rounded-2xl rounded-bl-md bg-white/[0.03] border border-white/[0.06] px-4 py-3">
              <p className="text-[12px] text-zinc-300 leading-[1.7]">
                Based on your conversations, you&apos;ve explored pricing extensively:
              </p>
              <ul className="mt-2 space-y-1 text-[11px] text-zinc-400 leading-relaxed">
                <li>• <strong className="text-zinc-300">Freemium</strong> works when marginal cost is near zero</li>
                <li>• <strong className="text-zinc-300">Value-based pricing</strong> beats cost-plus for SaaS</li>
                <li>• You noted YC&apos;s advice: &quot;charge more than you think&quot;</li>
              </ul>
            </div>
            {/* Citations */}
            <div className="flex gap-1.5 flex-wrap">
              {["ChatGPT · Mar 2025", "Kindle · Zero to One", "YouTube · YC Talk"].map((c) => (
                <span key={c} className="text-[9px] text-zinc-600 bg-zinc-900/60 border border-zinc-800/40 px-2 py-0.5 rounded-full">{c}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Input */}
      <div className="h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center px-3 gap-2 mt-auto">
        <span className="text-[12px] text-zinc-600 flex-1">Ask about your knowledge...</span>
        <div className="w-7 h-7 rounded-lg bg-teal-500/20 flex items-center justify-center">
          <ArrowRight className="w-3 h-3 text-teal-400" />
        </div>
      </div>
    </div>
  );
}

function ExploreMockup() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Search */}
      <div className="h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center px-3 gap-2">
        <Search className="w-3.5 h-3.5 text-zinc-600" />
        <span className="text-[12px] text-teal-400">machine learning</span>
        <span className="ml-auto text-[10px] text-zinc-600">12 results · 0.04s</span>
      </div>
      {/* Filter chips */}
      <div className="flex gap-1.5">
        {["All", "ChatGPT", "Kindle", "URLs", "Notes"].map((f, i) => (
          <span key={f} className={`text-[10px] px-2.5 py-1 rounded-lg border ${
            i === 0 ? "bg-teal-500/10 border-teal-500/20 text-teal-400 font-medium" : "bg-white/[0.02] border-white/[0.04] text-zinc-600"
          }`}>{f}</span>
        ))}
      </div>
      {/* Results */}
      <div className="space-y-1.5">
        {[
          { title: "Transformers vs RNNs — attention mechanism breakthrough", relevance: "98%", source: "ChatGPT" },
          { title: "Neural networks learn features hierarchically", relevance: "94%", source: "ChatGPT" },
          { title: "RAG paper summary — retrieval + generation", relevance: "91%", source: "PDF" },
          { title: "The Bitter Lesson — computation > hand-crafting", relevance: "87%", source: "URL" },
          { title: "Course notes: MIT 6.006 algorithms", relevance: "72%", source: "File" },
        ].map((r) => (
          <div key={r.title} className="flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 hover:border-white/[0.08] transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-zinc-300 truncate">{r.title}</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">{r.source}</p>
            </div>
            <span className="text-[10px] text-teal-400/60 font-mono shrink-0">{r.relevance}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LandingClient() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 selection:bg-teal-500/20 overflow-x-hidden">
      <style jsx global>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes pulse-line {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.4; }
        }
      `}</style>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "SoftwareApplication", name: "MindStore",
        applicationCategory: "ProductivityApplication", operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        description: "Personal knowledge OS. 35 plugins, 12+ sources, MCP protocol, MIT licensed.",
      }) }} />

      {/* ═══════ NAV ═══════ */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <MindStoreLogo className="w-6 h-6" />
            <span className="font-semibold text-[14px] tracking-[-0.02em]">MindStore</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/docs" className="text-[13px] text-zinc-500 hover:text-zinc-200 transition-colors hidden sm:block">Docs</Link>
            <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer" className="text-[13px] text-zinc-500 hover:text-zinc-200 transition-colors hidden sm:block">GitHub</a>
            <Link href="/app/plugins" className="text-[13px] text-zinc-500 hover:text-zinc-200 transition-colors hidden md:block">Plugins</Link>
            <Link href="/app">
              <button className="h-8 px-4 rounded-lg bg-zinc-100 text-zinc-900 text-[13px] font-semibold hover:bg-white transition-colors">Open App</button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══════ HERO — split layout, terminal demo ═══════ */}
      <section className="pt-28 pb-4 md:pt-36 md:pb-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-center">
            {/* Left — message */}
            <div>
              <Reveal>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/[0.08] border border-teal-500/15 text-[11px] font-medium text-teal-400 mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                  Open source · 35 plugins · MCP native
                </div>
              </Reveal>
              <Reveal delay={0.06}>
                <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-extrabold leading-[1.08] tracking-[-0.04em]">
                  Your knowledge.
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-sky-400 to-teal-300">
                    Searchable. Connected.
                  </span>
                  <br />
                  Supercharged.
                </h1>
              </Reveal>
              <Reveal delay={0.12}>
                <p className="text-[15px] text-zinc-400 mt-5 leading-[1.7] max-w-md">
                  Import from 12+ sources. Search by meaning. 
                  Chat with your own data. Connect any AI via MCP.
                </p>
              </Reveal>
              <Reveal delay={0.16}>
                <div className="flex flex-wrap gap-3 mt-7">
                  <Link href="/app">
                    <button className="h-11 px-7 rounded-xl bg-teal-500 hover:bg-teal-400 text-white text-[14px] font-semibold transition-all active:scale-[0.97] shadow-lg shadow-teal-500/20">
                      Get Started Free
                    </button>
                  </Link>
                  <Link href="/app?demo=true">
                    <button className="h-11 px-6 rounded-xl border border-zinc-800 text-[14px] font-medium text-zinc-300 hover:border-zinc-600 hover:text-white transition-all">
                      Live Demo
                    </button>
                  </Link>
                </div>
              </Reveal>
            </div>

            {/* Right — animated terminal showing the magic */}
            <Reveal delay={0.15}>
              <div className="rounded-2xl bg-[#0c0c0e] border border-zinc-800/50 overflow-hidden shadow-2xl shadow-black/30">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800/40 bg-zinc-900/20">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
                  </div>
                  <span className="text-[10px] text-zinc-600 ml-2 font-mono">mindstore</span>
                </div>
                <div className="p-5 min-h-[220px]">
                  <TypeWriter startDelay={0.8} lines={[
                    { text: "$ mindstore import chatgpt-export.zip", color: "text-zinc-300", delay: 0 },
                    { text: "  ✓ 1,247 conversations parsed", color: "text-emerald-400/70", delay: 0.6 },
                    { text: "  ✓ 8,392 memories created", color: "text-emerald-400/70", delay: 1.0 },
                    { text: "  ✓ embeddings generated (gemini-free)", color: "text-emerald-400/70", delay: 1.5 },
                    { text: "", delay: 1.8 },
                    { text: "$ mindstore search \"pricing strategy lessons\"", color: "text-zinc-300", delay: 2.0 },
                    { text: "  Found 12 relevant memories across 5 sources", color: "text-teal-400/70", delay: 2.6 },
                    { text: "  ┌ ChatGPT Mar 2025: \"Freemium works when...\"", color: "text-zinc-500", delay: 3.0 },
                    { text: "  ├ Kindle: Zero to One highlight #47", color: "text-zinc-500", delay: 3.3 },
                    { text: "  └ YouTube: Y Combinator pricing talk", color: "text-zinc-500", delay: 3.6 },
                  ]} />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════ TRUST BAR — compact, scannable ═══════ */}
      <section className="py-10 md:py-14">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal>
            <div className="flex flex-wrap justify-center gap-x-10 gap-y-4 text-center">
              {[
                { n: 35, s: "", l: "plugins" },
                { n: 12, s: "+", l: "importers" },
                { n: 336, s: "", l: "tests" },
                { n: 66, s: "", l: "API routes" },
                { n: 103, s: "", l: "doc pages" },
              ].map((s) => (
                <div key={s.l} className="min-w-[80px]">
                  <p className="text-[24px] md:text-[28px] font-bold tracking-[-0.03em] tabular-nums">
                    <Counter end={s.n} suffix={s.s} />
                  </p>
                  <p className="text-[11px] text-zinc-600">{s.l}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ PRODUCT PREVIEW — show the actual app ═══════ */}
      <ProductPreview />

      {/* ═══════ CHATGPT IMPORT CALLOUT ═══════ */}
      <section className="border-t border-white/[0.04] bg-gradient-to-b from-emerald-500/[0.02] to-transparent">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-24">
          <div className="grid md:grid-cols-[1fr_1.2fr] gap-10 md:gap-16 items-center">
            <div>
              <Reveal>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/[0.08] border border-emerald-500/15 text-[11px] font-medium text-emerald-400 mb-5">
                  <Upload className="w-3 h-3" />
                  Most popular import
                </div>
                <h2 className="text-[clamp(1.4rem,2.5vw,2rem)] font-bold tracking-[-0.03em]">
                  Import your ChatGPT
                  <br />
                  <span className="text-emerald-400">in 30 seconds.</span>
                </h2>
              </Reveal>
              <Reveal delay={0.08}>
                <p className="text-[13px] text-zinc-500 mt-4 leading-[1.7] max-w-md">
                  Every conversation you&apos;ve ever had with ChatGPT — searchable, connected,
                  and ready to power your AI tools. Export from OpenAI, drop the file, done.
                </p>
              </Reveal>
              <Reveal delay={0.12}>
                <div className="mt-6 space-y-3">
                  {[
                    { step: "1", text: "Go to ChatGPT → Settings → Data controls → Export data" },
                    { step: "2", text: "Upload the ZIP to MindStore" },
                    { step: "3", text: "Search, chat, and discover connections instantly" },
                  ].map((s) => (
                    <div key={s.step} className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-400 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {s.step}
                      </span>
                      <p className="text-[13px] text-zinc-400 leading-relaxed">{s.text}</p>
                    </div>
                  ))}
                </div>
              </Reveal>
              <Reveal delay={0.16}>
                <Link href="/app/import" className="inline-flex items-center gap-2 mt-6 h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-[13px] font-semibold text-white transition-all active:scale-[0.97]">
                  <Upload className="w-3.5 h-3.5" />
                  Import Now
                </Link>
              </Reveal>
            </div>

            {/* Visual — import flow mockup */}
            <Reveal delay={0.1}>
              <div className="rounded-2xl bg-[#0c0c0e] border border-zinc-800/50 overflow-hidden shadow-2xl shadow-black/30">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800/40 bg-zinc-900/20">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-700/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-700/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-700/60" />
                  </div>
                  <span className="text-[10px] text-zinc-600 ml-2 font-mono">MindStore — Import</span>
                </div>
                <div className="p-6 space-y-4">
                  {/* Drop zone mockup */}
                  <div className="border-2 border-dashed border-emerald-500/25 rounded-2xl p-8 flex flex-col items-center gap-3 bg-emerald-500/[0.02]">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                      <Upload className="w-5 h-5 text-emerald-400" />
                    </div>
                    <p className="text-[13px] text-zinc-300 font-medium">conversations.json</p>
                    <p className="text-[11px] text-zinc-600">12.4 MB · ChatGPT export</p>
                  </div>
                  {/* Progress mockup */}
                  <div className="space-y-2.5">
                    {[
                      { label: "Parsing conversations", count: "1,247", done: true },
                      { label: "Creating memories", count: "8,392", done: true },
                      { label: "Generating embeddings", count: "8,392", done: true },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center">
                          <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <span className="text-[12px] text-zinc-400 flex-1">{item.label}</span>
                        <span className="text-[11px] text-emerald-400/70 font-mono">{item.count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-center pt-2">
                    <p className="text-[13px] text-emerald-400 font-medium">✨ Done in 28 seconds</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════ ARCHITECTURE DIAGRAM — visual, not text ═══════ */}
      <section className="border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-24">
          <Reveal>
            <p className="text-[12px] font-semibold text-teal-400 tracking-[0.1em] uppercase mb-3">How it works</p>
            <h2 className="text-[clamp(1.4rem,2.5vw,2rem)] font-bold tracking-[-0.03em] mb-12">
              Import → Embed → Search → Create
            </h2>
          </Reveal>

          {/* Visual pipeline */}
          <Reveal delay={0.1}>
            <div className="grid grid-cols-4 gap-0 items-stretch relative">
              {/* Connecting line */}
              <div className="absolute top-1/2 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-teal-500/30 via-sky-500/30 to-teal-500/30" style={{ animation: "pulse-line 3s ease-in-out infinite" }} />
              
              {[
                { icon: Upload, label: "Import", sub: "12+ sources", color: "text-teal-400", bg: "bg-teal-500/10 border-teal-500/20" },
                { icon: Cpu, label: "Embed", sub: "Semantic vectors", color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/20" },
                { icon: Search, label: "Search", sub: "By meaning", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
                { icon: Zap, label: "Create", sub: "35 plugins", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
              ].map((step, i) => (
                <div key={step.label} className="relative flex flex-col items-center text-center px-2">
                  <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl ${step.bg} border flex items-center justify-center mb-3 relative z-10`}>
                    <step.icon className={`w-5 h-5 md:w-6 md:h-6 ${step.color}`} />
                  </div>
                  <p className="text-[13px] font-semibold">{step.label}</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">{step.sub}</p>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Import sources — visual grid */}
          <Reveal delay={0.2}>
            <div className="mt-14 pt-10 border-t border-white/[0.04]">
              <p className="text-[11px] font-semibold text-zinc-500 tracking-[0.08em] uppercase mb-4">Importers</p>
              <div className="flex flex-wrap gap-2">
                {["ChatGPT", "Kindle", "YouTube", "Notion", "Obsidian", "Reddit", "PDF/EPUB", "Twitter", "Telegram", "Pocket", "Spotify", "Readwise", "Voice", "Images", "URLs", "Text"].map((s) => (
                  <span key={s} className="px-3 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800/40 text-[12px] text-zinc-400 font-medium hover:text-zinc-200 hover:border-zinc-700 transition-all cursor-default">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ MCP — the superpower ═══════ */}
      <section className="border-t border-white/[0.04] bg-gradient-to-b from-teal-500/[0.02] to-transparent">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div>
              <Reveal>
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-teal-500/[0.1] border border-teal-500/15 text-[10px] font-bold text-teal-400 tracking-widest uppercase mb-4">
                  <Radio className="w-3 h-3" />
                  MCP Native
                </div>
                <h2 className="text-[clamp(1.4rem,2.5vw,2rem)] font-bold tracking-[-0.03em]">
                  Give any AI access to your knowledge.
                </h2>
              </Reveal>
              <Reveal delay={0.08}>
                <p className="text-[13px] text-zinc-500 mt-3 leading-[1.7] max-w-md">
                  MindStore is a full MCP server. Claude, Cursor, ChatGPT — any MCP client 
                  gets your personal context. Three tools, three lines of config.
                </p>
              </Reveal>
              <Reveal delay={0.12}>
                <div className="mt-5 space-y-2">
                  {[
                    { fn: "search_mind", desc: "Semantic search" },
                    { fn: "get_profile", desc: "Knowledge profile" },
                    { fn: "get_context", desc: "Topic context" },
                  ].map((t) => (
                    <div key={t.fn} className="flex items-center gap-3">
                      <code className="text-[11px] font-mono text-teal-400/80 bg-teal-500/[0.06] px-2 py-0.5 rounded border border-teal-500/10 shrink-0">{t.fn}</code>
                      <span className="text-[12px] text-zinc-600">{t.desc}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
            <Reveal delay={0.1}>
              <div className="rounded-xl bg-[#0c0c0e] border border-zinc-800/50 overflow-hidden">
                <div className="flex items-center px-4 py-2.5 border-b border-zinc-800/40 bg-zinc-900/20">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-700/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-700/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-700/60" />
                  </div>
                  <span className="text-[10px] text-zinc-600 ml-3 font-mono">claude_desktop_config.json</span>
                </div>
                <div className="p-5 font-mono text-[13px] leading-[1.8]">
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

      {/* ═══════ SUPERPOWERS — feature grid, hover for detail ═══════ */}
      <section className="border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-24">
          <Reveal>
            <p className="text-[12px] font-semibold text-teal-400 tracking-[0.1em] uppercase mb-3">Superpowers</p>
            <h2 className="text-[clamp(1.4rem,2.5vw,2rem)] font-bold tracking-[-0.03em] mb-10">
              35 plugins. Each one a rabbit hole.
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Reveal delay={0.00}><FeatureCard icon={MessageSquare} color="text-sky-400" title="Chat with your mind" desc="Ask questions. Get answers from YOUR data with citations." tags={["OpenAI", "Gemini", "Ollama", "OpenRouter", "Streaming"]} /></Reveal>
            <Reveal delay={0.04}><FeatureCard icon={Fingerprint} color="text-teal-400" title="Knowledge fingerprint" desc="3D WebGL map of your mind's topology." tags={["WebGL", "Clustering", "Interactive", "Blind spots"]} /></Reveal>
            <Reveal delay={0.08}><FeatureCard icon={AlertTriangle} color="text-amber-400" title="Contradiction detector" desc="Past-you vs present-you. AI finds the conflicts." tags={["Cross-temporal", "AI analysis", "Resolution"]} /></Reveal>
            <Reveal delay={0.12}><FeatureCard icon={Layers} color="text-emerald-400" title="Flashcard maker" desc="Auto-generates decks from your knowledge. Spaced repetition." tags={["SRS", "Auto-generate", "Review tracking"]} /></Reveal>
            <Reveal delay={0.16}><FeatureCard icon={TrendingUp} color="text-sky-400" title="Topic evolution" desc="Watch your interests shift across months and years." tags={["Timeline", "Trends", "Topic tracking"]} /></Reveal>
            <Reveal delay={0.20}><FeatureCard icon={Heart} color="text-red-400" title="Sentiment timeline" desc="Emotional patterns across your entire knowledge history." tags={["NLP", "Patterns", "Temporal analysis"]} /></Reveal>
            <Reveal delay={0.24}><FeatureCard icon={Target} color="text-teal-400" title="Knowledge gaps" desc="AI maps what you know and what's missing." tags={["Gap analysis", "Suggestions", "Learning paths"]} /></Reveal>
            <Reveal delay={0.28}><FeatureCard icon={PenTool} color="text-amber-400" title="Blog writer" desc="Draft posts grounded in your actual knowledge." tags={["AI draft", "Your voice", "Export ready"]} /></Reveal>
            <Reveal delay={0.32}><FeatureCard icon={Network} color="text-sky-400" title="Mind maps" desc="AI-generated visual maps of connected topics." tags={["Clustering", "k-means", "Interactive"]} /></Reveal>
          </div>

          <Reveal delay={0.35}>
            <div className="mt-6 flex flex-wrap gap-1.5">
              {["Newsletter", "Resume", "Conversation Prep", "Learning Paths", "Voice Memos", "Vision/OCR", "Custom RAG", "Multi-language", "Domain Embeddings", "Anki Export", "Obsidian Sync", "Notion Sync", "Duplicate Detector", "Smart Collections"].map((p) => (
                <span key={p} className="text-[10px] text-zinc-600 bg-zinc-900/40 border border-zinc-800/30 px-2.5 py-1 rounded-full hover:text-zinc-400 hover:border-zinc-700 transition-all cursor-default">{p}</span>
              ))}
              <Link href="/app/plugins" className="text-[10px] text-teal-400 bg-teal-500/[0.06] border border-teal-500/10 px-2.5 py-1 rounded-full hover:bg-teal-500/[0.12] transition-all">
                All 35 →
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ OPEN & EXTENSIBLE ═══════ */}
      <section className="border-t border-white/[0.04] bg-[#0a0a0c]">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-24">
          <Reveal>
            <h2 className="text-[clamp(1.4rem,2.5vw,2rem)] font-bold tracking-[-0.03em] mb-3">
              Yours to own. Yours to extend.
            </h2>
            <p className="text-[13px] text-zinc-500 max-w-lg leading-[1.7] mb-10">
              MIT licensed. Plugin SDK. Community-built extensions welcome. 
              Self-hosted on your hardware. Your AI keys, your data, your rules.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Lock, title: "Self-hosted", desc: "Your server. Zero tracking. Full control." },
              { icon: Globe, title: "Any AI provider", desc: "Gemini (free), OpenAI, Ollama, OpenRouter." },
              { icon: Puzzle, title: "Plugin SDK", desc: "Build importers, analyzers, exporters." },
              { icon: GitBranch, title: "MIT open source", desc: "336 tests. 103 docs. DCO signed." },
            ].map((p, i) => (
              <Reveal key={p.title} delay={i * 0.05}>
                <div className="rounded-xl bg-zinc-900/30 border border-zinc-800/40 p-4">
                  <p.icon className="w-4 h-4 text-zinc-500 mb-2.5" />
                  <h3 className="text-[13px] font-semibold">{p.title}</h3>
                  <p className="text-[11px] text-zinc-600 mt-1 leading-[1.6]">{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.25}>
            <div className="mt-8 flex flex-wrap items-center gap-6 text-[12px] text-zinc-600">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Actively developed
              </span>
              <span>New plugins weekly</span>
              <span>Community contributions welcome</span>
              <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300 transition-colors font-medium ml-auto">
                Star on GitHub →
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ CTA ═══════ */}
      <section className="border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28 text-center">
          <Reveal>
            <MindStoreLogo className="w-16 h-16 mx-auto mb-6" />
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="text-[clamp(1.4rem,3vw,2.25rem)] font-bold tracking-[-0.03em]">
              Your knowledge deserves an OS.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-[13px] text-zinc-500 mt-3">Free. Private. No sign-up. Deploy in 2 minutes.</p>
          </Reveal>
          <Reveal delay={0.14}>
            <div className="flex flex-wrap gap-3 justify-center mt-7">
              <Link href="/app">
                <button className="h-12 px-8 rounded-xl bg-teal-500 hover:bg-teal-400 text-white text-[15px] font-semibold transition-all active:scale-[0.97] shadow-lg shadow-teal-500/20">
                  Open MindStore <ArrowRight className="w-4 h-4 inline ml-1.5" />
                </button>
              </Link>
              <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer">
                <button className="h-12 px-7 rounded-xl border border-zinc-800 text-[15px] font-medium text-zinc-400 hover:border-zinc-600 hover:text-white transition-all">
                  GitHub
                </button>
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="border-t border-white/[0.04] py-6">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-zinc-700">
            <div className="flex items-center gap-3">
              <MindStoreLogoMono className="w-3.5 h-3.5" />
              <span>MindStore · MIT License · Open Source</span>
            </div>
            <div className="flex items-center gap-5">
              <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">GitHub</a>
              <Link href="/docs" className="hover:text-zinc-400 transition-colors">Docs</Link>
              <Link href="/app/plugins" className="hover:text-zinc-400 transition-colors">Plugins</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
