"use client";

import { useState, useCallback } from "react";
import {
  Copy, Check, RotateCcw, BookmarkPlus, Loader2, ThumbsUp, ThumbsDown, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** Feedback storage in localStorage */
function saveFeedback(msgContent: string, feedback: "up" | "down") {
  try {
    const key = "mindstore-chat-feedback";
    const raw = localStorage.getItem(key);
    const data: Array<{ content: string; feedback: string; timestamp: string }> = raw ? JSON.parse(raw) : [];
    data.push({
      content: msgContent.slice(0, 500),
      feedback,
      timestamp: new Date().toISOString(),
    });
    // Keep last 200
    if (data.length > 200) data.splice(0, data.length - 200);
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

function getFeedback(msgContent: string): "up" | "down" | null {
  try {
    const key = "mindstore-chat-feedback";
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data: Array<{ content: string; feedback: string }> = JSON.parse(raw);
    const snippet = msgContent.slice(0, 500);
    const found = data.find((d) => d.content === snippet);
    return (found?.feedback as "up" | "down") || null;
  } catch {
    return null;
  }
}

/** Action buttons for assistant messages */
export function AssistantMessageActions({
  content,
  question,
  onRegenerate,
  onDelete,
}: {
  content: string;
  question: string;
  onRegenerate?: () => void;
  onDelete?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(() => getFeedback(content));

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [content]);

  const handleSaveToMemory = useCallback(async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      const title = question
        ? question.length > 80
          ? question.slice(0, 77) + "…"
          : question
        : "Chat Insight";
      const res = await fetch("/api/v1/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents: [{ title, content, sourceType: "text" }],
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setSaved(true);
      toast.success("Saved to memory", {
        description: `${data.imported || 1} chunk${(data.imported || 1) > 1 ? "s" : ""} — find it in Explore`,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [content, question, saving, saved]);

  const handleFeedback = useCallback(
    (type: "up" | "down") => {
      const newFeedback = feedback === type ? null : type;
      setFeedback(newFeedback);
      if (newFeedback) {
        saveFeedback(content, newFeedback);
        toast.success(newFeedback === "up" ? "Thanks for the feedback!" : "Noted — we'll improve");
      }
    },
    [feedback, content]
  );

  return (
    <div className="absolute -bottom-1 left-0 flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 touch-visible transition-all">
      {/* Copy */}
      <button
        onClick={handleCopy}
        className="w-7 h-7 rounded-lg bg-[#111113] border border-white/[0.08] flex items-center justify-center hover:bg-white/[0.08] active:scale-90 shadow-lg shadow-black/30 transition-all"
        title="Copy"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-teal-400" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-zinc-500" />
        )}
      </button>

      {/* Save to Memory */}
      <button
        onClick={handleSaveToMemory}
        disabled={saving || saved}
        className={cn(
          "h-7 rounded-lg border flex items-center justify-center gap-1 px-2",
          "shadow-lg shadow-black/30 active:scale-90 transition-all",
          saved
            ? "bg-teal-500/10 border-teal-500/20 text-teal-400 cursor-default"
            : saving
              ? "bg-[#111113] border-white/[0.08] text-zinc-500 cursor-wait"
              : "bg-[#111113] border-white/[0.08] text-zinc-500 hover:bg-teal-500/10 hover:border-teal-500/20 hover:text-teal-400"
        )}
        title={saved ? "Saved" : "Save to memory"}
      >
        {saving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : saved ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <BookmarkPlus className="w-3.5 h-3.5" />
        )}
        <span className="text-[10px] font-medium leading-none hidden sm:inline">
          {saved ? "Saved" : saving ? "…" : "Save"}
        </span>
      </button>

      {/* Thumbs up */}
      <button
        onClick={() => handleFeedback("up")}
        className={cn(
          "w-7 h-7 rounded-lg border flex items-center justify-center active:scale-90 shadow-lg shadow-black/30 transition-all",
          feedback === "up"
            ? "bg-teal-500/15 border-teal-500/20 text-teal-400"
            : "bg-[#111113] border-white/[0.08] text-zinc-500 hover:bg-white/[0.08]"
        )}
        title="Good response"
      >
        <ThumbsUp className="w-3 h-3" />
      </button>

      {/* Thumbs down */}
      <button
        onClick={() => handleFeedback("down")}
        className={cn(
          "w-7 h-7 rounded-lg border flex items-center justify-center active:scale-90 shadow-lg shadow-black/30 transition-all",
          feedback === "down"
            ? "bg-red-500/15 border-red-500/20 text-red-400"
            : "bg-[#111113] border-white/[0.08] text-zinc-500 hover:bg-white/[0.08]"
        )}
        title="Poor response"
      >
        <ThumbsDown className="w-3 h-3" />
      </button>

      {/* Regenerate */}
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          className="w-7 h-7 rounded-lg bg-[#111113] border border-white/[0.08] flex items-center justify-center hover:bg-white/[0.08] active:scale-90 shadow-lg shadow-black/30 transition-all"
          title="Regenerate"
        >
          <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
        </button>
      )}

      {/* Delete */}
      {onDelete && (
        <button
          onClick={onDelete}
          className="w-7 h-7 rounded-lg bg-[#111113] border border-white/[0.08] flex items-center justify-center hover:bg-red-500/10 active:scale-90 shadow-lg shadow-black/30 transition-all"
          title="Delete message"
        >
          <Trash2 className="w-3 h-3 text-zinc-500 hover:text-red-400" />
        </button>
      )}
    </div>
  );
}

/** Simple copy button for user messages */
export function UserMessageActions({
  content,
  onDelete,
}: {
  content: string;
  onDelete?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="absolute -bottom-1 right-0 flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 touch-visible transition-all">
      <button
        onClick={() => {
          navigator.clipboard.writeText(content).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="w-7 h-7 rounded-lg bg-[#111113] border border-white/[0.08] flex items-center justify-center hover:bg-white/[0.08] active:scale-90 shadow-lg shadow-black/30 transition-all"
        title="Copy"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-teal-400" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-zinc-500" />
        )}
      </button>
      {onDelete && (
        <button
          onClick={onDelete}
          className="w-7 h-7 rounded-lg bg-[#111113] border border-white/[0.08] flex items-center justify-center hover:bg-red-500/10 active:scale-90 shadow-lg shadow-black/30 transition-all"
          title="Delete"
        >
          <Trash2 className="w-3 h-3 text-zinc-500 hover:text-red-400" />
        </button>
      )}
    </div>
  );
}
