"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, Home, Upload, MessageSquare, Compass, Settings, Sparkles, Plug } from "lucide-react";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

const navItems = [
  { href: "/app", icon: Home, label: "Dashboard" },
  { href: "/app/import", icon: Upload, label: "Import" },
  { href: "/app/learn", icon: Sparkles, label: "Learn About You" },
  { href: "/app/chat", icon: MessageSquare, label: "Chat" },
  { href: "/app/explore", icon: Compass, label: "Explore" },
  { href: "/app/connect", icon: Plug, label: "Connect AI" },
  { href: "/app/settings", icon: Settings, label: "Settings" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 border-r border-border/50 bg-card/30 flex flex-col shrink-0">
          <div className="h-14 flex items-center px-4 gap-2 font-semibold border-b border-border/50">
            <Brain className="w-5 h-5 text-primary" />
            <span>Mindstore</span>
          </div>
          <nav className="flex-1 p-2 space-y-0.5">
            {navItems.map((item) => {
              const active = pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="p-3 border-t border-border/50">
            <p className="text-[10px] text-muted-foreground text-center">All data stored locally</p>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </TooltipProvider>
  );
}
