"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X, Send, Loader2, Globe, Type, FileText,
  Zap, Check, Link2, StickyNote, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type CaptureMode = "note" | "url";

export function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CaptureMode>("note");
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Listen for Cmd+Shift+N / Ctrl+Shift+N
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setOpen((prev) => {
          if (prev) return false;
          return true;
        });
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        handleClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Listen for custom event from command palette
  useEffect(() => {
    function handleEvent() {
      setOpen(true);
    }
    window.addEventListener("mindstore:quick-capture", handleEvent);
    return () => window.removeEventListener("mindstore:quick-capture", handleEvent);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setSaved(false);
      setTimeout(() => {
        if (mode === "url") urlInputRef.current?.focus();
        else textareaRef.current?.focus();
      }, 100);
    }
  }, [open, mode]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, [content]);

  const handleClose = useCallback(() => {
    setOpen(false);
    // Don't clear content immediately for undo possibility
    setTimeout(() => {
      setContent("");
      setTitle("");
      setMode("note");
      setSaved(false);
    }, 300);
  }, []);

  const handleSave = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      if (mode === "url") {
        // URL import
        const res = await fetch("/api/v1/import-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmed }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to import URL");
        setSaved(true);
        toast.success(`Imported: ${data.title || trimmed}`, {
          description: `${data.chunks || 1} chunk${(data.chunks || 1) > 1 ? "s" : ""} saved`,
        });
      } else {
        // Quick note
        const res = await fetch("/api/v1/memories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: trimmed,
            sourceType: "text",
            sourceTitle: title.trim() || "Quick Note",
            metadata: { quickCapture: true, capturedAt: new Date().toISOString() },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to save");
        setSaved(true);
        toast.success("Note saved to memory");
      }

      // Auto-close after short delay
      setTimeout(handleClose, 800);
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    }
    setSaving(false);
  }, [content, title, mode, handleClose]);

  // Handle Cmd+Enter to submit
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave],
  );

  // Detect URL paste
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text");
    if (mode === "note" && !content && /^https?:\/\/\S+$/.test(text.trim())) {
      e.preventDefault();
      setMode("url");
      setContent(text.trim());
    }
  }, [mode, content]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-0 bottom-0 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-[71] md:max-w-lg md:w-full mx-auto">
        <div
          className={cn(
            "bg-[#111113] border border-white/[0.08] shadow-2xl shadow-black/60",
            "rounded-t-2xl md:rounded-2xl",
            "animate-in slide-in-from-bottom md:slide-in-from-bottom-4 md:fade-in duration-200",
            "overflow-hidden",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-teal-500/15 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-teal-400" />
              </div>
              <span className="text-[13px] font-semibold text-zinc-200">Quick Capture</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Mode toggle */}
              <div className="flex items-center rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
                <button
                  onClick={() => { setMode("note"); setContent(""); }}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
                    mode === "note"
                      ? "bg-teal-500/15 text-teal-300"
                      : "text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  <StickyNote className="w-3 h-3" />
                  Note
                </button>
                <button
                  onClick={() => { setMode("url"); setContent(""); }}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
                    mode === "url"
                      ? "bg-orange-500/15 text-orange-300"
                      : "text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  <Globe className="w-3 h-3" />
                  URL
                </button>
              </div>
              <button
                onClick={handleClose}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3">
            {mode === "note" ? (
              <>
                {/* Title (optional) */}
                <input
                  type="text"
                  placeholder="Title (optional)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-transparent text-[14px] font-medium text-zinc-200 placeholder:text-zinc-600 outline-none border-none"
                />
                {/* Content */}
                <textarea
                  ref={textareaRef}
                  placeholder="Capture a thought, note, or idea..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  rows={3}
                  className={cn(
                    "w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-3.5 py-3",
                    "text-[13px] text-zinc-300 placeholder:text-zinc-600",
                    "outline-none resize-none",
                    "focus:border-teal-500/30 focus:bg-white/[0.03] transition-all",
                    "min-h-[80px] max-h-[200px]",
                  )}
                />
              </>
            ) : (
              <>
                {/* URL input */}
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input
                    ref={urlInputRef}
                    type="url"
                    placeholder="https://..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className={cn(
                      "w-full bg-white/[0.02] border border-white/[0.06] rounded-xl pl-10 pr-4 py-3",
                      "text-[13px] text-zinc-300 placeholder:text-zinc-600",
                      "outline-none",
                      "focus:border-orange-500/30 focus:bg-white/[0.03] transition-all",
                    )}
                  />
                </div>
                <p className="text-[11px] text-zinc-600 px-1">
                  Paste a URL to extract and save the page content as a memory.
                </p>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06] bg-white/[0.01]">
            <div className="flex items-center gap-1">
              <kbd className="text-[10px] font-mono bg-white/[0.04] border border-white/[0.08] rounded px-1.5 py-[2px] text-zinc-500">
                {navigator.platform?.includes("Mac") ? "⌘" : "Ctrl"}
              </kbd>
              <kbd className="text-[10px] font-mono bg-white/[0.04] border border-white/[0.08] rounded px-1.5 py-[2px] text-zinc-500">
                ↵
              </kbd>
              <span className="text-[10px] text-zinc-600 ml-1">to save</span>
            </div>

            <button
              onClick={handleSave}
              disabled={!content.trim() || saving || saved}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-all",
                "active:scale-[0.97]",
                saved
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                  : saving
                    ? "bg-white/[0.04] text-zinc-500 cursor-wait"
                    : content.trim()
                      ? "bg-teal-500 text-white hover:bg-teal-400 shadow-lg shadow-teal-500/20"
                      : "bg-white/[0.04] text-zinc-600 cursor-not-allowed",
              )}
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved
                </>
              ) : saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Save
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
