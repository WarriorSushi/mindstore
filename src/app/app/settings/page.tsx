"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Key, Download, Upload, Trash2, Loader2, Sparkles, Server, CheckCircle,
  RefreshCw, Zap, Globe, Plug, Database, Activity, Shield, Layers,
  AlertTriangle, ExternalLink, Eye, EyeOff, Copy, Check, Settings,
} from "lucide-react";
import { toast } from "sonner";
import { PageTransition, Stagger } from "@/components/PageTransition";
import { usePageTitle } from "@/lib/use-page-title";

/* ─── Data fetchers ─── */
async function fetchSettings() {
  try { const r = await fetch("/api/v1/settings"); return r.ok ? r.json() : null; } catch { return null; }
}
async function fetchStats() {
  try { const r = await fetch("/api/v1/stats"); return r.ok ? r.json() : null; } catch { return null; }
}
async function fetchHealth() {
  try { const r = await fetch("/api/v1/health"); return r.ok ? r.json() : null; } catch { return null; }
}

/* ─── Types ─── */
interface HealthData {
  status: string;
  memories: {
    total: number; withEmbeddings: number; withoutEmbeddings: number;
    embeddingPercent: number; pinned: number; oldest: string; newest: string;
  };
  embeddings: { dimensions: { dims: number; count: number }[]; coverage: string };
  sources: { type: string; count: number; totalChars: number; avgChars: number; size: string }[];
  storage: {
    contentSize: string; tableSize: string; indexSize: string; totalSize: string;
    raw: { contentBytes: number; tableBytes: number; indexBytes: number; totalBytes: number };
  };
  activity: { day: string; count: number }[];
  plugins: { total: number; enabled: number };
  connections: number;
  database: {
    version: string;
    serverTime: string;
    healthy: boolean;
    connection?: {
      configured: boolean;
      hostKind: string;
      sslRequired: boolean;
      port: number | null;
      preparedStatements: string;
    };
  };
}

type TabId = "providers" | "health" | "data";

