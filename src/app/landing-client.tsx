"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight, Upload, MessageSquare, Search,
  Fingerprint, Network, Layers, Heart, Target,
  PenTool, Route, Mail, Mic, Camera,
  Lock, Globe, Zap, AlertTriangle, BookOpen,
  FileText, Dna, Puzzle, Users, GitBranch,
  ChevronDown, Sparkles, Brain, Eye, TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { MindStoreLogo, MindStoreLogoMono } from "@/components/MindStoreLogo";

/* ═══════════════════════════════════════════
   MindStore Landing v4 — "Make them feel it"
   
   Goal: Make people excited. Feel the problem.
   See the solution. Get hyped. Want it NOW.
   
   Strategy:
   - Open with the FEELING (your knowledge is scattered)
   - Show the 5-second magic moment (import → search → answer)
   - Progressive disclosure (simple → click for depth)
   - MCP + Plugins as power-user hooks
   - Social proof through numbers + open source
   ═══════════════════════════════════════════ */

function useInView(threshold = 0.1) {
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

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useInView();
  return (
    <div ref={ref} className={className}
      style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s` }}>
      {children}
    </div>
  );
}

/* Expandable detail — click to learn more */
function Expandable({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="w-full text-left group">
        <div className="flex items-center gap-2">
          {summary}
          <ChevronDown className={`w-3.5 h-3.5 text-zinc-600 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      <div className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] mt-3 opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

export function LandingClient() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 selection:bg-teal-500/20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "SoftwareApplication", name: "MindStore",
        applicationCategory: "ProductivityApplication", operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
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
            <Link href="/app">
              <button className="h-8 px-4 rounded-lg bg-zinc-100 text-zinc-900 text-[13px] font-semibold hover:bg-white transition-colors">
                Open App
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══════ HERO — feel the problem, see the solution ═══════ */}
      <section className="pt-28 pb-8 md:pt-40 md:pb-12">
        <div className="max-w-5xl mx-auto px-6">
          <Reveal>
            <p className="text-[13px] text-zinc-600 mb-5">
              You&apos;ve had thousands of conversations with AI. Read hundreds of articles. 
              Highlighted dozens of books. <span className="text-zinc-400">Where did it all go?</span>
            </p>
          </Reveal>

          <Reveal delay={0.08}>
            <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[1.05] tracking-[-0.04em] max-w-4xl">
              Finally, all your knowledge
              <br />
              <span className="bg-gradient-to-r from-teal-400 to-sky-400 bg-clip-text text-transparent">in one place you can actually search.</span>
            </h1>
          </Reveal>

          <Reveal delay={0.15}>
            <p className="text-[17px] text-zinc-400 mt-6 max-w-xl leading-[1.75]">
              MindStore imports everything — ChatGPT, Kindle, YouTube, Notion, and 8 more sources — 
              then lets you search by meaning, chat with it, and discover connections you never knew existed.
            </p>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link href="/app">
                <button className="h-12 px-8 rounded-xl bg-teal-500 hover:bg-teal-400 text-white text-[15px] font-semibold transition-all active:scale-[0.97] shadow-lg shadow-teal-500/20">
                  Get Started — It&apos;s Free
                </button>
              </Link>
              <Link href="/app?demo=true">
                <button className="h-12 px-7 rounded-xl border border-zinc-800 text-[15px] font-medium text-zinc-300 hover:border-zinc-600 hover:text-white transition-all active:scale-[0.97]">
                  Try the Demo
                </button>
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.25}>
            <p className="text-[12px] text-zinc-700 mt-4">
              Free forever · Self-hosted · No sign-up required · MIT open source
            </p>
          </Reveal>
        </div>
      </section>

      {/* ═══════ THE MAGIC — how it works in 3 steps ═══════ */}
      <section className="py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-6">
          <Reveal>
            <p className="text-[12px] font-semibold text-teal-400 tracking-[0.1em] uppercase mb-8">How it works</p>
          </Reveal>
          
          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {[
              {
                step: "01",
                title: "Drop in your knowledge",
                desc: "Export your ChatGPT history, drag in your Kindle highlights, paste a YouTube link. MindStore eats it all.",
                detail: "12 importers: ChatGPT, Kindle, YouTube, Notion, Obsidian, Reddit, Twitter, Telegram, Pocket, Readwise, Spotify, PDF/EPUB. Plus voice memos, images, URLs, and plain text.",
              },
              {
                step: "02",
                title: "AI makes it searchable",
                desc: "Every piece of knowledge gets embedded semantically. Search by meaning, not keywords. \"What did I learn about pricing?\" just works.",
                detail: "Uses your choice of AI: Gemini (free), OpenAI, Ollama (local & free), OpenRouter (200+ models), or any OpenAI-compatible API. You bring the key, MindStore does the rest.",
              },
              {
                step: "03",
                title: "Your brain, supercharged",
                desc: "Chat with your knowledge. Auto-generate flashcards. Find contradictions in your own thinking. See your mind mapped in 3D.",
                detail: "35 built-in plugins: mind maps, sentiment analysis, knowledge gaps, blog writer, newsletter generator, resume builder, contradiction detector, topic evolution tracker, and more.",
              },
            ].map((s, i) => (
              <Reveal key={s.step} delay={i * 0.08}>
                <div>
                  <span className="text-[11px] font-mono text-teal-500/60 tracking-wider">{s.step}</span>
                  <h3 className="text-[18px] font-bold mt-2 tracking-[-0.01em]">{s.title}</h3>
                  <p className="text-[14px] text-zinc-500 mt-2 leading-[1.7]">{s.desc}</p>
                  <Expandable summary={
                    <span className="text-[12px] text-zinc-600 hover:text-zinc-400 transition-colors mt-3 inline-flex items-center gap-1.5 font-medium">
                      Learn more
                    </span>
                  }>
                    <p className="text-[13px] text-zinc-500 leading-[1.7] pl-0 border-l-2 border-teal-500/20 ml-0 pl-3">
                      {s.detail}
                    </p>
                  </Expandable>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ THE SUPERPOWER — MCP ═══════ */}
      <section className="border-t border-white/[0.04] bg-gradient-to-b from-teal-500/[0.02] to-transparent">
        <div className="max-w-5xl mx-auto px-6 py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-start">
            <div>
              <Reveal>
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-teal-500/[0.08] border border-teal-500/15 text-[11px] font-semibold text-teal-400 tracking-wider uppercase mb-4">
                  <Sparkles className="w-3 h-3" />
                  Superpower
                </div>
                <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.03em]">
                  Give any AI access to <em className="not-italic text-teal-400">your</em> brain.
                </h2>
              </Reveal>
              <Reveal delay={0.08}>
                <p className="text-[14px] text-zinc-500 mt-4 leading-[1.75]">
                  MindStore is an MCP server. Claude, ChatGPT, Cursor — 
                  any AI that speaks MCP can search your knowledge, understand your context, 
                  and work with what <em>you</em> actually know. Not the internet. You.
                </p>
              </Reveal>
              <Reveal delay={0.12}>
                <Expandable summary={
                  <span className="text-[13px] text-zinc-600 hover:text-zinc-400 transition-colors mt-4 inline-flex items-center gap-1.5 font-medium">
                    What can connected AIs do?
                  </span>
                }>
                  <div className="space-y-2 mt-1">
                    {[
                      { fn: "search_mind", desc: "Semantic search across all your knowledge" },
                      { fn: "get_profile", desc: "Understand who you are and what you know" },
                      { fn: "get_context", desc: "Pull relevant context for any topic" },
                    ].map((t) => (
                      <div key={t.fn} className="flex items-center gap-3">
                        <code className="text-[11px] font-mono text-teal-400/80 bg-teal-500/[0.06] px-2 py-0.5 rounded border border-teal-500/10">{t.fn}</code>
                        <span className="text-[12px] text-zinc-500">{t.desc}</span>
                      </div>
                    ))}
                  </div>
                </Expandable>
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
                  <span className="text-[10px] text-zinc-600 ml-2 font-mono">3 lines. that&apos;s it.</span>
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

      {/* ═══════ WHAT'S INSIDE — the features that excite ═══════ */}
      <section className="border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-6 py-16 md:py-24">
          <Reveal>
            <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.03em] mb-3">
              Not just storage. Think of it as a thinking partner.
            </h2>
            <p className="text-[14px] text-zinc-500 mb-12 max-w-xl">
              Every feature is a plugin. Install what excites you, skip what doesn&apos;t. 35 built-in, all free, more shipping from the community.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: MessageSquare, color: "text-sky-400",
                title: "Chat with your knowledge",
                desc: "Ask anything. Get answers from YOUR data, with citations.",
                detail: "Supports OpenAI, Gemini, Ollama, OpenRouter, or any OpenAI-compatible API. Streaming responses with source links.",
              },
              {
                icon: Fingerprint, color: "text-teal-400",
                title: "Knowledge fingerprint",
                desc: "A 3D map of your mind. See what you know — and what you don't.",
                detail: "Interactive WebGL visualization. Clusters form automatically from your data. Zoom into topics, find blind spots, discover connections.",
              },
              {
                icon: AlertTriangle, color: "text-amber-400",
                title: "Contradiction detector",
                desc: "Find where past-you disagrees with present-you.",
                detail: "AI scans your knowledge for conflicting beliefs across time. Not errors — evolution of thought. Fascinating to explore.",
              },
              {
                icon: Layers, color: "text-emerald-400",
                title: "Flashcard maker",
                desc: "Auto-generate decks from things you've learned.",
                detail: "Spaced repetition built in. Review due cards daily. AI generates questions from your own knowledge — better than generic study material.",
              },
              {
                icon: TrendingUp, color: "text-sky-400",
                title: "Topic evolution",
                desc: "Watch how your interests shift over months and years.",
                detail: "Timeline view of every topic you've explored. See when you got obsessed with something, when you moved on, what stuck.",
              },
              {
                icon: PenTool, color: "text-teal-400",
                title: "Create from your brain",
                desc: "Blog posts, newsletters, resumes — all grounded in what you actually know.",
                detail: "Blog writer, newsletter generator, resume builder, conversation prep, learning paths. AI drafts from your knowledge, not generic templates.",
              },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 0.04}>
                <div className="group">
                  <f.icon className={`w-5 h-5 ${f.color} mb-3`} />
                  <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{f.title}</h3>
                  <p className="text-[13px] text-zinc-500 mt-1.5 leading-[1.65]">{f.desc}</p>
                  <Expandable summary={
                    <span className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors mt-2 inline-flex items-center gap-1 font-medium">
                      Details
                    </span>
                  }>
                    <p className="text-[12px] text-zinc-500 leading-[1.7]">{f.detail}</p>
                  </Expandable>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.3}>
            <div className="mt-10 flex flex-wrap gap-2">
              {["Mind Maps", "Sentiment Analysis", "Knowledge Gaps", "Writing Style", "Voice Memos", "Image Recognition", "Smart Collections", "Duplicate Detector", "Multi-Language", "Custom RAG", "Anki Export", "Obsidian Sync", "Notion Sync"].map((p) => (
                <span key={p} className="px-3 py-1.5 rounded-full bg-zinc-900/60 border border-zinc-800/50 text-[11px] text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-all cursor-default">
                  {p}
                </span>
              ))}
              <Link href="/app/plugins" className="px-3 py-1.5 rounded-full bg-teal-500/[0.08] border border-teal-500/15 text-[11px] text-teal-400 hover:bg-teal-500/[0.15] transition-all">
                All 35 plugins →
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ COMMUNITY & EXTENSIBILITY ═══════ */}
      <section className="border-t border-white/[0.04] bg-[#0a0a0c]">
        <div className="max-w-5xl mx-auto px-6 py-16 md:py-24">
          <Reveal>
            <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.03em] mb-3">
              Your MindStore. Your rules.
            </h2>
            <p className="text-[14px] text-zinc-500 max-w-xl leading-[1.75]">
              Open source isn&apos;t a label — it&apos;s a promise. Full source code, MIT licensed, 
              community-driven. New plugins ship regularly. Build your own. Make MindStore yours.
            </p>
          </Reveal>

          <div className="mt-12 grid sm:grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Lock, title: "Self-hosted", desc: "Your server. Your data. Zero tracking." },
              { icon: Globe, title: "Bring your own AI", desc: "Gemini (free), OpenAI, Ollama, OpenRouter. No lock-in." },
              { icon: Puzzle, title: "Plugin SDK", desc: "Build custom importers, analyzers, exporters. Community growing." },
              { icon: GitBranch, title: "Open source", desc: "MIT licensed. 336 tests. 103 docs. DCO-signed commits." },
            ].map((p, i) => (
              <Reveal key={p.title} delay={i * 0.05}>
                <div>
                  <p.icon className="w-4 h-4 text-zinc-600 mb-2.5" />
                  <h3 className="text-[14px] font-semibold text-zinc-200">{p.title}</h3>
                  <p className="text-[12px] text-zinc-500 mt-1 leading-[1.65]">{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.2}>
            <div className="mt-10 pt-8 border-t border-white/[0.04] flex flex-wrap items-center gap-6 text-[13px] text-zinc-500">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Actively developed
              </span>
              <span>35 plugins shipping</span>
              <span>Community contributions welcome</span>
              <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300 transition-colors font-medium ml-auto">
                View on GitHub →
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ CTA ═══════ */}
      <section className="border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-6 py-20 md:py-28 text-center">
          <Reveal>
            <MindStoreLogo className="w-14 h-14 mx-auto mb-6 opacity-25" />
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="text-[clamp(1.5rem,3.5vw,2.5rem)] font-bold tracking-[-0.03em]">
              Your knowledge deserves better than a folder of bookmarks.
            </h2>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="text-[14px] text-zinc-500 mt-3">
              Free. Private. No sign-up. Takes 2 minutes.
            </p>
          </Reveal>
          <Reveal delay={0.16}>
            <div className="flex flex-wrap gap-3 justify-center mt-8">
              <Link href="/app">
                <button className="h-12 px-8 rounded-xl bg-teal-500 hover:bg-teal-400 text-white text-[15px] font-semibold transition-all active:scale-[0.97] shadow-lg shadow-teal-500/20">
                  Open MindStore <ArrowRight className="w-4 h-4 inline ml-1" />
                </button>
              </Link>
              <Link href="/app?demo=true">
                <button className="h-12 px-7 rounded-xl border border-zinc-800 text-[15px] font-medium text-zinc-400 hover:border-zinc-600 hover:text-white transition-all active:scale-[0.97]">
                  Try the Demo
                </button>
              </Link>
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
