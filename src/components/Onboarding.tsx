"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowRight, ArrowLeft, Zap, Brain, Key, Upload, Check,
  Sparkles, Globe, Loader2, AlertCircle, FileText, Play,
  ExternalLink,
} from "lucide-react";
import { loadDemoData } from "@/lib/demo";

const ONBOARDING_KEY = "mindstore_onboarding_done";

type Step = "welcome" | "connect" | "import" | "done";
type Provider = "gemini" | "openai" | "ollama";

const STEPS: Step[] = ["welcome", "connect", "import", "done"];

/* ─── Provider configs ─── */
const PROVIDERS: {
  id: Provider;
  name: string;
  tagline: string;
  badge?: string;
  placeholder: string;
  fieldLabel: string;
  helpUrl: string;
  helpText: string;
}[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    tagline: "Free tier available — best for getting started",
    badge: "Free",
    placeholder: "AIza...",
    fieldLabel: "Gemini API Key",
    helpUrl: "https://aistudio.google.com/apikey",
    helpText: "Get a free key from Google AI Studio",
  },
  {
    id: "openai",
    name: "OpenAI",
    tagline: "GPT-4o, best quality responses",
    placeholder: "sk-...",
    fieldLabel: "OpenAI API Key",
    helpUrl: "https://platform.openai.com/api-keys",
    helpText: "Get a key from OpenAI dashboard",
  },
  {
    id: "ollama",
    name: "Ollama",
    tagline: "100% local, no API key needed",
    badge: "Local",
    placeholder: "http://localhost:11434",
    fieldLabel: "Ollama URL",
    helpUrl: "https://ollama.ai",
    helpText: "Install Ollama and run locally",
  },
];

/* ─── Validation helper ─── */
async function validateProvider(
  provider: Provider,
  value: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const body: Record<string, string> = {};
    if (provider === "gemini") body.geminiKey = value;
    else if (provider === "openai") body.apiKey = value;
    else if (provider === "ollama") body.ollamaUrl = value;

    const res = await fetch("/api/v1/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || "Invalid key" };
    return { ok: true };
  } catch {
    return { ok: false, error: "Connection failed" };
  }
}