/* ─── Main page ─── */
export default function SettingsPage() {
  usePageTitle("Settings");

  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");
  const [customApiUrl, setCustomApiUrl] = useState("");
  const [customApiModel, setCustomApiModel] = useState("");
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [reindexing, setReindexing] = useState(false);
  const [reindexStatus, setReindexStatus] = useState<any>(null);
  const [chatProvider, setChatProvider] = useState<string>("auto");
  const [savingChat, setSavingChat] = useState(false);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("providers");

  useEffect(() => {
    fetchSettings().then((s) => {
      setSettings(s);
      if (s?.chatProvider) setChatProvider(s.chatProvider);
    });
    fetchStats().then(setStats);
    fetchHealth().then(setHealth);
    fetch("/api/v1/reindex").then(r => r.json()).then(setReindexStatus).catch(() => {});
  }, []);

  const handleSave = useCallback(async (provider: string) => {
    setSaving(provider);
    const body: Record<string, string> = {};
    if (provider === "openai") body.apiKey = openaiKey.trim();
    if (provider === "gemini") body.geminiKey = geminiKey.trim();
    if (provider === "ollama") body.ollamaUrl = ollamaUrl.trim();
    if (provider === "openrouter") body.openrouterKey = openrouterKey.trim();
    if (provider === "custom") {
      body.customApiKey = customApiKey.trim();
      body.customApiUrl = customApiUrl.trim();
      body.customApiModel = customApiModel.trim();
    }
    const res = await fetch("/api/v1/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(null);
    if (data.ok) {
      setOpenaiKey(""); setGeminiKey(""); setOllamaUrl(""); setOpenrouterKey("");
      setCustomApiKey(""); setCustomApiUrl(""); setCustomApiModel("");
      fetchSettings().then(setSettings);
      try { const { invalidateAiStatus } = await import("@/lib/use-ai-status"); invalidateAiStatus(); } catch {}
    } else {
      throw new Error(data.error || "Connection failed — check your key and try again");
    }
  }, [openaiKey, geminiKey, ollamaUrl, openrouterKey, customApiKey, customApiUrl, customApiModel]);

  const handleRemoveAll = useCallback(async () => {
    if (!confirm("Remove all API keys? You'll need to re-enter them to use AI features.")) return;
    await fetch("/api/v1/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove" }),
    });
    toast.success("All API keys removed");
    fetchSettings().then(setSettings);
    try { const { invalidateAiStatus } = await import("@/lib/use-ai-status"); invalidateAiStatus(); } catch {}
  }, []);

  const handleExport = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/export");
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `mindstore-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      toast.success("Backup downloaded");
    } catch (err: any) {
      toast.error(err.message);
    }
  }, []);

  const handleRestore = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!data.memories) throw new Error("Invalid backup format");
        const res = await fetch("/api/v1/backup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Restore failed");
        const r = await res.json();
        fetchStats().then(setStats);
        toast.success(`Restored ${r.imported} memories`);
      } catch (err: any) {
        toast.error(err.message);
      }
    };
    input.click();
  }, []);

  const handleClear = useCallback(async () => {
    if (!confirm("Delete ALL memories? This cannot be undone.")) return;
    if (!confirm("Are you absolutely sure? Every memory will be permanently deleted.")) return;
    await fetch("/api/v1/memories", { method: "DELETE" });
    fetchStats().then(setStats);
    toast.success("All data cleared");
  }, []);

  const handleReindex = useCallback(async () => {
    setReindexing(true);
    try {
      const statusRes = await fetch("/api/v1/reindex");
      const status = await statusRes.json();
      if (!status.needsReindex) {
        toast.success("All memories already have embeddings!");
        setReindexing(false);
        return;
      }
      toast(`Generating embeddings for ${status.withoutEmbeddings} memories…`);
      let remaining = status.withoutEmbeddings;
      while (remaining > 0) {
        const res = await fetch("/api/v1/reindex", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchSize: 50 }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
        const data = await res.json();
        if (data?.job?.status === "blocked" || data?.job?.status === "failed") {
          throw new Error(data.message || "Embedding backfill could not continue");
        }
        const nextRemaining = typeof data.remaining === "number" ? data.remaining : remaining;
        if (nextRemaining >= remaining && (!data.processed || data.processed === 0) && data?.job?.status !== "completed") {
          throw new Error(data.message || "Embedding backfill made no progress");
        }
        remaining = nextRemaining;
        if (remaining > 0) toast(`${data.processed} done, ${remaining} remaining…`);
      }
      toast.success("All memories now have embeddings!");
    } catch (err: any) {
      toast.error(err.message || "Reindex failed");
    }
    setReindexing(false);
    fetch("/api/v1/reindex").then(r => r.json()).then(setReindexStatus).catch(() => {});
  }, []);

  const handleSetChatProvider = useCallback(async (provider: string) => {
    setChatProvider(provider);
    setSavingChat(true);
    try {
      const res = await fetch("/api/v1/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatProvider: provider }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(provider === "auto" ? "Chat provider set to auto-detect" : `Chat will use ${provider}`);
      } else {
        toast.error(data.error || "Failed to save");
      }
    } catch {
      toast.error("Failed to save preference");
    }
    setSavingChat(false);
  }, []);

  const providers = settings?.providers || {};

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "providers", label: "Providers", icon: <Key className="w-4 h-4" /> },
    { id: "health", label: "Health", icon: <Activity className="w-4 h-4" /> },
    { id: "data", label: "Data", icon: <Database className="w-4 h-4" /> },
  ];

  return (
    <PageTransition className="space-y-6 md:space-y-8 pb-8">
      {/* ─── Header ─── */}
      <Stagger>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] md:text-[28px] font-semibold tracking-[-0.03em]">Settings</h1>
            <p className="text-[13px] text-zinc-500 mt-1">
              AI providers, system health, and data management
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
            <Settings className="w-5 h-5 text-zinc-500" />
          </div>
        </div>
      </Stagger>

      {/* ─── Tab Navigation ─── */}
      <Stagger>
        <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </Stagger>

      {/* ─── Active Provider Badge ─── */}
      {activeTab === "providers" && settings?.embeddingProvider && (
        <Stagger>
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-teal-500/[0.05] border border-teal-500/15">
            <CheckCircle className="w-4 h-4 text-teal-400 shrink-0" />
            <span className="text-[12px] text-zinc-400">
              Embeddings: <span className="text-teal-300 font-medium">{settings.embeddingProvider}</span>
            </span>
          </div>
        </Stagger>
      )}

      {activeTab === "providers" && settings?.authStatus && (
        <Stagger>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Identity mode</p>
                <p className="mt-2 text-[15px] font-medium text-zinc-200">
                  {settings.authStatus.identityMode === "google-oauth" ? "Google OAuth" :
                    settings.authStatus.identityMode === "single-user" ? "Single-user fallback" : "Unconfigured"}
                </p>
                <p className="mt-1 text-[12px] leading-6 text-zinc-500">
                  {settings.authStatus.googleConfigured
                    ? "This deployment can issue real user sessions."
                    : "Public deployments should configure Google OAuth before inviting users in."}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-right">
                <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">Single-user fallback</p>
                <p className={`mt-1 text-[12px] font-medium ${settings.authStatus.singleUserMode ? "text-amber-300" : "text-emerald-300"}`}>
                  {settings.authStatus.singleUserMode ? "Enabled" : "Disabled"}
                </p>
              </div>
            </div>
          </div>
        </Stagger>
      )}

      {/* ─── Reindex Nudge ─── */}
      {activeTab === "providers" && settings?.hasApiKey && reindexStatus?.needsReindex && !reindexing && (
        <Stagger>
          <button
            onClick={handleReindex}
            className="w-full flex items-center justify-between rounded-2xl bg-amber-500/[0.05] border border-amber-500/15 px-4 py-3.5 hover:bg-amber-500/[0.08] transition-colors text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-[13px] text-amber-300 font-medium">
                  {reindexStatus.withoutEmbeddings} memories need embeddings
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Tap to enable semantic search for all your data
                </p>
              </div>
            </div>
            <RefreshCw className="w-4 h-4 text-amber-400 shrink-0 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </Stagger>
      )}

      {/* ─── PROVIDERS TAB ─── */}
      {activeTab === "providers" && (
        <>
          <Stagger>
            <div className="space-y-3">
              <SectionLabel label="AI Providers" />

              <ProviderCard
                name="Google Gemini"
                icon={<Sparkles className="w-4 h-4" />}
                iconColor="text-blue-400"
                badge="Free"
                badgeColor="text-emerald-400 bg-emerald-500/10 border-emerald-500/15"
                connected={providers.gemini?.configured}
                preview={providers.gemini?.preview}
                description="Free embeddings & chat — best for getting started."
                inputProps={{ type: "password", placeholder: "AIza...", value: geminiKey, onChange: (e: any) => setGeminiKey(e.target.value) }}
                onSave={() => handleSave("gemini")}
                saving={saving === "gemini"}
                disabled={!geminiKey.trim()}
                accentColor="blue"
                guide={{
                  steps: [
                    "Go to Google AI Studio (link below)",
                    "Sign in with your Google account",
                    'Click "Create API key" → select any project',
                    "Copy the key (starts with AIza...) and paste it here",
                  ],
                  url: "https://aistudio.google.com/apikey",
                  urlLabel: "Open Google AI Studio",
                }}
              />

              <ProviderCard
                name="OpenAI"
                icon={<Key className="w-4 h-4" />}
                iconColor="text-emerald-400"
                badge="Paid"
                badgeColor="text-zinc-400 bg-zinc-500/10 border-zinc-500/15"
                connected={providers.openai?.configured}
                preview={providers.openai?.preview}
                description="GPT-4o-mini + text-embedding-3-small. High quality responses."
                inputProps={{ type: "password", placeholder: "sk-...", value: openaiKey, onChange: (e: any) => setOpenaiKey(e.target.value) }}
                onSave={() => handleSave("openai")}
                saving={saving === "openai"}
                disabled={!openaiKey.trim()}
                accentColor="emerald"
                guide={{
                  steps: [
                    "Go to OpenAI Platform (link below)",
                    "Sign in and navigate to API Keys",
                    'Click "Create new secret key"',
                    "Copy the key (starts with sk-...) and paste it here",
                    "Note: requires billing — add credits in Settings → Billing",
                  ],
                  url: "https://platform.openai.com/api-keys",
                  urlLabel: "Open OpenAI Dashboard",
                }}
              />

              <ProviderCard
                name="Ollama"
                icon={<Server className="w-4 h-4" />}
                iconColor="text-orange-400"
                badge="Local"
                badgeColor="text-orange-400 bg-orange-500/10 border-orange-500/15"
                connected={providers.ollama?.configured}
                preview={providers.ollama?.url}
                description="100% local, no API key. Your data never leaves your machine."
                inputProps={{ placeholder: "http://localhost:11434", value: ollamaUrl, onChange: (e: any) => setOllamaUrl(e.target.value) }}
                onSave={() => handleSave("ollama")}
                saving={saving === "ollama"}
                disabled={!ollamaUrl.trim()}
                accentColor="orange"
                guide={{
                  steps: [
                    "Install Ollama from ollama.ai (link below)",
                    "Run: ollama serve (starts on port 11434)",
                    "Pull a model: ollama pull llama3.2",
                    "Enter the URL below (default: http://localhost:11434)",
                  ],
                  url: "https://ollama.ai",
                  urlLabel: "Download Ollama",
                }}
              />

              <ProviderCard
                name="OpenRouter"
                icon={<Globe className="w-4 h-4" />}
                iconColor="text-teal-400"
                badge="200+ Models"
                badgeColor="text-teal-400 bg-teal-500/10 border-teal-500/15"
                connected={providers.openrouter?.configured}
                preview={providers.openrouter?.preview}
                description="Claude, Llama, Mistral & more. One key for 200+ models."
                inputProps={{ type: "password", placeholder: "sk-or-...", value: openrouterKey, onChange: (e: any) => setOpenrouterKey(e.target.value) }}
                onSave={() => handleSave("openrouter")}
                saving={saving === "openrouter"}
                disabled={!openrouterKey.trim()}
                accentColor="teal"
                guide={{
                  steps: [
                    "Go to OpenRouter (link below)",
                    "Create an account and navigate to Keys",
                    'Click "Create Key"',
                    "Copy the key (starts with sk-or-...) and paste it here",
                  ],
                  url: "https://openrouter.ai/keys",
                  urlLabel: "Open OpenRouter",
                }}
              />

              <ProviderCard
                name="Custom API"
                icon={<Plug className="w-4 h-4" />}
                iconColor="text-zinc-400"
                badge="Any LLM"
                badgeColor="text-zinc-400 bg-zinc-500/10 border-zinc-500/15"
                connected={providers.custom?.configured}
                preview={providers.custom?.model}
                description="Any OpenAI-compatible endpoint — Groq, Together, Fireworks, DeepSeek, and more."
                inputProps={{ type: "text", placeholder: "API Base URL (e.g. https://api.groq.com/openai/v1)", value: customApiUrl, onChange: (e: any) => setCustomApiUrl(e.target.value) }}
                extraInputs={[
                  { type: "password", placeholder: "API Key", value: customApiKey, onChange: (e: any) => setCustomApiKey(e.target.value) },
                  { type: "text", placeholder: "Model name (e.g. llama-3.3-70b-versatile)", value: customApiModel, onChange: (e: any) => setCustomApiModel(e.target.value) },
                ]}
                onSave={() => handleSave("custom")}
                saving={saving === "custom"}
                disabled={!customApiKey.trim() || !customApiUrl.trim()}
                accentColor="zinc"
                guide={{
                  steps: [
                    "Get an API key from your chosen provider",
                    "Enter the OpenAI-compatible base URL",
                    "Enter your API key and model name",
                    "Test the connection to verify it works",
                  ],
                }}
              />
            </div>
          </Stagger>

          {/* ─── Chat Provider Preference ─── */}
          {settings?.hasApiKey && (
            <Stagger>
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <SectionLabel label="Chat Provider" />
                  {savingChat && <Loader2 className="w-3 h-3 text-teal-400 animate-spin" />}
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-1">
                  <p className="text-[12px] text-zinc-500 leading-relaxed px-1 pb-2">
                    Choose which AI handles your chat conversations
                  </p>
                  {([
                    { id: "auto", name: "Auto-detect", desc: "Uses first available provider", icon: <Zap className="w-3.5 h-3.5" />, iconColor: "text-amber-400", available: true },
                    { id: "gemini", name: "Google Gemini", desc: "gemini-2.0-flash · fast & free", icon: <Sparkles className="w-3.5 h-3.5" />, iconColor: "text-blue-400", available: !!providers.gemini?.configured },
                    { id: "openai", name: "OpenAI", desc: "gpt-4o-mini · high quality", icon: <Key className="w-3.5 h-3.5" />, iconColor: "text-emerald-400", available: !!providers.openai?.configured },
                    { id: "ollama", name: "Ollama", desc: "llama3.2 · 100% local & private", icon: <Server className="w-3.5 h-3.5" />, iconColor: "text-orange-400", available: !!providers.ollama?.configured },
                    { id: "openrouter", name: "OpenRouter", desc: "200+ models · Claude, Llama, Mistral", icon: <Globe className="w-3.5 h-3.5" />, iconColor: "text-teal-400", available: !!providers.openrouter?.configured },
                    { id: "custom", name: "Custom API", desc: providers.custom?.model || "any OpenAI-compatible", icon: <Plug className="w-3.5 h-3.5" />, iconColor: "text-zinc-400", available: !!providers.custom?.configured },
                  ] as const).map(opt => (
                    <ChatProviderOption
                      key={opt.id}
                      name={opt.name}
                      description={opt.desc}
                      icon={opt.icon}
                      iconColor={opt.iconColor}
                      active={chatProvider === opt.id}
                      onClick={() => handleSetChatProvider(opt.id)}
                      available={opt.available}
                    />
                  ))}
                </div>
              </div>
            </Stagger>
          )}
        </>
      )}

      {/* ─── HEALTH TAB ─── */}
      {activeTab === "health" && (
        <Stagger>
          <div className="space-y-4">
            {!health ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
              </div>
            ) : (
              <>
                {/* Status Banner */}
                <div className={`rounded-2xl border p-4 flex items-center gap-3 ${
                  health.status === "healthy"
                    ? "bg-emerald-500/[0.04] border-emerald-500/15"
                    : "bg-red-500/[0.04] border-red-500/15"
                }`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    health.status === "healthy" ? "bg-emerald-500/10" : "bg-red-500/10"
                  }`}>
                    <Shield className={`w-5 h-5 ${health.status === "healthy" ? "text-emerald-400" : "text-red-400"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[14px] font-semibold ${health.status === "healthy" ? "text-emerald-300" : "text-red-300"}`}>
                      {health.status === "healthy" ? "System Healthy" : "Issues Detected"}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {health.database?.version || "Unknown DB"} · {health.memories.total.toLocaleString()} memories · {health.storage.totalSize}
                    </p>
                    {health.database?.connection && (
                      <p className="text-[10px] text-zinc-600 mt-1">
                        {health.database.connection.hostKind} · port {health.database.connection.port ?? "?"} ·
                        SSL {health.database.connection.sslRequired ? "required" : "unspecified"} ·
                        prepared statements {health.database.connection.preparedStatements}
                      </p>
                    )}
                  </div>
                </div>

                {/* Knowledge Base */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-teal-400" />
                      <p className="text-[13px] font-medium text-zinc-200">Knowledge Base</p>
                    </div>
                    <span className="text-[11px] text-zinc-500 tabular-nums">
                      {health.memories.total.toLocaleString()} memories
                    </span>
                  </div>

                  {/* Embedding coverage */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-500">Embedding coverage</span>
                      <span className={`text-[12px] font-semibold tabular-nums ${
                        health.memories.embeddingPercent >= 90 ? "text-emerald-400" :
                        health.memories.embeddingPercent >= 50 ? "text-amber-400" : "text-red-400"
                      }`}>
                        {health.memories.embeddingPercent}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          health.memories.embeddingPercent >= 90 ? "bg-emerald-500" :
                          health.memories.embeddingPercent >= 50 ? "bg-amber-500" : "bg-red-500"
                        }`}
                        style={{ width: `${health.memories.embeddingPercent}%` }}
                      />
                    </div>
                    {health.memories.withoutEmbeddings > 0 && (
                      <p className="text-[11px] text-amber-400/80">
                        {health.memories.withoutEmbeddings} memories missing embeddings — semantic search can&apos;t find them
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 pt-3 border-t border-white/[0.04]">
                    <InfoRow label="With embeddings" value={health.memories.withEmbeddings.toLocaleString()} />
                    <InfoRow label="Pinned" value={String(health.memories.pinned)} />
                    <InfoRow label="Knowledge span" value={
                      health.memories.oldest && health.memories.newest
                        ? `${new Date(health.memories.oldest).toLocaleDateString()} — ${new Date(health.memories.newest).toLocaleDateString()}`
                        : "N/A"
                    } />
                    <InfoRow label="Connections" value={health.connections.toLocaleString()} />
                  </div>

                  {health.embeddings.dimensions.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {health.embeddings.dimensions.map(d => (
                        <span key={d.dims} className="text-[10px] font-mono text-zinc-500 bg-white/[0.04] px-2 py-1 rounded-lg border border-white/[0.06]">
                          {d.dims}d × {d.count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Source Breakdown */}
                {health.sources.length > 0 && (
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                    <p className="text-[12px] font-medium text-zinc-300">Sources</p>
                    <div className="space-y-2.5">
                      {health.sources.map((s) => {
                        const pct = health.memories.total > 0 ? (s.count / health.memories.total) * 100 : 0;
                        return (
                          <div key={s.type} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-medium text-zinc-300 capitalize">{s.type}</span>
                                <span className="text-[10px] text-zinc-600 tabular-nums">{s.count.toLocaleString()}</span>
                              </div>
                              <span className="text-[10px] text-zinc-500 tabular-nums">{s.size} · {Math.round(pct)}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-teal-500/60 transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Activity */}
                {health.activity.length > 0 && (
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] font-medium text-zinc-300">Activity</p>
                      <span className="text-[10px] text-zinc-600">Last 7 days</span>
                    </div>
                    <div className="flex items-end gap-1.5 h-20">
                      {(() => {
                        const days: { day: string; count: number }[] = [];
                        for (let i = 6; i >= 0; i--) {
                          const d = new Date();
                          d.setDate(d.getDate() - i);
                          const dayStr = d.toISOString().split("T")[0];
                          const found = health.activity.find(a => a.day?.split("T")[0] === dayStr);
                          days.push({ day: dayStr, count: found?.count || 0 });
                        }
                        const max = Math.max(...days.map(d => d.count), 1);
                        return days.map((day, i) => {
                          const isToday = i === 6;
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                              <span className="text-[9px] text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                                {day.count}
                              </span>
                              <div
                                className={`w-full rounded-md transition-colors min-h-[3px] ${
                                  isToday ? "bg-teal-400/70 hover:bg-teal-400" : "bg-teal-500/30 hover:bg-teal-500/50"
                                }`}
                                style={{ height: `${Math.max((day.count / max) * 100, 4)}%` }}
                                title={`${day.day}: ${day.count} memories`}
                              />
                              <span className={`text-[9px] ${isToday ? "text-zinc-400 font-medium" : "text-zinc-600"}`}>
                                {new Date(day.day + "T12:00:00").toLocaleDateString(undefined, { weekday: "narrow" })}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}

                {/* System Info */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                  <p className="text-[12px] font-medium text-zinc-300">System</p>
                  <div className="space-y-2">
                    <InfoRow label="Database" value={health.database?.version || "Unknown"} />
                    <InfoRow label="Content size" value={health.storage.contentSize} />
                    <InfoRow label="Index size" value={health.storage.indexSize} />
                    <InfoRow label="Total storage" value={health.storage.totalSize} />
                    <InfoRow label="Plugins" value={`${health.plugins.total} installed · ${health.plugins.enabled} active`} />
                  </div>
                </div>
              </>
            )}
          </div>
        </Stagger>
      )}

      {/* ─── DATA TAB ─── */}
      {activeTab === "data" && (
        <>
          <Stagger>
            <div className="space-y-3">
              <SectionLabel label="Overview" />
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Memories", value: stats?.totalMemories || 0 },
                    { label: "Sources", value: stats?.totalSources || 0 },
                    { label: "ChatGPT", value: stats?.byType?.chatgpt || 0 },
                    { label: "Other", value: (stats?.byType?.file || 0) + (stats?.byType?.text || 0) + (stats?.byType?.url || 0) },
                  ].map((s) => (
                    <div key={s.label} className="space-y-1">
                      <p className="text-[20px] md:text-[24px] font-semibold tabular-nums tracking-tight">
                        {s.value.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-zinc-500 font-medium">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Stagger>

          {/* Backup & Restore */}
          <Stagger>
            <div className="space-y-3">
              <SectionLabel label="Backup & Restore" />
              <div className="grid grid-cols-2 gap-2">
                <DataActionButton
                  icon={<Download className="w-4 h-4" />}
                  label="Export Data"
                  description="Download JSON backup"
                  onClick={handleExport}
                />
                <DataActionButton
                  icon={<Upload className="w-4 h-4" />}
                  label="Restore Backup"
                  description="Import from JSON file"
                  onClick={handleRestore}
                />
              </div>
            </div>
          </Stagger>

          {/* Maintenance */}
          <Stagger>
            <div className="space-y-3">
              <SectionLabel label="Maintenance" />
              <div className="grid grid-cols-2 gap-2">
                <DataActionButton
                  icon={<RefreshCw className={`w-4 h-4 ${reindexing ? "animate-spin" : ""}`} />}
                  label={reindexing ? "Indexing…" : "Reindex"}
                  description="Rebuild embeddings"
                  onClick={handleReindex}
                  disabled={reindexing}
                />
                <DataActionButton
                  icon={<Key className="w-4 h-4" />}
                  label="Remove Keys"
                  description="Clear all API keys"
                  onClick={handleRemoveAll}
                />
              </div>
            </div>
          </Stagger>

          {/* Danger Zone */}
          <Stagger>
            <div className="space-y-3">
              <SectionLabel label="Danger Zone" danger />
              <div className="rounded-2xl border border-red-500/10 bg-red-500/[0.02] p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-red-300">Delete All Data</p>
                    <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                      Permanently delete every memory, connection, and source. This action cannot be undone.
                      We recommend exporting a backup first.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClear}
                  className="w-full h-10 rounded-xl border border-red-500/20 text-red-400 text-[13px] font-medium hover:bg-red-500/10 transition-colors active:scale-[0.98]"
                >
                  <span className="flex items-center justify-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    Delete Everything
                  </span>
                </button>
              </div>
            </div>
          </Stagger>
        </>
      )}

      {/* ─── About Footer ─── */}
      <Stagger>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-[12px] text-zinc-500 leading-relaxed">
            <span className="text-zinc-300 font-medium">MindStore</span> — personal knowledge base.
            Import conversations, notes, and articles. Search semantically. Connect to any AI via MCP.
          </p>
          <p className="text-[11px] text-zinc-600 mt-2">
            Built by{" "}
            <a href="https://github.com/WarriorSushi" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300 transition-colors">
              WarriorSushi
            </a>{" "}
            · v0.3
          </p>
        </div>
      </Stagger>
    </PageTransition>
  );
}

/* ─── Section Label ─── */
function SectionLabel({ label, danger }: { label: string; danger?: boolean }) {
  return (
    <p className={`text-[11px] font-semibold uppercase tracking-[0.08em] px-1 ${
      danger ? "text-red-400/70" : "text-zinc-500"
    }`}>
      {label}
    </p>
  );
}

/* ─── Provider Card ─── */
function ProviderCard({
  name, icon, iconColor, badge, badgeColor, connected, preview,
  description, inputProps, extraInputs, onSave, saving, disabled, accentColor, guide,
}: {
  name: string; icon: React.ReactNode; iconColor: string;
  badge: string; badgeColor: string; connected: boolean;
  preview?: string; description: string;
  inputProps: any; extraInputs?: any[];
  onSave: () => Promise<void>; saving: boolean; disabled: boolean;
  accentColor: string;
  guide?: { steps: string[]; url?: string; urlLabel?: string };
}) {
  const [expanded, setExpanded] = useState(!connected);
  const [status, setStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [latency, setLatency] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const handleInputChange = (e: any) => {
    inputProps.onChange(e);
    if (status === "error" || status === "success") {
      setStatus("idle");
      setErrorMsg("");
    }
  };

  const handleTestAndSave = async () => {
    setStatus("testing");
    setErrorMsg("");
    setLatency(null);
    const start = performance.now();
    try {
      await onSave();
      const elapsed = Math.round(performance.now() - start);
      setLatency(elapsed);
      setStatus("success");
      setTimeout(() => setExpanded(false), 1500);
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message || "Connection failed");
    }
  };

  const buttonColorMap: Record<string, string> = {
    blue: "bg-blue-600 hover:bg-blue-500",
    emerald: "bg-emerald-600 hover:bg-emerald-500",
    orange: "bg-orange-600 hover:bg-orange-500",
    teal: "bg-teal-600 hover:bg-teal-500",
    zinc: "bg-zinc-700 hover:bg-zinc-600",
  };
  const buttonColor = buttonColorMap[accentColor] || buttonColorMap.teal;

  const inputBorderClass =
    status === "success" ? "border-emerald-500/30 focus:border-emerald-500/40" :
    status === "error" ? "border-red-500/30 focus:border-red-500/40" :
    "border-white/[0.08] focus:border-teal-500/30";

  const isPassword = inputProps.type === "password";

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all duration-300 ${
      status === "success" ? "border-emerald-500/25 bg-emerald-500/[0.03]" :
      status === "error" ? "border-red-500/20 bg-red-500/[0.02]" :
      status === "testing" ? "border-teal-500/20 bg-teal-500/[0.02]" :
      "border-white/[0.06] bg-white/[0.02]"
    }`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className={`w-8 h-8 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0 ${iconColor}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-medium">{name}</span>
            <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-[2px] rounded-md border ${badgeColor}`}>
              {badge}
            </span>
          </div>
          {!expanded && connected && preview && (
            <p className="text-[11px] text-zinc-600 mt-0.5 truncate">
              Connected · <code className="bg-white/[0.06] px-1 py-0.5 rounded text-[10px]">{preview}</code>
            </p>
          )}
        </div>
        {connected && (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium shrink-0">
            <CheckCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Connected</span>
          </span>
        )}
        <svg
          className={`w-4 h-4 text-zinc-600 transition-transform duration-200 shrink-0 ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/[0.04]">
          <p className="text-[12px] text-zinc-500 leading-relaxed pt-3">{description}</p>

          {/* Setup guide toggle */}
          {guide && (
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="flex items-center gap-1.5 text-[11px] text-teal-500 hover:text-teal-400 font-medium transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              {showGuide ? "Hide setup guide" : "How to get a key →"}
            </button>
          )}

          {/* Inline guide */}
          {showGuide && guide && (
            <div className="rounded-xl bg-teal-500/[0.04] border border-teal-500/10 p-3 space-y-2">
              {guide.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-teal-500/15 text-teal-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">{step}</p>
                </div>
              ))}
              {guide.url && (
                <a
                  href={guide.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] text-teal-400 hover:text-teal-300 font-medium mt-1 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  {guide.urlLabel || "Open →"}
                </a>
              )}
            </div>
          )}

          {/* Inputs */}
          <div className="space-y-2">
            <div className="relative">
              <input
                {...inputProps}
                type={isPassword && showKey ? "text" : inputProps.type}
                onChange={handleInputChange}
                onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && !disabled && handleTestAndSave()}
                className={`w-full h-10 px-3 ${isPassword ? "pr-10" : ""} rounded-xl bg-white/[0.04] border text-[13px] font-mono placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-teal-500/20 transition-all ${inputBorderClass}`}
              />
              {isPassword && inputProps.value && (
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  tabIndex={-1}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              )}
            </div>

            {extraInputs?.map((inp: any, i: number) => {
              const isExtraPassword = inp.type === "password";
              return (
                <div key={i} className="relative">
                  <input
                    {...inp}
                    type={isExtraPassword && showKey ? "text" : inp.type}
                    className={`w-full h-10 px-3 ${isExtraPassword ? "pr-10" : ""} rounded-xl bg-white/[0.04] border text-[13px] font-mono placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-teal-500/20 transition-all ${inputBorderClass}`}
                  />
                  {isExtraPassword && inp.value && (
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              );
            })}

            {/* Save button */}
            <button
              onClick={handleTestAndSave}
              disabled={disabled || status === "testing"}
              className={`w-full h-10 rounded-xl text-[13px] font-medium text-white transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                status === "success" ? "bg-emerald-600 hover:bg-emerald-500" :
                status === "error" ? "bg-red-600/80 hover:bg-red-500/80" :
                buttonColor
              }`}
            >
              {status === "testing" ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />Testing connection…</>
              ) : status === "success" ? (
                <><CheckCircle className="w-3.5 h-3.5" />Connected{latency ? ` · ${latency}ms` : ""}</>
              ) : status === "error" ? (
                <><AlertTriangle className="w-3.5 h-3.5" />Retry</>
              ) : (
                <><Zap className="w-3.5 h-3.5" />Test & Save</>
              )}
            </button>
          </div>

          {/* Status feedback */}
          {status === "success" && (
            <div className="flex items-center gap-2 text-[11px] text-emerald-400">
              <CheckCircle className="w-3 h-3 shrink-0" />
              Key validated and saved. Ready for embeddings and chat.
            </div>
          )}
          {status === "error" && errorMsg && (
            <div className="flex items-start gap-2 text-[11px] text-red-400">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Current key preview */}
          {connected && preview && (
            <CurrentKeyPreview preview={preview} />
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Current Key Preview with copy ─── */
function CurrentKeyPreview({ preview }: { preview: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(preview).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-[11px] text-zinc-600 truncate">
        Current: <code className="bg-white/[0.06] px-1.5 py-0.5 rounded-md text-[10px]">{preview}</code>
      </p>
      <button
        onClick={handleCopy}
        className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"
        title="Copy key preview"
      >
        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
}

/* ─── Data Action Button ─── */
function DataActionButton({
  icon, label, description, onClick, danger, disabled,
}: {
  icon: React.ReactNode; label: string; description: string;
  onClick: () => void; danger?: boolean; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-1.5 py-4 px-3 rounded-2xl border text-center transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed ${
        danger
          ? "border-red-500/15 text-red-400 hover:bg-red-500/[0.05]"
          : "border-white/[0.06] text-zinc-300 hover:bg-white/[0.04] hover:border-white/[0.08]"
      }`}
    >
      <span className={danger ? "text-red-400" : "text-zinc-400"}>{icon}</span>
      <span className="text-[12px] font-medium">{label}</span>
      <span className="text-[10px] text-zinc-600">{description}</span>
    </button>
  );
}

