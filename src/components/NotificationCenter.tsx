"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, Check, CheckCheck, X, Trash2, ExternalLink, Loader2,
  BookOpen, FileText, Play, Bookmark, Gem, MessageCircle,
  Network, TrendingUp, Heart, Target, PenTool, Layers,
  FileEdit, Users, Route, FileUser, Mail, Mic, Camera,
  SlidersHorizontal, Globe, Dna, Download, FolderDown, FileStack,
  Upload, BarChart3, Zap, Cpu, AlertTriangle, Sparkles,
  Copy, FolderOpen, Search, Puzzle, RefreshCw, Trophy,
  type LucideIcon,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  icon: string | null;
  color: string;
  href: string | null;
  pluginSlug: string | null;
  metadata: Record<string, any>;
  read: boolean;
  createdAt: string;
}

// ─── Icon Map ─────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  BookOpen, FileText, Play, Bookmark, Gem, MessageCircle,
  Network, TrendingUp, Heart, Target, PenTool, Layers,
  FileEdit, Users, Route, FileUser, Mail, Mic, Camera,
  SlidersHorizontal, Globe, Dna, Download, FolderDown, FileStack,
  Upload, BarChart3, Zap, Cpu, AlertTriangle, Sparkles,
  Copy, FolderOpen, Search, Puzzle, RefreshCw, Trophy, Bell,
};

const TYPE_DEFAULTS: Record<string, { icon: LucideIcon; color: string }> = {
  import_complete:  { icon: Upload,        color: "teal" },
  analysis_ready:   { icon: BarChart3,     color: "sky" },
  review_due:       { icon: Layers,        color: "amber" },
  plugin_event:     { icon: Puzzle,        color: "teal" },
  system:           { icon: Sparkles,      color: "zinc" },
  export_ready:     { icon: Download,      color: "emerald" },
  connection_found: { icon: Network,       color: "sky" },
  milestone:        { icon: Trophy,        color: "amber" },
};

const COLOR_STYLES: Record<string, { bg: string; border: string; text: string; dot: string; ring: string }> = {
  teal:    { bg: "bg-teal-500/[0.08]",    border: "border-teal-500/20",    text: "text-teal-400",    dot: "bg-teal-400",    ring: "ring-teal-500/30" },
  sky:     { bg: "bg-sky-500/[0.08]",     border: "border-sky-500/20",     text: "text-sky-400",     dot: "bg-sky-400",     ring: "ring-sky-500/30" },
  emerald: { bg: "bg-emerald-500/[0.08]", border: "border-emerald-500/20", text: "text-emerald-400", dot: "bg-emerald-400", ring: "ring-emerald-500/30" },
  amber:   { bg: "bg-amber-500/[0.08]",   border: "border-amber-500/20",   text: "text-amber-400",   dot: "bg-amber-400",   ring: "ring-amber-500/30" },
  red:     { bg: "bg-red-500/[0.08]",     border: "border-red-500/20",     text: "text-red-400",     dot: "bg-red-400",     ring: "ring-red-500/30" },
  blue:    { bg: "bg-blue-500/[0.08]",    border: "border-blue-500/20",    text: "text-blue-400",    dot: "bg-blue-400",    ring: "ring-blue-500/30" },
  zinc:    { bg: "bg-zinc-500/[0.06]",    border: "border-zinc-500/15",    text: "text-zinc-400",    dot: "bg-zinc-400",    ring: "ring-zinc-500/20" },
};

// ─── Time formatting ──────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Component ────────────────────────────────────────────────────

