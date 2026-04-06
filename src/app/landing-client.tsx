"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback, type ReactNode, type CSSProperties } from "react";
import { useSession } from "next-auth/react";
import {
  ArrowRight, Brain, Search, MessageSquare, Layers,
  FileText, BookOpen, Globe, Mic, Image, Bookmark,
  GitBranch, Network, Target,
  BarChart3, PenTool, Lightbulb, Puzzle,
  GraduationCap, Download, Upload, Merge,
  Sparkles, Eye, AlertTriangle, Cpu, Languages,
  Route, Boxes, FileCode, Newspaper, FileCheck,
  type LucideIcon,
} from "lucide-react";
import { MindStoreLogo } from "@/components/MindStoreLogo";

/* ═══════════════════════════════════════════════════════════════
   MindStore Landing — v5 "VC-Grade"
   
   Design system: OLED black (#0a0a0b), teal-500 primary, sky secondary.
   NO violet/purple/fuchsia. Lucide icons only. Clean flat typography.
   
   Structure: hero → demo → ticker → importers → AI portability →
   MCP config → use cases → capabilities → community → CTA
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

/* ─── Network Particles — throttled to 30fps for battery ─── */
function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W: number, H: number, id: number, lastFrame = 0;
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
    function draw(now: number) {
      id = requestAnimationFrame(draw);
      if (now - lastFrame < 33) return; // ~30fps cap
      lastFrame = now;
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
    }
    id = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(id); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true" />;
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
  { name: "Cursor", by: "AI IDE", color: "#38bdf8" },
  { name: "Ollama", by: "Local", color: "#f97316" },
  { name: "Copilot", by: "GitHub", color: "#60a5fa" },
  { name: "Perplexity", by: "Search", color: "#22d3ee" },
  { name: "OpenRouter", by: "200+ models", color: "#ef4444" },
  { name: "Windsurf", by: "Codeium", color: "#10b981" },
  { name: "Any MCP Client", by: "Open protocol", color: "#71717a" },
];

/* ─── Capabilities ─── */
const CAPS: { icon: LucideIcon; title: string; desc: string; accent: string }[] = [
  { icon: Search, title: "Semantic Search", desc: "BM25 + vector search with HyDE, reranking, and contextual compression. Find anything by meaning.", accent: "rgba(20,184,166,0.12)" },
  { icon: MessageSquare, title: "Chat With Your Mind", desc: "Ask questions. Get cited answers from YOUR data — not generic internet. Switch AI models per-message.", accent: "rgba(56,189,248,0.12)" },
  { icon: Brain, title: "Knowledge Fingerprint", desc: "3D WebGL visualization of your mind's topology. See clusters, connections, blind spots.", accent: "rgba(20,184,166,0.1)" },
  { icon: AlertTriangle, title: "Contradiction Finder", desc: "AI scans for conflicting beliefs and outdated information across your entire knowledge base.", accent: "rgba(239,68,68,0.1)" },
  { icon: Route, title: "Topic Evolution", desc: "Timeline of how your interests evolved. Which topics grew, which faded. Your intellectual journey.", accent: "rgba(245,158,11,0.1)" },
  { icon: Target, title: "Knowledge Gaps", desc: "Identifies blind spots. Generates targeted learning paths for what you should know more about.", accent: "rgba(16,185,129,0.1)" },
  { icon: GraduationCap, title: "Flashcard Engine", desc: "Auto-generated spaced repetition from any memory. SM-2 algorithm. Export to Anki.", accent: "rgba(56,189,248,0.1)" },
  { icon: PenTool, title: "Content Generation", desc: "Blog drafts, newsletters, resumes — all grounded in your actual knowledge. Export to Markdown, Hugo, Jekyll.", accent: "rgba(20,184,166,0.1)" },
  { icon: Cpu, title: "Custom RAG", desc: "5 retrieval strategies. Domain-specific embeddings for medical, legal, code. Tune per-query.", accent: "rgba(245,158,11,0.1)" },
  { icon: Languages, title: "Multi-Language", desc: "Cross-language semantic search. Write in English, find it in Japanese. 100+ languages.", accent: "rgba(56,189,248,0.1)" },
  { icon: Eye, title: "Vision & Voice", desc: "Images → AI description → searchable. Voice → Whisper transcription → saved. Every modality indexed.", accent: "rgba(239,68,68,0.1)" },
  { icon: Boxes, title: "Smart Collections", desc: "k-means clustering groups memories into topics automatically. No manual tagging needed.", accent: "rgba(16,185,129,0.1)" },
];

/* ─── Use Cases ─── */
const CASES = [
  { icon: BarChart3, title: "Watch your beliefs contradict each other over time", desc: "You wrote \"always use TypeScript\" in March and \"plain JS is fine for scripts\" in November. AI finds these. Track how your thinking evolved." },
  { icon: Network, title: "See your entire mind rendered as a 3D graph", desc: "Knowledge Fingerprint: WebGL visualization. Clusters of related ideas. Orphaned concepts. Bridge ideas connecting domains you never realized were linked." },
  { icon: Lightbulb, title: "Give Claude access to YOUR knowledge — not just the internet", desc: "Connect via MCP. Claude searches your notes, meeting prep, domain knowledge before answering. Context no foundation model has." },
  { icon: FileText, title: "Import 5 years of ChatGPT and search it in seconds", desc: "Export your data, drop the ZIP. Every conversation indexed. Ask \"what did I discuss about React hooks in 2024?\" — get the exact thread." },
  { icon: BookOpen, title: "Turn 200 Kindle highlights into a connected knowledge graph", desc: "Import from every book. See which ideas connect across authors. Find that Taleb quote that relates to your Kahneman notes." },
  { icon: Newspaper, title: "Auto-generate a newsletter from what you actually learned this week", desc: "Newsletter plugin scans recent memories, groups by topic, generates a digest. You edit, they read. Thought leadership from real knowledge." },
];

