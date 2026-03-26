"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight, Brain, Search, MessageSquare, Layers,
  FileText, BookOpen, Globe, Mic, Image, Bookmark,
  GitBranch, Zap, Shield, Database, Network, Target,
  TrendingUp, BarChart3, PenTool, Lightbulb, Puzzle,
  GraduationCap, Users, Download, Upload, Merge,
  Sparkles, Eye, AlertTriangle, Cpu, Languages,
  Route, Boxes, FileCode, Newspaper, FileCheck,
  type LucideIcon,
} from "lucide-react";
import { MindStoreLogo } from "@/components/MindStoreLogo";

/* ═══════════════════════════════════════════════════════════════
   MindStore Landing — v3 "Real Power"
   
   OLED black (#0a0a0b) + teal primary + sky secondary.
   Full-width sections. No vague copy. Real product capabilities.
   Lucide icons instead of emojis. AI logos as custom SVGs.
   ═══════════════════════════════════════════════════════════════ */

function useInView(threshold = 0.08) {
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

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useInView();
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(20px)",
      transition: `opacity .7s cubic-bezier(.16,1,.3,1) ${delay}s, transform .7s cubic-bezier(.16,1,.3,1) ${delay}s`,
    }}>{children}</div>
  );
}

function Counter({ end, suffix = "" }: { end: number; suffix?: string }) {
  const { ref, visible } = useInView();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let f: number;
    const dur = 1200, start = performance.now();
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

/* ─── Network particles ─── */
function NetworkParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W: number, H: number, animId: number;
    const ps: { x: number; y: number; vx: number; vy: number; r: number }[] = [];
    function resize() { W = c!.width = window.innerWidth; H = c!.height = window.innerHeight; }
    resize(); window.addEventListener("resize", resize);
    const count = Math.min(40, Math.floor(window.innerWidth / 45));
    for (let i = 0; i < count; i++) ps.push({ x: Math.random() * 2000, y: Math.random() * 2000, vx: prefersReduced ? 0 : (Math.random() - .5) * .1, vy: prefersReduced ? 0 : (Math.random() - .5) * .1, r: Math.random() * .8 + .4 });
    function draw() {
      ctx!.clearRect(0, 0, W, H);
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i]; p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1;
        for (let j = i + 1; j < ps.length; j++) {
          const d = Math.hypot(p.x - ps[j].x, p.y - ps[j].y);
          if (d < 130) { ctx!.beginPath(); ctx!.strokeStyle = `rgba(20,184,166,${.035 * (1 - d / 130)})`; ctx!.lineWidth = .5; ctx!.moveTo(p.x, p.y); ctx!.lineTo(ps[j].x, ps[j].y); ctx!.stroke(); }
        }
        ctx!.beginPath(); ctx!.fillStyle = "rgba(20,184,166,0.12)"; ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx!.fill();
      }
      animId = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true" />;
}

/* ─── Dual ticker ─── */
const ROW1 = ["ChatGPT Exports", "Kindle Highlights", "YouTube Transcripts", "Notion Workspaces", "Obsidian Vaults", "Reddit Saved", "PDFs & EPUBs", "Twitter Bookmarks", "Browser Bookmarks"];
const ROW2 = ["Telegram Messages", "Pocket Articles", "Spotify History", "Readwise", "Voice Memos", "Screenshots & Images", "URLs & Webpages", "Plain Text", "Anki Decks"];

