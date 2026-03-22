"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Brain, Lock, Search, Upload, Zap, MessageSquare, ArrowRight, Fingerprint, Shuffle, AlertTriangle, Timer, BarChart3, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

export default function LandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "MindStore",
    applicationCategory: "ProductivityApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description: "Import your ChatGPT conversations, notes, and knowledge. Ask anything. Get synthesized answers from your own brain.",
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Nav */}
      <nav className="border-b border-zinc-800/50 backdrop-blur-sm sticky top-0 z-50 bg-zinc-950/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-violet-400" />
            <span className="font-semibold text-lg">MindStore</span>
          </div>
          <Link href="/app">
            <Button variant="outline" size="sm" className="border-zinc-700 hover:bg-zinc-800">
              Open App <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative max-w-6xl mx-auto px-6 pt-24 pb-20 overflow-hidden">
        {/* Background orbs */}
        <div className="orb w-96 h-96 bg-violet-600 top-0 -left-48" style={{ animationDelay: '0s' }} />
        <div className="orb w-72 h-72 bg-fuchsia-600 top-20 -right-36" style={{ animationDelay: '-7s' }} />
        <div className="orb w-64 h-64 bg-indigo-600 -bottom-32 left-1/3" style={{ animationDelay: '-14s' }} />

        <motion.div
          initial="hidden"
          animate="visible"
          className="relative text-center max-w-3xl mx-auto"
        >
          <motion.div custom={0} variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 backdrop-blur-sm text-sm text-zinc-400 mb-8">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            100% private — your data never leaves your browser
          </motion.div>

          <motion.h1 custom={1} variants={fadeUp} className="text-5xl sm:text-7xl font-bold tracking-tight mb-6">
            Your mind,{" "}
            <span className="hero-gradient">
              searchable.
            </span>
          </motion.h1>

          <motion.p custom={2} variants={fadeUp} className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Import your ChatGPT conversations, notes, and knowledge.
            Ask anything. Get synthesized answers from <span className="text-zinc-200 font-medium">your own brain</span>.
          </motion.p>

          <motion.div custom={3} variants={fadeUp} className="flex flex-wrap gap-4 justify-center">
            <Link href="/app">
              <Button size="lg" className="bg-violet-600 hover:bg-violet-500 text-white px-8">
                Get Started — Free
              </Button>
            </Link>
            <Link href="/app?demo=true">
              <Button size="lg" variant="outline" className="border-violet-500/40 hover:bg-violet-950/50 text-violet-300 px-8">
                🎯 Try Demo
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button size="lg" variant="outline" className="border-zinc-700 hover:bg-zinc-800 px-8">
                See How It Works
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-16">Three steps to a searchable mind</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: Upload, title: "1. Import", desc: "Drop your ChatGPT export, paste notes, upload files. MindStore ingests everything." },
            { icon: Zap, title: "2. Index", desc: "AI creates semantic embeddings of your knowledge. Every idea becomes findable." },
            { icon: Search, title: "3. Ask", desc: "Query your mind in natural language. Get synthesized answers with source citations." },
          ].map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="glow-card p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 transition-all duration-300 hover:-translate-y-1"
            >
              <step.icon className="w-10 h-10 text-violet-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
              <p className="text-zinc-400 leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Innovation Layer */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-zinc-800/30">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20 mb-4">INNOVATION LAYER</span>
          <h2 className="text-3xl font-bold mb-4">Features no other tool has</h2>
          <p className="text-zinc-400 max-w-xl mx-auto">MindStore doesn't just store your knowledge — it understands it, connects it, and challenges it.</p>
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: Fingerprint, title: "Knowledge Fingerprint", desc: "3D WebGL visualization of your mind's topology. See clusters, connections, and blind spots in an interactive graph.", color: "text-violet-400" },
            { icon: Shuffle, title: "Cross-Pollination", desc: "Discovers unexpected bridges between distant ideas. \"Your gardening notes share a pattern with your software architecture conversations.\"", color: "text-emerald-400" },
            { icon: AlertTriangle, title: "Contradiction Detector", desc: "Surfaces where your own thinking conflicts. Not errors — evolution of thought across time.", color: "text-red-400" },
            { icon: Timer, title: "Forgetting Curve", desc: "Ebbinghaus spaced repetition across your entire knowledge base. Alerts when knowledge is fading.", color: "text-amber-400" },
            { icon: BarChart3, title: "Mind Diff & Metabolism", desc: "Track what you learned this week. A 0-10 fitness score for your brain measuring intake, diversity, and growth.", color: "text-cyan-400" },
            { icon: Swords, title: "Devil's Advocate", desc: "Challenges your assumptions using your own stored knowledge. Real contradicting evidence, not generic counterarguments.", color: "text-fuchsia-400" },
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="glow-card p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 transition-all duration-300 hover:-translate-y-1"
            >
              <feature.icon className={`w-8 h-8 ${feature.color} mb-4`} />
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">Why MindStore?</h2>
        <p className="text-zinc-400 text-center mb-16 max-w-xl mx-auto">ChatGPT forgets. Your notes are scattered. MindStore unifies everything into one queryable brain.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: Brain, title: "Unified Knowledge", desc: "ChatGPT exports, notes, articles, files — all in one searchable place." },
            { icon: MessageSquare, title: "Ask Your Mind", desc: "Natural language queries. Synthesized answers pulling from all your sources." },
            { icon: Lock, title: "100% Private", desc: "Everything stays in your browser. No servers. No tracking. Your data is yours." },
            { icon: Search, title: "Semantic Search", desc: "Find ideas by meaning, not just keywords. AI understands what you're looking for." },
            { icon: Zap, title: "Instant Setup", desc: "No install. No account. Drop a file, add your OpenAI key, start asking." },
            { icon: Upload, title: "Multiple Sources", desc: "ChatGPT JSON, text, markdown files, URLs — import from anywhere." },
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="glow-card p-5 rounded-lg border border-zinc-800/50 hover:border-zinc-700/50 transition-all duration-300"
            >
              <feature.icon className="w-5 h-5 text-violet-400 mb-3" />
              <h3 className="font-medium mb-1">{feature.title}</h3>
              <p className="text-sm text-zinc-500">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <div className="relative p-12 rounded-2xl border border-violet-500/20 bg-gradient-to-b from-violet-950/30 to-zinc-950 overflow-hidden">
          <div className="orb w-64 h-64 bg-violet-600 -top-32 -right-32" style={{ animationDelay: '-5s' }} />
          <div className="relative">
          <h2 className="text-3xl font-bold mb-4">Ready to search your mind?</h2>
          <p className="text-zinc-400 mb-8">Free. Private. No account needed.</p>
          <Link href="/app">
            <Button size="lg" className="bg-violet-600 hover:bg-violet-500 text-white px-10">
              Open MindStore <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-sm text-zinc-500">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            <span>MindStore</span>
          </div>
          <span>Built by <a href="https://github.com/WarriorSushi" className="text-zinc-400 hover:text-zinc-300">WarriorSushi</a></span>
        </div>
      </footer>
    </div>
  );
}
