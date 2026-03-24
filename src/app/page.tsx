"use client";

import Link from "next/link";
import {
  Brain, Lock, Search, Upload, Zap, MessageSquare, ArrowRight,
  Fingerprint, Shuffle, AlertTriangle, Timer, BarChart3, Swords,
  ChevronRight, Sparkles, Globe, FileText, Network, GraduationCap,
} from "lucide-react";

export default function LandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "MindStore",
    applicationCategory: "ProductivityApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description:
      "Import your ChatGPT conversations, notes, and knowledge. Ask anything. Get synthesized answers from your own brain.",
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
          <Link href="/app">
            <button className="h-8 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.06] text-[13px] font-medium text-zinc-300 hover:text-white transition-all active:scale-[0.96] flex items-center gap-1.5">
              Open App
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Link>
        </div>
      </nav>

      {/* ═══════ HERO ═══════ */}
      <section className="relative pt-32 pb-24 md:pt-40 md:pb-32 overflow-hidden">
        {/* Background orbs */}
        <div
          className="orb w-96 h-96 bg-teal-600 top-0 -left-48"
          style={{ animationDelay: "0s" }}
        />
        <div
          className="orb w-72 h-72 bg-sky-600 top-20 -right-36"
          style={{ animationDelay: "-7s" }}
        />
        <div
          className="orb w-64 h-64 bg-indigo-600 -bottom-32 left-1/3"
          style={{ animationDelay: "-14s" }}
        />

        <div className="relative max-w-3xl mx-auto px-6 text-center landing-fade-in">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-[13px] text-zinc-400 mb-8 landing-fade-in"
            style={{ animationDelay: "0.1s" }}
          >
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            Your second brain — powered by AI
          </div>

          {/* Headline */}
          <h1
            className="text-[48px] sm:text-[72px] font-bold tracking-[-0.04em] leading-[1.05] mb-6 landing-fade-in"
            style={{ animationDelay: "0.2s" }}
          >
            Your mind,{" "}
            <span className="hero-gradient">searchable.</span>
          </h1>

          {/* Subhead */}
          <p
            className="text-[17px] md:text-[19px] text-zinc-400 mb-10 max-w-2xl mx-auto leading-[1.7] landing-fade-in"
            style={{ animationDelay: "0.3s" }}
          >
            Import your ChatGPT conversations, notes, and knowledge. Ask
            anything. Get synthesized answers from{" "}
            <span className="text-zinc-200 font-medium">your own brain</span>.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-wrap gap-3 justify-center landing-fade-in"
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
            <Link href="#how-it-works">
              <button className="h-12 px-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-[15px] font-medium text-zinc-300 transition-all active:scale-[0.97]">
                See How It Works
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section
        id="how-it-works"
        className="max-w-6xl mx-auto px-6 py-20 md:py-28"
      >
        <h2 className="text-[28px] md:text-[36px] font-bold text-center tracking-[-0.03em] mb-4">
          Three steps to a searchable mind
        </h2>
        <p className="text-[15px] text-zinc-500 text-center mb-14 max-w-lg mx-auto">
          From raw data to instant answers in minutes.
        </p>
        <div className="grid md:grid-cols-3 gap-4 md:gap-5">
          {[
            {
              icon: Upload,
              color: "text-teal-400",
              bg: "from-teal-500/15 to-teal-500/5",
              title: "1. Import",
              desc: "Drop your ChatGPT export, paste notes, upload files. MindStore ingests everything.",
            },
            {
              icon: Zap,
              color: "text-blue-400",
              bg: "from-blue-500/15 to-blue-500/5",
              title: "2. Index",
              desc: "AI creates semantic embeddings of your knowledge. Every idea becomes findable.",
            },
            {
              icon: Search,
              color: "text-emerald-400",
              bg: "from-emerald-500/15 to-emerald-500/5",
              title: "3. Ask",
              desc: "Query your mind in natural language. Get synthesized answers with source citations.",
            },
          ].map((step) => (
            <div
              key={step.title}
              className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 md:p-7 hover:bg-white/[0.04] transition-all duration-300 group"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-b ${step.bg} pointer-events-none`}
              />
              <div className="relative">
                <div className="w-11 h-11 rounded-xl bg-white/[0.06] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <step.icon className={`w-5 h-5 ${step.color}`} />
                </div>
                <h3 className="text-[17px] font-semibold mb-2 tracking-[-0.01em]">
                  {step.title}
                </h3>
                <p className="text-[14px] text-zinc-400 leading-[1.65]">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ INNOVATION FEATURES ═══════ */}
      <section className="max-w-6xl mx-auto px-6 py-20 md:py-28 border-t border-white/[0.04]">
        <div className="text-center mb-14">
          <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] bg-teal-500/10 text-teal-400 border border-teal-500/15 mb-4">
            Innovation Layer
          </span>
          <h2 className="text-[28px] md:text-[36px] font-bold tracking-[-0.03em] mb-4">
            Features no other tool has
          </h2>
          <p className="text-[15px] text-zinc-500 max-w-xl mx-auto leading-relaxed">
            MindStore doesn't just store your knowledge — it understands it,
            connects it, and challenges it.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {[
            {
              icon: Fingerprint,
              title: "Knowledge Fingerprint",
              desc: "3D WebGL visualization of your mind's topology. See clusters, connections, and blind spots in an interactive graph.",
              color: "text-teal-400",
              border: "hover:border-teal-500/20",
            },
            {
              icon: Shuffle,
              title: "Cross-Pollination",
              desc: 'Discovers unexpected bridges between distant ideas. "Your gardening notes share a pattern with your software architecture conversations."',
              color: "text-emerald-400",
              border: "hover:border-emerald-500/20",
            },
            {
              icon: AlertTriangle,
              title: "Contradiction Detector",
              desc: "Surfaces where your own thinking conflicts. Not errors — evolution of thought across time.",
              color: "text-red-400",
              border: "hover:border-red-500/20",
            },
            {
              icon: Timer,
              title: "Forgetting Curve",
              desc: "Ebbinghaus spaced repetition across your entire knowledge base. Alerts when knowledge is fading.",
              color: "text-amber-400",
              border: "hover:border-amber-500/20",
            },
            {
              icon: BarChart3,
              title: "Mind Diff & Metabolism",
              desc: "Track what you learned this week. A 0-10 fitness score for your brain measuring intake, diversity, and growth.",
              color: "text-cyan-400",
              border: "hover:border-cyan-500/20",
            },
            {
              icon: Swords,
              title: "Devil's Advocate",
              desc: "Challenges your assumptions using your own stored knowledge. Real contradicting evidence, not generic counterarguments.",
              color: "text-sky-400",
              border: "hover:border-sky-500/20",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 md:p-6 hover:bg-white/[0.04] transition-all duration-300 ${feature.border}`}
            >
              <feature.icon
                className={`w-6 h-6 ${feature.color} mb-3.5`}
              />
              <h3 className="text-[15px] font-semibold mb-1.5 tracking-[-0.01em]">
                {feature.title}
              </h3>
              <p className="text-[13px] text-zinc-500 leading-[1.65]">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ WHY MINDSTORE ═══════ */}
      <section className="max-w-6xl mx-auto px-6 py-20 md:py-28 border-t border-white/[0.04]">
        <h2 className="text-[28px] md:text-[36px] font-bold text-center tracking-[-0.03em] mb-4">
          Why MindStore?
        </h2>
        <p className="text-[15px] text-zinc-500 text-center mb-14 max-w-xl mx-auto">
          ChatGPT forgets. Your notes are scattered. MindStore unifies
          everything into one queryable brain.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {[
            {
              icon: Brain,
              title: "Unified Knowledge",
              desc: "ChatGPT exports, notes, articles, files — all in one searchable place.",
            },
            {
              icon: MessageSquare,
              title: "Ask Your Mind",
              desc: "Natural language queries. Synthesized answers pulling from all your sources.",
            },
            {
              icon: Lock,
              title: "100% Private",
              desc: "Your data stays secure on your own server. All AI calls handled server-side. You own everything.",
            },
            {
              icon: Search,
              title: "Semantic Search",
              desc: "Find ideas by meaning, not just keywords. AI understands what you're looking for.",
            },
            {
              icon: Zap,
              title: "Instant Setup",
              desc: "Quick deploy. Add your API key, start asking. All processing happens server-side.",
            },
            {
              icon: Upload,
              title: "Multiple Sources",
              desc: "ChatGPT JSON, text, markdown files, URLs — import from anywhere.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] transition-all duration-300"
            >
              <feature.icon className="w-5 h-5 text-teal-400 mb-3" />
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
          <div
            className="orb w-64 h-64 bg-teal-600 -top-32 -right-32"
            style={{ animationDelay: "-5s" }}
          />
          <div className="relative">
            <h2 className="text-[28px] md:text-[36px] font-bold tracking-[-0.03em] mb-4">
              Ready to search your mind?
            </h2>
            <p className="text-[15px] text-zinc-500 mb-8">
              Free. Private. Self-hosted.
            </p>
            <Link href="/app">
              <button className="h-12 px-10 rounded-2xl bg-teal-600 hover:bg-teal-500 text-[15px] font-semibold text-white transition-all active:scale-[0.97] shadow-lg shadow-teal-500/20 flex items-center gap-2 mx-auto">
                Open MindStore
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="border-t border-white/[0.04] py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-[13px] text-zinc-600">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            <span className="font-medium">MindStore</span>
          </div>
          <span>
            Built by{" "}
            <a
              href="https://github.com/WarriorSushi"
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              WarriorSushi
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
