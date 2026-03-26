"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight, Sparkles, Radio, Lock, Globe,
  Puzzle, GitBranch, type LucideIcon,
} from "lucide-react";
import { MindStoreLogo, MindStoreLogoMono } from "@/components/MindStoreLogo";

/* ═══════════════════════════════════════════
   MindStore Landing — "Dusk" Edition
   
   Warm charcoal palette. Amber accents. 
   Moving ticker. Horizontal scroll features.
   Connected AI chain. Use cases section.
   Community knowledge sharing teaser.
   ═══════════════════════════════════════════ */

/* ─── Utilities ─── */
function useInView(t = 0.08) {
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
      opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(20px)",
      transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
    }}>{children}</div>
  );
}

/* ─── Animated counter ─── */
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

/* ─── Particle canvas ─── */
function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const x = c.getContext("2d");
    if (!x) return;
    let W: number, H: number, animId: number;
    const ps: { x: number; y: number; vx: number; vy: number; r: number }[] = [];

    function resize() {
      W = c!.width = window.innerWidth;
      H = c!.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < 30; i++) {
      ps.push({
        x: Math.random() * 2000, y: Math.random() * 2000,
        vx: (Math.random() - 0.5) * 0.12, vy: (Math.random() - 0.5) * 0.12,
        r: Math.random() + 0.5,
      });
    }

    function draw() {
      x!.clearRect(0, 0, W, H);
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        for (let j = i + 1; j < ps.length; j++) {
          const d = Math.hypot(p.x - ps[j].x, p.y - ps[j].y);
          if (d < 100) {
            x!.beginPath();
            x!.strokeStyle = `rgba(212,164,74,${0.04 * (1 - d / 100)})`;
            x!.lineWidth = 0.5;
            x!.moveTo(p.x, p.y);
            x!.lineTo(ps[j].x, ps[j].y);
            x!.stroke();
          }
        }
        x!.beginPath();
        x!.fillStyle = "rgba(212,164,74,0.12)";
        x!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        x!.fill();
      }
      animId = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />;
}

/* ─── Source Ticker ─── */
const SOURCES = ["ChatGPT", "Kindle", "YouTube", "Notion", "Obsidian", "Reddit", "PDF/EPUB", "Twitter", "Telegram", "Pocket", "Spotify", "Readwise", "Voice Memos", "Images", "URLs", "Browser Bookmarks", "Any Text"];

