"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback, type ReactNode, type CSSProperties } from "react";
import {
  ArrowRight, Brain, Search, MessageSquare, Layers,
  FileText, BookOpen, Globe, Mic, Image, Bookmark,
  GitBranch, Zap, Shield, Database, Network, Target,
  TrendingUp, BarChart3, PenTool, Lightbulb, Puzzle,
  GraduationCap, Users, Download, Upload, Merge,
  Sparkles, Eye, AlertTriangle, Cpu, Languages,
  Route, Boxes, FileCode, Newspaper, FileCheck, ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { MindStoreLogo } from "@/components/MindStoreLogo";

/* ═══════════════════════════════════════════════════════════════
   MindStore Landing — v4 "VC-Grade"
   
   Audit-driven rewrite. Problems fixed:
   - Generous spacing with VARIED rhythm (not same py everywhere)
   - Film grain overlay for texture
   - Bigger, bolder typography
   - Full-bleed moments that break the vertical monotony
   - NO identical card grids — each section has unique layout
   - Stronger color usage (teal/sky used boldly, not just on labels)
   - Network particles more visible
   - Asymmetric layouts, not everything centered
   ═══════════════════════════════════════════════════════════════ */

/* ─── Reveal animation ─── */
function useInView(threshold = 0.06) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); o.unobserve(el); } }, { threshold });
    o.observe(el);
    return () => o.disconnect();
  }, [threshold]);
  return { ref, visible: v };
}

function R({ children, className = "", delay = 0, style }: { children: ReactNode; className?: string; delay?: number; style?: CSSProperties }) {
  const { ref, visible } = useInView();
  return (
    <div ref={ref} className={className} style={{
      ...style,
      opacity: visible ? 1 : 0,
      transform: visible ? "none" : "translateY(24px)",
      transition: `opacity .8s cubic-bezier(.16,1,.3,1) ${delay}s, transform .8s cubic-bezier(.16,1,.3,1) ${delay}s`,
    }}>{children}</div>
  );
}

/* ─── Counter ─── */
function Counter({ end, suffix = "" }: { end: number; suffix?: string }) {
  const { ref, visible } = useInView();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let f: number;
    const dur = 1400, start = performance.now();
    const step = (now: number) => { const p = Math.min((now - start) / dur, 1); setCount(Math.round((1 - Math.pow(1 - p, 4)) * end)); if (p < 1) f = requestAnimationFrame(step); };
    f = requestAnimationFrame(step);
    return () => cancelAnimationFrame(f);
  }, [visible, end]);
  return <span ref={ref}>{count}{suffix}</span>;
}

/* ─── Network Particles — more visible ─── */
function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W: number, H: number, id: number;
    const ps: { x: number; y: number; vx: number; vy: number; r: number; o: number }[] = [];
    function resize() { W = c!.width = window.innerWidth; H = c!.height = window.innerHeight; }
    resize(); window.addEventListener("resize", resize);
    const n = Math.min(50, Math.floor(window.innerWidth / 35));
    for (let i = 0; i < n; i++) ps.push({
      x: Math.random() * 2000, y: Math.random() * 3000,
      vx: reduced ? 0 : (Math.random() - .5) * .15,
      vy: reduced ? 0 : (Math.random() - .5) * .15,
      r: Math.random() * 1.2 + .5, o: Math.random() * .3 + .1,
    });
    function draw() {
      ctx!.clearRect(0, 0, W, H);
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i]; p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1;
        for (let j = i + 1; j < ps.length; j++) {
          const d = Math.hypot(p.x - ps[j].x, p.y - ps[j].y);
          if (d < 150) {
            ctx!.beginPath();
            ctx!.strokeStyle = `rgba(20,184,166,${.06 * (1 - d / 150)})`;
            ctx!.lineWidth = .6;
            ctx!.moveTo(p.x, p.y); ctx!.lineTo(ps[j].x, ps[j].y); ctx!.stroke();
          }
        }
        ctx!.beginPath();
        ctx!.fillStyle = `rgba(20,184,166,${p.o})`;
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx!.fill();
      }
      id = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(id); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true" />;
}

/* ─── Film grain overlay ─── */
function Grain() {
  return (
    <div className="fixed inset-0 z-[1] pointer-events-none opacity-[0.035]"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }}
      aria-hidden="true"
    />
  );
}

