"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Brain, Search, MessageSquare, Shield, ArrowRight, Zap, Database, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-lg">
            <Brain className="w-5 h-5 text-primary" />
            <span>Mindstore</span>
          </div>
          <Link href="/app">
            <Button variant="secondary" size="sm">Open App</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20">
        <motion.div
          className="text-center max-w-3xl mx-auto"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        >
          <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm mb-6 border border-primary/20">
            <Lock className="w-3 h-3" />
            100% private. Your data never leaves your browser.
          </motion.div>
          <motion.h1 variants={fadeUp} custom={1} className="text-5xl sm:text-6xl font-bold tracking-tight mb-6">
            Your mind,{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              searchable.
            </span>
          </motion.h1>
          <motion.p variants={fadeUp} custom={2} className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
            Import your ChatGPT conversations, notes, and knowledge. Ask anything.
            Get answers from YOUR brain — powered by AI, stored locally.
          </motion.p>
          <motion.div variants={fadeUp} custom={3} className="flex gap-3 justify-center">
            <Link href="/app">
              <Button size="lg" className="gap-2">
                Get Started <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-border/50">
        <motion.h2
          className="text-3xl font-bold text-center mb-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          How it works
        </motion.h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: Database, title: "1. Import", desc: "Upload your ChatGPT export, paste text, or drop files. We parse and chunk everything automatically." },
            { icon: Zap, title: "2. Index", desc: "Each chunk gets embedded with OpenAI's latest model. Vectors are stored locally in your browser's IndexedDB." },
            { icon: Search, title: "3. Ask", desc: "Ask any question. We search your knowledge semantically, find the best matches, and synthesize an answer." },
          ].map((step, i) => (
            <motion.div
              key={step.title}
              className="p-6 rounded-xl border border-border/50 bg-card/50 hover:bg-card transition-colors"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
            >
              <step.icon className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
              <p className="text-muted-foreground text-sm">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Demo */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-border/50">
        <motion.div
          className="max-w-2xl mx-auto"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl font-bold text-center mb-8">See it in action</h2>
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-secondary rounded-lg p-3 text-sm">
                What was my pricing strategy for the SaaS product?
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Brain className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted rounded-lg p-3 text-sm space-y-2">
                <p>Based on your conversations, you discussed a <strong>tiered pricing strategy</strong> with three plans:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Free tier with 100 queries/month</li>
                  <li>Pro at $19/mo with unlimited queries</li>
                  <li>Team at $49/mo with collaboration features</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-2 border-t border-border pt-2">
                  📎 Source: ChatGPT conversation &ldquo;Pricing Strategy Discussion&rdquo;, March 2025
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-border/50">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Shield, title: "100% Private", desc: "All data stored in your browser. Nothing sent to any server." },
            { icon: Brain, title: "AI-Powered", desc: "Semantic search + GPT synthesis for accurate answers." },
            { icon: Database, title: "Multi-Source", desc: "ChatGPT exports, text, files, and URLs." },
            { icon: Zap, title: "Instant", desc: "Client-side vector search. No backend latency." },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              className="p-5 rounded-lg border border-border/30 bg-card/30"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <f.icon className="w-5 h-5 text-primary mb-3" />
              <h3 className="font-medium mb-1 text-sm">{f.title}</h3>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>Mindstore — Your personal knowledge base. Built with privacy in mind.</p>
        </div>
      </footer>
    </div>
  );
}
