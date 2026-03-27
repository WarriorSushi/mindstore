"use client";

import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const MODEL_OPTIONS: Record<
  string,
  { label: string; models: { id: string; name: string; tag?: string }[] }
> = {
  gemini: {
    label: "Gemini",
    models: [
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", tag: "default" },
      { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", tag: "fast" },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", tag: "smart" },
    ],
  },
  openai: {
    label: "OpenAI",
    models: [
      { id: "gpt-4o-mini", name: "GPT-4o Mini", tag: "default" },
      { id: "gpt-4o", name: "GPT-4o", tag: "smart" },
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", tag: "new" },
      { id: "gpt-4.1", name: "GPT-4.1", tag: "new" },
      { id: "o4-mini", name: "o4-mini", tag: "reasoning" },
    ],
  },
  openrouter: {
    label: "OpenRouter",
    models: [
      { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", tag: "default" },
      { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", tag: "smart" },
      { id: "anthropic/claude-opus-4", name: "Claude Opus 4", tag: "best" },
      { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", tag: "free" },
      { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash" },
      { id: "mistralai/mistral-large-latest", name: "Mistral Large" },
      { id: "deepseek/deepseek-chat-v3", name: "DeepSeek V3", tag: "cheap" },
      { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B" },
    ],
  },
  ollama: {
    label: "Ollama",
    models: [
      { id: "llama3.2", name: "Llama 3.2", tag: "default" },
      { id: "llama3.1", name: "Llama 3.1" },
      { id: "mistral", name: "Mistral" },
      { id: "gemma2", name: "Gemma 2" },
      { id: "phi3", name: "Phi-3" },
      { id: "qwen2.5", name: "Qwen 2.5" },
    ],
  },
  custom: {
    label: "Custom",
    models: [],
  },
};

const TAG_STYLES: Record<string, string> = {
  default: "text-zinc-500 bg-zinc-500/10",
  fast: "text-sky-400 bg-sky-500/10",
  smart: "text-teal-400 bg-teal-500/10",
  new: "text-sky-300 bg-sky-400/10",
  reasoning: "text-teal-300 bg-teal-400/10",
  best: "text-teal-300 bg-teal-400/10",
  free: "text-zinc-400 bg-zinc-500/10",
  cheap: "text-zinc-400 bg-zinc-500/10",
};

export function ModelSwitcher({
  provider,
  selectedModel,
  onModelChange,
}: {
  provider: string;
  selectedModel: string;
  onModelChange: (model: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const providerKey = provider === "auto" ? null : provider;
  const sections = providerKey
    ? { [providerKey]: MODEL_OPTIONS[providerKey] }
    : MODEL_OPTIONS;

  const currentName = (() => {
    for (const section of Object.values(MODEL_OPTIONS)) {
      const found = section.models.find((m) => m.id === selectedModel);
      if (found) return found.name;
    }
    return selectedModel || "Default";
  })();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12px] transition-all",
          open
            ? "text-teal-300 bg-teal-500/10"
            : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
        )}
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span className="max-w-[120px] truncate">{currentName}</span>
        <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-64 rounded-xl bg-[#111113]/95 backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/60 overflow-hidden z-50 max-h-80 overflow-y-auto">
          {Object.entries(sections)
            .filter(([, s]) => s && s.models.length > 0)
            .map(([key, section]) => (
              <div key={key}>
                <div className="px-3 pt-2.5 pb-1 sticky top-0 bg-[#111113]/95 backdrop-blur-xl">
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.08em]">
                    {section!.label}
                  </span>
                </div>
                {section!.models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      onModelChange(model.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors",
                      selectedModel === model.id
                        ? "text-teal-300 bg-teal-500/10"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                    )}
                  >
                    <span className="flex-1 truncate">{model.name}</span>
                    {model.tag && (
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0",
                          TAG_STYLES[model.tag] || "text-zinc-500 bg-zinc-500/10"
                        )}
                      >
                        {model.tag}
                      </span>
                    )}
                    {selectedModel === model.id && (
                      <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            ))}
          {selectedModel && (
            <button
              onClick={() => {
                onModelChange("");
                setOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-[12px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border-t border-white/[0.06]"
            >
              Reset to default
            </button>
          )}
        </div>
      )}
    </div>
  );
}