/* ─── Dual ticker ─── */
const ROW1 = ["ChatGPT Exports", "Kindle Highlights", "YouTube Transcripts", "Notion Workspaces", "Obsidian Vaults", "Reddit Saved", "PDFs & EPUBs", "Twitter Bookmarks", "Browser Bookmarks"];
const ROW2 = ["Telegram Messages", "Pocket Articles", "Spotify History", "Readwise", "Voice Memos", "Screenshots", "URLs & Pages", "Plain Text", "Anki Decks"];

function Ticker() {
  return (
    <div className="py-5 space-y-3 overflow-hidden" style={{ borderTop: "1px solid rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
      <div className="flex gap-3" style={{ animation: "tkL 55s linear infinite", width: "max-content" }}>
        {[...ROW1, ...ROW1, ...ROW1].map((s, i) => (
          <span key={i} className="px-5 py-2 rounded-xl text-[13px] font-medium whitespace-nowrap shrink-0 text-zinc-500"
            style={{ background: "rgba(20,184,166,0.03)", border: "1px solid rgba(20,184,166,0.06)" }}>{s}</span>
        ))}
      </div>
      <div className="flex gap-3" style={{ animation: "tkR 60s linear infinite", width: "max-content" }}>
        {[...ROW2, ...ROW2, ...ROW2].map((s, i) => (
          <span key={i} className="px-5 py-2 rounded-xl text-[13px] font-medium whitespace-nowrap shrink-0 text-zinc-500"
            style={{ background: "rgba(56,189,248,0.03)", border: "1px solid rgba(56,189,248,0.06)" }}>{s}</span>
        ))}
      </div>
    </div>
  );
}

/* ─── AI Models ─── */
const AI_MODELS = [
  { name: "Claude", by: "Anthropic", color: "#d4a27f" },
  { name: "ChatGPT", by: "OpenAI", color: "#10a37f" },
  { name: "Gemini", by: "Google", color: "#4285f4" },
  { name: "Cursor", by: "AI IDE", color: "#a78bfa" },
  { name: "Ollama", by: "Local", color: "#f97316" },
  { name: "Copilot", by: "GitHub", color: "#60a5fa" },
  { name: "Perplexity", by: "Search", color: "#22d3ee" },
  { name: "OpenRouter", by: "200+ models", color: "#e879f9" },
  { name: "Windsurf", by: "Codeium", color: "#22d3ee" },
  { name: "Any MCP Client", by: "Open protocol", color: "#71717a" },
];

/* ─── Capabilities ─── */
const CAPS: { icon: LucideIcon; title: string; desc: string; accent: string }[] = [
  { icon: Search, title: "Semantic Search", desc: "BM25 + vector search with HyDE, reranking, and contextual compression. Find anything by meaning.", accent: "rgba(20,184,166,0.12)" },
  { icon: MessageSquare, title: "Chat With Your Mind", desc: "Ask questions. Get cited answers from YOUR data — not generic internet. Switch AI models per-message.", accent: "rgba(56,189,248,0.12)" },
  { icon: Brain, title: "Knowledge Fingerprint", desc: "3D WebGL visualization of your mind's topology. See clusters, connections, blind spots.", accent: "rgba(168,85,247,0.1)" },
  { icon: AlertTriangle, title: "Contradiction Finder", desc: "AI scans for conflicting beliefs and outdated information across your entire knowledge base.", accent: "rgba(239,68,68,0.1)" },
  { icon: Route, title: "Topic Evolution", desc: "Timeline of how your interests evolved. Which topics grew, which faded. Your intellectual journey.", accent: "rgba(245,158,11,0.1)" },
  { icon: Target, title: "Knowledge Gaps", desc: "Identifies blind spots. Generates targeted learning paths for what you should know more about.", accent: "rgba(16,185,129,0.1)" },
  { icon: GraduationCap, title: "Flashcard Engine", desc: "Auto-generated spaced repetition from any memory. SM-2 algorithm. Export to Anki.", accent: "rgba(56,189,248,0.1)" },
  { icon: PenTool, title: "Content Generation", desc: "Blog drafts, newsletters, resumes — all grounded in your actual knowledge. Export to Markdown, Hugo, Jekyll.", accent: "rgba(20,184,166,0.1)" },
  { icon: Cpu, title: "Custom RAG", desc: "5 retrieval strategies. Domain-specific embeddings for medical, legal, code. Tune per-query.", accent: "rgba(245,158,11,0.1)" },
  { icon: Languages, title: "Multi-Language", desc: "Cross-language semantic search. Write in English, find it in Japanese. 100+ languages.", accent: "rgba(168,85,247,0.1)" },
  { icon: Eye, title: "Vision & Voice", desc: "Images → AI description → searchable. Voice → Whisper transcription → saved. Every modality indexed.", accent: "rgba(239,68,68,0.1)" },
  { icon: Boxes, title: "Smart Collections", desc: "k-means clustering groups memories into topics automatically. No manual tagging needed.", accent: "rgba(16,185,129,0.1)" },
];

/* ─── Use Cases ─── */
const CASES = [
  { icon: FileText, title: "Import 5 years of ChatGPT and search it in seconds", desc: "Export your data, drop the ZIP. Every conversation indexed. Ask \"what did I discuss about React hooks in 2024?\" — get the exact thread." },
  { icon: BookOpen, title: "Turn 200 Kindle highlights into a connected knowledge graph", desc: "Import from every book. See which ideas connect across authors. Find that Taleb quote that relates to your Kahneman notes." },
  { icon: Lightbulb, title: "Give Claude access to YOUR knowledge — not just the internet", desc: "Connect via MCP. Claude searches your notes, meeting prep, domain knowledge before answering. Context no foundation model has." },
  { icon: BarChart3, title: "Watch your beliefs contradict each other over time", desc: "You wrote \"always use TypeScript\" in March and \"plain JS is fine for scripts\" in November. AI finds these. Track how your thinking evolved." },
  { icon: Network, title: "See your entire mind rendered as a 3D graph", desc: "Knowledge Fingerprint: WebGL visualization. Clusters of related ideas. Orphaned concepts. Bridge ideas connecting domains you never realized were linked." },
  { icon: Newspaper, title: "Auto-generate a newsletter from what you actually learned this week", desc: "Newsletter plugin scans recent memories, groups by topic, generates a digest. You edit, they read. Thought leadership from real knowledge." },
];

/* ─── Interactive Demo ─── */
const QUERIES = [
  { q: "that pricing article from last year", results: [
    { title: "SaaS Pricing Strategies — 2024", src: "Kindle", score: 98, color: "#f59e0b" },
    { title: "Conversation about pricing tiers", src: "ChatGPT", score: 94, color: "#10b981" },
    { title: "Stripe pricing page analysis", src: "URL", score: 87, color: "#f97316" },
  ]},
  { q: "how do transformers actually work?", results: [
    { title: "AI Architecture Deep Dive", src: "ChatGPT", score: 99, color: "#10b981" },
    { title: "Attention Is All You Need — notes", src: "Notes", score: 96, color: "#3b82f6" },
    { title: "Neural network lecture highlights", src: "YouTube", score: 89, color: "#ef4444" },
  ]},
  { q: "what did Kahneman say about biases?", results: [
    { title: "Thinking, Fast and Slow — highlights", src: "Kindle", score: 97, color: "#f59e0b" },
    { title: "Psychology Misconceptions thread", src: "ChatGPT", score: 92, color: "#10b981" },
    { title: "Cognitive bias in product design", src: "Notes", score: 85, color: "#3b82f6" },
  ]},
];

function Demo() {
  const [qi, setQi] = useState(0);
  const [ci, setCi] = useState(0);
  const [phase, setPhase] = useState<"type"|"show"|"wait"|"clear">("type");
  const [vr, setVr] = useState(0);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const o = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 });
    o.observe(el); return () => o.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    const cur = QUERIES[qi]; if (!cur) return;
    if (phase === "type") {
      if (ci < cur.q.length) {
        const t = setTimeout(() => setCi(c => c + 1), 40 + Math.random() * 25);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPhase("show"), 250);
      return () => clearTimeout(t);
    }
    if (phase === "show") {
      if (vr < cur.results.length) {
        const t = setTimeout(() => setVr(v => v + 1), 160);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPhase("wait"), 3000);
      return () => clearTimeout(t);
    }
    if (phase === "wait") { setPhase("clear"); }
    if (phase === "clear") {
      const t = setTimeout(() => { setQi(i => (i + 1) % QUERIES.length); setCi(0); setVr(0); setPhase("type"); }, 350);
      return () => clearTimeout(t);
    }
  }, [inView, phase, ci, vr, qi]);

  const cur = QUERIES[qi];
  const typed = cur.q.slice(0, ci);

  return (
    <div ref={ref} className="relative mx-auto max-w-[840px]">
      <div className="absolute -inset-12 rounded-[48px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(20,184,166,0.08), rgba(56,189,248,0.04), transparent 70%)", filter: "blur(40px)" }} />
      <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/60"
        style={{ background: "#0c0c0e", border: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Chrome */}
        <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="flex gap-[6px]">
            <div className="w-[10px] h-[10px] rounded-full" style={{ background: "rgba(239,68,68,0.5)" }} />
            <div className="w-[10px] h-[10px] rounded-full" style={{ background: "rgba(234,179,8,0.5)" }} />
            <div className="w-[10px] h-[10px] rounded-full" style={{ background: "rgba(34,197,94,0.5)" }} />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] text-zinc-600" style={{ background: "rgba(255,255,255,0.03)" }}>
              <span className="w-2 h-2 rounded-sm" style={{ background: "rgba(20,184,166,0.5)" }} />
              mindstore.org/app
            </div>
          </div>
          <div className="w-16" />
        </div>
        {/* Content */}
        <div className="p-5 sm:p-7">
          <div className="text-[11px] text-zinc-600 mb-2 font-medium">Explore · 2,847 memories</div>
          {/* Search */}
          <div className="flex items-center gap-2.5 px-4 h-10 rounded-xl mb-4 transition-all duration-300"
            style={{ background: typed ? "rgba(20,184,166,0.04)" : "rgba(255,255,255,0.03)", border: typed ? "1px solid rgba(20,184,166,0.12)" : "1px solid rgba(255,255,255,0.05)" }}>
            <Search className={`w-4 h-4 shrink-0 transition-colors ${typed ? "text-teal-400" : "text-zinc-600"}`} />
            <div className="flex-1">
              {typed ? (
                <span className="text-[13px] text-zinc-200">{typed}{phase === "type" && <span className="inline-block w-[1.5px] h-[13px] bg-teal-400 ml-0.5 align-middle" style={{ animation: "blink .8s step-end infinite" }} />}</span>
              ) : (
                <span className="text-[13px] text-zinc-600">Search your memories…</span>
              )}
            </div>
            <span className="text-[9px] text-zinc-700 font-mono bg-white/[0.04] px-1.5 py-0.5 rounded shrink-0">⌘K</span>
          </div>
          {/* Results */}
          <div className="space-y-2 transition-opacity duration-300" style={{ opacity: phase === "clear" ? 0 : 1 }}>
            {(phase === "show" || phase === "wait") && cur.results.map((r, i) => (
              <div key={`${qi}-${i}`} className="flex items-start gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-400"
                style={{
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)",
                  opacity: i < vr ? 1 : 0, transform: i < vr ? "translateY(0)" : "translateY(10px)",
                  transitionDelay: `${i * 60}ms`,
                }}>
                <div className="w-1.5 h-8 rounded-full shrink-0 mt-0.5" style={{ background: r.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-zinc-200 truncate">{r.title}</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5">from {r.src}</div>
                </div>
                <div className="text-[11px] font-mono text-teal-500/80 shrink-0">{r.score}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */

export function LandingClient() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 selection:bg-teal-500/20 overflow-x-hidden relative">
      <style jsx global>{`
        @keyframes tkL { from{transform:translateX(0)} to{transform:translateX(-33.333%)} }
        @keyframes tkR { from{transform:translateX(-33.333%)} to{transform:translateX(0)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}
      `}</style>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "SoftwareApplication", name: "MindStore",
        applicationCategory: "ProductivityApplication", operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      }) }} />

      <Particles />
      <Grain />

      {/* ═══════ NAV ═══════ */}
      <nav className="fixed top-0 inset-x-0 z-50 h-14 px-6 lg:px-10 flex items-center justify-between backdrop-blur-2xl"
        style={{ background: "rgba(9,9,11,0.8)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <Link href="/" className="flex items-center gap-2.5" aria-label="MindStore home">
          <MindStoreLogo className="w-7 h-7" />
          <span className="font-bold text-[15px] tracking-[-0.02em]">MindStore</span>
        </Link>
        <div className="flex items-center gap-5">
          <Link href="/docs" className="text-[13px] text-zinc-500 hover:text-zinc-200 transition hidden sm:block">Docs</Link>
          <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer" className="text-[13px] text-zinc-500 hover:text-zinc-200 transition hidden sm:block">GitHub</a>
          <Link href="/app">
            <button className="h-8 px-4 rounded-lg text-[13px] font-bold bg-teal-500 text-white border-none cursor-pointer hover:bg-teal-400 transition-all hover:-translate-y-px">
              Open App
            </button>
          </Link>
        </div>
      </nav>

      {/* ═══════ HERO — generous space ═══════ */}
      <section className="relative z-10 pt-[clamp(140px,20vh,220px)] pb-[clamp(48px,7vh,64px)]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10">
          <R>
            <h1 className="text-[clamp(2.6rem,6vw,4.5rem)] font-extrabold leading-[1.02] tracking-[-0.045em] max-w-[800px]">
              You&apos;ve spent years<br />learning things.<br />
              <span className="font-serif italic text-teal-400">Where did it all go?</span>
            </h1>
          </R>
          <R delay={0.1}>
            <p className="text-[clamp(16px,1.8vw,19px)] mt-7 max-w-[520px] leading-[1.7] text-zinc-400">
              MindStore imports everything you&apos;ve ever read, written, highlighted, or saved — 
              makes it searchable by meaning — and connects it to{" "}
              <strong className="text-zinc-100 font-semibold">any AI model</strong> you use.
            </p>
          </R>
          <R delay={0.18}>
            <div className="flex gap-3 mt-8 flex-wrap">
              <Link href="/app">
                <button className="h-12 px-8 rounded-xl text-[15px] font-bold bg-teal-500 text-white cursor-pointer transition-all hover:bg-teal-400 hover:-translate-y-0.5 shadow-[0_6px_24px_rgba(20,184,166,0.2)]">
                  Get Started Free <ArrowRight className="w-4 h-4 inline ml-1.5" />
                </button>
              </Link>
              <Link href="/app?demo=true">
                <button className="h-12 px-6 rounded-xl text-[15px] font-medium bg-transparent text-zinc-400 border border-zinc-800 cursor-pointer transition-all hover:text-zinc-100 hover:border-zinc-600">
                  Try Demo
                </button>
              </Link>
            </div>
          </R>
          <R delay={0.24}>
            <div className="flex gap-6 mt-6 text-[12px] text-zinc-600 flex-wrap">
              <span>MIT Open Source</span>
              <span>Self-hosted</span>
              <span>35 Plugins</span>
              <span>No AI costs</span>
            </div>
          </R>
        </div>
      </section>

      {/* ═══════ DEMO — full bleed visual break ═══════ */}
      <section className="relative z-10 py-[clamp(32px,5vh,48px)]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10">
          <R delay={0.1}><Demo /></R>
        </div>
      </section>

      {/* ═══════ TICKER ═══════ */}
      <Ticker />

      {/* ═══════ IMPORT — asymmetric two-col ═══════ */}
      <section className="relative z-10 py-[clamp(80px,12vh,120px)]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-20 items-center">
            <div>
              <R>
                <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-teal-500 mb-4">12+ importers</p>
                <h2 className="text-[clamp(1.6rem,3.2vw,2.8rem)] font-extrabold tracking-[-0.04em] leading-[1.08]">
                  Every source.<br />One knowledge base.
                </h2>
              </R>
              <R delay={0.08}>
                <p className="text-[16px] mt-5 leading-[1.8] text-zinc-400 max-w-[460px]">
                  Drop a ChatGPT export ZIP — 5 years of conversations indexed in seconds.
                  Kindle highlights with book structure. Obsidian vaults with wikilinks.
                  YouTube transcripts. PDFs with chapter-aware chunking.
                </p>
              </R>
              <R delay={0.14}>
                <div className="flex gap-4 mt-6 text-[12px] text-zinc-500 flex-wrap">
                  <span className="flex items-center gap-1.5"><Download className="w-3.5 h-3.5 text-teal-500/70" /> Drag & drop</span>
                  <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-teal-500/70" /> Batch import</span>
                  <span className="flex items-center gap-1.5"><FileCheck className="w-3.5 h-3.5 text-teal-500/70" /> Deduplication</span>
                </div>
              </R>
            </div>
            <R delay={0.1}>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { icon: MessageSquare, label: "ChatGPT", c: "#10b981" },
                  { icon: BookOpen, label: "Kindle", c: "#f59e0b" },
                  { icon: Globe, label: "YouTube", c: "#ef4444" },
                  { icon: FileText, label: "Notion", c: "#71717a" },
                  { icon: FileCode, label: "Obsidian", c: "#a78bfa" },
                  { icon: Bookmark, label: "Reddit", c: "#f97316" },
                  { icon: FileText, label: "PDF/EPUB", c: "#3b82f6" },
                  { icon: Globe, label: "Twitter", c: "#22d3ee" },
                  { icon: Mic, label: "Voice", c: "#ec4899" },
                  { icon: Image, label: "Images", c: "#a78bfa" },
                  { icon: Globe, label: "URLs", c: "#14b8a6" },
                  { icon: Puzzle, label: "+5 more", c: "#71717a" },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl transition-all hover:bg-white/[0.04]"
                    style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <s.icon className="w-4 h-4 shrink-0" style={{ color: s.c }} />
                    <span className="text-[12px] font-medium text-zinc-300">{s.label}</span>
                  </div>
                ))}
              </div>
            </R>
          </div>
        </div>
      </section>

      {/* ═══════ AI PORTABILITY — centered, spacious ═══════ */}
      <section className="relative z-10 py-[clamp(80px,12vh,120px)]" style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10 text-center">
          <R>
            <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-teal-500 mb-4">Portable knowledge</p>
            <h2 className="text-[clamp(1.6rem,3.2vw,2.8rem)] font-extrabold tracking-[-0.04em] leading-[1.08] max-w-[600px] mx-auto">
              Connect to any AI.<br />Your context follows you.
            </h2>
          </R>
          <R delay={0.08}>
            <p className="text-[16px] mt-5 max-w-[500px] mx-auto leading-[1.8] text-zinc-400">
              MindStore speaks MCP — the open protocol. Add your knowledge as a tool in any AI.
              Switch models anytime. Zero lock-in.
            </p>
          </R>
          <R delay={0.14}>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-10 max-w-[800px] mx-auto">
              {AI_MODELS.map((ai) => (
                <div key={ai.name} className="flex flex-col items-center gap-2 py-4 px-3 rounded-xl transition-all hover:bg-white/[0.03] cursor-default"
                  style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div className="w-3 h-3 rounded-full" style={{ background: ai.color, boxShadow: `0 0 12px ${ai.color}30` }} />
                  <span className="text-[12px] font-semibold text-zinc-200">{ai.name}</span>
                  <span className="text-[10px] text-zinc-600 -mt-1">{ai.by}</span>
                </div>
              ))}
            </div>
          </R>
        </div>
      </section>

      {/* ═══════ MCP — code block, asymmetric ═══════ */}
      <section className="relative z-10 py-[clamp(80px,12vh,120px)]" style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            <div>
              <R>
                <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-teal-500 mb-4">MCP Protocol</p>
                <h2 className="text-[clamp(1.6rem,3.2vw,2.8rem)] font-extrabold tracking-[-0.04em] leading-[1.08]">
                  Three lines of config.<br />Any AI gets your brain.
                </h2>
              </R>
              <R delay={0.08}>
                <p className="text-[16px] mt-5 leading-[1.8] text-zinc-400 max-w-[420px]">
                  Point any MCP client at your MindStore. Three functions give any AI complete access to search, profile, and contextualize your knowledge.
                </p>
              </R>
              <R delay={0.14}>
                <div className="flex flex-col gap-3 mt-6">
                  {[
                    { fn: "search_mind", desc: "Semantic search across all knowledge" },
                    { fn: "get_profile", desc: "Expertise, writing style, stats" },
                    { fn: "get_context", desc: "Deep context on any topic" },
                  ].map(t => (
                    <div key={t.fn} className="flex items-center gap-3">
                      <code className="font-mono text-[12px] px-3 py-1 rounded-lg text-teal-400/80 shrink-0"
                        style={{ background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.08)" }}>
                        {t.fn}
                      </code>
                      <span className="text-[12px] text-zinc-500">{t.desc}</span>
                    </div>
                  ))}
                </div>
              </R>
            </div>
            <R delay={0.1}>
              <div className="rounded-2xl overflow-hidden" style={{ background: "#0e0e10", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="px-4 py-2.5 flex items-center gap-[6px]" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: "rgba(239,68,68,0.5)" }} />
                  <div className="w-2 h-2 rounded-full" style={{ background: "rgba(234,179,8,0.5)" }} />
                  <div className="w-2 h-2 rounded-full" style={{ background: "rgba(34,197,94,0.5)" }} />
                  <span className="font-mono text-[10px] ml-2 text-zinc-700">claude_desktop_config.json</span>
                </div>
                <div className="p-5 font-mono text-[13px] leading-[2] text-zinc-600">
                  <pre className="whitespace-pre"><code>{`{\n  `}<span className="text-zinc-300">{`"mcpServers"`}</span>{`: {\n    `}<span className="text-zinc-300">{`"mindstore"`}</span>{`: {\n      `}<span className="text-zinc-300">{`"url"`}</span>{`: `}<span className="text-teal-400">{`"https://mindstore.org/api/mcp"`}</span>{`\n    }\n  }\n}`}</code></pre>
                </div>
              </div>
            </R>
          </div>
        </div>
      </section>

      {/* ═══════ USE CASES — full-width rows, no cards ═══════ */}
      <section className="relative z-10 py-[clamp(80px,12vh,120px)]" style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10">
          <R>
            <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-teal-500 mb-4">Real power</p>
            <h2 className="text-[clamp(1.6rem,3.2vw,2.8rem)] font-extrabold tracking-[-0.04em] leading-[1.08] max-w-[500px]">
              Not another notes app.
            </h2>
          </R>
          <div className="mt-10 space-y-0">
            {CASES.map((uc, i) => (
              <R key={uc.title} delay={0.04 * i}>
                <div className="group grid lg:grid-cols-[1fr_1.4fr] gap-5 lg:gap-10 py-6 lg:py-8 transition-all duration-300"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div className="flex items-start gap-3">
                    <uc.icon className="w-5 h-5 text-teal-500 shrink-0 mt-1" />
                    <h3 className="text-[15px] lg:text-[17px] font-bold text-zinc-100 leading-[1.35]">{uc.title}</h3>
                  </div>
                  <p className="text-[14px] lg:text-[15px] leading-[1.75] text-zinc-500 group-hover:text-zinc-400 transition-colors">{uc.desc}</p>
                </div>
              </R>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ CAPABILITIES — staggered, varied sizes ═══════ */}
      <section className="relative z-10 py-[clamp(80px,12vh,120px)]" style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10">
          <R>
            <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-sky-400 mb-4">35 plugins</p>
            <h2 className="text-[clamp(1.6rem,3.2vw,2.8rem)] font-extrabold tracking-[-0.04em] leading-[1.08] max-w-[500px]">
              Every tool your knowledge needs.
            </h2>
          </R>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px mt-10 rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
            {CAPS.map((c, i) => (
              <R key={c.title} delay={0.02 * i}>
                <div className="p-6 lg:p-7 transition-all duration-300 hover:bg-white/[0.02]"
                  style={{ background: "#09090b" }}>
                  <c.icon className="w-5 h-5 text-teal-500 mb-4" />
                  <h3 className="text-[14px] font-bold text-zinc-200 mb-1">{c.title}</h3>
                  <p className="text-[13px] text-zinc-500 leading-[1.65]">{c.desc}</p>
                </div>
              </R>
            ))}
          </div>
          <R delay={0.3}>
            <div className="mt-6">
              <Link href="/app/plugins" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-teal-400 hover:text-teal-300 transition">
                Browse all 35 plugins <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </R>
        </div>
      </section>

      {/* ═══════ COMMUNITY — large, impactful ═══════ */}
      <section className="relative z-10 py-[clamp(80px,12vh,120px)]"
        style={{ borderTop: "1px solid rgba(255,255,255,0.03)", background: "linear-gradient(180deg, rgba(20,184,166,0.015) 0%, transparent 60%)" }}>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <R>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-bold mb-5 text-teal-400"
                  style={{ background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.1)" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                  Coming soon
                </div>
                <h2 className="text-[clamp(1.6rem,3.2vw,2.8rem)] font-extrabold tracking-[-0.04em] leading-[1.08]">
                  Community<br />knowledge bases.
                </h2>
              </R>
              <R delay={0.08}>
                <p className="text-[16px] mt-5 leading-[1.8] text-zinc-400 max-w-[440px]">
                  Browse curated minds from experts. A researcher shares paper summaries.
                  A chef shares recipe knowledge. Import what resonates. Share yours back.
                  Knowledge grows when it flows.
                </p>
              </R>
            </div>
            <R delay={0.1}>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Search, label: "Browse minds", desc: "Explore community knowledge" },
                  { icon: Download, label: "Import", desc: "Grab others' expertise" },
                  { icon: Upload, label: "Share", desc: "Publish your knowledge" },
                  { icon: Merge, label: "Merge", desc: "Combine & grow" },
                ].map(item => (
                  <div key={item.label} className="p-5 rounded-xl transition-all hover:-translate-y-0.5"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <item.icon className="w-5 h-5 text-teal-500 mb-3" />
                    <div className="text-[13px] font-bold text-zinc-200">{item.label}</div>
                    <div className="text-[11px] text-zinc-600 mt-1">{item.desc}</div>
                  </div>
                ))}
              </div>
            </R>
          </div>
        </div>
      </section>

      {/* ═══════ OPEN SOURCE — minimal, confident ═══════ */}
      <section className="relative z-10 py-[clamp(48px,7vh,64px)]" style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10 grid lg:grid-cols-[1.5fr_1fr] gap-6 items-center">
          <div>
            <R>
              <h2 className="text-[clamp(1.2rem,2.2vw,1.6rem)] font-extrabold tracking-[-0.03em]">
                MIT licensed. Self-hosted. Your data, your keys.
              </h2>
            </R>
            <R delay={0.06}>
              <p className="text-[14px] mt-2 leading-[1.7] text-zinc-500 max-w-[500px]">
                Zero vendor lock-in. Zero AI costs for MindStore — you bring your own keys.
                Plugin SDK for extending. Community-driven development.
              </p>
            </R>
          </div>
          <R delay={0.1}>
            <div className="flex flex-wrap items-center gap-5 text-[12px] text-zinc-600 lg:justify-end">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                Active
              </span>
              <span><Counter end={336} /> tests</span>
              <span><Counter end={66} /> APIs</span>
              <span><Counter end={103} /> docs</span>
              <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer"
                className="font-bold text-teal-500 hover:text-teal-400 transition">
                GitHub →
              </a>
            </div>
          </R>
        </div>
      </section>

      {/* ═══════ CTA — big, final ═══════ */}
      <section className="relative z-10 py-[clamp(80px,14vh,140px)] text-center" style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10">
          <R><MindStoreLogo className="w-14 h-14 mx-auto mb-6" /></R>
          <R delay={0.08}>
            <h2 className="text-[clamp(1.8rem,3.5vw,3rem)] font-extrabold tracking-[-0.04em] leading-[1.06]">
              Your knowledge deserves<br /><span className="font-serif italic text-teal-400">an operating system.</span>
            </h2>
          </R>
          <R delay={0.14}>
            <p className="text-[14px] mt-4 text-zinc-500">Free · Self-hosted · MIT open source · No sign-up required</p>
          </R>
          <R delay={0.2}>
            <div className="flex gap-3 justify-center mt-8 flex-wrap">
              <Link href="/app">
                <button className="h-12 px-8 rounded-xl text-[15px] font-bold bg-teal-500 text-white cursor-pointer transition-all hover:bg-teal-400 hover:-translate-y-0.5 shadow-[0_6px_24px_rgba(20,184,166,0.2)]">
                  Open MindStore <ArrowRight className="w-4 h-4 inline ml-1.5" />
                </button>
              </Link>
              <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer">
                <button className="h-12 px-6 rounded-xl text-[15px] font-medium bg-transparent text-zinc-400 border border-zinc-800 cursor-pointer transition-all hover:text-zinc-100 hover:border-zinc-600">
                  GitHub
                </button>
              </a>
            </div>
          </R>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 py-5 px-6 lg:px-10 flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-800 max-w-[1200px] mx-auto"
        style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
        <span>MindStore · MIT License</span>
        <div className="flex gap-5">
          <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-500 transition">GitHub</a>
          <Link href="/docs" className="hover:text-zinc-500 transition">Docs</Link>
          <Link href="/app/plugins" className="hover:text-zinc-500 transition">Plugins</Link>
        </div>
      </footer>
    </div>
  );
}
