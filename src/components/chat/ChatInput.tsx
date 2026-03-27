"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowUp, Square, Loader2, Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: (text?: string) => void;
  onStop: () => void;
  loading: boolean;
  disabled?: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  loading,
  disabled,
}: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const charCount = value.length;
  const maxChars = 4000;

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height =
        Math.min(inputRef.current.scrollHeight, 160) + "px";
    }
  }, [value]);

  // Focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter to send, Shift+Enter for newline
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSend();
        return;
      }
      // Cmd+Enter (Mac) or Ctrl+Enter (Windows) to send
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onSend();
        return;
      }
    },
    [onSend]
  );

  return (
    <div className="relative">
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your knowledge…"
            rows={1}
            disabled={disabled}
            className={cn(
              "w-full resize-none rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 pr-12 text-[14px] leading-relaxed placeholder:text-zinc-600",
              "focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500/30 transition-all max-h-[160px]",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          />
          {/* Character count (only shows when approaching limit) */}
          {charCount > maxChars * 0.7 && (
            <span
              className={cn(
                "absolute bottom-2 right-14 text-[10px] tabular-nums transition-colors",
                charCount > maxChars ? "text-red-400" : "text-zinc-600"
              )}
            >
              {charCount.toLocaleString()}/{maxChars.toLocaleString()}
            </span>
          )}
        </div>
        {loading ? (
          <button
            onClick={onStop}
            className="w-10 h-10 rounded-xl bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-all shrink-0 active:scale-90 ring-1 ring-white/[0.1]"
            title="Stop generating"
          >
            <Square className="w-3.5 h-3.5 text-white fill-white" />
          </button>
        ) : (
          <button
            onClick={() => onSend()}
            disabled={!value.trim() || disabled}
            className="w-10 h-10 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-20 disabled:hover:bg-teal-600 flex items-center justify-center transition-all shrink-0 active:scale-90"
          >
            <ArrowUp className="w-4.5 h-4.5 text-white" />
          </button>
        )}
      </div>
      {/* Keyboard hints */}
      <div className="flex items-center justify-end mt-1.5 px-1">
        <span className="text-[10px] text-zinc-700 hidden sm:flex items-center gap-1.5">
          <kbd className="font-mono text-[9px] bg-white/[0.04] border border-white/[0.08] rounded px-1 py-[1px]">Enter</kbd>
          <span>send</span>
          <span className="text-zinc-800">·</span>
          <kbd className="font-mono text-[9px] bg-white/[0.04] border border-white/[0.08] rounded px-1 py-[1px]">Shift+Enter</kbd>
          <span>newline</span>
          <span className="text-zinc-800">·</span>
          <kbd className="font-mono text-[9px] bg-white/[0.04] border border-white/[0.08] rounded px-1 py-[1px]">⌘+Enter</kbd>
          <span>send</span>
        </span>
      </div>
    </div>
  );
}
