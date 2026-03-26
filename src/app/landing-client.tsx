"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { MindStoreLogo, MindStoreLogoMono } from "@/components/MindStoreLogo";

/* ═══════════════════════════════════════════
   MindStore Landing — "Dusk" v2
   
   App-consistent palette: OLED black base,
   teal-500 primary, sky secondary.
   Dusk structure: ticker, horizontal scroll,
   connected AI, creative layouts.
   NO framer-motion — pure CSS animations.
   ═══════════════════════════════════════════ */

/* ─── Hooks ─── */
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

function Reveal({ children, className = "", delay = 0, as: Tag = "div" }: { children: ReactNode; className?: string; delay?: number; as?: "div" | "section" }) {
  const { ref, visible } = useInView();
  return (
    <Tag ref={ref} className={className} style={{
      opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(22px)",
      transition: `opacity .7s cubic-bezier(.16,1,.3,1) ${delay}s, transform .7s cubic-bezier(.16,1,.3,1) ${delay}s`,
    }}>{children}</Tag>
  );
}

/* ─── Counter ─── */
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

/* ─── Network Particle Canvas ─── */
function NetworkParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    // Respect reduced motion
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W: number, H: number, animId: number;
    const particles: { x: number; y: number; vx: number; vy: number; r: number }[] = [];

    function resize() { W = c!.width = window.innerWidth; H = c!.height = window.innerHeight; }
    resize();
    window.addEventListener("resize", resize);

    const count = Math.min(35, Math.floor(window.innerWidth / 50));
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * 2000, y: Math.random() * 2000,
        vx: prefersReduced ? 0 : (Math.random() - .5) * .12,
        vy: prefersReduced ? 0 : (Math.random() - .5) * .12,
        r: Math.random() * .8 + .4,
      });
    }

    function draw() {
      ctx!.clearRect(0, 0, W, H);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        for (let j = i + 1; j < particles.length; j++) {
          const d = Math.hypot(p.x - particles[j].x, p.y - particles[j].y);
          if (d < 120) {
            ctx!.beginPath();
            ctx!.strokeStyle = `rgba(20,184,166,${.04 * (1 - d / 120)})`;
            ctx!.lineWidth = .5;
            ctx!.moveTo(p.x, p.y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.stroke();
          }
        }
        ctx!.beginPath();
        ctx!.fillStyle = "rgba(20,184,166,0.15)";
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      animId = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true" />;
}

/* ─── Dual Ticker (two rows, opposite directions) ─── */
const SOURCES_ROW1 = ["ChatGPT", "Kindle", "YouTube", "Notion", "Obsidian", "Reddit", "PDF/EPUB", "Twitter", "Browser Bookmarks"];
const SOURCES_ROW2 = ["Telegram", "Pocket", "Spotify", "Readwise", "Voice Memos", "Images", "URLs", "Any Text", "Anki"];

function DualTicker() {
  return (
    <div className="py-4 space-y-2.5 overflow-hidden" style={{ borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      {/* Row 1 — moves left */}
      <div className="flex gap-2.5" style={{ animation: "tickerLeft 45s linear infinite", width: "max-content" }}>
        {[...SOURCES_ROW1, ...SOURCES_ROW1, ...SOURCES_ROW1].map((s, i) => (
          <span key={i} className="px-4 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap shrink-0"
            style={{ background: "rgba(20,184,166,0.04)", border: "1px solid rgba(20,184,166,0.06)", color: "rgba(161,161,170,0.7)" }}>
            {s}
          </span>
        ))}
      </div>
      {/* Row 2 — moves right */}
      <div className="flex gap-2.5" style={{ animation: "tickerRight 50s linear infinite", width: "max-content" }}>
        {[...SOURCES_ROW2, ...SOURCES_ROW2, ...SOURCES_ROW2].map((s, i) => (
          <span key={i} className="px-4 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap shrink-0"
            style={{ background: "rgba(56,189,248,0.04)", border: "1px solid rgba(56,189,248,0.06)", color: "rgba(161,161,170,0.7)" }}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── AI Models ─── */
const AI_MODELS = [
  { name: "Claude", color: "#f59e0b", desc: "Anthropic" },
  { name: "ChatGPT", color: "#10b981", desc: "OpenAI" },
  { name: "Gemini", color: "#38bdf8", desc: "Google" },
  { name: "Cursor", color: "#a78bfa", desc: "IDE" },
  { name: "Ollama", color: "#f97316", desc: "Local" },
  { name: "Windsurf", color: "#22d3ee", desc: "Codeium" },
  { name: "Copilot", color: "#60a5fa", desc: "GitHub" },
  { name: "Perplexity", color: "#14b8a6", desc: "Search" },
  { name: "OpenRouter", color: "#e879f9", desc: "200+ models" },
  { name: "Any MCP Client", color: "#71717a", desc: "Universal" },
];

/* ─── Use Cases ─── */
const USE_CASES = [
  { emoji: "🎓", title: "Ace your exams", desc: "Flashcards auto-generated from everything you've ever read. Spaced repetition built in. Study smarter, not harder.", color: "#14b8a6" },
  { emoji: "💼", title: "Nail the meeting", desc: "\"What do I know about this client?\" — instant context from past conversations, notes, and research.", color: "#38bdf8" },
  { emoji: "✍️", title: "Write from your brain", desc: "Blog posts, newsletters, reports — all grounded in what you actually know, cited from your own data.", color: "#f59e0b" },
  { emoji: "🔍", title: "Find that one thing", desc: "\"I read something about pricing last year...\" — semantic search finds it even if you don't remember the words.", color: "#10b981" },
  { emoji: "🧠", title: "See your mind", desc: "Interactive 3D knowledge map. Watch clusters form. Spot blind spots. Find contradictions in your own thinking.", color: "#a78bfa" },
  { emoji: "🤝", title: "Share your expertise", desc: "Export your knowledge base. Let teammates learn from your curated mind. Community brains, shared.", color: "#f97316" },
  { emoji: "📚", title: "Never lose a highlight", desc: "Kindle, PDF, article highlights — all in one place, all connected, all searchable by meaning.", color: "#ec4899" },
  { emoji: "🎯", title: "Fill knowledge gaps", desc: "AI analyzes what you know and maps what's missing. Get targeted learning paths for what matters.", color: "#22d3ee" },
];

export function LandingClient() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-zinc-100 selection:bg-teal-500/20 overflow-x-hidden">
      <style jsx global>{`
        @keyframes tickerLeft { from { transform: translateX(0); } to { transform: translateX(-33.333%); } }
        @keyframes tickerRight { from { transform: translateX(-33.333%); } to { transform: translateX(0); } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes orbit { from { transform: rotate(0deg) translateX(var(--orbit-r)) rotate(0deg); } to { transform: rotate(360deg) translateX(var(--orbit-r)) rotate(-360deg); } }
        @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
        @media (prefers-reduced-motion: reduce) {
          .ticker-row, [style*="animation"] { animation: none !important; }
        }
      `}</style>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "SoftwareApplication", name: "MindStore",
        applicationCategory: "ProductivityApplication", operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        description: "Personal knowledge OS. 35 plugins, 12+ sources, MCP protocol, MIT licensed.",
      }) }} />

      <NetworkParticles />

      {/* ═══════ NAV ═══════ */}
      <nav className="fixed top-0 inset-x-0 z-50 h-[52px] px-4 md:px-8 flex items-center justify-between backdrop-blur-xl"
        style={{ background: "rgba(10,10,11,0.85)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <Link href="/" className="flex items-center gap-2" aria-label="MindStore home">
          <MindStoreLogo className="w-6 h-6" />
          <span className="font-bold text-[14px] tracking-[-0.01em]">MindStore</span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/docs" className="text-[12px] text-zinc-500 hover:text-zinc-200 transition hidden sm:block">Docs</Link>
          <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer" className="text-[12px] text-zinc-500 hover:text-zinc-200 transition hidden sm:block">GitHub</a>
          <Link href="/app">
            <button className="h-[30px] px-3.5 rounded-lg text-[12px] font-bold bg-teal-500 text-white border-none cursor-pointer hover:bg-teal-400 transition-colors">
              Open App
            </button>
          </Link>
        </div>
      </nav>

      {/* ═══════ HERO ═══════ */}
      <section className="pt-[clamp(130px,18vh,200px)] pb-[clamp(32px,5vh,48px)] relative z-10">
        <div className="max-w-[920px] mx-auto px-5 md:px-8 text-center">
          <Reveal>
            <h1 className="text-[clamp(2.4rem,5.5vw,4.2rem)] font-extrabold leading-[1.04] tracking-[-0.04em]">
              You&apos;ve spent years<br className="hidden sm:block" /> learning things.<br />
              <span className="font-serif italic text-teal-400">Where did it all go?</span>
            </h1>
          </Reveal>
          <Reveal delay={0.14}>
            <div className="flex gap-3 justify-center mt-6 flex-wrap">
              <Link href="/app">
                <button className="h-11 px-7 rounded-xl text-[14px] font-bold bg-teal-500 text-white cursor-pointer transition-all hover:bg-teal-400 hover:-translate-y-0.5 shadow-[0_4px_20px_rgba(20,184,166,0.2)]">
                  Get Started — Free
                </button>
              </Link>
              <Link href="/app?demo=true">
                <button className="h-11 px-5 rounded-xl text-[14px] font-medium bg-transparent text-zinc-500 border border-zinc-800 cursor-pointer transition-all hover:text-zinc-200 hover:border-zinc-600">
                  Live Demo
                </button>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ DUAL TICKER ═══════ */}
      <div className="pt-6 pb-1 relative z-10">
        <div className="max-w-[920px] mx-auto px-5 md:px-8">
          <Reveal>
            <p className="text-[14px] sm:text-[15px] leading-[1.7] text-zinc-500 text-center max-w-[500px] mx-auto">
              MindStore imports everything — makes it searchable by meaning — and connects it to{" "}
              <strong className="text-zinc-200 font-semibold">any AI</strong> you use. Your knowledge, portable forever.
            </p>
          </Reveal>
        </div>
      </div>
      <DualTicker />

      {/* ═══════ "THROW IN ANYTHING" ═══════ */}
      <section className="py-[clamp(48px,8vh,72px)] relative z-10">
        <div className="max-w-[920px] mx-auto px-5 md:px-8">
          <Reveal>
            <p className="text-[10px] font-semibold tracking-[0.12em] uppercase mb-2 text-teal-500">Universal input</p>
            <h2 className="text-[clamp(1.5rem,3.2vw,2.6rem)] font-extrabold tracking-[-0.04em] leading-[1.08]">
              Throw in <span className="font-serif italic text-teal-400">anything.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.06}>
            <p className="text-[14px] mt-3 leading-[1.75] max-w-[440px] text-zinc-500">
              ChatGPT exports. Kindle highlights. YouTube transcripts. Voice memos. Screenshots. 
              PDFs. URLs. Plain text. If it&apos;s knowledge, MindStore eats it — and makes every word 
              searchable by <em className="text-zinc-300 not-italic">meaning</em>, not just keywords.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="flex items-center gap-3 mt-5 text-[11px] text-zinc-600 flex-wrap">
              <span><strong className="text-zinc-300 font-semibold">12+</strong> importers</span>
              <span className="text-zinc-800">·</span>
              <span>Drag &amp; drop</span>
              <span className="text-zinc-800">·</span>
              <span>Batch import</span>
              <span className="text-zinc-800">·</span>
              <span>ZIP upload</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ PORTABILITY — AI Orbit ═══════ */}
      <section className="py-[clamp(48px,8vh,72px)] relative z-10" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-[920px] mx-auto px-5 md:px-8">
          <Reveal>
            <h2 className="text-[clamp(1.5rem,3.2vw,2.6rem)] font-extrabold tracking-[-0.04em] leading-[1.08]">
              Your brain shouldn&apos;t be<br className="hidden sm:block" /> locked to{" "}
              <span className="font-serif italic text-teal-400">one AI.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.06}>
            <p className="text-[14px] mt-3 leading-[1.75] max-w-[440px] text-zinc-500">
              Store once. Connect everywhere. Switch models freely. Your context follows you — not the platform.
            </p>
          </Reveal>
          {/* AI model orbit / scatter layout */}
          <Reveal delay={0.1}>
            <div className="mt-8 relative">
              {/* Desktop: scattered/organic layout */}
              <div className="hidden md:block relative h-[240px]">
                {AI_MODELS.map((ai, i) => {
                  // Organic positions — hand-placed for visual balance
                  const positions = [
                    { top: "8%", left: "2%" },    // Claude
                    { top: "0%", left: "25%" },   // ChatGPT
                    { top: "15%", left: "52%" },  // Gemini
                    { top: "4%", left: "76%" },   // Cursor
                    { top: "42%", left: "0%" },   // Ollama
                    { top: "38%", left: "34%" },  // Windsurf
                    { top: "48%", left: "64%" },  // Copilot
                    { top: "70%", left: "8%" },   // Perplexity
                    { top: "72%", left: "40%" },  // OpenRouter
                    { top: "68%", left: "72%" },  // Any MCP
                  ];
                  return (
                    <div key={ai.name} className="absolute group cursor-default" style={{ ...positions[i], animation: `float ${3 + i * 0.4}s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }}>
                      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl transition-all duration-300 group-hover:scale-105"
                        style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${ai.color}22` }}>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ai.color, boxShadow: `0 0 8px ${ai.color}40` }} />
                        <div>
                          <div className="text-[13px] font-semibold text-zinc-200">{ai.name}</div>
                          <div className="text-[9px] text-zinc-600">{ai.desc}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Mobile: 2-column flowing grid */}
              <div className="md:hidden grid grid-cols-2 gap-2">
                {AI_MODELS.map((ai) => (
                  <div key={ai.name} className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${ai.color}22` }}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ai.color, boxShadow: `0 0 6px ${ai.color}40` }} />
                    <div>
                      <div className="text-[12px] font-semibold text-zinc-200">{ai.name}</div>
                      <div className="text-[9px] text-zinc-600">{ai.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ PIPELINE ═══════ */}
      <div className="py-4 relative z-10" style={{ borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-[920px] mx-auto px-5 md:px-8">
          <Reveal>
            <div className="flex items-center gap-2 flex-wrap text-[14px] font-semibold">
              {[
                { icon: "📥", label: "Import" },
                { icon: "⚡", label: "Embed" },
                { icon: "🔍", label: "Search" },
                { icon: "✨", label: "Create" },
              ].map((step, i) => (
                <span key={step.label} className="flex items-center gap-1">
                  {i > 0 && <span className="text-zinc-800 mx-1">→</span>}
                  <span className="text-zinc-100">{step.icon} {step.label}</span>
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </div>

      {/* ═══════ MCP ═══════ */}
      <section className="py-[clamp(48px,8vh,72px)] relative z-10">
        <div className="max-w-[920px] mx-auto px-5 md:px-8">
          <Reveal>
            <h2 className="text-[clamp(1.3rem,2.8vw,2rem)] font-extrabold tracking-[-0.04em]">
              Three lines. <span className="font-serif italic text-teal-400">Any AI gets your brain.</span>
            </h2>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-8 items-start mt-5">
            <div>
              <Reveal delay={0.06}>
                <p className="text-[13px] leading-[1.75] text-zinc-500">
                  MindStore speaks MCP — the open protocol. Point any client at your instance. Three functions give any AI complete context.
                </p>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="flex flex-col gap-2 mt-4">
                  {[
                    { fn: "search_mind", desc: "Semantic search across all your knowledge" },
                    { fn: "get_profile", desc: "Your knowledge profile and expertise" },
                    { fn: "get_context", desc: "Deep context on any topic" },
                  ].map(t => (
                    <div key={t.fn} className="flex items-center gap-3">
                      <code className="font-mono text-[10px] px-2.5 py-0.5 rounded border shrink-0 text-teal-400/60"
                        style={{ background: "rgba(20,184,166,0.05)", borderColor: "rgba(20,184,166,0.1)" }}>
                        {t.fn}
                      </code>
                      <span className="text-[10px] text-zinc-600">{t.desc}</span>
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
                  <span className="font-mono text-[9px] ml-2 text-zinc-700">config.json</span>
                </div>
                <div className="p-4 font-mono text-[12px] leading-[1.9] text-zinc-600">
                  <pre className="whitespace-pre"><code>{`{\n  `}<span className="text-zinc-400">{`"mcpServers"`}</span>{`: {\n    `}<span className="text-zinc-400">{`"mindstore"`}</span>{`: {\n      `}<span className="text-zinc-400">{`"url"`}</span>{`: `}<span className="text-teal-400">{`"https://mindstore.org/api/mcp"`}</span>{`\n    }\n  }\n}`}</code></pre>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════ USE CASES — staggered 2-col masonry ═══════ */}
      <section className="py-[clamp(48px,8vh,72px)] relative z-10" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-[920px] mx-auto px-5 md:px-8">
          <Reveal>
            <p className="text-[10px] font-semibold tracking-[0.12em] uppercase mb-2 text-teal-500">Use cases</p>
            <h2 className="text-[clamp(1.3rem,2.8vw,2rem)] font-extrabold tracking-[-0.04em]">
              What will <span className="font-serif italic text-teal-400">you</span> use it for?
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-3 mt-6">
            {USE_CASES.map((uc, i) => (
              <Reveal key={uc.title} delay={0.04 * i}>
                <div className="group p-5 rounded-2xl cursor-default transition-all duration-300 hover:-translate-y-0.5"
                  style={{ 
                    background: "rgba(255,255,255,0.02)", 
                    border: "1px solid rgba(255,255,255,0.04)",
                    // Alternate heights for masonry feel
                    ...(i % 3 === 0 ? { paddingBottom: "28px" } : {}),
                  }}>
                  <div className="flex items-start gap-3.5">
                    <span className="text-[28px] shrink-0 mt-0.5 transition-transform duration-300 group-hover:scale-110">{uc.emoji}</span>
                    <div>
                      <h3 className="text-[14px] font-bold text-zinc-200">{uc.title}</h3>
                      <p className="text-[12px] mt-1.5 leading-[1.65] text-zinc-500">{uc.desc}</p>
                    </div>
                  </div>
                  {/* Accent line */}
                  <div className="h-px mt-4 transition-all duration-300 group-hover:w-full w-0" style={{ background: uc.color, opacity: 0.3 }} />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ SUPERPOWERS — flowing tags ═══════ */}
      <section className="py-[clamp(48px,8vh,72px)] relative z-10" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-[920px] mx-auto px-5 md:px-8">
          <Reveal>
            <h2 className="text-[clamp(1.3rem,2.8vw,2rem)] font-extrabold tracking-[-0.04em]">
              Not storage. <span className="font-serif italic text-teal-400">A thinking partner.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="flex flex-wrap gap-2 mt-6">
              {[
                { emoji: "💬", name: "Chat", desc: "Cited answers from your data" },
                { emoji: "🧬", name: "Mind Fingerprint", desc: "3D knowledge topology" },
                { emoji: "⚠️", name: "Contradiction Finder", desc: "Past vs present beliefs" },
                { emoji: "🃏", name: "Flashcards", desc: "SRS from your knowledge" },
                { emoji: "📈", name: "Topic Evolution", desc: "Interests over time" },
                { emoji: "❤️", name: "Sentiment Timeline", desc: "Emotional patterns" },
                { emoji: "🎯", name: "Knowledge Gaps", desc: "What you're missing" },
                { emoji: "✍️", name: "Blog Draft", desc: "From your brain" },
                { emoji: "📰", name: "Newsletter", desc: "Curated from knowledge" },
                { emoji: "📄", name: "Resume Builder", desc: "Skills from your data" },
                { emoji: "🕸️", name: "Mind Maps", desc: "Visual clusters" },
                { emoji: "🎓", name: "Learning Paths", desc: "Personalized curriculum" },
              ].map((f, i) => (
                <div key={f.name} className="group flex items-center gap-2 px-3.5 py-2 rounded-xl cursor-default transition-all duration-200 hover:scale-[1.02]"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <span className="text-[15px]">{f.emoji}</span>
                  <span className="text-[12px] font-semibold text-zinc-300">{f.name}</span>
                  <span className="text-[10px] text-zinc-600 hidden sm:inline">— {f.desc}</span>
                </div>
              ))}
              <Link href="/app/plugins" className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold text-teal-400 transition-all hover:bg-teal-500/10"
                style={{ border: "1px solid rgba(20,184,166,0.15)" }}>
                All 35 plugins <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ COMMUNITY — share & grow ═══════ */}
      <section className="py-[clamp(48px,8vh,72px)] relative z-10"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: "linear-gradient(180deg, rgba(20,184,166,0.015) 0%, transparent 100%)" }}>
        <div className="max-w-[920px] mx-auto px-5 md:px-8">
          <Reveal>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold mb-4 text-teal-400"
              style={{ background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.1)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              Coming soon
            </div>
            <h2 className="text-[clamp(1.3rem,2.8vw,2rem)] font-extrabold tracking-[-0.04em]">
              Share minds. <span className="font-serif italic text-teal-400">Grow together.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.06}>
            <p className="text-[14px] mt-3 leading-[1.75] max-w-[500px] text-zinc-500">
              Community knowledge bases are coming. Browse curated minds on topics you care about. 
              Grab what resonates. Share what you&apos;ve learned. Merge others&apos; expertise into your own. 
              Knowledge isn&apos;t meant to sit in silos.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6">
              {[
                { emoji: "🔍", label: "Browse minds", desc: "Explore community knowledge" },
                { emoji: "⬇️", label: "Import", desc: "Grab others' expertise" },
                { emoji: "⬆️", label: "Share", desc: "Publish your knowledge" },
                { emoji: "🔀", label: "Merge", desc: "Combine & grow" },
              ].map(item => (
                <div key={item.label} className="p-3.5 rounded-xl text-center transition-all hover:-translate-y-0.5"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <span className="text-[20px]">{item.emoji}</span>
                  <div className="text-[12px] font-semibold text-zinc-300 mt-1">{item.label}</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5">{item.desc}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ OPEN SOURCE ═══════ */}
      <section className="py-[clamp(32px,4vh,40px)] relative z-10" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-[920px] mx-auto px-5 md:px-8">
          <Reveal>
            <h2 className="text-[clamp(1rem,1.8vw,1.3rem)] font-extrabold tracking-[-0.03em]">
              Yours to own. <span className="font-serif italic text-teal-400">Yours to extend.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.06}>
            <p className="text-[13px] mt-2 leading-[1.7] max-w-[500px] text-zinc-500">
              MIT licensed. Plugin SDK. Community-driven. Self-hosted. Your AI keys, your data, zero vendor lock-in.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-3 text-[11px] text-zinc-600">
              <span className="flex items-center gap-1.5">
                <span className="w-[5px] h-[5px] rounded-full bg-teal-500 animate-pulse" />
                Actively developed
              </span>
              <span><Counter end={336} /> tests</span>
              <span><Counter end={103} /> docs</span>
              <span>Plugin SDK</span>
              <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer"
                className="font-semibold text-teal-500 hover:text-teal-400 transition ml-auto">
                Star on GitHub →
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ CTA ═══════ */}
      <section className="py-[clamp(56px,10vh,88px)] text-center relative z-10" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-[920px] mx-auto px-5 md:px-8">
          <Reveal><MindStoreLogo className="w-12 h-12 mx-auto mb-4" /></Reveal>
          <Reveal delay={0.06}>
            <h2 className="text-[clamp(1.3rem,2.8vw,2rem)] font-extrabold tracking-[-0.04em]">
              Your knowledge deserves<br /><span className="font-serif italic text-teal-400">an operating system.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-[12px] mt-2 text-zinc-600">Free · Private · No sign-up · MIT open source</p>
          </Reveal>
          <Reveal delay={0.14}>
            <div className="flex gap-3 justify-center mt-5 flex-wrap">
              <Link href="/app">
                <button className="h-11 px-7 rounded-xl text-[14px] font-bold bg-teal-500 text-white cursor-pointer transition-all hover:bg-teal-400 hover:-translate-y-0.5 shadow-[0_4px_20px_rgba(20,184,166,0.2)]">
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

      {/* ═══════ FOOTER ═══════ */}
      <footer className="py-3.5 px-5 md:px-8 flex flex-wrap items-center justify-between gap-2 text-[9px] text-zinc-800 max-w-[920px] mx-auto relative z-10"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <span>MindStore · MIT License</span>
        <div className="flex gap-3">
          <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-500 transition">GitHub</a>
          <Link href="/docs" className="hover:text-zinc-500 transition">Docs</Link>
          <Link href="/app/plugins" className="hover:text-zinc-500 transition">Plugins</Link>
        </div>
      </footer>
    </div>
  );
}
