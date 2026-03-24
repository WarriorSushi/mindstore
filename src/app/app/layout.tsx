"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain, LayoutDashboard, Upload, MessageSquare, Compass, Settings,
  GraduationCap, Fingerprint, Lightbulb, Network, Menu, X, Sparkles,
  Search, Keyboard, Puzzle, TrendingUp, Heart, Target, PenTool, Layers,
  FileEdit, Users, Route,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Onboarding } from "@/components/Onboarding";
import { CommandPalette } from "@/components/CommandPalette";
import { GlobalDropZone } from "@/components/GlobalDropZone";
import { KeyboardShortcuts, openKeyboardShortcuts } from "@/components/KeyboardShortcuts";

const navItems = [
  { href: "/app", icon: LayoutDashboard, label: "Home" },
  { href: "/app/chat", icon: MessageSquare, label: "Chat" },
  { href: "/app/import", icon: Upload, label: "Import" },
  { href: "/app/explore", icon: Compass, label: "Explore" },
  { href: "/app/learn", icon: GraduationCap, label: "Learn" },
  { href: "/app/mindmap", icon: Network, label: "Mind Map" },
  { href: "/app/evolution", icon: TrendingUp, label: "Evolution" },
  { href: "/app/sentiment", icon: Heart, label: "Sentiment" },
  { href: "/app/gaps", icon: Target, label: "Gaps" },
  { href: "/app/writing", icon: PenTool, label: "Writing" },
  { href: "/app/flashcards", icon: Layers, label: "Flashcards" },
  { href: "/app/blog", icon: FileEdit, label: "Blog Writer" },
  { href: "/app/prep", icon: Users, label: "Prep" },
  { href: "/app/paths", icon: Route, label: "Learn Paths" },
  { href: "/app/insights", icon: Lightbulb, label: "Insights" },
  { href: "/app/plugins", icon: Puzzle, label: "Plugins" },
  { href: "/app/connect", icon: Network, label: "Connect AI" },
  { href: "/app/settings", icon: Settings, label: "Settings" },
];