/* ─── Chat Provider Option ─── */
function ChatProviderOption({
  name, description, icon, iconColor, active, onClick, available,
}: {
  name: string; description: string; icon: React.ReactNode; iconColor: string;
  active: boolean; onClick: () => void; available: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!available}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all active:scale-[0.98] ${
        active
          ? "bg-teal-500/[0.08] border border-teal-500/25 ring-1 ring-teal-500/15"
          : available
            ? "border border-transparent hover:bg-white/[0.04] hover:border-white/[0.06]"
            : "border border-transparent opacity-35 cursor-not-allowed"
      }`}
    >
      <div className={`w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 ${iconColor}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[13px] font-medium ${active ? "text-white" : available ? "text-zinc-300" : "text-zinc-500"}`}>
            {name}
          </span>
          {!available && (
            <span className="text-[9px] text-zinc-600 font-medium uppercase tracking-wide">Not connected</span>
          )}
        </div>
        <span className="text-[11px] text-zinc-600">{description}</span>
      </div>
      {active && (
        <div className="w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center shrink-0">
          <CheckCircle className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      {!active && available && (
        <div className="w-5 h-5 rounded-full border border-white/[0.1] shrink-0" />
      )}
    </button>
  );
}

/* ─── Info Row ─── */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[11px] text-zinc-500">{label}</span>
      <span className="text-[11px] text-zinc-400 text-right truncate max-w-[200px]">{value}</span>
    </div>
  );
}