/* ─── App Showcase with animated cursor ─── */

/* Sidebar items — label, path, icon indicator */
const NAV_ITEMS = [
  { label: "Dashboard", path: "/app", group: "main" },
  { label: "Explore", path: "/app/explore", group: "main" },
  { label: "Chat", path: "/app/chat", group: "main" },
  { label: "Fingerprint", path: "/app/fingerprint", group: "plugins" },
  { label: "Flashcards", path: "/app/flashcards", group: "plugins" },
  { label: "Evolution", path: "/app/evolution", group: "plugins" },
  { label: "Plugins", path: "/app/plugins", group: "main" },
];

/* Screen renderers keyed by index */
const SCREEN_CONTENT: Record<number, () => ReactNode> = {
  /* Dashboard */
  0: () => (
    <div className="p-4 sm:p-5 space-y-3">
      <div className="text-[13px] font-semibold text-zinc-200 tracking-[-0.02em]">Your Mind</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { v: "2,847", l: "Memories", c: "rgba(20,184,166,0.12)" },
          { v: "1,423", l: "ChatGPT", c: "rgba(16,185,129,0.12)" },
          { v: "892", l: "Books", c: "rgba(245,158,11,0.12)" },
          { v: "532", l: "Notes", c: "rgba(59,130,246,0.12)" },
        ].map(s => (
          <div key={s.l} className="rounded-lg p-2" style={{ background: s.c, border: "1px solid rgba(255,255,255,0.03)" }}>
            <div className="text-[13px] font-bold text-zinc-200 tabular-nums">{s.v}</div>
            <div className="text-[8px] text-zinc-500 mt-0.5">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.03)" }}>
        <div className="text-[9px] text-zinc-600 mb-1.5">14-day activity</div>
        <div className="flex items-end gap-[2px] h-10">
          {[3,5,2,7,4,8,6,9,5,3,7,8,4,6].map((h, i) => (
            <div key={i} className="flex-1 rounded-sm" style={{ height: `${h * 11}%`, background: `rgba(20,184,166,${0.2 + h * 0.08})` }} />
          ))}
        </div>
      </div>
      <div className="space-y-1">
        {[
          { t: "Thinking, Fast and Slow", s: "Kindle", c: "#f59e0b" },
          { t: "React Server Components deep dive", s: "ChatGPT", c: "#10b981" },
          { t: "Stripe API architecture notes", s: "URL", c: "#3b82f6" },
        ].map(m => (
          <div key={m.t} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.015)" }}>
            <div className="w-1 h-5 rounded-full shrink-0" style={{ background: m.c }} />
            <div className="min-w-0">
              <div className="text-[10px] font-medium text-zinc-300 truncate">{m.t}</div>
              <div className="text-[8px] text-zinc-600">{m.s}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
  /* Explore */
  1: () => (
    <div className="p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2 px-3 h-8 rounded-lg" style={{ background: "rgba(20,184,166,0.04)", border: "1px solid rgba(20,184,166,0.1)" }}>
        <Search className="w-3.5 h-3.5 text-teal-400" />
        <span className="text-[11px] text-zinc-300">transformers attention mechanism</span>
      </div>
      <div className="flex gap-1.5 text-[9px]">
        {["Semantic", "Hybrid", "Keyword"].map(m => (
          <span key={m} className={`px-2 py-0.5 rounded ${m === "Semantic" ? "bg-teal-500/10 text-teal-400" : "bg-white/[0.03] text-zinc-600"}`}>{m}</span>
        ))}
      </div>
      {[
        { t: "AI Architecture Deep Dive", s: "ChatGPT", sc: 98, c: "#10b981" },
        { t: "Attention Is All You Need — notes", s: "Kindle", sc: 94, c: "#f59e0b" },
        { t: "Neural network lecture highlights", s: "YouTube", sc: 89, c: "#ef4444" },
        { t: "Transformer implementation walkthrough", s: "Notes", sc: 85, c: "#3b82f6" },
      ].map(r => (
        <div key={r.t} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.03)" }}>
          <div className="w-1 h-7 rounded-full shrink-0" style={{ background: r.c }} />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold text-zinc-200 truncate">{r.t}</div>
            <div className="text-[8px] text-zinc-600">{r.s}</div>
          </div>
          <span className="text-[10px] font-mono text-teal-500/70 shrink-0">{r.sc}%</span>
        </div>
      ))}
    </div>
  ),
  /* Chat */
  2: () => (
    <div className="p-4 sm:p-5 flex flex-col h-[320px] sm:h-[360px]">
      <div className="flex-1 space-y-3 overflow-hidden">
        <div className="flex gap-2">
          <div className="w-5 h-5 rounded-full bg-teal-500/20 flex items-center justify-center shrink-0"><span className="text-[8px] text-teal-400">Y</span></div>
          <div className="px-3 py-2 rounded-xl rounded-tl-sm text-[11px] text-zinc-300 max-w-[80%]" style={{ background: "rgba(255,255,255,0.04)" }}>
            What do my notes say about attention mechanisms?
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center shrink-0"><Sparkles className="w-2.5 h-2.5 text-sky-400" /></div>
          <div className="px-3 py-2 rounded-xl rounded-tl-sm text-[11px] text-zinc-400 max-w-[85%] leading-[1.6]" style={{ background: "rgba(56,189,248,0.04)" }}>
            Based on your knowledge base, attention mechanisms allow models to weigh different parts of the input dynamically. Your notes from <span className="text-sky-400/80">&quot;AI Architecture Deep Dive&quot;</span> describe self-attention as computing relevance scores between all token pairs...
            <div className="flex gap-1 mt-2">
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400/60">3 sources cited</span>
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/[0.03] text-zinc-600">GPT-4o</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 h-8 rounded-lg mt-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <span className="text-[10px] text-zinc-600 flex-1">Ask your knowledge…</span>
        <ArrowRight className="w-3 h-3 text-zinc-700" />
      </div>
    </div>
  ),
  /* Knowledge Fingerprint — 3D-ish graph */
  3: () => (
    <div className="p-4 sm:p-5">
      <div className="text-[13px] font-semibold text-zinc-200 tracking-[-0.02em] mb-2">Knowledge Fingerprint</div>
      <div className="relative h-[260px] sm:h-[300px] rounded-xl overflow-hidden" style={{ background: "rgba(0,0,0,0.4)" }}>
        <svg viewBox="0 0 400 300" className="w-full h-full">
          {/* Grid lines for depth */}
          {[60,120,180,240].map(y => <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="rgba(20,184,166,0.03)" strokeWidth="0.5" />)}
          {[80,160,240,320].map(x => <line key={x} x1={x} y1="0" x2={x} y2="300" stroke="rgba(20,184,166,0.03)" strokeWidth="0.5" />)}
          {/* Connections */}
          {[
            [120,70,200,140],[200,140,310,90],[200,140,155,210],[155,210,75,185],
            [310,90,345,185],[345,185,275,230],[275,230,200,140],[75,185,120,70],
            [155,210,275,230],[120,70,55,140],[55,140,75,185],[310,90,365,55],
            [345,185,365,55],[275,230,200,270],[200,270,120,250],[120,250,75,185],
            [200,140,200,270],[55,140,120,250],[310,90,275,230],
          ].map(([x1,y1,x2,y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(20,184,166,0.12)" strokeWidth="0.8">
              <animate attributeName="opacity" values="0.08;0.18;0.08" dur={`${3 + i * 0.3}s`} repeatCount="indefinite" />
            </line>
          ))}
          {/* Nodes with pulsing */}
          {[
            { x: 120, y: 70, r: 16, c: "#14b8a6", l: "AI/ML" },
            { x: 200, y: 140, r: 22, c: "#14b8a6", l: "Core" },
            { x: 310, y: 90, r: 14, c: "#38bdf8", l: "Code" },
            { x: 155, y: 210, r: 12, c: "#f59e0b", l: "Books" },
            { x: 75, y: 185, r: 10, c: "#71717a", l: "Philosophy" },
            { x: 345, y: 185, r: 11, c: "#10b981", l: "Finance" },
            { x: 275, y: 230, r: 9, c: "#10b981", l: "Health" },
            { x: 55, y: 140, r: 8, c: "#f97316", l: "Music" },
            { x: 365, y: 55, r: 7, c: "#22d3ee", l: "Travel" },
            { x: 200, y: 270, r: 10, c: "#ef4444", l: "Cooking" },
            { x: 120, y: 250, r: 8, c: "#71717a", l: "Design" },
          ].map((n, i) => (
            <g key={i}>
              <circle cx={n.x} cy={n.y} r={n.r * 1.5} fill={n.c} opacity="0.06">
                <animate attributeName="r" values={`${n.r * 1.2};${n.r * 1.8};${n.r * 1.2}`} dur={`${2.5 + i * 0.4}s`} repeatCount="indefinite" />
              </circle>
              <circle cx={n.x} cy={n.y} r={n.r * 0.7} fill={n.c} opacity="0.6" />
              <circle cx={n.x} cy={n.y} r={n.r * 0.3} fill="white" opacity="0.3" />
              <text x={n.x} y={n.y + n.r + 11} textAnchor="middle" fontSize="7.5" fill="rgba(161,161,170,0.5)" fontFamily="system-ui">{n.l}</text>
            </g>
          ))}
        </svg>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 50% 47%, rgba(20,184,166,0.06), transparent 65%)" }} />
      </div>
      <div className="flex gap-3 mt-2 text-[9px] text-zinc-600">
        <span>11 clusters</span><span>·</span><span>2,847 nodes</span><span>·</span><span>4,230 edges</span>
      </div>
    </div>
  ),
  /* Flashcards */
  4: () => (
    <div className="p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[13px] font-semibold text-zinc-200">Flashcards</div>
        <span className="text-[9px] text-zinc-500">42 due today</span>
      </div>
      <div className="rounded-xl p-5 text-center" style={{ background: "rgba(20,184,166,0.04)", border: "1px solid rgba(20,184,166,0.08)" }}>
        <div className="text-[9px] text-teal-500/50 font-medium mb-1.5">QUESTION</div>
        <div className="text-[14px] text-zinc-200 font-medium leading-[1.5]">
          What is the key innovation<br />of the Transformer architecture?
        </div>
        <div className="text-[9px] text-zinc-600 mt-2.5">from &quot;AI Architecture Deep Dive&quot;</div>
      </div>
      <div className="flex justify-center gap-2 mt-3">
        {[
          { l: "Again", c: "rgba(239,68,68,0.12)" },
          { l: "Hard", c: "rgba(245,158,11,0.12)" },
          { l: "Good", c: "rgba(20,184,166,0.12)" },
          { l: "Easy", c: "rgba(59,130,246,0.12)" },
        ].map(b => (
          <div key={b.l} className="px-3.5 py-1 rounded-lg text-[10px] font-medium text-zinc-400" style={{ background: b.c }}>{b.l}</div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div className="h-full rounded-full" style={{ width: "65%", background: "rgba(20,184,166,0.5)" }} />
        </div>
        <span className="text-[8px] text-zinc-600">27/42</span>
      </div>
    </div>
  ),
  /* Topic Evolution */
  5: () => (
    <div className="p-4 sm:p-5">
      <div className="text-[13px] font-semibold text-zinc-200 mb-1">Topic Evolution</div>
      <div className="text-[9px] text-zinc-600 mb-3">12-month interest shifts</div>
      <div className="space-y-2">
        {[
          { topic: "Machine Learning", months: [2,3,5,7,8,9,8,7,6,5,4,3], c: "#14b8a6" },
          { topic: "React & Frontend", months: [6,5,4,3,3,4,5,7,8,9,8,7], c: "#38bdf8" },
          { topic: "Business Strategy", months: [1,2,3,4,6,7,8,7,6,5,4,3], c: "#f59e0b" },
          { topic: "Philosophy", months: [4,5,6,5,3,2,1,2,3,4,5,6], c: "#71717a" },
          { topic: "Health & Fitness", months: [3,3,4,5,6,7,8,8,7,6,5,4], c: "#10b981" },
        ].map(row => (
          <div key={row.topic} className="flex items-center gap-2.5">
            <div className="w-[80px] shrink-0 text-[9px] text-zinc-400 truncate">{row.topic}</div>
            <div className="flex-1 flex items-center gap-[2px] h-4">
              {row.months.map((v, i) => (
                <div key={i} className="flex-1 rounded-sm" style={{ height: `${v * 10}%`, background: row.c, opacity: 0.15 + v * 0.085 }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1.5 text-[7px] text-zinc-700 pl-[40px] sm:pl-[85px]">
        <span>Jan</span><span>Apr</span><span>Jul</span><span>Oct</span>
      </div>
    </div>
  ),
  /* Plugin Store */
  6: () => (
    <div className="p-4 sm:p-5">
      <div className="text-[13px] font-semibold text-zinc-200 mb-3">Plugin Store</div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { name: "Knowledge Fingerprint", desc: "3D mind visualization", icon: Network, installed: true, c: "#14b8a6" },
          { name: "Flashcard Engine", desc: "SM-2 spaced repetition", icon: GraduationCap, installed: true, c: "#38bdf8" },
          { name: "Contradiction Finder", desc: "Spot conflicting beliefs", icon: AlertTriangle, installed: false, c: "#ef4444" },
          { name: "Mind Map", desc: "Visual knowledge graph", icon: GitBranch, installed: true, c: "#10b981" },
          { name: "Blog Draft", desc: "Write from knowledge", icon: PenTool, installed: false, c: "#f59e0b" },
          { name: "Voice to Memory", desc: "Whisper transcription", icon: Mic, installed: false, c: "#f97316" },
        ].map(p => (
          <div key={p.name} className="p-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="flex items-center gap-2 mb-1.5">
              <p.icon className="w-3.5 h-3.5" style={{ color: p.c }} />
              <span className="text-[10px] font-semibold text-zinc-200">{p.name}</span>
            </div>
            <div className="text-[8px] text-zinc-600 mb-2">{p.desc}</div>
            <div className={`text-[8px] font-medium px-2 py-0.5 rounded-md inline-block ${
              p.installed ? "bg-teal-500/10 text-teal-400" : "bg-white/[0.04] text-zinc-500"
            }`}>
              {p.installed ? "Installed" : "Install"}
            </div>
          </div>
        ))}
      </div>
      <div className="text-center mt-3 text-[9px] text-zinc-600">35 plugins available · All free</div>
    </div>
  ),
};

/* Cursor choreography: [navIndex, pauseMs] */
const CHOREOGRAPHY: [number, number][] = [
  [0, 3200],  // Dashboard
  [1, 3200],  // Explore
  [2, 3200],  // Chat
  [3, 4000],  // Fingerprint (longer — it's impressive)
  [4, 3200],  // Flashcards
  [5, 3200],  // Evolution
  [6, 3200],  // Plugins
];

function Demo() {
  const [step, setStep] = useState(0);
  const [cursorTarget, setCursorTarget] = useState(0);
  const [clicking, setClicking] = useState(false);
  const [activeScreen, setActiveScreen] = useState(0);
  const [inView, setInView] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sidebarRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const o = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.15 });
    o.observe(el); return () => o.disconnect();
  }, []);

  /* Choreography loop */
  useEffect(() => {
    if (!inView) return;

    const [navIdx, pause] = CHOREOGRAPHY[step];

    // Phase 1: Move cursor to target (takes ~600ms via CSS transition)
    setCursorTarget(navIdx);
    
    // Phase 2: Click after cursor arrives
    const clickT = setTimeout(() => {
      setClicking(true);
      setTimeout(() => {
        setClicking(false);
        // Transition content
        setTransitioning(true);
        setTimeout(() => {
          setActiveScreen(navIdx);
          setTransitioning(false);
        }, 150);
      }, 150);
    }, 650);

    // Phase 3: Wait, then advance
    const nextT = setTimeout(() => {
      setStep(s => (s + 1) % CHOREOGRAPHY.length);
    }, 650 + pause);

    return () => { clearTimeout(clickT); clearTimeout(nextT); };
  }, [inView, step]);

  /* Get cursor position relative to container */
  const getCursorPos = useCallback(() => {
    const target = sidebarRefs.current[cursorTarget];
    const container = containerRef.current;
    if (!target || !container) return { x: 80, y: 100 };
    const tRect = target.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    return {
      x: tRect.left - cRect.left + tRect.width * 0.6,
      y: tRect.top - cRect.top + tRect.height * 0.5,
    };
  }, [cursorTarget]);

  const [cursorPos, setCursorPos] = useState({ x: 80, y: 100 });
  
  useEffect(() => {
    // Recalculate on target change
    const raf = requestAnimationFrame(() => setCursorPos(getCursorPos()));
    return () => cancelAnimationFrame(raf);
  }, [cursorTarget, getCursorPos]);

  // Also recalculate on resize
  useEffect(() => {
    const h = () => setCursorPos(getCursorPos());
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, [getCursorPos]);

  const currentNav = NAV_ITEMS[activeScreen];

  return (
    <div ref={ref} className="relative mx-auto max-w-[840px]">
      <div className="absolute -inset-12 rounded-[48px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(20,184,166,0.08), rgba(56,189,248,0.04), transparent 70%)", filter: "blur(40px)" }} />
      <div ref={containerRef} className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/60"
        style={{ background: "#0c0c0e", border: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Chrome bar */}
        <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="flex gap-[6px]">
            <div className="w-[10px] h-[10px] rounded-full" style={{ background: "rgba(239,68,68,0.5)" }} />
            <div className="w-[10px] h-[10px] rounded-full" style={{ background: "rgba(234,179,8,0.5)" }} />
            <div className="w-[10px] h-[10px] rounded-full" style={{ background: "rgba(34,197,94,0.5)" }} />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] text-zinc-600 transition-all duration-300" style={{ background: "rgba(255,255,255,0.03)" }}>
              <span className="w-2 h-2 rounded-sm" style={{ background: "rgba(20,184,166,0.5)" }} />
              mindstore.org{currentNav?.path || "/app"}
            </div>
          </div>
          <div className="w-16" />
        </div>
        
        {/* Sidebar + Content */}
        <div className="flex">
          {/* Sidebar */}
          <div className="hidden sm:flex w-[150px] flex-col shrink-0 p-2 gap-px"
            style={{ borderRight: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="flex items-center gap-2 px-2 py-2 mb-1">
              <MindStoreLogo className="w-4 h-4" />
              <span className="text-[9px] font-bold text-zinc-300">MindStore</span>
            </div>
            {/* Main section */}
            <div className="text-[7px] text-zinc-700 uppercase tracking-wider px-2 pt-1 pb-0.5">Main</div>
            {NAV_ITEMS.filter(n => n.group === "main").map((nav, _) => {
              const globalIdx = NAV_ITEMS.indexOf(nav);
              return (
                <div key={nav.label} ref={el => { sidebarRefs.current[globalIdx] = el; }}
                  className={`px-2 py-1.5 rounded-md text-[9px] transition-all duration-300 ${
                    activeScreen === globalIdx ? "bg-white/[0.06] text-zinc-200 font-medium" : "text-zinc-600"
                  }`}>
                  {nav.label}
                </div>
              );
            })}
            <div className="text-[7px] text-zinc-700 uppercase tracking-wider px-2 pt-2 pb-0.5">Plugins</div>
            {NAV_ITEMS.filter(n => n.group === "plugins").map((nav) => {
              const globalIdx = NAV_ITEMS.indexOf(nav);
              return (
                <div key={nav.label} ref={el => { sidebarRefs.current[globalIdx] = el; }}
                  className={`px-2 py-1.5 rounded-md text-[9px] transition-all duration-300 ${
                    activeScreen === globalIdx ? "bg-white/[0.06] text-zinc-200 font-medium" : "text-zinc-600"
                  }`}>
                  {nav.label}
                </div>
              );
            })}
          </div>

          {/* Content area */}
          <div className="flex-1 min-h-[320px] sm:min-h-[380px] relative overflow-hidden">
            <div style={{ opacity: transitioning ? 0 : 1, transform: transitioning ? "translateY(6px)" : "none", transition: "opacity .2s, transform .2s" }}>
              {SCREEN_CONTENT[activeScreen]?.() ?? null}
            </div>
          </div>
        </div>

        {/* Animated Cursor — desktop only */}
        <div className="hidden sm:block absolute z-30 pointer-events-none"
          style={{
            left: cursorPos.x, top: cursorPos.y,
            transition: "left .6s cubic-bezier(.16,1,.3,1), top .6s cubic-bezier(.16,1,.3,1)",
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
          }}>
          {/* Cursor SVG */}
          <svg width="16" height="20" viewBox="0 0 16 20" fill="none" style={{ transform: clicking ? "scale(0.85)" : "scale(1)", transition: "transform .15s ease" }}>
            <path d="M1 1L1 14.5L4.5 11L8 18L10.5 17L7 10L12 10L1 1Z" fill="white" stroke="black" strokeWidth="1" />
          </svg>
          {/* Click ripple */}
          {clicking && (
            <div className="absolute -left-3 -top-3 w-8 h-8 rounded-full" style={{ background: "rgba(20,184,166,0.3)", animation: "clickRipple .4s ease-out forwards" }} />
          )}
        </div>

        {/* Mobile nav dots */}
        <div className="sm:hidden flex justify-center gap-1.5 pb-3">
          {NAV_ITEMS.map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeScreen ? "bg-teal-500 w-4" : "bg-zinc-700"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */

export function LandingClient() {
  const { data: session } = useSession();
  const isLoggedIn = !!(session as any)?.userId;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-zinc-100 selection:bg-teal-500/20 overflow-x-hidden relative">
      <style jsx global>{`
        @keyframes tkL { from{transform:translateX(0)} to{transform:translateX(-33.333%)} }
        @keyframes tkR { from{transform:translateX(-33.333%)} to{transform:translateX(0)} }
        @keyframes clickRipple { 0%{transform:scale(0);opacity:1} 100%{transform:scale(2.5);opacity:0} }
        @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}
      `}</style>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "SoftwareApplication", name: "MindStore",
        applicationCategory: "ProductivityApplication", operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      }) }} />

      <Particles />

      {/* ═══════ NAV ═══════ */}
      <nav className="fixed top-0 inset-x-0 z-50 h-14 px-6 lg:px-10 flex items-center justify-between backdrop-blur-2xl"
        style={{ background: "rgba(10,10,11,0.85)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <Link href="/" className="flex items-center gap-2.5" aria-label="MindStore home">
          <MindStoreLogo className="w-7 h-7" />
          <span className="font-bold text-[15px] tracking-[-0.02em]">MindStore</span>
        </Link>
        <div className="flex items-center gap-5">
          <Link href="/docs" className="text-[13px] text-zinc-500 hover:text-zinc-200 transition hidden sm:block">Docs</Link>
          <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer" className="text-[13px] text-zinc-500 hover:text-zinc-200 transition hidden sm:block">GitHub</a>
          <Link href="/app">
            <button className="h-8 px-4 rounded-lg text-[13px] font-bold bg-teal-500 text-white border-none cursor-pointer hover:bg-teal-400 transition-all hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0b]">
              {isLoggedIn ? "Dashboard" : "Open App"}
            </button>
          </Link>
        </div>
      </nav>

      {/* ═══════ HERO — generous space ═══════ */}
      <section className="relative z-10 pt-[clamp(140px,20vh,220px)] pb-[clamp(48px,7vh,64px)]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10">
          <R>
            <h1 className="text-[clamp(2.6rem,6vw,4.5rem)] font-extrabold leading-[1.02] tracking-[-0.045em] max-w-[800px]">
              You&apos;ve spent years learning things.{" "}
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
          <R delay={0.16}>
            <div className="flex flex-wrap gap-2 mt-5 text-[12px]">
              {[
                { label: "Search by meaning", color: "text-teal-400" },
                { label: "Chat with your notes", color: "text-sky-400" },
                { label: "Find contradictions", color: "text-amber-400" },
                { label: "Track how you've changed", color: "text-emerald-400" },
                { label: "Connect to any AI", color: "text-teal-400" },
              ].map(tag => (
                <span key={tag.label} className={`px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] ${tag.color}/80`}>{tag.label}</span>
              ))}
            </div>
          </R>
          <R delay={0.18}>
            <div className="flex gap-3 mt-8 flex-wrap">
              <Link href="/app">
                <button className="h-12 px-8 rounded-xl text-[15px] font-bold bg-teal-500 text-white cursor-pointer transition-all hover:bg-teal-400 hover:-translate-y-0.5 shadow-[0_6px_24px_rgba(20,184,166,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0b]">
                  {isLoggedIn ? <>Go to Dashboard <ArrowRight className="w-4 h-4 inline ml-1.5" /></> : <>Get Started Free <ArrowRight className="w-4 h-4 inline ml-1.5" /></>}
                </button>
              </Link>
              {!isLoggedIn && (
                <Link href="/app?demo=true">
                  <button className="h-12 px-6 rounded-xl text-[15px] font-medium bg-transparent text-zinc-400 border border-zinc-800 cursor-pointer transition-all hover:text-zinc-100 hover:border-zinc-600">
                    Try Demo
                  </button>
                </Link>
              )}
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

      {/* ═══════ ANALYSIS SUITE — what you do with your knowledge ═══════ */}
      <section className="relative z-10 py-[clamp(80px,12vh,120px)]" style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10">
          <R>
            <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-sky-400 mb-4">Knowledge intelligence</p>
            <h2 className="text-[clamp(1.6rem,3.2vw,2.8rem)] font-extrabold tracking-[-0.04em] leading-[1.08] max-w-[600px]">
              Not just storage.<br />A second brain that thinks.
            </h2>
          </R>
          <R delay={0.08}>
            <p className="text-[16px] mt-5 leading-[1.8] text-zinc-400 max-w-[520px]">
              MindStore doesn&apos;t just hold your knowledge — it analyzes it. Finds contradictions
              you wrote years apart. Tracks how your thinking evolved. Surfaces gaps in what you know.
            </p>
          </R>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                icon: AlertTriangle,
                label: "Contradiction Finder",
                desc: "You wrote \"always TypeScript\" in March, \"JS is fine\" in November. AI finds these.",
                color: "text-red-400",
                bg: "rgba(239,68,68,0.05)",
                border: "rgba(239,68,68,0.1)",
              },
              {
                icon: Route,
                label: "Topic Evolution",
                desc: "Timeline of how your interests shifted. Which ideas grew, which faded. Your intellectual arc.",
                color: "text-amber-400",
                bg: "rgba(245,158,11,0.05)",
                border: "rgba(245,158,11,0.1)",
              },
              {
                icon: Target,
                label: "Knowledge Gaps",
                desc: "AI identifies blind spots and generates targeted reading lists for what you should know.",
                color: "text-emerald-400",
                bg: "rgba(16,185,129,0.05)",
                border: "rgba(16,185,129,0.1)",
              },
              {
                icon: Brain,
                label: "Knowledge Fingerprint",
                desc: "3D WebGL graph of your mind's topology. Clusters, bridges, and orphaned ideas — rendered live.",
                color: "text-teal-400",
                bg: "rgba(20,184,166,0.05)",
                border: "rgba(20,184,166,0.1)",
              },
            ].map((item, i) => (
              <R key={item.label} delay={0.06 * i}>
                <div className="p-5 rounded-2xl h-full transition-all hover:-translate-y-0.5 hover:bg-white/[0.02]"
                  style={{ background: item.bg, border: `1px solid ${item.border}` }}>
                  <item.icon className={`w-5 h-5 ${item.color} mb-4`} />
                  <h3 className="text-[14px] font-bold text-zinc-200 mb-2">{item.label}</h3>
                  <p className="text-[12px] text-zinc-500 leading-[1.65]">{item.desc}</p>
                </div>
              </R>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ KNOWLEDGE GRAPH — visual centerpiece ═══════ */}
      <section className="relative z-10 py-[clamp(80px,12vh,120px)]" style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Graph visual */}
            <R delay={0.04}>
              <div className="relative rounded-2xl overflow-hidden order-last lg:order-first"
                style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(20,184,166,0.08)" }}>
                <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: "rgba(20,184,166,0.6)" }} />
                  <span className="text-[10px] font-mono text-zinc-700">Knowledge Fingerprint — live graph</span>
                </div>
                <div className="p-2">
                  <svg viewBox="0 0 400 300" className="w-full h-auto">
                    {[60,120,180,240].map(y => <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="rgba(20,184,166,0.03)" strokeWidth="0.5" />)}
                    {[80,160,240,320].map(x => <line key={x} x1={x} y1="0" x2={x} y2="300" stroke="rgba(20,184,166,0.03)" strokeWidth="0.5" />)}
                    {[
                      [120,70,200,140],[200,140,310,90],[200,140,155,210],[155,210,75,185],
                      [310,90,345,185],[345,185,275,230],[275,230,200,140],[75,185,120,70],
                      [155,210,275,230],[120,70,55,140],[55,140,75,185],[310,90,365,55],
                      [345,185,365,55],[275,230,200,270],[200,270,120,250],[120,250,75,185],
                      [200,140,200,270],[55,140,120,250],[310,90,275,230],
                    ].map(([x1,y1,x2,y2], i) => (
                      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(20,184,166,0.15)" strokeWidth="0.8">
                        <animate attributeName="opacity" values="0.06;0.22;0.06" dur={`${3 + i * 0.3}s`} repeatCount="indefinite" />
                      </line>
                    ))}
                    {[
                      { x: 120, y: 70, r: 16, c: "#14b8a6", l: "AI/ML" },
                      { x: 200, y: 140, r: 22, c: "#14b8a6", l: "Core" },
                      { x: 310, y: 90, r: 14, c: "#38bdf8", l: "Code" },
                      { x: 155, y: 210, r: 12, c: "#f59e0b", l: "Books" },
                      { x: 75, y: 185, r: 10, c: "#71717a", l: "Philosophy" },
                      { x: 345, y: 185, r: 11, c: "#10b981", l: "Finance" },
                      { x: 275, y: 230, r: 9, c: "#10b981", l: "Health" },
                      { x: 55, y: 140, r: 8, c: "#f97316", l: "Music" },
                      { x: 365, y: 55, r: 7, c: "#22d3ee", l: "Travel" },
                      { x: 200, y: 270, r: 10, c: "#ef4444", l: "Cooking" },
                      { x: 120, y: 250, r: 8, c: "#71717a", l: "Design" },
                    ].map((n, i) => (
                      <g key={i}>
                        <circle cx={n.x} cy={n.y} r={n.r * 1.5} fill={n.c} opacity="0.07">
                          <animate attributeName="r" values={`${n.r * 1.2};${n.r * 1.9};${n.r * 1.2}`} dur={`${2.5 + i * 0.4}s`} repeatCount="indefinite" />
                        </circle>
                        <circle cx={n.x} cy={n.y} r={n.r * 0.7} fill={n.c} opacity="0.65" />
                        <circle cx={n.x} cy={n.y} r={n.r * 0.3} fill="white" opacity="0.3" />
                        <text x={n.x} y={n.y + n.r + 11} textAnchor="middle" fontSize="7.5" fill="rgba(161,161,170,0.55)" fontFamily="system-ui">{n.l}</text>
                      </g>
                    ))}
                  </svg>
                </div>
                {/* Stat overlays */}
                <div className="absolute top-10 left-4 px-2.5 py-1.5 rounded-lg text-[10px] font-mono"
                  style={{ background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.12)" }}>
                  <span className="text-teal-400">11 clusters</span>
                </div>
                <div className="absolute bottom-8 right-4 px-2.5 py-1.5 rounded-lg text-[10px] font-mono"
                  style={{ background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.1)" }}>
                  <span className="text-sky-400">19 bridges</span>
                </div>
              </div>
            </R>
            {/* Copy */}
            <div>
              <R>
                <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-teal-400 mb-4">Knowledge Fingerprint</p>
                <h2 className="text-[clamp(1.6rem,3.2vw,2.8rem)] font-extrabold tracking-[-0.04em] leading-[1.08]">
                  Your mind,<br />rendered in 3D.
                </h2>
              </R>
              <R delay={0.08}>
                <p className="text-[16px] mt-5 leading-[1.8] text-zinc-400 max-w-[440px]">
                  Every memory you import becomes a node. Every connection a bridge.
                  Watch your knowledge topology emerge — clusters you expect, links you&apos;d never have drawn yourself.
                </p>
              </R>
              <R delay={0.14}>
                <div className="mt-8 space-y-4">
                  {[
                    { label: "Clusters", desc: "Topic groups that formed organically from your writing", color: "text-teal-400" },
                    { label: "Bridges", desc: "Ideas connecting domains you never knew were related", color: "text-sky-400" },
                    { label: "Orphans", desc: "Isolated knowledge — gaps in your thinking made visible", color: "text-amber-400" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full bg-current mt-2 shrink-0 opacity-70 ${item.color}`} />
                      <div>
                        <span className={`text-[13px] font-semibold ${item.color}`}>{item.label}</span>
                        <span className="text-[13px] text-zinc-500"> — {item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </R>
            </div>
          </div>
        </div>
      </section>

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
                  { icon: FileCode, label: "Obsidian", c: "#38bdf8" },
                  { icon: Bookmark, label: "Reddit", c: "#f97316" },
                  { icon: FileText, label: "PDF/EPUB", c: "#3b82f6" },
                  { icon: Globe, label: "Twitter", c: "#22d3ee" },
                  { icon: Mic, label: "Voice", c: "#f97316" },
                  { icon: Image, label: "Images", c: "#38bdf8" },
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
              Six things you can do<br />that no other app does.
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
                  style={{ background: "#0a0a0b" }}>
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
                Self-hosted. Extensible. Your data, your keys.
                </h2>
            </R>
            <R delay={0.06}>
              <p className="text-[14px] mt-2 leading-[1.7] text-zinc-500 max-w-[500px]">
                Zero vendor lock-in. Bring your own AI keys. Run it privately or enable Google sign-in for public multi-user deployments.
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
              <span><Counter end={500} suffix="+" /> tests</span>
              <span><Counter end={66} /> APIs</span>
              <span><Counter end={100} suffix="+" /> docs</span>
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
            <p className="text-[14px] mt-4 text-zinc-500">Free · Self-hosted · Open source · Public deployments should enable auth</p>
          </R>
          <R delay={0.2}>
            <div className="flex gap-3 justify-center mt-8 flex-wrap">
              <Link href="/app">
                <button className="h-12 px-8 rounded-xl text-[15px] font-bold bg-teal-500 text-white cursor-pointer transition-all hover:bg-teal-400 hover:-translate-y-0.5 shadow-[0_6px_24px_rgba(20,184,166,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0b]">
                  {isLoggedIn ? <>Go to Dashboard <ArrowRight className="w-4 h-4 inline ml-1.5" /></> : <>Open MindStore <ArrowRight className="w-4 h-4 inline ml-1.5" /></>}
                </button>
              </Link>
              {!isLoggedIn && (
                <Link href="/login">
                  <button className="h-12 px-6 rounded-xl text-[15px] font-medium bg-transparent text-zinc-400 border border-zinc-800 cursor-pointer transition-all hover:text-zinc-100 hover:border-zinc-600">
                    Sign In
                  </button>
                </Link>
              )}
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
      <footer className="relative z-10 py-5 px-6 lg:px-10 flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-700 max-w-[1200px] mx-auto"
        style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
        <span>MindStore · open source memory infrastructure</span>
        <div className="flex gap-5">
          <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-500 transition">GitHub</a>
          <Link href="/docs" className="hover:text-zinc-500 transition">Docs</Link>
          <Link href="/app/plugins" className="hover:text-zinc-500 transition">Plugins</Link>
          <Link href="/privacy" className="hover:text-zinc-500 transition">Privacy</Link>
          <Link href="/terms" className="hover:text-zinc-500 transition">Terms</Link>
        </div>
      </footer>
    </div>
  );
}