function Ticker() {
  return (
    <div className="overflow-hidden py-5 border-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
      <div className="flex gap-3 animate-[tickerScroll_40s_linear_infinite]" style={{ width: "max-content" }}>
        {[...SOURCES, ...SOURCES].map((s, i) => (
          <span key={i} className="px-5 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap shrink-0"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)", color: "#8a8070" }}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── AI Models ─── */
const AI_MODELS = [
  { name: "Claude", color: "#d4a44a" },
  { name: "ChatGPT", color: "#0ea5e9" },
  { name: "Gemini", color: "#34d399" },
  { name: "Cursor", color: "#f59e0b" },
  { name: "Ollama", color: "#8a8070" },
  { name: "Windsurf", color: "#a78bfa" },
  { name: "Copilot", color: "#60a5fa" },
  { name: "Perplexity", color: "#22d3ee" },
  { name: "Any MCP Client", color: "#5c5546" },
];

/* ─── Use Cases ─── */
const USE_CASES = [
  { emoji: "🎓", title: "Study for exams", desc: "Auto-generate flashcards from everything you've read. Spaced repetition built in." },
  { emoji: "💼", title: "Prep for meetings", desc: "\"What do I know about this client?\" — instant context from past conversations." },
  { emoji: "✍️", title: "Write from your brain", desc: "Blog posts, newsletters, reports — all grounded in what you actually know, not generic AI." },
  { emoji: "🔍", title: "Find that one thing", desc: "\"I read something about pricing strategy last year...\" — semantic search across all sources." },
  { emoji: "🧠", title: "Map your knowledge", desc: "Interactive 3D mind map. See clusters, blind spots, contradictions in your own thinking." },
  { emoji: "🤝", title: "Share expertise", desc: "Export your knowledge base. Let your team or community learn from your curated mind." },
  { emoji: "📚", title: "Never lose a highlight", desc: "Kindle, PDF, article highlights — all in one place, all connected, all searchable." },
  { emoji: "🎯", title: "Fill knowledge gaps", desc: "AI analyzes what you know and suggests what's missing. Targeted learning paths." },
];

export function LandingClient() {
  return (
    <div className="min-h-screen text-[#e8e2d4] selection:bg-amber-500/20 overflow-x-hidden" style={{ background: "#17150f" }}>
      <style jsx global>{`
        @keyframes tickerScroll { to { transform: translateX(-50%); } }
      `}</style>

      <Particles />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "SoftwareApplication", name: "MindStore",
        applicationCategory: "ProductivityApplication", operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        description: "Personal knowledge OS. 35 plugins, 12+ sources, MCP protocol, MIT licensed.",
      }) }} />

      {/* ═══════ NAV ═══════ */}
      <nav className="fixed top-0 inset-x-0 z-50 h-[54px] px-4 md:px-10 flex items-center justify-between backdrop-blur-xl" 
        style={{ background: "rgba(23,21,15,0.85)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <Link href="/" className="flex items-center gap-2">
          <MindStoreLogo className="w-6 h-6" />
          <span className="font-extrabold text-[14px]">MindStore</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/docs" className="text-[12px] hidden sm:block" style={{ color: "#8a8070" }}>Docs</Link>
          <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer" className="text-[12px] hidden sm:block" style={{ color: "#8a8070" }}>GitHub</a>
          <Link href="/app">
            <button className="h-[30px] px-4 rounded-[7px] text-[12px] font-bold border-none cursor-pointer" style={{ background: "#e8e2d4", color: "#17150f" }}>
              Open App
            </button>
          </Link>
        </div>
      </nav>

      {/* ═══════ HERO ═══════ */}
      <section className="pt-[clamp(140px,20vh,220px)] pb-[clamp(40px,6vh,60px)] relative z-10">
        <div className="max-w-[1000px] mx-auto px-4 md:px-10 text-center">
          <Reveal>
            <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[1.04] tracking-[-0.05em]">
              You&apos;ve spent years<br />learning things.<br />
              <span className="font-serif italic" style={{ color: "#d4a44a" }}>Where did it all go?</span>
            </h1>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="text-[15px] mt-4 max-w-[480px] mx-auto leading-[1.75]" style={{ color: "#8a8070" }}>
              MindStore imports everything — makes it searchable by meaning — and connects it to{" "}
              <strong className="font-semibold" style={{ color: "#e8e2d4" }}>any AI</strong> you use. Your knowledge, portable.
            </p>
          </Reveal>
          <Reveal delay={0.14}>
            <div className="flex gap-3 justify-center mt-6 flex-wrap">
              <Link href="/app">
                <button className="h-[46px] px-8 rounded-[14px] text-[14px] font-bold text-white border-none cursor-pointer transition-all hover:-translate-y-0.5"
                  style={{ background: "#e8e2d4", color: "#17150f" }}>
                  Get Started — Free →
                </button>
              </Link>
              <Link href="/app?demo=true">
                <button className="h-[46px] px-6 rounded-[14px] text-[14px] font-medium border cursor-pointer transition-all"
                  style={{ background: "transparent", color: "#8a8070", borderColor: "#3d3830" }}>
                  Live Demo
                </button>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ SOURCE TICKER ═══════ */}
      <Ticker />

      {/* ═══════ ADD ANYTHING ═══════ */}
      <section className="py-[clamp(48px,8vh,80px)] relative z-10">
        <div className="max-w-[1000px] mx-auto px-4 md:px-10">
          <Reveal>
            <p className="text-[10px] font-semibold tracking-[0.1em] uppercase mb-2" style={{ color: "#d4a44a" }}>Universal input</p>
            <h2 className="text-[clamp(1.6rem,3.5vw,2.8rem)] font-extrabold tracking-[-0.04em] leading-[1.06]">
              Throw in <span className="font-serif italic" style={{ color: "#d4a44a" }}>anything.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.06}>
            <p className="text-[14px] mt-3 leading-[1.7] max-w-[460px]" style={{ color: "#8a8070" }}>
              ChatGPT exports. Kindle highlights. YouTube transcripts. Voice memos. Screenshots. 
              PDFs. URLs. Plain text. If it&apos;s knowledge, MindStore eats it — and makes every word 
              searchable by <em>meaning</em>, not just keywords.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ═══════ PORTABILITY — connected AI chain ═══════ */}
      <section className="py-[clamp(48px,8vh,80px)] relative z-10" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-[1000px] mx-auto px-4 md:px-10">
          <Reveal>
            <h2 className="text-[clamp(1.6rem,3.5vw,2.8rem)] font-extrabold tracking-[-0.04em] leading-[1.06]">
              Your brain shouldn&apos;t be<br />locked to <span className="font-serif italic" style={{ color: "#d4a44a" }}>one AI.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.06}>
            <p className="text-[14px] mt-3 leading-[1.7] max-w-[460px]" style={{ color: "#8a8070" }}>
              Store once. Connect everywhere. Switch models freely. Your context follows you — not the platform.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="flex items-center gap-0 mt-7 flex-wrap">
              {AI_MODELS.map((ai, i) => (
                <div key={ai.name} className="flex items-center">
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-[13px] font-semibold transition-all hover:brightness-110"
                    style={{ background: "#1e1c16", border: "1px solid rgba(255,255,255,0.06)", color: "#c4b998" }}>
                    <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: ai.color }} />
                    {ai.name}
                  </div>
                  {i < AI_MODELS.length - 1 && (
                    <div className="w-5 h-px shrink-0 hidden sm:block" 
                      style={{ background: "linear-gradient(90deg, rgba(212,164,74,0.3), rgba(212,164,74,0.1))" }} />
                  )}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ PIPELINE INLINE ═══════ */}
      <div className="py-5 relative z-10" style={{ borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-[1000px] mx-auto px-4 md:px-10">
          <Reveal>
            <div className="flex items-center gap-2 flex-wrap text-[14px] font-semibold" style={{ color: "#8a8070" }}>
              <span className="flex items-center gap-1" style={{ color: "#e8e2d4" }}>📥 Import</span><span style={{ color: "#3d3830" }}>→</span>
              <span className="flex items-center gap-1" style={{ color: "#e8e2d4" }}>⚡ Embed</span><span style={{ color: "#3d3830" }}>→</span>
              <span className="flex items-center gap-1" style={{ color: "#e8e2d4" }}>🔍 Search</span><span style={{ color: "#3d3830" }}>→</span>
              <span className="flex items-center gap-1" style={{ color: "#e8e2d4" }}>✨ Create</span>
            </div>
          </Reveal>
        </div>
      </div>

      {/* ═══════ MCP ═══════ */}
      <section className="py-[clamp(48px,8vh,80px)] relative z-10" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-[1000px] mx-auto px-4 md:px-10">
          <Reveal>
            <h2 className="text-[clamp(1.4rem,3vw,2.2rem)] font-extrabold tracking-[-0.04em]">
              Three lines. <span className="font-serif italic" style={{ color: "#d4a44a" }}>Any AI gets your brain.</span>
            </h2>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-8 items-start mt-5">
            <div>
              <Reveal delay={0.06}>
                <p className="text-[13px] leading-[1.7]" style={{ color: "#8a8070" }}>
                  MindStore is a full MCP server. Point any client at your instance. Three functions, infinite context.
                </p>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="flex flex-col gap-2 mt-4">
                  {[
                    { fn: "search_mind", desc: "Semantic search" },
                    { fn: "get_profile", desc: "Knowledge profile" },
                    { fn: "get_context", desc: "Topic context" },
                  ].map(t => (
                    <div key={t.fn} className="flex items-center gap-3">
                      <code className="font-mono text-[10px] px-2.5 py-0.5 rounded border shrink-0"
                        style={{ color: "rgba(212,164,74,0.6)", background: "rgba(212,164,74,0.06)", borderColor: "rgba(212,164,74,0.1)" }}>
                        {t.fn}
                      </code>
                      <span className="text-[10px]" style={{ color: "#5c5546" }}>{t.desc}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
            <Reveal delay={0.08}>
              <div className="rounded-[14px] overflow-hidden" style={{ background: "#0f0e0a", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="px-3.5 py-2 flex items-center gap-[5px]" style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <div className="w-[7px] h-[7px] rounded-full" style={{ background: "rgba(239,68,68,0.3)" }} />
                  <div className="w-[7px] h-[7px] rounded-full" style={{ background: "rgba(234,179,8,0.3)" }} />
                  <div className="w-[7px] h-[7px] rounded-full" style={{ background: "rgba(34,197,94,0.3)" }} />
                  <span className="font-mono text-[9px] ml-1.5" style={{ color: "#3d3830" }}>config.json</span>
                </div>
                <div className="p-4 font-mono text-[12px] leading-[1.8]" style={{ color: "#5c5546" }}>
                  <pre><code>{`{`}<br />{`  `}<span style={{ color: "#c4b998" }}>{`"mcpServers"`}</span>{`: {`}<br />{`    `}<span style={{ color: "#c4b998" }}>{`"mindstore"`}</span>{`: {`}<br />{`      `}<span style={{ color: "#c4b998" }}>{`"url"`}</span>{`: `}<span style={{ color: "#d4a44a" }}>{`"https://mindstore.org/api/mcp"`}</span><br />{`    }`}<br />{`  }`}<br />{`}`}</code></pre>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════ USE CASES — horizontal scroll ═══════ */}
      <section className="py-[clamp(48px,8vh,80px)] relative z-10">
        <div className="max-w-[1000px] mx-auto px-4 md:px-10">
          <Reveal>
            <p className="text-[10px] font-semibold tracking-[0.1em] uppercase mb-2" style={{ color: "#d4a44a" }}>Use cases</p>
            <h2 className="text-[clamp(1.4rem,3vw,2.2rem)] font-extrabold tracking-[-0.04em]">
              What will <span className="font-serif italic" style={{ color: "#d4a44a" }}>you</span> use it for?
            </h2>
          </Reveal>
        </div>
        <Reveal delay={0.08}>
          <div className="flex gap-3 overflow-x-auto mt-6 px-4 md:px-10 pb-3 snap-x snap-mandatory" 
            style={{ scrollbarWidth: "thin", scrollbarColor: "#3d3830 #1e1c16" }}>
            {USE_CASES.map((uc) => (
              <div key={uc.title} className="shrink-0 w-[240px] p-5 rounded-[14px] snap-start transition-all hover:-translate-y-0.5"
                style={{ background: "#1e1c16", border: "1px solid rgba(255,255,255,0.04)" }}>
                <span className="text-[24px]">{uc.emoji}</span>
                <h3 className="text-[13px] font-bold mt-2" style={{ color: "#e8e2d4" }}>{uc.title}</h3>
                <p className="text-[11px] mt-1.5 leading-[1.6]" style={{ color: "#8a8070" }}>{uc.desc}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ═══════ SUPERPOWERS — horizontal scroll ═══════ */}
      <section className="py-[clamp(48px,8vh,80px)] relative z-10" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-[1000px] mx-auto px-4 md:px-10">
          <Reveal>
            <h2 className="text-[clamp(1.4rem,3vw,2.2rem)] font-extrabold tracking-[-0.04em]">
              Not storage. <span className="font-serif italic" style={{ color: "#d4a44a" }}>A thinking partner.</span>
            </h2>
          </Reveal>
        </div>
        <Reveal delay={0.08}>
          <div className="flex gap-3 overflow-x-auto mt-6 px-4 md:px-10 pb-3 snap-x snap-mandatory"
            style={{ scrollbarWidth: "thin", scrollbarColor: "#3d3830 #1e1c16" }}>
            {[
              { emoji: "💬", title: "Chat", desc: "Ask your knowledge. Cited answers from YOUR data." },
              { emoji: "🧬", title: "Fingerprint", desc: "3D WebGL map of your mind's topology." },
              { emoji: "⚠️", title: "Contradictions", desc: "Past-you vs present-you. AI finds conflicts." },
              { emoji: "🃏", title: "Flashcards", desc: "Auto-generated. Spaced repetition built in." },
              { emoji: "📈", title: "Evolution", desc: "Watch interests shift across months." },
              { emoji: "❤️", title: "Sentiment", desc: "Emotional patterns in your history." },
              { emoji: "🎯", title: "Gaps", desc: "AI maps what you're missing." },
              { emoji: "✍️", title: "Create", desc: "Blog, newsletter, resume from your brain." },
              { emoji: "🕸️", title: "Mind Maps", desc: "Visual topic clusters." },
            ].map((f) => (
              <div key={f.title} className="shrink-0 w-[200px] p-5 rounded-[14px] snap-start transition-all hover:-translate-y-0.5"
                style={{ background: "#1e1c16", border: "1px solid rgba(255,255,255,0.04)" }}>
                <span className="text-[20px]">{f.emoji}</span>
                <h3 className="text-[13px] font-bold mt-2" style={{ color: "#e8e2d4" }}>{f.title}</h3>
                <p className="text-[10px] mt-1 leading-[1.5]" style={{ color: "#8a8070" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </Reveal>
        <div className="max-w-[1000px] mx-auto px-4 md:px-10 mt-3">
          <Reveal delay={0.15}>
            <div className="flex flex-wrap gap-1">
              {["Voice Memos", "Vision/OCR", "Custom RAG", "Multi-language", "Anki Export", "Obsidian Sync", "Notion Sync", "Resume Builder", "Learning Paths", "Smart Collections", "Duplicate Detector"].map(p => (
                <span key={p} className="text-[9px] px-2.5 py-0.5 rounded-full" 
                  style={{ color: "#5c5546", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.03)" }}>{p}</span>
              ))}
              <Link href="/app/plugins" className="text-[9px] px-2.5 py-0.5 rounded-full font-semibold transition-all"
                style={{ color: "#d4a44a", background: "rgba(212,164,74,0.06)", border: "1px solid rgba(212,164,74,0.1)" }}>
                All 35 plugins →
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ COMMUNITY KNOWLEDGE — coming soon teaser ═══════ */}
      <section className="py-[clamp(48px,8vh,80px)] relative z-10" 
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: "linear-gradient(180deg, rgba(212,164,74,0.02) 0%, transparent 100%)" }}>
        <div className="max-w-[1000px] mx-auto px-4 md:px-10">
          <Reveal>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-semibold mb-4"
              style={{ background: "rgba(212,164,74,0.08)", border: "1px solid rgba(212,164,74,0.12)", color: "#d4a44a" }}>
              <Sparkles className="w-3 h-3" />
              Coming soon
            </div>
            <h2 className="text-[clamp(1.4rem,3vw,2.2rem)] font-extrabold tracking-[-0.04em]">
              Share minds. <span className="font-serif italic" style={{ color: "#d4a44a" }}>Grow together.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.06}>
            <p className="text-[14px] mt-3 leading-[1.7] max-w-[520px]" style={{ color: "#8a8070" }}>
              Community knowledge bases are coming. Browse curated minds on topics you care about. 
              Grab what resonates. Share what you&apos;ve learned. Merge others&apos; expertise into your own MindStore. 
              Knowledge isn&apos;t meant to sit in silos — it&apos;s meant to flow.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="flex flex-wrap gap-3 mt-6">
              {[
                { emoji: "📖", label: "Browse community minds" },
                { emoji: "⬇️", label: "Import others' knowledge" },
                { emoji: "⬆️", label: "Share your expertise" },
                { emoji: "🔀", label: "Merge & grow" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-[12px] font-medium"
                  style={{ background: "#1e1c16", border: "1px solid rgba(255,255,255,0.04)", color: "#c4b998" }}>
                  <span>{item.emoji}</span>
                  {item.label}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ OPEN SOURCE ═══════ */}
      <section className="py-[clamp(32px,5vh,48px)] relative z-10" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-[1000px] mx-auto px-4 md:px-10">
          <Reveal>
            <h2 className="text-[clamp(1.1rem,2vw,1.4rem)] font-extrabold tracking-[-0.03em]">
              Yours to own. <span className="font-serif italic" style={{ color: "#d4a44a" }}>Yours to extend.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.06}>
            <p className="text-[13px] mt-2 leading-[1.7] max-w-[540px]" style={{ color: "#8a8070" }}>
              MIT licensed. Plugin SDK. Community-driven. Self-hosted. Your AI keys, your data, zero vendor lock-in.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-[11px]" style={{ color: "#5c5546" }}>
              <span className="flex items-center gap-1.5">
                <span className="w-[5px] h-[5px] rounded-full animate-pulse" style={{ background: "#d4a44a" }} />
                Actively developed
              </span>
              <span><Counter end={336} /> tests</span>
              <span><Counter end={103} /> docs</span>
              <span>Plugin SDK</span>
              <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer"
                className="font-semibold ml-auto transition-colors hover:brightness-110" style={{ color: "#d4a44a" }}>
                Star on GitHub →
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ CTA ═══════ */}
      <section className="py-[clamp(60px,10vh,100px)] text-center relative z-10" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-[1000px] mx-auto px-4 md:px-10">
          <Reveal>
            <MindStoreLogo className="w-[48px] h-[48px] mx-auto mb-4" />
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="text-[clamp(1.4rem,3vw,2.2rem)] font-extrabold tracking-[-0.04em]">
              Your knowledge deserves<br /><span className="font-serif italic" style={{ color: "#d4a44a" }}>an operating system.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-[12px] mt-2" style={{ color: "#5c5546" }}>Free · Private · No sign-up · MIT open source</p>
          </Reveal>
          <Reveal delay={0.14}>
            <div className="flex gap-3 justify-center mt-5 flex-wrap">
              <Link href="/app">
                <button className="h-[46px] px-8 rounded-[14px] text-[14px] font-bold border-none cursor-pointer transition-all hover:-translate-y-0.5"
                  style={{ background: "#e8e2d4", color: "#17150f" }}>
                  Open MindStore <ArrowRight className="w-4 h-4 inline ml-1" />
                </button>
              </Link>
              <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer">
                <button className="h-[46px] px-6 rounded-[14px] text-[14px] font-medium border cursor-pointer transition-all"
                  style={{ background: "transparent", color: "#8a8070", borderColor: "#3d3830" }}>
                  GitHub
                </button>
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="py-3.5 px-4 md:px-10 flex flex-wrap items-center justify-between gap-2 text-[9px] max-w-[1000px] mx-auto relative z-10"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)", color: "#3d3830" }}>
        <span>MindStore · MIT License</span>
        <div className="flex gap-3">
          <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer" className="hover:brightness-150">GitHub</a>
          <Link href="/docs" className="hover:brightness-150">Docs</Link>
          <Link href="/app/plugins" className="hover:brightness-150">Plugins</Link>
        </div>
      </footer>
    </div>
  );
}