export function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/notifications?limit=30");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
      setTotal(data.total || 0);
    } catch {
      // silent — notification center is non-critical
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // Mark one as read
  const markRead = async (id: string) => {
    await fetch("/api/v1/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark-read", id }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  // Mark all as read
  const markAllRead = async () => {
    await fetch("/api/v1/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark-all-read" }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  // Delete one
  const deleteOne = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch("/api/v1/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    setNotifications((prev) => {
      const removed = prev.find((n) => n.id === id);
      if (removed && !removed.read) setUnreadCount((c) => Math.max(0, c - 1));
      return prev.filter((n) => n.id !== id);
    });
  };

  // Clear all read
  const clearRead = async () => {
    await fetch("/api/v1/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear-read" }),
    });
    setNotifications((prev) => prev.filter((n) => !n.read));
  };

  // Click on notification
  const handleClick = (n: Notification) => {
    if (!n.read) markRead(n.id);
    if (n.href) {
      router.push(n.href);
      setOpen(false);
    }
  };

  // Get icon component for notification
  const getIcon = (n: Notification): LucideIcon => {
    if (n.icon && ICON_MAP[n.icon]) return ICON_MAP[n.icon];
    return TYPE_DEFAULTS[n.type]?.icon || Bell;
  };

  const getColor = (n: Notification): string => {
    return n.color || TYPE_DEFAULTS[n.type]?.color || "teal";
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="relative w-8 h-8 rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all active:scale-95"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={open}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-teal-500 text-[10px] font-bold text-white flex items-center justify-center animate-in fade-in zoom-in duration-200">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-[380px] max-h-[520px] bg-[#0e0e10] border border-white/[0.06] rounded-2xl shadow-2xl shadow-black/50 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
          role="dialog"
          aria-label="Notifications"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-200">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-teal-500/15 text-teal-400 text-[10px] font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="h-7 px-2 rounded-lg text-[11px] font-medium text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all flex items-center gap-1"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3 h-3" />
                  Read all
                </button>
              )}
              {notifications.some((n) => n.read) && (
                <button
                  onClick={clearRead}
                  className="h-7 px-2 rounded-lg text-[11px] font-medium text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all flex items-center gap-1"
                  title="Clear read notifications"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto max-h-[420px] notification-scroll">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6">
                <div className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-3">
                  <Bell className="w-5 h-5 text-zinc-600" />
                </div>
                <p className="text-sm text-zinc-500 text-center">No notifications yet</p>
                <p className="text-xs text-zinc-600 text-center mt-1">
                  Activity from plugins and imports will show up here
                </p>
              </div>
            ) : (
              <div className="py-1">
                {notifications.map((n) => {
                  const Icon = getIcon(n);
                  const color = getColor(n);
                  const styles = COLOR_STYLES[color] || COLOR_STYLES.teal;

                  return (
                    <div
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={`group relative flex gap-3 px-4 py-3 transition-all cursor-pointer ${
                        n.read
                          ? "hover:bg-white/[0.02] opacity-60"
                          : "hover:bg-white/[0.04] bg-white/[0.015]"
                      }`}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && handleClick(n)}
                    >
                      {/* Unread dot */}
                      {!n.read && (
                        <div className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${styles.dot}`} />
                      )}

                      {/* Icon */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-xl ${styles.bg} border ${styles.border} flex items-center justify-center`}>
                        <Icon className={`w-3.5 h-3.5 ${styles.text}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] leading-snug ${n.read ? "text-zinc-400" : "text-zinc-200"}`}>
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2 leading-relaxed">
                            {n.body}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-zinc-600">{timeAgo(n.createdAt)}</span>
                          {n.pluginSlug && (
                            <span className="text-[10px] text-zinc-600 flex items-center gap-0.5">
                              <Puzzle className="w-2.5 h-2.5" />
                              {n.pluginSlug.replace(/-/g, " ")}
                            </span>
                          )}
                          {n.href && (
                            <ExternalLink className="w-2.5 h-2.5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex-shrink-0 flex items-start gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
                        {!n.read && (
                          <button
                            onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-zinc-500 hover:text-teal-400 hover:bg-white/[0.06] transition-all"
                            title="Mark as read"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={(e) => deleteOne(n.id, e)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-white/[0.06] transition-all"
                          title="Delete"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {total > 30 && (
            <div className="px-4 py-2.5 border-t border-white/[0.04] text-center">
              <span className="text-[11px] text-zinc-500">
                Showing 30 of {total} notifications
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
