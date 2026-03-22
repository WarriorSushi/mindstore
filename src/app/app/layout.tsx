"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, LayoutDashboard, Upload, MessageSquare, Compass, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/app", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/app/import", icon: Upload, label: "Import" },
  { href: "/app/chat", icon: MessageSquare, label: "Chat" },
  { href: "/app/explore", icon: Compass, label: "Explore" },
  { href: "/app/settings", icon: Settings, label: "Settings" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-16 md:w-56 border-r border-zinc-800/50 bg-zinc-950 flex flex-col shrink-0">
        <Link href="/" className="h-16 flex items-center gap-2 px-4 border-b border-zinc-800/50">
          <Brain className="w-6 h-6 text-violet-400 shrink-0" />
          <span className="font-semibold hidden md:block">Mindstore</span>
        </Link>
        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-violet-500/10 text-violet-400"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span className="hidden md:block">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
