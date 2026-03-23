"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  LayoutDashboard,
  Upload,
  MessageSquare,
  Compass,
  Settings,
  GraduationCap,
  Fingerprint,
  Lightbulb,
  Network,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

const navItems = [
  { href: "/app", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/app/import", icon: Upload, label: "Import" },
  { href: "/app/chat", icon: MessageSquare, label: "Chat" },
  { href: "/app/explore", icon: Compass, label: "Explore" },
  { href: "/app/learn", icon: GraduationCap, label: "Learn" },
  { href: "/app/fingerprint", icon: Fingerprint, label: "Fingerprint" },
  { href: "/app/insights", icon: Lightbulb, label: "Insights" },
  { href: "/app/connect", icon: Network, label: "Connect" },
  { href: "/app/settings", icon: Settings, label: "Settings" },
];

// Bottom bar shows top 5 most-used items on mobile
const mobileNavItems = [
  { href: "/app", icon: LayoutDashboard, label: "Home" },
  { href: "/app/chat", icon: MessageSquare, label: "Chat" },
  { href: "/app/import", icon: Upload, label: "Import" },
  { href: "/app/explore", icon: Compass, label: "Explore" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Prevent body scroll when sidebar open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* ─── Mobile Top Bar ─── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-zinc-950/95 backdrop-blur-xl border-b border-white/[0.06] flex items-center justify-between px-4 safe-top">
        <Link href="/app" className="flex items-center gap-2.5">
          <Brain className="w-5 h-5 text-violet-400" />
          <span className="font-semibold text-[15px]">MindStore</span>
        </Link>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/[0.06] transition-colors"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* ─── Mobile Sidebar Overlay ─── */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <nav className="absolute top-14 right-0 w-64 h-[calc(100%-3.5rem)] bg-zinc-950 border-l border-white/[0.06] p-3 overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="space-y-0.5">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all",
                      active
                        ? "bg-violet-500/15 text-violet-300"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] active:bg-white/[0.08]"
                    )}
                  >
                    <item.icon className={cn("w-[18px] h-[18px]", active && "text-violet-400")} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      )}

      {/* ─── Desktop Sidebar ─── */}
      <aside className="hidden md:flex w-56 fixed left-0 top-0 h-screen border-r border-white/[0.06] bg-zinc-950 flex-col z-30">
        <Link href="/" className="h-14 flex items-center gap-2.5 px-5 border-b border-white/[0.06]">
          <Brain className="w-5 h-5 text-violet-400" />
          <span className="font-semibold text-[15px]">MindStore</span>
        </Link>
        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all",
                  active
                    ? "bg-violet-500/15 text-violet-300"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                )}
              >
                <item.icon className={cn("w-[18px] h-[18px]", active && "text-violet-400")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <p className="text-[10px] text-zinc-600 text-center">v0.3 · by AltCorp</p>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <main className="md:ml-56 min-h-screen pb-20 md:pb-0 pt-14 md:pt-0">
        <div className="max-w-4xl mx-auto px-4 py-4 md:px-8 md:py-6">
          {children}
        </div>
      </main>

      {/* ─── Mobile Bottom Nav ─── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-xl border-t border-white/[0.06] safe-bottom">
        <div className="flex items-center justify-around h-14">
          {mobileNavItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-[56px]",
                  active
                    ? "text-violet-400"
                    : "text-zinc-500 active:text-zinc-300"
                )}
              >
                <item.icon className={cn("w-5 h-5", active && "text-violet-400")} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-zinc-500 active:text-zinc-300 min-w-[56px]"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
