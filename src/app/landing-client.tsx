"use client";

import Link from "next/link";
import {
  Brain, Lock, Search, Upload, Zap, MessageSquare, ArrowRight,
  Fingerprint, Shuffle, AlertTriangle, Timer, BarChart3, Swords,
  Sparkles, Globe, FileText, Network, GraduationCap,
  Loader2, BookOpen, Mic, Camera, Layers, Heart, PenTool,
  Target, Route, FileUser, Mail, Download, Dna,
  type LucideIcon,
} from "lucide-react";

// ─── Import source icons (for the import grid) ───────────────
const importSources = [
  { name: "ChatGPT", icon: MessageSquare, color: "text-emerald-400" },
  { name: "Kindle", icon: BookOpen, color: "text-amber-400" },
  { name: "YouTube", icon: Globe, color: "text-red-400" },
  { name: "Notion", icon: FileText, color: "text-zinc-300" },
  { name: "Obsidian", icon: Dna, color: "text-sky-400" },
  { name: "PDF & EPUB", icon: FileText, color: "text-teal-400" },
  { name: "Reddit", icon: MessageSquare, color: "text-orange-400" },
  { name: "Twitter", icon: Globe, color: "text-sky-300" },
  { name: "Spotify", icon: Mic, color: "text-emerald-300" },
  { name: "Bookmarks", icon: Globe, color: "text-blue-400" },
  { name: "Telegram", icon: MessageSquare, color: "text-sky-400" },
  { name: "Voice Memos", icon: Mic, color: "text-teal-300" },
];