const bottomNav = [
  { href: "/app", icon: LayoutDashboard, label: "Home" },
  { href: "/app/chat", icon: MessageSquare, label: "Chat" },
  { href: "/app/import", icon: Upload, label: "Import" },
  { href: "/app/explore", icon: Compass, label: "Explore" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const isChat = pathname === "/app/chat";

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0b]">
      {/* ════════ ONBOARDING ════════ */}
      <Onboarding />
      {/* ════════ COMMAND PALETTE ════════ */}
      <CommandPalette />
      {/* ════════ GLOBAL DROP ZONE ════════ */}
      <GlobalDropZone />
      {/* ════════ KEYBOARD SHORTCUTS HELP ════════ */}
      <KeyboardShortcuts />
      {/* ════════ MOBILE HEADER ════════ */}
      <header className={cn(
        "md:hidden fixed top-0 inset-x-0 z-50 safe-top",
        "h-12 flex items-center justify-between px-4",
        "bg-[#0a0a0b]/80 backdrop-blur-2xl backdrop-saturate-150",
        "border-b border-white/[0.04]",
      )}>
        <Link href="/app" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[8px] bg-gradient-to-br from-teal-500 to-sky-600 flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-[15px] tracking-[-0.01em]">MindStore</span>
        </Link>
        <div className="flex items-center gap-1">
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors"
            aria-label="Search"
          >
            <Search className="w-[18px] h-[18px] text-zinc-400" />
          </button>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors"
            aria-label="Menu"
          >
            {menuOpen ? <X className="w-[18px] h-[18px]" /> : <Menu className="w-[18px] h-[18px]" />}
          </button>
        </div>
      </header>

      {/* ════════ MOBILE MENU OVERLAY ════════ */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
          <div
            className="absolute top-12 inset-x-0 safe-top bg-[#111113] border-b border-white/[0.06] animate-in slide-in-from-top shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="p-2 max-h-[70dvh] overflow-y-auto">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] transition-all active:scale-[0.98]",
                      active
                        ? "bg-teal-500/12 text-white font-medium"
                        : "text-zinc-400 active:bg-white/[0.06]"
                    )}
                  >
                    <item.icon className={cn("w-5 h-5", active ? "text-teal-400" : "text-zinc-500")} />
                    {item.label}
                    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-400" />}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* ════════ DESKTOP SIDEBAR ════════ */}
      <aside className="hidden md:flex w-[220px] fixed left-0 top-0 h-screen flex-col z-30 bg-[#0a0a0b] border-r border-white/[0.04]">
        <Link href="/" className="h-14 flex items-center gap-2.5 px-5 border-b border-white/[0.04]">
          <div className="w-7 h-7 rounded-[8px] bg-gradient-to-br from-teal-500 to-sky-600 flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-[15px] tracking-[-0.01em]">MindStore</span>
        </Link>
        <nav className="flex-1 py-2 px-2.5 space-y-px overflow-y-auto">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-all",
                  active
                    ? "bg-white/[0.08] text-white"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                )}
              >
                <item.icon className={cn("w-4 h-4", active ? "text-teal-400" : "text-zinc-500")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-3 border-t border-white/[0.04] space-y-2">
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            className="w-full flex items-center gap-2 px-2.5 py-[7px] rounded-lg text-[12px] text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] transition-all"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Search</span>
            <kbd className="text-[10px] font-mono bg-white/[0.04] border border-white/[0.08] rounded px-1.5 py-[1px]">⌘K</kbd>
          </button>
          <button
            onClick={() => openKeyboardShortcuts()}
            className="w-full flex items-center gap-2 px-2.5 py-[7px] rounded-lg text-[12px] text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] transition-all"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Shortcuts</span>
            <kbd className="text-[10px] font-mono bg-white/[0.04] border border-white/[0.08] rounded px-1.5 py-[1px]">?</kbd>
          </button>
          <p className="text-[10px] text-zinc-600 font-medium tracking-wide px-2.5">MINDSTORE v0.3</p>
        </div>
      </aside>

      {/* ════════ MAIN CONTENT ════════ */}
      <main className={cn(
        "md:ml-[220px] min-h-[100dvh]",
        "pt-12 md:pt-0",  // account for mobile header
        "pb-[52px] md:pb-0",  // bottom nav space on mobile (always visible now)
      )}>
        <div className={cn(
          "mx-auto",
          isChat ? "h-[calc(100dvh-3rem-52px)] md:h-[100dvh]" : "max-w-3xl px-4 py-5 md:px-8 md:py-8",
        )}>
          {children}
        </div>
      </main>

      {/* ════════ MOBILE BOTTOM NAV ════════ */}
      <nav className={cn(
        "md:hidden fixed bottom-0 inset-x-0 z-50 safe-bottom",
        "bg-[#0a0a0b]/80 backdrop-blur-2xl backdrop-saturate-150",
        "border-t border-white/[0.04]",
      )}>
          <div className="grid grid-cols-5 h-[52px]">
            {bottomNav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center justify-center gap-[2px] active:opacity-70 transition-opacity"
                >
                  <item.icon className={cn(
                    "w-[20px] h-[20px] transition-colors",
                    active ? "text-teal-400" : "text-zinc-600"
                  )} />
                  <span className={cn(
                    "text-[10px] font-medium transition-colors",
                    active ? "text-teal-400" : "text-zinc-600"
                  )}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
            <button
              onClick={() => setMenuOpen(true)}
              className="flex flex-col items-center justify-center gap-[2px] active:opacity-70 transition-opacity"
            >
              <Sparkles className="w-[20px] h-[20px] text-zinc-600" />
              <span className="text-[10px] font-medium text-zinc-600">More</span>
            </button>
          </div>
        </nav>
    </div>
  );
}
