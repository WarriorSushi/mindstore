"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  X, Pin, Trash2, Copy, ExternalLink, Clock, FileText,
  Globe, MessageCircle, Type, BookOpen, Bookmark, Gem, Mic,
  Camera, StickyNote, Send, Music, Highlighter, PlayCircle,
  AtSign, BookmarkCheck, MessageSquare, ChevronRight,
  Layers, Edit3, Check, Loader2, Hash, Calendar,
  FileBox, ArrowUpRight, Sparkles, Link2, MessageSquarePlus,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Memory {
  id: string;
  content: string;
  source: string;
  sourceId?: string;
  sourceTitle: string;
  timestamp: string;
  importedAt?: string;
  metadata?: Record<string, any>;
  pinned?: boolean;
}

const TYPE_CONFIG: Record<string, { icon: typeof FileText; color: string; bg: string; label: string }> = {
  chatgpt:     { icon: MessageCircle, color: "text-green-400",   bg: "bg-green-500/10",   label: "ChatGPT" },
  text:        { icon: Type,          color: "text-teal-400",    bg: "bg-teal-500/10",    label: "Note" },
  file:        { icon: FileText,      color: "text-blue-400",    bg: "bg-blue-500/10",    label: "File" },
  url:         { icon: Globe,         color: "text-orange-400",  bg: "bg-orange-500/10",  label: "URL" },
  kindle:      { icon: BookOpen,      color: "text-amber-400",   bg: "bg-amber-500/10",   label: "Kindle" },
  document:    { icon: FileBox,       color: "text-blue-400",    bg: "bg-blue-500/10",    label: "Document" },
  youtube:     { icon: PlayCircle,    color: "text-red-400",     bg: "bg-red-500/10",     label: "YouTube" },
  bookmark:    { icon: Bookmark,      color: "text-sky-400",     bg: "bg-sky-500/10",     label: "Bookmark" },
  obsidian:    { icon: Gem,           color: "text-teal-400",    bg: "bg-teal-500/10",    label: "Obsidian" },
  reddit:      { icon: MessageSquare, color: "text-orange-400",  bg: "bg-orange-500/10",  label: "Reddit" },
  audio:       { icon: Mic,           color: "text-teal-400",    bg: "bg-teal-500/10",    label: "Audio" },
  image:       { icon: Camera,        color: "text-sky-400",     bg: "bg-sky-500/10",     label: "Image" },
  notion:      { icon: StickyNote,    color: "text-zinc-300",    bg: "bg-zinc-500/10",    label: "Notion" },
  twitter:     { icon: AtSign,        color: "text-sky-400",     bg: "bg-sky-500/10",     label: "Twitter/X" },
  telegram:    { icon: Send,          color: "text-teal-400",    bg: "bg-teal-500/10",    label: "Telegram" },
  pocket:      { icon: BookmarkCheck, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Pocket" },
  instapaper:  { icon: BookmarkCheck, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Instapaper" },
  spotify:     { icon: Music,         color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Spotify" },
  readwise:    { icon: Highlighter,   color: "text-amber-400",   bg: "bg-amber-500/10",   label: "Readwise" },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * MemoryDrawer — Global component that listens for "mindstore:open-memory" events
 * and displays a slide-in detail panel.
 * 
 * Dispatch from anywhere:
 *   window.dispatchEvent(new CustomEvent("mindstore:open-memory", { detail: memory }))
 */
interface RelatedMemory {
  id: string;
  content: string;
  source: string;
  sourceType: string;
  sourceId?: string;
  sourceTitle: string;
  timestamp: string;
  metadata?: Record<string, any>;
  similarity: number | null;
  method: string;
}

export function MemoryDrawer() {
  const router = useRouter();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [open, setOpen] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [relatedMemories, setRelatedMemories] = useState<RelatedMemory[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [showRelated, setShowRelated] = useState(true);

  // Listen for custom events
  useEffect(() => {
    function handleOpen(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setMemory(detail);
        setOpen(true);
        setConfirmDelete(false);
        setRelatedMemories([]);
      }
    }
    window.addEventListener("mindstore:open-memory", handleOpen);
    return () => window.removeEventListener("mindstore:open-memory", handleOpen);
  }, []);

  // Fetch related memories when a memory is opened
  useEffect(() => {
    if (!memory?.id || !open) return;
    let cancelled = false;
    setLoadingRelated(true);
    fetch(`/api/v1/memories/related?id=${memory.id}&limit=5`)
      .then(r => r.ok ? r.json() : { related: [] })
      .then(data => {
        if (!cancelled) setRelatedMemories(data.related || []);
      })
      .catch(() => { if (!cancelled) setRelatedMemories([]); })
      .finally(() => { if (!cancelled) setLoadingRelated(false); });
    return () => { cancelled = true; };
  }, [memory?.id, open]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Close with Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        handleClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setTimeout(() => {
      setMemory(null);
      setConfirmDelete(false);
    }, 300);
  }, []);

  const handlePin = useCallback(async () => {
    if (!memory) return;
    setPinning(true);
    try {
      const newPinned = !memory.pinned;
      const res = await fetch("/api/v1/memories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: memory.id, pinned: newPinned }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setMemory({ ...memory, pinned: newPinned });
      toast.success(newPinned ? "Pinned to dashboard" : "Unpinned");
    } catch {
      toast.error("Failed to update pin status");
    }
    setPinning(false);
  }, [memory]);

  const handleDelete = useCallback(async () => {
    if (!memory) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/v1/memories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: memory.id }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Memory deleted");
      handleClose();
    } catch {
      toast.error("Failed to delete memory");
    }
    setDeleting(false);
  }, [memory, confirmDelete, handleClose]);

  const handleCopy = useCallback(async () => {
    if (!memory) return;
    try {
      await navigator.clipboard.writeText(memory.content);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, [memory]);

  const handleChatAbout = useCallback(() => {
    if (!memory) return;
    const preview = memory.content.slice(0, 200).replace(/\n/g, ' ');
    const query = `Tell me more about: "${preview}"`;
    router.push(`/app/chat?q=${encodeURIComponent(query)}`);
    handleClose();
  }, [memory, router, handleClose]);

  const handleOpenRelated = useCallback((related: RelatedMemory) => {
    // Open the related memory in the same drawer
    setMemory({
      id: related.id,
      content: related.content,
      source: related.sourceType || related.source,
      sourceId: related.sourceId,
      sourceTitle: related.sourceTitle,
      timestamp: related.timestamp,
      metadata: related.metadata,
      pinned: false,
    });
    setConfirmDelete(false);
    setRelatedMemories([]);
    // Scroll to top of drawer
    const scrollEl = document.querySelector('[data-drawer-scroll]');
    if (scrollEl) scrollEl.scrollTop = 0;
  }, []);

  if (!memory) return null;

  const config = TYPE_CONFIG[memory.source] || {
    icon: FileText,
    color: "text-zinc-400",
    bg: "bg-zinc-500/10",
    label: memory.source || "Unknown",
  };
  const Icon = config.icon;
  const words = wordCount(memory.content);
  const chars = memory.content.length;
  const tags = memory.metadata?.tags || [];
  const meta = memory.metadata || {};

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={handleClose}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 bottom-0 z-[61] w-full md:w-[480px] lg:w-[520px]",
          "bg-[#0c0c0e] border-l border-white/[0.06]",
          "shadow-2xl shadow-black/40",
          "flex flex-col",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", config.bg)}>
              <Icon className={cn("w-4 h-4", config.color)} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-zinc-200 truncate">
                {memory.sourceTitle || "Untitled"}
              </p>
              <p className="text-[11px] text-zinc-600">{config.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Pin */}
            <button
              onClick={handlePin}
              disabled={pinning}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                memory.pinned
                  ? "bg-amber-500/15 text-amber-400"
                  : "text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06]",
              )}
              title={memory.pinned ? "Unpin" : "Pin"}
            >
              <Pin className={cn("w-4 h-4", memory.pinned && "fill-amber-400/30")} />
            </button>
            {/* Copy */}
            <button
              onClick={handleCopy}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] transition-all"
              title="Copy content"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            {/* Close */}
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] transition-all"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content area — scrollable */}
        <div data-drawer-scroll className="flex-1 overflow-y-auto px-5 py-5 space-y-5 overscroll-contain">
          {/* Metadata pills */}
          <div className="flex flex-wrap gap-2">
            <span className={cn(
              "inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg font-semibold uppercase tracking-wider",
              config.bg, config.color, "border", `border-${config.color.replace("text-", "").replace("-400", "-500/15")}`,
            )}>
              <Icon className="w-3 h-3" />
              {config.label}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg font-medium text-zinc-500 bg-white/[0.03] border border-white/[0.06]">
              <Hash className="w-3 h-3" />
              {words.toLocaleString()} words
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg font-medium text-zinc-500 bg-white/[0.03] border border-white/[0.06]">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(memory.timestamp)}
            </span>
            {memory.pinned && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/15">
                <Pin className="w-3 h-3 fill-amber-400/30" />
                Pinned
              </span>
            )}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag: string, i: number) => (
                  <span
                    key={i}
                    className="text-[11px] px-2 py-0.5 rounded-lg bg-teal-500/8 text-teal-400 border border-teal-500/12 font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Main content */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Content</p>
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 max-h-[50vh] overflow-y-auto">
              <div className="text-[13px] text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">
                {memory.content}
              </div>
            </div>
          </div>

          {/* Source info */}
          {memory.sourceId && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Source</p>
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3.5">
                {memory.sourceId.startsWith("http") ? (
                  <a
                    href={memory.sourceId}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[12px] text-teal-400 hover:text-teal-300 transition-colors group"
                  >
                    <Globe className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate underline decoration-teal-500/30 group-hover:decoration-teal-400">{memory.sourceId}</span>
                    <ArrowUpRight className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                ) : (
                  <p className="text-[12px] text-zinc-400 truncate">{memory.sourceId}</p>
                )}
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Timeline</p>
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                  <Calendar className="w-3 h-3" />
                  Created
                </div>
                <span className="text-[11px] text-zinc-400">{formatDate(memory.timestamp)}</span>
              </div>
              {memory.importedAt && memory.importedAt !== memory.timestamp && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                    <Clock className="w-3 h-3" />
                    Imported
                  </div>
                  <span className="text-[11px] text-zinc-400">{formatDate(memory.importedAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Extra metadata */}
          {Object.keys(meta).filter(k => !["pinned", "tags", "quickCapture", "capturedAt"].includes(k)).length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Metadata</p>
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3.5 space-y-1.5">
                {Object.entries(meta)
                  .filter(([k]) => !["pinned", "tags", "quickCapture", "capturedAt"].includes(k))
                  .slice(0, 10)
                  .map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between gap-4">
                      <span className="text-[11px] text-zinc-500 shrink-0">{key}</span>
                      <span className="text-[11px] text-zinc-400 truncate text-right">
                        {typeof value === "object" ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Related Memories — Knowledge Connections */}
          <div className="space-y-2.5">
            <button
              onClick={() => setShowRelated(prev => !prev)}
              className="flex items-center gap-2 group w-full"
            >
              <Link2 className="w-3.5 h-3.5 text-teal-400" />
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest group-hover:text-zinc-400 transition-colors">
                Related Memories
              </p>
              {relatedMemories.length > 0 && (
                <span className="text-[9px] font-bold text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded-md">
                  {relatedMemories.length}
                </span>
              )}
              <ChevronRight className={cn(
                "w-3 h-3 text-zinc-600 ml-auto transition-transform",
                showRelated && "rotate-90",
              )} />
            </button>

            {showRelated && (
              <div className="space-y-1.5">
                {loadingRelated ? (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    <Loader2 className="w-3.5 h-3.5 text-teal-400/60 animate-spin" />
                    <span className="text-[11px] text-zinc-600">Finding connections…</span>
                  </div>
                ) : relatedMemories.length === 0 ? (
                  <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3.5 text-center">
                    <p className="text-[11px] text-zinc-600">No related memories found</p>
                  </div>
                ) : (
                  relatedMemories.map((related) => {
                    const relConfig = TYPE_CONFIG[related.sourceType || related.source] || {
                      icon: FileText, color: "text-zinc-400", bg: "bg-zinc-500/10", label: related.sourceType || "Unknown",
                    };
                    const RelIcon = relConfig.icon;
                    const preview = related.content.slice(0, 120).replace(/\n/g, ' ').trim();
                    return (
                      <button
                        key={related.id}
                        onClick={() => handleOpenRelated(related)}
                        className="w-full rounded-xl bg-white/[0.02] border border-white/[0.06] p-3 hover:bg-white/[0.04] hover:border-teal-500/15 transition-all group text-left"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5", relConfig.bg)}>
                            <RelIcon className={cn("w-3 h-3", relConfig.color)} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-[11px] font-semibold text-zinc-300 truncate group-hover:text-teal-300 transition-colors">
                                {related.sourceTitle || "Untitled"}
                              </p>
                              {related.similarity !== null && (
                                <span className="text-[9px] font-bold text-teal-500/70 bg-teal-500/8 px-1.5 py-0.5 rounded shrink-0">
                                  {related.similarity}%
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
                              {preview}{related.content.length > 120 ? '…' : ''}
                            </p>
                          </div>
                          <ChevronRight className="w-3 h-3 text-zinc-700 group-hover:text-teal-400 shrink-0 mt-1 transition-colors" />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Quick Actions</p>
            <div className="flex gap-2">
              <button
                onClick={handleChatAbout}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-teal-500/8 border border-teal-500/15 text-teal-400 hover:bg-teal-500/15 hover:border-teal-500/25 transition-all text-[12px] font-medium"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                Chat about this
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all text-[12px] font-medium"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Memory ID */}
          <div className="pt-2">
            <p className="text-[10px] text-zinc-700 font-mono tracking-wide break-all">
              ID: {memory.id}
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/[0.06] shrink-0 bg-[#0c0c0e]">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all",
              confirmDelete
                ? "bg-red-500/15 text-red-400 border border-red-500/20"
                : "text-zinc-600 hover:text-red-400 hover:bg-red-500/10",
            )}
          >
            {deleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            {confirmDelete ? "Confirm Delete?" : "Delete"}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePin}
              disabled={pinning}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all",
                memory.pinned
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                  : "bg-white/[0.04] text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 border border-white/[0.06]",
              )}
            >
              <Pin className={cn("w-3.5 h-3.5", memory.pinned && "fill-amber-400/30")} />
              {memory.pinned ? "Pinned" : "Pin"}
            </button>
            <button
              onClick={handleChatAbout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 border border-teal-500/15 transition-all"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              Chat
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Helper to open a memory in the drawer from anywhere.
 * Usage: openMemoryDrawer({ id, content, source, sourceTitle, timestamp, ... })
 */
export function openMemoryDrawer(memory: Memory) {
  window.dispatchEvent(new CustomEvent("mindstore:open-memory", { detail: memory }));
}