function DualTicker() {
  return (
    <div className="py-3 space-y-2 overflow-hidden" style={{ borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div className="flex gap-2.5" style={{ animation: "tickerLeft 50s linear infinite", width: "max-content" }}>
        {[...ROW1, ...ROW1, ...ROW1].map((s, i) => (
          <span key={i} className="px-4 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap shrink-0 text-zinc-500"
            style={{ background: "rgba(20,184,166,0.03)", border: "1px solid rgba(20,184,166,0.06)" }}>{s}</span>
        ))}
      </div>
      <div className="flex gap-2.5" style={{ animation: "tickerRight 55s linear infinite", width: "max-content" }}>
        {[...ROW2, ...ROW2, ...ROW2].map((s, i) => (
          <span key={i} className="px-4 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap shrink-0 text-zinc-500"
            style={{ background: "rgba(56,189,248,0.03)", border: "1px solid rgba(56,189,248,0.06)" }}>{s}</span>
        ))}
      </div>
    </div>
  );
}

/* ─── AI Model Logos (simple SVG marks) ─── */
/* ─── Product Preview — CSS mockup of the app ─── */
function ProductPreview() {
  return (
    <div className="relative mx-auto max-w-[900px]">
      {/* Ambient glow */}
      <div className="absolute -inset-8 rounded-[40px] opacity-40 blur-[60px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 40%, rgba(20,184,166,0.15), rgba(56,189,248,0.08), transparent 70%)" }}
      />
      
      {/* Browser chrome */}
      <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/40"
        style={{ background: "#0c0c0e" }}>
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="flex gap-[6px]">
            <div className="w-[10px] h-[10px] rounded-full" style={{ background: "rgba(239,68,68,0.5)" }} />
            <div className="w-[10px] h-[10px] rounded-full" style={{ background: "rgba(234,179,8,0.5)" }} />
            <div className="w-[10px] h-[10px] rounded-full" style={{ background: "rgba(34,197,94,0.5)" }} />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] text-zinc-600" style={{ background: "rgba(255,255,255,0.03)" }}>
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "rgba(20,184,166,0.5)" }} />
              mindstore.org/app
            </div>
          </div>
          <div className="w-16" /> {/* Balance */}
        </div>

        {/* App layout */}
        <div className="flex h-[340px] sm:h-[400px]">
          {/* Sidebar (hidden on mobile) */}
          <div className="hidden sm:flex w-[180px] flex-col shrink-0 p-3 gap-0.5"
            style={{ borderRight: "1px solid rgba(255,255,255,0.04)" }}>
            {/* Logo */}
            <div className="flex items-center gap-2 px-2 py-2 mb-2">
              <div className="w-5 h-5 rounded-md" style={{ background: "linear-gradient(135deg, #14b8a6, #0ea5e9)" }} />
              <span className="text-[11px] font-bold text-zinc-300">MindStore</span>
            </div>
            {/* Nav items */}
            {[
              { label: "Dashboard", active: true },
              { label: "Chat" },
              { label: "Import" },
              { label: "Explore" },
              { label: "Fingerprint" },
              { label: "Insights" },
              { label: "Collections" },
              { label: "Flashcards" },
            ].map((item) => (
              <div key={item.label} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] ${
                item.active
                  ? "bg-white/[0.06] text-zinc-200 font-medium"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}>
                <div className={`w-3 h-3 rounded ${item.active ? "bg-teal-500/30" : "bg-white/[0.04]"}`} />
                {item.label}
              </div>
            ))}
          </div>

          {/* Main content area */}
          <div className="flex-1 p-4 sm:p-5 overflow-hidden">
            {/* Header */}
            <div className="mb-4">
              <div className="text-[14px] sm:text-[16px] font-semibold text-zinc-200 tracking-[-0.02em]">Your Mind</div>
              <div className="text-[10px] text-zinc-600 mt-0.5">2,847 memories across 14 sources</div>
            </div>

            {/* Search bar */}
            <div className="flex items-center gap-2 px-3 h-8 rounded-lg mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <Search className="w-3 h-3 text-zinc-600" />
              <span className="text-[10px] text-zinc-600">Search your memories…</span>
              <span className="ml-auto text-[8px] text-zinc-700 font-mono bg-white/[0.04] px-1 py-0.5 rounded">⌘K</span>
            </div>

            {/* Stat cards row */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { label: "Total", value: "2,847", color: "rgba(20,184,166,0.12)" },
                { label: "ChatGPT", value: "1,423", color: "rgba(34,197,94,0.12)" },
                { label: "Notes", value: "892", color: "rgba(59,130,246,0.12)" },
                { label: "URLs", value: "532", color: "rgba(249,115,22,0.12)" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg p-2" style={{ background: s.color, border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div className="text-[13px] sm:text-[15px] font-semibold text-zinc-200 tabular-nums">{s.value}</div>
                  <div className="text-[8px] text-zinc-500 font-medium mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Activity bars */}
            <div className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-3 h-3 rounded bg-teal-500/20 flex items-center justify-center">
                  <BarChart3 className="w-2 h-2 text-teal-400" />
                </div>
                <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider">Activity · 14 days</span>
                <span className="ml-auto text-[8px] text-amber-400 font-semibold">🔥 7-day streak</span>
              </div>
              <div className="flex items-end gap-[3px] h-10">
                {[35, 22, 0, 48, 65, 30, 45, 55, 72, 40, 60, 80, 50, 90].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-[2px]"
                    style={{
                      height: `${Math.max(h, 4)}%`,
                      background: i === 13
                        ? "linear-gradient(to top, #14b8a6, #2dd4bf)"
                        : h === 0 ? "rgba(255,255,255,0.03)" : "rgba(20,184,166,0.25)",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Recent memories (peek) */}
            <div className="mt-3 space-y-1">
              {[
                { type: "chatgpt", title: "AI Architecture Deep Dive", snippet: "Discussed transformers vs RNNs…", color: "#10b981" },
                { type: "kindle", title: "Thinking, Fast and Slow", snippet: "System 1 is fast, intuitive…", color: "#f59e0b" },
              ].map((mem) => (
                <div key={mem.title} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <div className="w-5 h-5 rounded shrink-0" style={{ background: `${mem.color}20` }}>
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-2 h-2 rounded-sm" style={{ background: `${mem.color}60` }} />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] font-medium text-zinc-400 truncate">{mem.title}</div>
                    <div className="text-[8px] text-zinc-600 truncate">{mem.snippet}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AILogo({ name }: { name: string }) {
  const size = 20;
  // Recognizable simplified marks for each AI
  switch (name) {
    case "Claude": return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-1-4-4-1 4-1 1-4 1 4 4 1-4 1-1 4z" fill="#d4a27f"/></svg>;
    case "ChatGPT": return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a2 2 0 110 4 2 2 0 010-4zm-3 8h6v1H9v-1z" fill="#10a37f"/></svg>;
    case "Gemini": return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.85 0 3.58-.51 5.06-1.39C14.13 19.08 12 16.77 12 14c0-2.77 2.13-5.08 5.06-6.61A9.94 9.94 0 0012 2z" fill="#4285f4"/><path d="M17.06 7.39C14.13 8.92 12 11.23 12 14c0 2.77 2.13 5.08 5.06 6.61A9.94 9.94 0 0022 12c0-3.87-2.2-7.22-5.44-8.87l.5.26z" fill="#34a853"/></svg>;
    case "Cursor": return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="#a78bfa" strokeWidth="2"/><path d="M8 12l3 3 5-6" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    case "Ollama": return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="10" r="6" fill="none" stroke="#f97316" strokeWidth="2"/><path d="M9 9.5a1 1 0 112 0M13 9.5a1 1 0 112 0M10 13c1 1 3 1 4 0" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round"/></svg>;
    case "Copilot": return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="none" stroke="#60a5fa" strokeWidth="2"/><circle cx="12" cy="12" r="3" fill="#60a5fa"/></svg>;
    case "Perplexity": return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="none" stroke="#22d3ee" strokeWidth="2"/><path d="M12 7v10M7 12h10" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round"/></svg>;
    case "OpenRouter": return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M4 12h4m4 0h4m4 0h-2M12 4v4m0 4v4m0 4v-2" stroke="#e879f9" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="12" r="2" fill="#e879f9"/></svg>;
    case "Windsurf": return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M4 18c3-3 6-12 16-14-1 4-6 10-16 14z" fill="#22d3ee" opacity=".7"/></svg>;
    default: return <Network className="w-5 h-5 text-zinc-500" />;
  }
}

const AI_MODELS = [
  { name: "Claude", by: "Anthropic" },
  { name: "ChatGPT", by: "OpenAI" },
  { name: "Gemini", by: "Google" },
  { name: "Cursor", by: "AI IDE" },
  { name: "Ollama", by: "Run locally" },
  { name: "Copilot", by: "GitHub" },
  { name: "Perplexity", by: "Search AI" },
  { name: "OpenRouter", by: "200+ models" },
  { name: "Windsurf", by: "Codeium" },
  { name: "Any MCP Client", by: "Universal protocol" },
];

/* ─── Capability cards ─── */
interface Cap {
  icon: LucideIcon;
  title: string;
  desc: string;
  detail: string;
}

const CAPABILITIES: Cap[] = [
  { icon: Search, title: "Semantic Search", desc: "Find by meaning, not keywords", detail: "BM25 + vector search. Ask \"that pricing article from last year\" and find it even if you never used the word \"pricing.\" HyDE, reranking, and contextual compression strategies built in." },
  { icon: MessageSquare, title: "Chat With Your Knowledge", desc: "Every answer cited from your data", detail: "Ask questions. Get answers grounded in YOUR memories — not generic internet. Every claim linked to its source. Switch AI models per-message." },
  { icon: Brain, title: "Knowledge Fingerprint", desc: "3D interactive map of your mind", detail: "WebGL visualization of your knowledge topology. See clusters form, spot isolated ideas, discover connections you never noticed. k-means clustering on your embeddings." },
  { icon: AlertTriangle, title: "Contradiction Finder", desc: "Past-you vs present-you", detail: "AI scans your entire knowledge base for conflicting beliefs, outdated information, and inconsistencies. See exactly where your thinking changed." },
  { icon: Route, title: "Topic Evolution", desc: "Watch your interests shift over time", detail: "Timeline visualization of how your knowledge evolved. Which topics grew, which faded. See your intellectual journey mapped chronologically." },
  { icon: Target, title: "Knowledge Gaps", desc: "AI maps what you're missing", detail: "Analyzes your knowledge graph to identify blind spots. Generates targeted learning paths for areas you should know more about." },
  { icon: Boxes, title: "Smart Collections", desc: "AI-organized knowledge clusters", detail: "k-means clustering groups your memories into coherent topics automatically. No manual tagging needed. Collections update as you add more knowledge." },
  { icon: GraduationCap, title: "Flashcard Engine", desc: "Spaced repetition from your knowledge", detail: "Auto-generates flashcards from any memory. Built-in SM-2 algorithm. Export to Anki (.apkg). Your own knowledge becomes your study material." },
  { icon: PenTool, title: "Content Generation", desc: "Blog posts, newsletters, resumes", detail: "Blog draft generator, newsletter curator, resume builder — all writing grounded in your actual knowledge, not hallucinated. Export to Markdown, Hugo, Jekyll, Astro." },
  { icon: Cpu, title: "Custom RAG Strategies", desc: "5 retrieval strategies, swappable", detail: "Default, HyDE, multi-query, reranking, contextual compression, maximal. Tune retrieval per-query. Domain-specific embeddings for medical, legal, code." },
  { icon: Languages, title: "Multi-Language", desc: "Store and search in any language", detail: "Cross-language semantic search. Write in English, find it in Japanese. Embeddings work across 100+ languages." },
  { icon: Eye, title: "Vision & Voice", desc: "Images and audio become searchable", detail: "Upload images → AI describes → searchable memory. Record voice → Whisper transcription → saved. Every modality becomes text you can search and chat with." },
];

/* ─── What You Can Actually Do ─── */
interface UseCase {
  icon: LucideIcon;
  title: string;
  desc: string;
  color: string;
}

const USE_CASES: UseCase[] = [
  { icon: FileText, title: "Import 5 years of ChatGPT and search it in seconds", desc: "Export your ChatGPT data, drop the ZIP. MindStore indexes every conversation. Ask \"what did I discuss about React hooks in 2024?\" and get the exact thread.", color: "rgba(20,184,166,0.1)" },
  { icon: BookOpen, title: "Turn 200 Kindle highlights into a connected knowledge graph", desc: "Import highlights from every book. See which ideas connect across authors. Find that Nassim Taleb quote that relates to your Kahneman notes.", color: "rgba(56,189,248,0.1)" },
  { icon: Lightbulb, title: "Ask Claude about YOUR code — not generic docs", desc: "Connect MindStore via MCP. Claude searches your personal notes, meeting prep, and domain knowledge before answering. Context that no foundation model has.", color: "rgba(245,158,11,0.1)" },
  { icon: BarChart3, title: "Discover contradictions in your own thinking", desc: "You wrote \"always use TypeScript\" in March and \"plain JS is fine for scripts\" in November. AI finds these. Track how your beliefs evolved.", color: "rgba(239,68,68,0.1)" },
  { icon: Network, title: "Map your entire intellectual landscape in 3D", desc: "Knowledge Fingerprint renders your mind as a WebGL graph. Clusters of related ideas. Orphaned concepts. Bridge ideas connecting domains.", color: "rgba(168,85,247,0.1)" },
  { icon: Newspaper, title: "Auto-curate a weekly newsletter from what you learned", desc: "Newsletter plugin scans recent memories, groups by topic, generates a digest. You edit, they read. Thought leadership from your actual knowledge.", color: "rgba(16,185,129,0.1)" },
];

export function LandingClient() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-zinc-100 selection:bg-teal-500/20 overflow-x-hidden">
      <style jsx global>{`
        @keyframes tickerLeft { from { transform: translateX(0); } to { transform: translateX(-33.333%); } }
        @keyframes tickerRight { from { transform: translateX(-33.333%); } to { transform: translateX(0); } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; } }
      `}</style>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "SoftwareApplication", name: "MindStore",
        applicationCategory: "ProductivityApplication", operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        description: "Personal knowledge OS. Import from 12+ sources, semantic search, MCP protocol, 35 plugins. MIT licensed.",
      }) }} />

      <NetworkParticles />

      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 h-[52px] px-5 lg:px-8 flex items-center justify-between backdrop-blur-xl"
        style={{ background: "rgba(10,10,11,0.85)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <Link href="/" className="flex items-center gap-2" aria-label="MindStore home">
          <MindStoreLogo className="w-6 h-6" />
          <span className="font-bold text-[14px] tracking-[-0.01em]">MindStore</span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-5">
          <Link href="/docs" className="text-[12px] text-zinc-500 hover:text-zinc-200 transition hidden sm:block">Docs</Link>
          <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer" className="text-[12px] text-zinc-500 hover:text-zinc-200 transition hidden sm:block">GitHub</a>
          <Link href="/app/plugins" className="text-[12px] text-zinc-500 hover:text-zinc-200 transition hidden md:block">Plugins</Link>
          <Link href="/app">
            <button className="h-[30px] px-3.5 rounded-lg text-[12px] font-bold bg-teal-500 text-white border-none cursor-pointer hover:bg-teal-400 transition-colors">Open App</button>
          </Link>
        </div>
      </nav>

      {/* ═══════ HERO ═══════ */}
      <section className="pt-[clamp(120px,16vh,180px)] pb-[clamp(24px,3vh,36px)] relative z-10">
        <div className="max-w-[1120px] mx-auto px-5 lg:px-8 text-center">
          <Reveal>
            <h1 className="text-[clamp(2.2rem,5vw,3.8rem)] font-extrabold leading-[1.06] tracking-[-0.04em]">
              You&apos;ve spent years learning things.<br />
              <span className="font-serif italic text-teal-400">Where did it all go?</span>
            </h1>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="text-[clamp(14px,1.6vw,16px)] mt-5 max-w-[560px] mx-auto leading-[1.7] text-zinc-400">
              MindStore imports everything you&apos;ve ever read, written, highlighted, or saved — makes it 
              searchable by meaning — and connects it to <strong className="text-zinc-200 font-semibold">any AI model</strong> you use. 
              Your knowledge, portable forever.
            </p>
          </Reveal>
          <Reveal delay={0.14}>
            <div className="flex gap-3 justify-center mt-6 flex-wrap">
              <Link href="/app">
                <button className="h-11 px-7 rounded-xl text-[14px] font-bold bg-teal-500 text-white cursor-pointer transition-all hover:bg-teal-400 hover:-translate-y-0.5 shadow-[0_4px_20px_rgba(20,184,166,0.15)]">
                  Get Started Free <ArrowRight className="w-4 h-4 inline ml-1" />
                </button>
              </Link>
              <Link href="/app?demo=true">
                <button className="h-11 px-5 rounded-xl text-[14px] font-medium bg-transparent text-zinc-500 border border-zinc-800 cursor-pointer transition-all hover:text-zinc-200 hover:border-zinc-600">
                  Try Demo
                </button>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ PRODUCT PREVIEW ═══════ */}
      <section className="pt-2 pb-[clamp(32px,5vh,48px)] relative z-10">
        <div className="max-w-[1120px] mx-auto px-5 lg:px-8">
          <Reveal delay={0.18}>
            <ProductPreview />
          </Reveal>
        </div>
      </section>

      {/* ═══════ SOURCE TICKER ═══════ */}
      <DualTicker />

      {/* ═══════ IMPORT SECTION ═══════ */}
      <section className="py-[clamp(56px,9vh,80px)] relative z-10">
        <div className="max-w-[1120px] mx-auto px-5 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div>
              <Reveal>
                <p className="text-[10px] font-semibold tracking-[0.12em] uppercase mb-3 text-teal-500">12+ importers</p>
                <h2 className="text-[clamp(1.4rem,2.8vw,2.2rem)] font-extrabold tracking-[-0.04em] leading-[1.1]">
                  Every source. One knowledge base.
                </h2>
              </Reveal>
              <Reveal delay={0.06}>
                <p className="text-[14px] mt-3 leading-[1.75] text-zinc-400 max-w-[440px]">
                  Drop a ChatGPT export ZIP — 5 years of conversations indexed in seconds. 
                  Import Kindle highlights with book structure preserved. Obsidian vaults with 
                  wikilinks and graph structure. Reddit saved posts. YouTube transcripts. 
                  PDFs with chapter-aware chunking. Everything becomes one searchable brain.
                </p>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="flex gap-3 mt-5 text-[11px] text-zinc-500 flex-wrap">
                  <span className="flex items-center gap-1.5"><Download className="w-3.5 h-3.5 text-teal-500" /> Drag &amp; drop</span>
                  <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-teal-500" /> Batch import</span>
                  <span className="flex items-center gap-1.5"><FileCheck className="w-3.5 h-3.5 text-teal-500" /> Deduplication</span>
                  <span className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5 text-teal-500" /> ZIP upload</span>
                </div>
              </Reveal>
            </div>
            {/* Import sources visual */}
            <Reveal delay={0.08}>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: MessageSquare, label: "ChatGPT" },
                  { icon: BookOpen, label: "Kindle" },
                  { icon: Globe, label: "YouTube" },
                  { icon: FileText, label: "Notion" },
                  { icon: FileCode, label: "Obsidian" },
                  { icon: Bookmark, label: "Reddit" },
                  { icon: FileText, label: "PDF/EPUB" },
                  { icon: Globe, label: "Twitter" },
                  { icon: Mic, label: "Voice" },
                  { icon: Image, label: "Images" },
                  { icon: Globe, label: "URLs" },
                  { icon: Puzzle, label: "+5 more" },
                ].map((s, i) => (
                  <div key={s.label} className="flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all hover:bg-white/[0.04]"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", animationDelay: `${i * 50}ms` }}>
                    <s.icon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span className="text-[12px] font-medium text-zinc-300">{s.label}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════ CHATGPT IMPORT HIGHLIGHT ═══════ */}
      <section className="py-[clamp(32px,5vh,48px)] relative z-10">
        <div className="max-w-[1120px] mx-auto px-5 lg:px-8">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl"
              style={{ background: "linear-gradient(135deg, rgba(20,184,166,0.08), rgba(56,189,248,0.05))", border: "1px solid rgba(20,184,166,0.12)" }}>
              <div className="relative flex flex-col sm:flex-row items-center gap-5 sm:gap-8 p-5 sm:p-7">
                {/* Left: icon + text */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.15)" }}>
                    <Zap className="w-5 h-5 text-teal-400" />
                  </div>
                  <div>
                    <h3 className="text-[16px] sm:text-[18px] font-bold tracking-[-0.02em] text-zinc-100">
                      Import your ChatGPT in 30 seconds
                    </h3>
                    <p className="text-[12px] sm:text-[13px] text-zinc-500 mt-0.5 leading-relaxed">
                      Export from ChatGPT settings → upload the ZIP → done. Years of conversations, instantly searchable.
                    </p>
                  </div>
                </div>
                {/* Right: steps */}
                <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                  {[
                    { step: "1", label: "Export" },
                    { step: "2", label: "Upload" },
                    { step: "3", label: "Search" },
                  ].map((s, i) => (
                    <div key={s.step} className="flex items-center gap-2">
                      {i > 0 && <ArrowRight className="w-3 h-3 text-zinc-700 -ml-1" />}
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-teal-400"
                          style={{ background: "rgba(20,184,166,0.15)" }}>
                          {s.step}
                        </span>
                        <span className="text-[11px] font-semibold text-zinc-400">{s.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ PORTABILITY — AI Models ═══════ */}
      <section className="py-[clamp(56px,9vh,80px)] relative z-10" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-[1120px] mx-auto px-5 lg:px-8">
          <div className="text-center max-w-[600px] mx-auto">
            <Reveal>
              <p className="text-[10px] font-semibold tracking-[0.12em] uppercase mb-3 text-teal-500">Portable knowledge</p>
              <h2 className="text-[clamp(1.4rem,2.8vw,2.2rem)] font-extrabold tracking-[-0.04em] leading-[1.1]">
                Connect to any AI. Your context follows you.
              </h2>
            </Reveal>
            <Reveal delay={0.06}>
              <p className="text-[14px] mt-3 leading-[1.75] text-zinc-400">
                MindStore speaks MCP — the open protocol. Add it as a tool in Claude, ChatGPT, Cursor, or any MCP client. 
                Three functions give any AI your entire knowledge context. Switch models anytime. Zero lock-in.
              </p>
            </Reveal>
          </div>
          {/* AI model grid — 2 rows of 5 on desktop, 2 cols on mobile */}
          <Reveal delay={0.1}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mt-8 max-w-[900px] mx-auto">
              {AI_MODELS.map((ai) => (
                <div key={ai.name} className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl transition-all hover:bg-white/[0.04] cursor-default"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <AILogo name={ai.name} />
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-zinc-200 truncate">{ai.name}</div>
                    <div className="text-[10px] text-zinc-600">{ai.by}</div>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ MCP ═══════ */}
      <section className="py-[clamp(56px,9vh,80px)] relative z-10" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-[1120px] mx-auto px-5 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
            <div>
              <Reveal>
                <p className="text-[10px] font-semibold tracking-[0.12em] uppercase mb-3 text-teal-500">MCP Protocol</p>
                <h2 className="text-[clamp(1.4rem,2.8vw,2.2rem)] font-extrabold tracking-[-0.04em] leading-[1.1]">
                  Three lines of config. Any AI gets your brain.
                </h2>
              </Reveal>
              <Reveal delay={0.06}>
                <p className="text-[14px] mt-3 leading-[1.75] text-zinc-400 max-w-[420px]">
                  Point any MCP client at your MindStore. Claude, Cursor, Windsurf — they instantly gain 
                  access to search your memories, read your knowledge profile, and pull deep context on any topic.
                </p>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="flex flex-col gap-2.5 mt-5">
                  {[
                    { fn: "search_mind", desc: "Semantic search across all your knowledge" },
                    { fn: "get_profile", desc: "Your expertise areas, writing style, knowledge stats" },
                    { fn: "get_context", desc: "Deep context: related memories, connections, timeline" },
                  ].map(t => (
                    <div key={t.fn} className="flex items-center gap-3">
                      <code className="font-mono text-[11px] px-2.5 py-0.5 rounded text-teal-400/70 shrink-0"
                        style={{ background: "rgba(20,184,166,0.05)", border: "1px solid rgba(20,184,166,0.1)" }}>
                        {t.fn}
                      </code>
                      <span className="text-[11px] text-zinc-500">{t.desc}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
            <Reveal delay={0.08}>
              <div className="rounded-2xl overflow-hidden" style={{ background: "#111113", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="px-3.5 py-2 flex items-center gap-[5px]" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div className="w-[7px] h-[7px] rounded-full" style={{ background: "rgba(239,68,68,0.4)" }} />
                  <div className="w-[7px] h-[7px] rounded-full" style={{ background: "rgba(234,179,8,0.4)" }} />
                  <div className="w-[7px] h-[7px] rounded-full" style={{ background: "rgba(34,197,94,0.4)" }} />
                  <span className="font-mono text-[9px] ml-2 text-zinc-700">claude_desktop_config.json</span>
                </div>
                <div className="p-4 font-mono text-[12px] leading-[1.9] text-zinc-600">
                  <pre className="whitespace-pre"><code>{`{\n  `}<span className="text-zinc-300">{`"mcpServers"`}</span>{`: {\n    `}<span className="text-zinc-300">{`"mindstore"`}</span>{`: {\n      `}<span className="text-zinc-300">{`"url"`}</span>{`: `}<span className="text-teal-400">{`"https://mindstore.org/api/mcp"`}</span>{`\n    }\n  }\n}`}</code></pre>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════ WHAT YOU CAN ACTUALLY DO ═══════ */}
      <section className="py-[clamp(56px,9vh,80px)] relative z-10" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-[1120px] mx-auto px-5 lg:px-8">
          <div className="text-center max-w-[600px] mx-auto mb-8">
            <Reveal>
              <p className="text-[10px] font-semibold tracking-[0.12em] uppercase mb-3 text-teal-500">Real power</p>
              <h2 className="text-[clamp(1.4rem,2.8vw,2.2rem)] font-extrabold tracking-[-0.04em] leading-[1.1]">
                Not another notes app. This is what you can actually do.
              </h2>
            </Reveal>
          </div>
          <div className="space-y-3">
            {USE_CASES.map((uc, i) => (
              <Reveal key={uc.title} delay={0.04 * i}>
                <div className="group grid lg:grid-cols-[1fr_1.5fr] gap-4 lg:gap-8 p-5 lg:p-6 rounded-2xl transition-all duration-300 hover:translate-x-1"
                  style={{ background: uc.color, border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div className="flex items-start gap-3">
                    <uc.icon className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                    <h3 className="text-[14px] lg:text-[15px] font-bold text-zinc-100 leading-[1.4]">{uc.title}</h3>
                  </div>
                  <p className="text-[13px] leading-[1.7] text-zinc-400">{uc.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ CAPABILITIES GRID ═══════ */}
      <section className="py-[clamp(56px,9vh,80px)] relative z-10" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-[1120px] mx-auto px-5 lg:px-8">
          <div className="text-center max-w-[600px] mx-auto mb-8">
            <Reveal>
              <p className="text-[10px] font-semibold tracking-[0.12em] uppercase mb-3 text-sky-400">35 plugins</p>
              <h2 className="text-[clamp(1.4rem,2.8vw,2.2rem)] font-extrabold tracking-[-0.04em] leading-[1.1]">
                Every tool your knowledge needs. Built in.
              </h2>
            </Reveal>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CAPABILITIES.map((cap, i) => (
              <Reveal key={cap.title} delay={0.03 * i}>
                <div className="group p-5 rounded-2xl transition-all duration-300 hover:bg-white/[0.03] cursor-default"
                  style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <cap.icon className="w-5 h-5 text-teal-500 mb-3" />
                  <h3 className="text-[13px] font-bold text-zinc-200">{cap.title}</h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5 font-medium">{cap.desc}</p>
                  <p className="text-[11px] text-zinc-600 mt-2 leading-[1.6] opacity-0 max-h-0 overflow-hidden transition-all duration-300 group-hover:opacity-100 group-hover:max-h-[200px] group-hover:mt-3">
                    {cap.detail}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.3}>
            <div className="text-center mt-6">
              <Link href="/app/plugins" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-teal-400 hover:text-teal-300 transition">
                Browse all 35 plugins <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ COMMUNITY ═══════ */}
      <section className="py-[clamp(56px,9vh,80px)] relative z-10"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: "linear-gradient(180deg, rgba(20,184,166,0.01) 0%, transparent 100%)" }}>
        <div className="max-w-[1120px] mx-auto px-5 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div>
              <Reveal>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold mb-4 text-teal-400"
                  style={{ background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.1)" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                  Coming soon
                </div>
                <h2 className="text-[clamp(1.4rem,2.8vw,2.2rem)] font-extrabold tracking-[-0.04em] leading-[1.1]">
                  Community knowledge bases.
                </h2>
              </Reveal>
              <Reveal delay={0.06}>
                <p className="text-[14px] mt-3 leading-[1.75] text-zinc-400 max-w-[440px]">
                  Browse curated knowledge bases from experts. A machine learning researcher shares their paper summaries. 
                  A chef shares recipe knowledge. Import what resonates into your own MindStore. Share yours back. 
                  Knowledge grows when it flows.
                </p>
              </Reveal>
            </div>
            <Reveal delay={0.08}>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { icon: Search, label: "Browse minds", desc: "Explore community knowledge on any topic" },
                  { icon: Download, label: "Import", desc: "Grab expertise into your own MindStore" },
                  { icon: Upload, label: "Share", desc: "Publish your knowledge base publicly" },
                  { icon: Merge, label: "Merge", desc: "Combine multiple knowledge bases" },
                ].map(item => (
                  <div key={item.label} className="p-4 rounded-xl transition-all hover:-translate-y-0.5"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <item.icon className="w-4 h-4 text-teal-500 mb-2" />
                    <div className="text-[12px] font-semibold text-zinc-200">{item.label}</div>
                    <div className="text-[10px] text-zinc-600 mt-0.5 leading-[1.5]">{item.desc}</div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════ OPEN SOURCE ═══════ */}
      <section className="py-[clamp(40px,6vh,56px)] relative z-10" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-[1120px] mx-auto px-5 lg:px-8">
          <div className="grid lg:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <Reveal>
                <h2 className="text-[clamp(1.1rem,2vw,1.4rem)] font-extrabold tracking-[-0.03em]">
                  MIT licensed. Self-hosted. Community-driven.
                </h2>
              </Reveal>
              <Reveal delay={0.06}>
                <p className="text-[13px] mt-2 leading-[1.7] text-zinc-500 max-w-[500px]">
                  You own the code. You own the data. Your AI keys stay on your machine. 
                  Plugin SDK for extending. Zero vendor lock-in. Zero AI costs for MindStore — you bring your own keys.
                </p>
              </Reveal>
            </div>
            <Reveal delay={0.1}>
              <div className="flex flex-wrap items-center gap-4 text-[11px] text-zinc-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-[5px] h-[5px] rounded-full bg-teal-500 animate-pulse" />
                  Actively developed
                </span>
                <span><Counter end={336} /> tests</span>
                <span><Counter end={66} /> API routes</span>
                <span><Counter end={103} /> docs</span>
                <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer"
                  className="font-semibold text-teal-500 hover:text-teal-400 transition">
                  Star on GitHub →
                </a>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════ CTA ═══════ */}
      <section className="py-[clamp(60px,10vh,88px)] text-center relative z-10" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-[1120px] mx-auto px-5 lg:px-8">
          <Reveal><MindStoreLogo className="w-12 h-12 mx-auto mb-4" /></Reveal>
          <Reveal delay={0.06}>
            <h2 className="text-[clamp(1.4rem,2.8vw,2.2rem)] font-extrabold tracking-[-0.04em]">
              Your knowledge deserves<br /><span className="font-serif italic text-teal-400">an operating system.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-[13px] mt-2 text-zinc-500">Free · Self-hosted · MIT open source · No sign-up required</p>
          </Reveal>
          <Reveal delay={0.14}>
            <div className="flex gap-3 justify-center mt-5 flex-wrap">
              <Link href="/app">
                <button className="h-11 px-7 rounded-xl text-[14px] font-bold bg-teal-500 text-white cursor-pointer transition-all hover:bg-teal-400 hover:-translate-y-0.5 shadow-[0_4px_20px_rgba(20,184,166,0.15)]">
                  Open MindStore <ArrowRight className="w-4 h-4 inline ml-1" />
                </button>
              </Link>
              <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer">
                <button className="h-11 px-5 rounded-xl text-[14px] font-medium bg-transparent text-zinc-500 border border-zinc-800 cursor-pointer transition-all hover:text-zinc-200 hover:border-zinc-600">
                  GitHub
                </button>
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-4 px-5 lg:px-8 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-800 max-w-[1120px] mx-auto relative z-10"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <span>MindStore · MIT License · {new Date().getFullYear()}</span>
        <div className="flex gap-4">
          <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-500 transition">GitHub</a>
          <Link href="/docs" className="hover:text-zinc-500 transition">Docs</Link>
          <Link href="/app/plugins" className="hover:text-zinc-500 transition">Plugins</Link>
        </div>
      </footer>
    </div>
  );
}