export function Onboarding() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [fadeIn, setFadeIn] = useState(false);
  const [slideDir, setSlideDir] = useState(1);
  const [transitioning, setTransitioning] = useState(false);

  // Connect step
  const [provider, setProvider] = useState<Provider>("gemini");
  const [keyInput, setKeyInput] = useState("");
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [skippedConnect, setSkippedConnect] = useState(false);

  // Import step
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [demoLoading, setDemoLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const done = localStorage.getItem(ONBOARDING_KEY);
      if (!done) {
        setShow(true);
        requestAnimationFrame(() => setFadeIn(true));
      }
    }
  }, []);

  const finish = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setFadeIn(false);
    setTimeout(() => setShow(false), 300);
  }, []);

  const goTo = useCallback(
    (next: Step) => {
      const curIdx = STEPS.indexOf(step);
      const nextIdx = STEPS.indexOf(next);
      setSlideDir(nextIdx > curIdx ? 1 : -1);
      setTransitioning(true);
      setTimeout(() => {
        setStep(next);
        setTransitioning(false);
      }, 200);
    },
    [step]
  );

  const handleValidate = async () => {
    const val = keyInput.trim();
    if (!val) return;
    setValidating(true);
    setValidationError("");
    const result = await validateProvider(provider, val);
    setValidating(false);
    if (result.ok) {
      setValidated(true);
      // Auto-advance after brief success display
      setTimeout(() => goTo("import"), 800);
    } else {
      setValidationError(result.error || "Validation failed");
    }
  };

  const handleFileImport = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Support ChatGPT export format
      const conversations = Array.isArray(data) ? data : [data];
      const documents: { title: string; content: string; sourceType: string; sourceId: string }[] = [];

      for (const conv of conversations) {
        if (conv.mapping) {
          // ChatGPT format
          const title = conv.title || "Untitled";
          const messages = Object.values(conv.mapping) as any[];
          for (const node of messages) {
            const msg = node?.message;
            if (msg?.content?.parts?.length && msg.author?.role === "assistant") {
              documents.push({
                title,
                content: msg.content.parts.join("\n"),
                sourceType: "chatgpt",
                sourceId: conv.id || "__import__",
              });
            }
          }
        }
      }

      if (documents.length > 0) {
        const res = await fetch("/api/v1/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documents }),
        });
        if (res.ok) {
          setImportCount(documents.length);
          setImportDone(true);
          setTimeout(() => goTo("done"), 800);
        }
      } else {
        setImportCount(0);
        setImportDone(true);
        setTimeout(() => goTo("done"), 800);
      }
    } catch {
      setValidationError("Couldn't parse that file. Make sure it's a ChatGPT export JSON.");
    }
    setImporting(false);
  };

  const handleDemoLoad = async () => {
    setDemoLoading(true);
    await loadDemoData();
    setImportCount(24);
    setImportDone(true);
    setDemoLoading(false);
    setTimeout(() => goTo("done"), 600);
  };

  if (!show) return null;

  const stepIdx = STEPS.indexOf(step);

  return (
    <div className="fixed inset-0 z-[100]">
      <style>{`
        @keyframes wiz-slide-in {
          from { opacity: 0; transform: translateX(calc(var(--dir, 1) * 60px)); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes wiz-slide-out {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(calc(var(--dir, 1) * -60px)); }
        }
        @keyframes wiz-check-pop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes wiz-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#0a0a0b] transition-opacity duration-300"
        style={{ opacity: fadeIn ? 1 : 0 }}
      />

      <div
        className="relative h-full flex flex-col transition-opacity duration-300"
        style={{ opacity: fadeIn ? 1 : 0, transitionDelay: "100ms" }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          {/* Progress */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`h-1 rounded-full transition-all duration-500 ${
                  i <= stepIdx
                    ? "bg-teal-500 w-8"
                    : "bg-white/[0.08] w-4"
                }`}
              />
            ))}
          </div>
          {/* Skip */}
          <button
            onClick={finish}
            className="text-[12px] text-zinc-600 hover:text-zinc-400 font-medium px-3 py-1.5 rounded-xl transition-colors"
          >
            Skip setup
          </button>
        </div>

        {/* Step content */}
        <div className="flex-1 flex items-center justify-center px-6 overflow-hidden">
          <div
            key={step}
            className="w-full max-w-md"
            style={{
              "--dir": slideDir,
              animation: transitioning
                ? "wiz-slide-out 0.2s ease-out forwards"
                : "wiz-slide-in 0.35s cubic-bezier(0.25,0.46,0.45,0.94) forwards",
            } as React.CSSProperties}
          >
            {step === "welcome" && <WelcomeStep />}
            {step === "connect" && (
              <ConnectStep
                provider={provider}
                setProvider={(p) => {
                  setProvider(p);
                  setKeyInput("");
                  setValidated(false);
                  setValidationError("");
                }}
                keyInput={keyInput}
                setKeyInput={setKeyInput}
                validating={validating}
                validated={validated}
                validationError={validationError}
                onValidate={handleValidate}
              />
            )}
            {step === "import" && (
              <ImportStep
                fileRef={fileRef}
                importing={importing}
                importDone={importDone}
                importCount={importCount}
                demoLoading={demoLoading}
                onFile={handleFileImport}
                onDemo={handleDemoLoad}
                hasAI={validated || skippedConnect}
                validationError={validationError}
              />
            )}
            {step === "done" && (
              <DoneStep importCount={importCount} onFinish={finish} />
            )}
          </div>
        </div>

        {/* Bottom nav */}
        <div className="px-6 pb-8 pt-4 max-w-md mx-auto w-full">
          {step === "welcome" && (
            <button
              onClick={() => goTo("connect")}
              className="w-full h-[52px] rounded-2xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-semibold text-[15px] flex items-center justify-center gap-2.5 transition-all active:scale-[0.97] shadow-lg shadow-teal-500/20"
            >
              Get started
              <ArrowRight className="w-4.5 h-4.5" />
            </button>
          )}

          {step === "connect" && !validated && (
            <div className="space-y-3">
              <button
                onClick={handleValidate}
                disabled={!keyInput.trim() || validating}
                className="w-full h-[52px] rounded-2xl bg-teal-600 hover:bg-teal-500 disabled:bg-white/[0.06] disabled:text-zinc-600 text-white font-semibold text-[15px] flex items-center justify-center gap-2.5 transition-all active:scale-[0.97]"
              >
                {validating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    Connect
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setSkippedConnect(true);
                  goTo("import");
                }}
                className="w-full h-10 text-[13px] text-zinc-500 hover:text-zinc-400 font-medium transition-colors"
              >
                Skip for now — I&apos;ll set this up later
              </button>
            </div>
          )}

          {step === "import" && !importDone && (
            <button
              onClick={() => goTo("done")}
              className="w-full h-10 text-[13px] text-zinc-500 hover:text-zinc-400 font-medium transition-colors"
            >
              Skip — I&apos;ll import later
            </button>
          )}

          {step === "done" && (
            <button
              onClick={finish}
              className="w-full h-[52px] rounded-2xl bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-500 hover:to-sky-500 text-white font-semibold text-[15px] flex items-center justify-center gap-2.5 transition-all active:scale-[0.97] shadow-lg shadow-teal-500/20"
            >
              Open MindStore
              <Zap className="w-4.5 h-4.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Step: Welcome
   ═══════════════════════════════════════════════════════════════ */
function WelcomeStep() {
  return (
    <div className="text-center">
      <div
        className="w-20 h-20 rounded-[22px] bg-gradient-to-br from-teal-500 to-sky-600 flex items-center justify-center mx-auto mb-8 shadow-xl shadow-teal-500/20"
        style={{ animation: "wiz-float 3s ease-in-out infinite" }}
      >
        <Brain className="w-10 h-10 text-white" />
      </div>
      <h1 className="text-[32px] md:text-[40px] font-bold tracking-[-0.04em] leading-[1.1] mb-4">
        Welcome to
        <br />
        <span className="bg-gradient-to-r from-teal-400 to-sky-400 bg-clip-text text-transparent">
          MindStore
        </span>
      </h1>
      <p className="text-[15px] text-zinc-400 leading-[1.65] max-w-[340px] mx-auto">
        Your AI-powered second brain. Import your conversations,
        search your knowledge, and chat with everything you know.
      </p>
      <div className="flex items-center justify-center gap-6 mt-8 text-[12px] text-zinc-600">
        <span className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Free & open source
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
          Self-hosted
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          Private
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Step: Connect AI
   ═══════════════════════════════════════════════════════════════ */
function ConnectStep({
  provider,
  setProvider,
  keyInput,
  setKeyInput,
  validating,
  validated,
  validationError,
  onValidate,
}: {
  provider: Provider;
  setProvider: (p: Provider) => void;
  keyInput: string;
  setKeyInput: (v: string) => void;
  validating: boolean;
  validated: boolean;
  validationError: string;
  onValidate: () => void;
}) {
  const cfg = PROVIDERS.find((p) => p.id === provider)!;

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
          <Key className="w-5 h-5 text-teal-400" />
        </div>
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-0.02em]">
            Connect an AI provider
          </h2>
          <p className="text-[13px] text-zinc-500">
            Powers search, chat, and insights
          </p>
        </div>
      </div>

      {/* Provider tabs */}
      <div className="flex gap-2 mt-6 mb-5">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => setProvider(p.id)}
            className={`flex-1 h-10 rounded-xl text-[13px] font-medium transition-all ${
              provider === p.id
                ? "bg-white/[0.1] text-white border border-white/[0.1]"
                : "bg-white/[0.03] text-zinc-500 hover:bg-white/[0.06] border border-white/[0.04]"
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              {p.name.split(" ")[0]}
              {p.badge && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-semibold">
                  {p.badge}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* Provider detail */}
      <div className="space-y-3">
        <p className="text-[13px] text-zinc-500">{cfg.tagline}</p>

        {/* Input field */}
        <div className="relative">
          <input
            type={provider === "ollama" ? "url" : "password"}
            value={keyInput}
            onChange={(e) => {
              setKeyInput(e.target.value);
              if (validated) return; // Don't reset after success
            }}
            onKeyDown={(e) => e.key === "Enter" && onValidate()}
            placeholder={cfg.placeholder}
            disabled={validating || validated}
            className="w-full h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 text-[14px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-teal-500/40 focus:bg-white/[0.06] transition-all disabled:opacity-50 font-mono"
          />
          {validated && (
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center"
              style={{ animation: "wiz-check-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards" }}
            >
              <Check className="w-4 h-4 text-emerald-400" />
            </div>
          )}
        </div>

        {/* Validation error */}
        {validationError && (
          <div className="flex items-center gap-2 text-[12px] text-red-400">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {validationError}
          </div>
        )}

        {/* Success */}
        {validated && (
          <div className="flex items-center gap-2 text-[12px] text-emerald-400">
            <Check className="w-3.5 h-3.5" />
            Connected! Moving to import...
          </div>
        )}

        {/* Help link */}
        {!validated && (
          <a
            href={cfg.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[12px] text-teal-500 hover:text-teal-400 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            {cfg.helpText}
          </a>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Step: Import
   ═══════════════════════════════════════════════════════════════ */
function ImportStep({
  fileRef,
  importing,
  importDone,
  importCount,
  demoLoading,
  onFile,
  onDemo,
  hasAI,
  validationError,
}: {
  fileRef: React.RefObject<HTMLInputElement | null>;
  importing: boolean;
  importDone: boolean;
  importCount: number;
  demoLoading: boolean;
  onFile: (f: File) => void;
  onDemo: () => void;
  hasAI: boolean;
  validationError: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
          <Upload className="w-5 h-5 text-sky-400" />
        </div>
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-0.02em]">
            Add your first knowledge
          </h2>
          <p className="text-[13px] text-zinc-500">
            Import conversations or try with sample data
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {/* ChatGPT import */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importing || importDone}
          className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] p-4 text-left transition-all group disabled:opacity-50"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/15 transition-colors">
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[14px] font-medium">Import ChatGPT</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-400 font-semibold">
                  Recommended
                </span>
              </div>
              <p className="text-[12px] text-zinc-500 mt-0.5">
                Export from ChatGPT settings → Data controls → Export data.
                Upload the JSON file here.
              </p>
            </div>
          </div>
          {importing && (
            <div className="flex items-center gap-2 mt-3 text-[12px] text-teal-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Importing your conversations...
            </div>
          )}
          {importDone && importCount > 0 && (
            <div className="flex items-center gap-2 mt-3 text-[12px] text-emerald-400">
              <Check className="w-3.5 h-3.5" />
              Imported {importCount} memories!
            </div>
          )}
        </button>

        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
          }}
        />

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-[11px] text-zinc-600 font-medium">or</span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>

        {/* Try Demo */}
        <button
          onClick={onDemo}
          disabled={demoLoading || importDone}
          className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] p-4 text-left transition-all group disabled:opacity-50"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 group-hover:bg-amber-500/15 transition-colors">
              <Play className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-[14px] font-medium">Try with sample data</p>
              <p className="text-[12px] text-zinc-500 mt-0.5">
                Load 24 sample memories to explore MindStore instantly.
                No API key required.
              </p>
            </div>
          </div>
          {demoLoading && (
            <div className="flex items-center gap-2 mt-3 text-[12px] text-amber-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading demo data...
            </div>
          )}
        </button>

        {validationError && (
          <div className="flex items-center gap-2 text-[12px] text-red-400">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {validationError}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Step: Done
   ═══════════════════════════════════════════════════════════════ */
function DoneStep({
  importCount,
  onFinish,
}: {
  importCount: number;
  onFinish: () => void;
}) {
  return (
    <div className="text-center">
      <div
        className="w-20 h-20 rounded-[22px] bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-500/20"
        style={{ animation: "wiz-check-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards" }}
      >
        <Check className="w-10 h-10 text-white" />
      </div>
      <h2 className="text-[28px] md:text-[32px] font-bold tracking-[-0.03em] leading-[1.1] mb-3">
        You&apos;re all set!
      </h2>
      <p className="text-[15px] text-zinc-400 leading-[1.65] max-w-[320px] mx-auto mb-8">
        {importCount > 0 ? (
          <>
            {importCount} memories loaded and ready to explore.
            Search, chat, and discover connections in your knowledge.
          </>
        ) : (
          <>
            Your MindStore is ready. Import knowledge anytime from
            the dashboard — ChatGPT, notes, URLs, and more.
          </>
        )}
      </p>

      {/* Quick tips */}
      <div className="space-y-2 text-left max-w-sm mx-auto">
        {[
          { icon: Sparkles, text: "Chat — ask questions about your knowledge", color: "text-teal-400 bg-teal-500/10" },
          { icon: Globe, text: "Explore — browse and search all your memories", color: "text-sky-400 bg-sky-500/10" },
          { icon: Brain, text: "Fingerprint — see the shape of your thinking", color: "text-amber-400 bg-amber-500/10" },
        ].map(({ icon: Icon, text, color }) => (
          <div
            key={text}
            className="flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/[0.05] px-3.5 py-2.5"
          >
            <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center shrink-0`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <span className="text-[13px] text-zinc-400">{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
