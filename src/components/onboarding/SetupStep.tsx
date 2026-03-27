"use client";

import { useState, useCallback } from "react";
import {
  User, Sparkles, Key, Server, Loader2, Check,
  AlertCircle, ExternalLink, ArrowRight,
} from "lucide-react";
import type { StepProps, AiProvider } from "./types";

const PROVIDERS: {
  id: AiProvider;
  name: string;
  tagline: string;
  badge?: string;
  badgeColor?: string;
  placeholder: string;
  helpUrl: string;
  helpLabel: string;
  iconColor: string;
  accentBg: string;
  accentBorder: string;
  accentRing: string;
  icon: typeof Sparkles;
}[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    tagline: "Free tier, no credit card needed",
    badge: "Free",
    badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    placeholder: "AIza...",
    helpUrl: "https://aistudio.google.com/apikey",
    helpLabel: "Get a free key from Google AI Studio",
    iconColor: "text-blue-400",
    accentBg: "bg-blue-500/[0.08]",
    accentBorder: "border-blue-500/20",
    accentRing: "focus:ring-blue-500/30 focus:border-blue-500/30",
    icon: Sparkles,
  },
  {
    id: "openai",
    name: "OpenAI",
    tagline: "GPT-4o, best quality responses",
    placeholder: "sk-...",
    helpUrl: "https://platform.openai.com/api-keys",
    helpLabel: "Get key from OpenAI dashboard",
    iconColor: "text-emerald-400",
    accentBg: "bg-emerald-500/[0.08]",
    accentBorder: "border-emerald-500/20",
    accentRing: "focus:ring-emerald-500/30 focus:border-emerald-500/30",
    icon: Key,
  },
  {
    id: "ollama",
    name: "Ollama",
    tagline: "100% local, no API key needed",
    badge: "Local",
    badgeColor: "bg-orange-500/15 text-orange-400 border-orange-500/20",
    placeholder: "http://localhost:11434",
    helpUrl: "https://ollama.ai",
    helpLabel: "Install Ollama for local AI",
    iconColor: "text-orange-400",
    accentBg: "bg-orange-500/[0.08]",
    accentBorder: "border-orange-500/20",
    accentRing: "focus:ring-orange-500/30 focus:border-orange-500/30",
    icon: Server,
  },
];

export function SetupStep({ onNext, onSkip, state, setState }: StepProps) {
  const [name, setName] = useState(state.userName || "");
  const [provider, setProvider] = useState<AiProvider>(
    (state.aiProviderChoice as AiProvider) || "gemini"
  );
  const [keyInput, setKeyInput] = useState("");
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(state.hasAiProvider);
  const [error, setError] = useState("");

  const saveName = useCallback(async (val: string) => {
    if (val.trim()) {
      await fetch("/api/v1/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: val.trim() }),
      });
      setState(prev => ({ ...prev, userName: val.trim() }));
    }
  }, [setState]);

  const handleConnect = useCallback(async () => {
    const val = keyInput.trim();
    if (!val) return;

    setValidating(true);
    setError("");

    try {
      const body: Record<string, string> = {};
      if (provider === "gemini") body.geminiKey = val;
      else if (provider === "openai") body.apiKey = val;
      else if (provider === "ollama") body.ollamaUrl = val;

      const res = await fetch("/api/v1/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Connection failed");
        setValidating(false);
        return;
      }

      // Save provider choice
      await fetch("/api/v1/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiProviderChoice: provider }),
      });

      setValidated(true);
      setState(prev => ({ ...prev, hasAiProvider: true, aiProviderChoice: provider }));

      // Auto-advance after showing success
      setTimeout(() => onNext(), 700);
    } catch {
      setError("Connection failed — check your key and try again");
    }
    setValidating(false);
  }, [keyInput, provider, onNext, setState]);

  const handleSkipProvider = useCallback(async () => {
    // Save name first if entered
    if (name.trim()) await saveName(name);
    onNext();
  }, [name, saveName, onNext]);

  const handleContinue = useCallback(async () => {
    if (name.trim()) await saveName(name);
    if (validated) {
      onNext();
    }
  }, [name, saveName, validated, onNext]);

  const currentProvider = PROVIDERS.find(p => p.id === provider)!;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-[24px] md:text-[28px] font-bold tracking-[-0.03em] leading-[1.1]">
          Let&apos;s personalize
          <br />
          <span className="text-zinc-400">your experience</span>
        </h2>
      </div>

      {/* Name input */}
      <div className="space-y-2">
        <label className="text-[12px] font-semibold text-zinc-500 uppercase tracking-[0.06em]">
          Your name
        </label>
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => saveName(name)}
            placeholder="How should we address you?"
            className="w-full h-12 pl-10 pr-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-[14px] placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-teal-500/30 focus:border-teal-500/30 transition-all"
          />
        </div>
      </div>

      {/* AI Provider */}
      <div className="space-y-3">
        <label className="text-[12px] font-semibold text-zinc-500 uppercase tracking-[0.06em]">
          AI Provider
        </label>

        {/* Provider pills */}
        <div className="flex gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setProvider(p.id);
                setKeyInput("");
                setError("");
                setValidated(state.hasAiProvider);
              }}
              disabled={validated}
              className={`flex-1 relative h-11 rounded-xl text-[13px] font-medium transition-all border active:scale-[0.97] ${
                provider === p.id
                  ? `${p.accentBg} ${p.accentBorder} text-white`
                  : "bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:bg-white/[0.04]"
              } disabled:opacity-60`}
            >
              <span className="flex items-center justify-center gap-1.5">
                {p.name.split(" ").pop()}
                {p.badge && provider === p.id && (
                  <span className={`text-[9px] px-1.5 py-[1px] rounded-md border font-bold ${p.badgeColor}`}>
                    {p.badge}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Key/URL input */}
        {!validated && (
          <div className="space-y-2.5">
            <div className="relative">
              <input
                type={provider === "ollama" ? "url" : "password"}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                placeholder={currentProvider.placeholder}
                disabled={validating}
                className={`w-full h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 text-[14px] font-mono placeholder:text-zinc-600 focus:outline-none focus:ring-1 ${currentProvider.accentRing} transition-all disabled:opacity-50`}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-[12px] text-red-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex items-center justify-between">
              <a
                href={currentProvider.helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 text-[12px] ${currentProvider.iconColor} hover:opacity-80 transition-opacity`}
              >
                <ExternalLink className="w-3 h-3" />
                {currentProvider.helpLabel}
              </a>
              <button
                onClick={handleConnect}
                disabled={!keyInput.trim() || validating}
                className="h-9 px-5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:bg-white/[0.06] disabled:text-zinc-600 text-white text-[13px] font-medium flex items-center gap-2 transition-all active:scale-[0.97]"
              >
                {validating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>Connect</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Success state */}
        {validated && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20">
            <div
              className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0"
              style={{ animation: "onb-check-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards" }}
            >
              <Check className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-[13px] text-emerald-300 font-medium">
              AI provider connected
            </span>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="space-y-2 pt-2">
        {validated ? (
          <button
            onClick={handleContinue}
            className="w-full h-[52px] rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-[15px] flex items-center justify-center gap-2.5 transition-all active:scale-[0.97]"
          >
            Continue
            <ArrowRight className="w-4.5 h-4.5" />
          </button>
        ) : null}
        {!validated && (
          <button
            onClick={handleSkipProvider}
            className="w-full h-10 text-[13px] text-zinc-500 hover:text-zinc-400 font-medium transition-colors"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