export function LandingClient() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "MindStore",
    applicationCategory: "ProductivityApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description:
      "Your AI-powered second brain. Import knowledge from 12+ sources, chat with your own mind, and discover hidden connections. 35 plugins, MCP protocol, free and open source.",
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ═══════ NAV ═══════ */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#0a0a0b]/80 backdrop-blur-2xl backdrop-saturate-150 border-b border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[8px] bg-gradient-to-br from-teal-500 to-sky-600 flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-[15px] tracking-[-0.01em]">
              MindStore
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer" className="text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors hidden sm:inline-flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/></svg>
              GitHub
            </a>
            <Link href="/docs" className="text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors hidden sm:block">
              Docs
            </Link>
            <Link href="/app">
              <button className="h-8 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.06] text-[13px] font-medium text-zinc-300 hover:text-white transition-all active:scale-[0.96] flex items-center gap-1.5">
                Open App
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══════ HERO ═══════ */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
        <div className="orb w-96 h-96 bg-teal-600 top-0 -left-48" style={{ animationDelay: "0s" }} />
        <div className="orb w-72 h-72 bg-sky-600 top-20 -right-36" style={{ animationDelay: "-7s" }} />

        <div className="relative max-w-4xl mx-auto px-6 text-center landing-fade-in">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-[13px] text-zinc-400 mb-8 landing-fade-in"
            style={{ animationDelay: "0.1s" }}
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            35 plugins · 12 import sources · Free & open source
          </div>

          <h1
            className="text-[44px] sm:text-[64px] md:text-[72px] font-bold tracking-[-0.04em] leading-[1.05] mb-6 landing-fade-in"
            style={{ animationDelay: "0.2s" }}
          >
            Your AI-powered{" "}
            <span className="hero-gradient">second brain.</span>
          </h1>

          <p
            className="text-[17px] md:text-[19px] text-zinc-400 mb-10 max-w-2xl mx-auto leading-[1.7] landing-fade-in"
            style={{ animationDelay: "0.3s" }}
          >
            Import from ChatGPT, Kindle, YouTube, Notion &amp; 8 more sources.
            Chat with your own knowledge. Discover connections you never knew existed.
          </p>

          <div
            className="flex flex-wrap gap-3 justify-center mb-12 landing-fade-in"
            style={{ animationDelay: "0.4s" }}
          >
            <Link href="/app">
              <button className="h-12 px-8 rounded-2xl bg-teal-600 hover:bg-teal-500 text-[15px] font-semibold text-white transition-all active:scale-[0.97] shadow-lg shadow-teal-500/20">
                Get Started — Free
              </button>
            </Link>
            <Link href="/app?demo=true">
              <button className="h-12 px-8 rounded-2xl border border-teal-500/30 bg-teal-500/[0.06] hover:bg-teal-500/[0.12] text-[15px] font-medium text-teal-300 transition-all active:scale-[0.97]">
                🎯 Try Demo
              </button>
            </Link>
            <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer">
              <button className="h-12 px-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-[15px] font-medium text-zinc-300 transition-all active:scale-[0.97] flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/></svg>
                Star on GitHub
              </button>
            </a>
          </div>

          {/* ─── Stats bar ─── */}
          <div
            className="flex flex-wrap justify-center gap-8 md:gap-12 text-center landing-fade-in"
            style={{ animationDelay: "0.5s" }}
          >
            {[
              { value: "35", label: "Plugins" },
              { value: "12+", label: "Import Sources" },
              { value: "336", label: "Tests Passing" },
              { value: "MIT", label: "Licensed" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-[24px] font-bold text-white tabular-nums">{s.value}</p>
                <p className="text-[12px] text-zinc-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ IMPORT FROM ANYWHERE ═══════ */}
      <section className="max-w-6xl mx-auto px-6 py-20 md:py-28 border-t border-white/[0.04]">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] bg-teal-500/10 text-teal-400 border border-teal-500/15 mb-4">
            Universal Import
          </span>
          <h2 className="text-[28px] md:text-[36px] font-bold tracking-[-0.03em] mb-4">
            Import from anywhere you think
          </h2>
          <p className="text-[15px] text-zinc-500 max-w-xl mx-auto leading-relaxed">
            12 importers built-in. Drop a file, paste a URL, or connect a service. Your knowledge, unified.
          </p>
        </div>

        {/* Import source grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 mb-10">
          {importSources.map((src) => (
            <div
              key={src.name}
              className="flex flex-col items-center gap-2 py-4 px-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-200 group"
            >
              <src.icon className={`w-5 h-5 ${src.color} group-hover:scale-110 transition-transform`} />
              <span className="text-[12px] text-zinc-400 font-medium">{src.name}</span>
            </div>
          ))}
        </div>

        {/* Quick import highlight */}
        <div className="relative overflow-hidden rounded-3xl border border-teal-500/15 bg-gradient-to-br from-teal-500/[0.04] via-transparent to-sky-500/[0.03]">
          <div className="grid md:grid-cols-2 gap-8 md:gap-0">
            <div className="p-8 md:p-10 flex flex-col justify-center">
              <h3 className="text-[22px] md:text-[26px] font-bold tracking-[-0.02em] leading-[1.2] mb-4">
                Import your ChatGPT<br />
                <span className="text-teal-400">in 30 seconds.</span>
              </h3>
              <p className="text-[14px] text-zinc-400 leading-[1.7] mb-6 max-w-md">
                Years of AI conversations — every insight, every question — instantly searchable.
              </p>
              <div className="space-y-3">
                {[
                  { step: "1", label: "Export from ChatGPT", desc: "Settings → Data Controls → Export" },
                  { step: "2", label: "Download the ZIP", desc: "Check your email, click the link" },
                  { step: "3", label: "Drop it in MindStore", desc: "Drag & drop — we handle the rest" },
                ].map((s) => (
                  <div key={s.step} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-teal-500/15 flex items-center justify-center shrink-0">
                      <span className="text-[12px] font-bold text-teal-400">{s.step}</span>
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-white">{s.label}</p>
                      <p className="text-[12px] text-zinc-500">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative p-6 md:p-8 flex items-center justify-center">
              <div className="w-full max-w-xs">
                <div className="rounded-2xl border border-white/[0.08] bg-[#0d0d0e] overflow-hidden shadow-2xl shadow-black/40">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.04]">
                    <div className="w-2 h-2 rounded-full bg-red-500/60" />
                    <div className="w-2 h-2 rounded-full bg-amber-500/60" />
                    <div className="w-2 h-2 rounded-full bg-emerald-500/60" />
                    <span className="text-[9px] text-zinc-600 ml-2 font-mono">mindstore.org/app/import</span>
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="rounded-xl border-2 border-dashed border-teal-500/30 bg-teal-500/[0.04] p-6 text-center">
                      <Upload className="w-6 h-6 text-teal-400 mx-auto mb-2" />
                      <p className="text-[12px] text-zinc-300 font-medium">Drop your export</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">.json · .zip · .csv · .pdf · .epub</p>
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: "847 conversations parsed", done: true },
                        { label: "12,340 memories created", done: true },
                        { label: "Generating embeddings…", done: false },
                      ].map((line) => (
                        <div key={line.label} className="flex items-center gap-2 text-[10px]">
                          <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${line.done ? "bg-teal-500/15" : "bg-sky-500/15"}`}>
                            {line.done ? (
                              <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                            ) : (
                              <Loader2 className="w-2 h-2 text-sky-400 animate-spin" />
                            )}
                          </div>
                          <span className={line.done ? "text-zinc-400" : "text-zinc-300"}>{line.label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                      <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-teal-500 to-sky-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ WHAT YOU CAN DO ═══════ */}
      <section className="max-w-6xl mx-auto px-6 py-20 md:py-28 border-t border-white/[0.04]">
        <div className="text-center mb-14">
          <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] bg-sky-500/10 text-sky-400 border border-sky-500/15 mb-4">
            Full Feature Suite
          </span>
          <h2 className="text-[28px] md:text-[36px] font-bold tracking-[-0.03em] mb-4">
            Not just storage. Intelligence.
          </h2>
          <p className="text-[15px] text-zinc-500 max-w-xl mx-auto leading-relaxed">
            35 plugins across 5 categories. Every one free, built-in, production-grade.
          </p>
        </div>

        {/* Feature categories */}
        <div className="space-y-4">
          {/* Chat */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 md:p-8 hover:bg-white/[0.03] transition-all">
            <div className="flex items-start gap-4 md:gap-6">
              <div className="w-10 h-10 rounded-xl bg-teal-500/15 flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5 text-teal-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[17px] font-semibold mb-1">Chat With Your Mind</h3>
                <p className="text-[14px] text-zinc-400 leading-[1.7] mb-3">
                  Ask questions in natural language. Get synthesized answers from your own knowledge with source citations. 
                  Supports OpenAI, Gemini, Ollama, OpenRouter, or any OpenAI-compatible API.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["Semantic search", "Source citations", "Multi-provider", "Chat history"].map((tag) => (
                    <span key={tag} className="px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[11px] text-zinc-500">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Analysis */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:bg-white/[0.03] transition-all">
              <Fingerprint className="w-5 h-5 text-teal-400 mb-3" />
              <h3 className="text-[15px] font-semibold mb-1.5">Knowledge Fingerprint</h3>
              <p className="text-[13px] text-zinc-400 leading-[1.65]">
                Interactive 3D graph of your mind's topology. See clusters, connections, and blind spots emerge from your data.
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:bg-white/[0.03] transition-all">
              <AlertTriangle className="w-5 h-5 text-amber-400 mb-3" />
              <h3 className="text-[15px] font-semibold mb-1.5">Contradiction Detector</h3>
              <p className="text-[13px] text-zinc-400 leading-[1.65]">
                Surfaces where your own thinking conflicts across time. Not errors — evolution of thought.
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:bg-white/[0.03] transition-all">
              <Heart className="w-5 h-5 text-red-400 mb-3" />
              <h3 className="text-[15px] font-semibold mb-1.5">Sentiment Timeline</h3>
              <p className="text-[13px] text-zinc-400 leading-[1.65]">
                Track emotional patterns across your knowledge. See how your thinking about topics evolves.
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:bg-white/[0.03] transition-all">
              <Target className="w-5 h-5 text-sky-400 mb-3" />
              <h3 className="text-[15px] font-semibold mb-1.5">Knowledge Gaps</h3>
              <p className="text-[13px] text-zinc-400 leading-[1.65]">
                AI analyzes what you know and identifies what's missing. Get personalized learning suggestions.
              </p>
            </div>
          </div>

          {/* Create */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.03] transition-all">
              <Layers className="w-5 h-5 text-amber-400 mb-3" />
              <h3 className="text-[14px] font-semibold mb-1">Flashcard Maker</h3>
              <p className="text-[12px] text-zinc-500 leading-[1.65]">Auto-generate flashcards from your knowledge. Spaced repetition built-in.</p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.03] transition-all">
              <PenTool className="w-5 h-5 text-emerald-400 mb-3" />
              <h3 className="text-[14px] font-semibold mb-1">Blog Writer</h3>
              <p className="text-[12px] text-zinc-500 leading-[1.65]">Turn your knowledge into blog posts. AI drafts from your own ideas and insights.</p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.03] transition-all">
              <Route className="w-5 h-5 text-sky-400 mb-3" />
              <h3 className="text-[14px] font-semibold mb-1">Learning Paths</h3>
              <p className="text-[12px] text-zinc-500 leading-[1.65]">AI creates structured learning paths from your gaps and interests.</p>
            </div>
          </div>

          {/* More features row */}
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            {[
              "Mind Maps", "Writing Style Analysis", "Topic Evolution", "Newsletter Writer",
              "Resume Builder", "Conversation Prep", "Voice Transcription", "Image Recognition",
              "Duplicate Detector", "Smart Collections", "Custom RAG", "Multi-Language",
              "Anki Export", "Obsidian Sync", "Notion Sync",
            ].map((feature) => (
              <span key={feature} className="px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-[11px] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.12] transition-all cursor-default">
                {feature}
              </span>
            ))}
            <Link href="/app/plugins" className="px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/15 text-[11px] text-teal-400 hover:bg-teal-500/15 transition-all">
              View all 35 plugins →
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════ MCP PROTOCOL ═══════ */}
      <section className="max-w-6xl mx-auto px-6 py-20 md:py-28 border-t border-white/[0.04]">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          <div>
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 mb-4">
              Open Protocol
            </span>
            <h2 className="text-[28px] md:text-[36px] font-bold tracking-[-0.03em] mb-4">
              Connect your mind to any AI
            </h2>
            <p className="text-[15px] text-zinc-400 leading-[1.7] mb-6">
              MindStore speaks <span className="text-white font-medium">MCP</span> (Model Context Protocol).
              Connect Claude, ChatGPT, Cursor, or any MCP-compatible AI to your personal knowledge.
            </p>
            <div className="space-y-3">
              {[
                { label: "search_mind", desc: "Semantic search across all your knowledge" },
                { label: "get_profile", desc: "Your AI-generated knowledge profile" },
                { label: "get_context", desc: "Pull relevant context for any topic" },
              ].map((tool) => (
                <div key={tool.label} className="flex items-start gap-3 text-[13px]">
                  <code className="shrink-0 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-mono text-[12px] border border-emerald-500/15">{tool.label}</code>
                  <span className="text-zinc-500">{tool.desc}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d0e] p-5 font-mono text-[12px] leading-relaxed">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-amber-500/60" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
              <span className="text-[10px] text-zinc-600 ml-2">claude_desktop_config.json</span>
            </div>
            <pre className="text-zinc-400 overflow-x-auto"><code>{`{
  "mcpServers": {
    "mindstore": {
      "url": "https://mindstore.org/api/mcp"
    }
  }
}`}</code></pre>
            <p className="text-[11px] text-zinc-600 mt-3 font-sans">Add this to Claude Desktop. That&apos;s it.</p>
          </div>
        </div>
      </section>

      {/* ═══════ WHY MINDSTORE ═══════ */}
      <section className="max-w-6xl mx-auto px-6 py-20 md:py-28 border-t border-white/[0.04]">
        <h2 className="text-[28px] md:text-[36px] font-bold text-center tracking-[-0.03em] mb-14">
          Why MindStore?
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {[
            {
              icon: Lock,
              title: "100% Private",
              desc: "Self-hosted. Your data never leaves your server. All AI processing happens server-side.",
              color: "text-emerald-400",
            },
            {
              icon: Search,
              title: "Semantic Search",
              desc: "Find ideas by meaning, not keywords. AI understands what you're actually looking for.",
              color: "text-teal-400",
            },
            {
              icon: Zap,
              title: "Instant Setup",
              desc: "Deploy in 2 minutes. Add an API key, import your first file, start asking.",
              color: "text-amber-400",
            },
            {
              icon: Globe,
              title: "Any AI Provider",
              desc: "OpenAI, Gemini, Ollama, OpenRouter, or any OpenAI-compatible endpoint. Your choice.",
              color: "text-sky-400",
            },
            {
              icon: Network,
              title: "MCP Native",
              desc: "Connect your knowledge to Claude, Cursor, or any MCP client. Your mind as a tool.",
              color: "text-teal-400",
            },
            {
              icon: Sparkles,
              title: "Open Source",
              desc: "MIT licensed. 336 tests. Full documentation. Built in public, for the community.",
              color: "text-zinc-300",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] transition-all duration-300"
            >
              <feature.icon className={`w-5 h-5 ${feature.color} mb-3`} />
              <h3 className="text-[14px] font-semibold mb-1">
                {feature.title}
              </h3>
              <p className="text-[13px] text-zinc-500 leading-[1.6]">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ CTA ═══════ */}
      <section className="max-w-6xl mx-auto px-6 py-20 md:py-28">
        <div className="relative overflow-hidden rounded-3xl border border-teal-500/15 bg-gradient-to-b from-teal-500/[0.06] to-transparent p-10 md:p-16 text-center">
          <div className="orb w-64 h-64 bg-teal-600 -top-32 -right-32" style={{ animationDelay: "-5s" }} />
          <div className="relative">
            <h2 className="text-[28px] md:text-[36px] font-bold tracking-[-0.03em] mb-4">
              Ready to search your mind?
            </h2>
            <p className="text-[15px] text-zinc-500 mb-8 max-w-md mx-auto">
              Free. Private. Self-hosted. 35 plugins. Open source.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/app">
                <button className="h-12 px-10 rounded-2xl bg-teal-600 hover:bg-teal-500 text-[15px] font-semibold text-white transition-all active:scale-[0.97] shadow-lg shadow-teal-500/20 flex items-center gap-2">
                  Open MindStore
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
              <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer">
                <button className="h-12 px-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-[15px] font-medium text-zinc-300 transition-all active:scale-[0.97]">
                  View Source
                </button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="border-t border-white/[0.04] py-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-zinc-600">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              <span className="font-medium">MindStore</span>
              <span className="text-zinc-700">·</span>
              <span>MIT License</span>
              <span className="text-zinc-700">·</span>
              <span>Open Source</span>
            </div>
            <div className="flex items-center gap-4">
              <a href="https://github.com/WarriorSushi/mindstore" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/></svg>
                GitHub
              </a>
              <Link href="/docs" className="hover:text-zinc-300 transition-colors">Docs</Link>
              <span>
                Built by{" "}
                <a href="https://github.com/WarriorSushi" className="text-zinc-500 hover:text-zinc-300 transition-colors">WarriorSushi</a>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
