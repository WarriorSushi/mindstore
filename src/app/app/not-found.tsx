"use client";

import Link from "next/link";
import {
  Brain, ArrowLeft, LayoutDashboard, MessageSquare, Upload,
  Compass, Search, Puzzle,
} from "lucide-react";

const suggestions = [
  { href: "/app", icon: LayoutDashboard, label: "Dashboard", desc: "Your mind at a glance" },
  { href: "/app/chat", icon: MessageSquare, label: "Chat", desc: "Ask your knowledge" },
  { href: "/app/import", icon: Upload, label: "Import", desc: "Add new memories" },
  { href: "/app/explore", icon: Compass, label: "Explore", desc: "Browse everything" },
  { href: "/app/plugins", icon: Puzzle, label: "Plugins", desc: "33 extensions" },
];

export default function AppNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="text-center space-y-8 px-6 max-w-md w-full">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/15 flex items-center justify-center mx-auto">
          <Search className="w-7 h-7 text-teal-400/50" />
        </div>

        {/* Copy */}
        <div className="space-y-2">
          <h1 className="text-[42px] font-bold tracking-[-0.04em] bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">
            404
          </h1>
          <p className="text-[15px] text-zinc-400">
            This page doesn&apos;t exist in your mind… yet.
          </p>
          <p className="text-[12px] text-zinc-600">
            Maybe try searching, or navigate to one of these:
          </p>
        </div>

        {/* Quick nav suggestions */}
        <div className="space-y-1.5 text-left">
          {suggestions.map((s) => (
            <Link key={s.href} href={s.href}>
              <div className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.1] transition-all active:scale-[0.98]">
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 group-hover:bg-teal-500/10 transition-colors">
                  <s.icon className="w-4 h-4 text-zinc-500 group-hover:text-teal-400 transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-zinc-300">{s.label}</p>
                  <p className="text-[11px] text-zinc-600">{s.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Back button */}
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-all"
        >
          <ArrowLeft className="w-3 h-3" />
          Go back
        </button>
      </div>
    </div>
  );
}
