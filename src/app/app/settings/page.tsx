"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type ChangeEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { Key, Download, Upload, Trash2, Loader2, Sparkles, Server, CheckCircle, RefreshCw, Zap, Globe, Plug, Copy, Shield } from "lucide-react";
import { toast } from "sonner";
import { PageTransition, Stagger } from "@/components/PageTransition";

type ProviderId = "openai" | "gemini" | "ollama" | "openrouter" | "custom";

interface ProviderStatus {
  configured?: boolean;
  preview?: string;
  url?: string;
  model?: string;
}

interface SettingsResponse {
  chatProvider?: string;
  embeddingProvider?: string;
  hasApiKey?: boolean;
  providers?: Partial<Record<ProviderId, ProviderStatus>>;
}

interface StatsResponse {
  totalMemories: number;
  totalSources: number;
  byType?: Record<string, number>;
}

interface ReindexStatusResponse {
  total?: number;
  withEmbeddings?: number;
  withoutEmbeddings: number;
  needsReindex: boolean;
}

interface ReindexBatchResponse {
  processed: number;
  remaining: number;
  provider?: string;
  message?: string;
  error?: string;
}

interface ApiKeySummary {
  id: string;
  name: string;
  createdAt: string | null;
  lastUsedAt: string | null;
}

interface ApiKeysResponse {
  keys: ApiKeySummary[];
}

interface MutationResponse {
  ok?: boolean;
  error?: string;
}

interface CreateApiKeyResponse extends MutationResponse {
  rawKey?: string | null;
  apiKey?: ApiKeySummary;
}

async function fetchSettings(): Promise<SettingsResponse | null> {
  try {
    const response = await fetch("/api/v1/settings");
    return response.ok ? ((await response.json()) as SettingsResponse) : null;
  } catch {
    return null;
  }
}

async function fetchStats(): Promise<StatsResponse | null> {
  try {
    const response = await fetch("/api/v1/stats");
    return response.ok ? ((await response.json()) as StatsResponse) : null;
  } catch {
    return null;
  }
}

async function fetchApiKeys(): Promise<ApiKeysResponse> {
  try {
    const response = await fetch("/api/v1/api-keys");
    return response.ok ? ((await response.json()) as ApiKeysResponse) : { keys: [] };
  } catch {
    return { keys: [] };
  }
}

async function fetchReindexStatus(): Promise<ReindexStatusResponse | null> {
  try {
    const response = await fetch("/api/v1/reindex");
    return response.ok ? ((await response.json()) as ReindexStatusResponse) : null;
  } catch {
    return null;
  }
}

function subscribeToWindowLocation() {
  return () => {};
}

function getWindowOriginSnapshot() {
  if (typeof window === "undefined") {
    return "http://localhost:3000";
  }

  return window.location.origin;
}

export default function SettingsPage() {
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");
  const [customApiUrl, setCustomApiUrl] = useState("");
  const [customApiModel, setCustomApiModel] = useState("");
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [reindexing, setReindexing] = useState(false);
  const [reindexStatus, setReindexStatus] = useState<ReindexStatusResponse | null>(null);
  const [chatProvider, setChatProvider] = useState<string>("auto");
  const [savingChat, setSavingChat] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeySummary[]>([]);
  const [creatingApiKey, setCreatingApiKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const publicBaseUrl = useSyncExternalStore(
    subscribeToWindowLocation,
    getWindowOriginSnapshot,
    () => "http://localhost:3000"
  );

  useEffect(() => {
    fetchSettings().then((s) => {
      setSettings(s);
      if (s?.chatProvider) setChatProvider(s.chatProvider);
    });
    fetchStats().then(setStats);
    fetchApiKeys().then((data) => setApiKeys(data?.keys || []));
    fetchReindexStatus().then(setReindexStatus);
  }, []);

  const handleSave = async (provider: string) => {
    setSaving(provider);
    const body: Record<string, string> = {};
    if (provider === 'openai') body.apiKey = openaiKey.trim();
    if (provider === 'gemini') body.geminiKey = geminiKey.trim();
    if (provider === 'ollama') body.ollamaUrl = ollamaUrl.trim();
    if (provider === 'openrouter') body.openrouterKey = openrouterKey.trim();
    if (provider === 'custom') {
      body.customApiKey = customApiKey.trim();
      body.customApiUrl = customApiUrl.trim();
      body.customApiModel = customApiModel.trim();
    }
    const res = await fetch('/api/v1/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = (await res.json()) as MutationResponse;
    setSaving(null);
    if (data.ok) {
      toast.success(`${provider} connected`);
      setOpenaiKey(""); setGeminiKey(""); setOllamaUrl(""); setOpenrouterKey(""); setCustomApiKey(""); setCustomApiUrl(""); setCustomApiModel("");
      fetchSettings().then(setSettings);
    } else toast.error(data.error || 'Failed');
  };

  const handleRemoveAll = async () => {
    await fetch('/api/v1/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'remove' }) });
    toast.success("Keys removed"); fetchSettings().then(setSettings);
  };

  const handleExport = async () => {
    try {
      const res = await fetch('/api/v1/export');
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `mindstore-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      toast.success("Backup downloaded");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleClear = async () => {
    if (!confirm("Delete ALL memories? This cannot be undone.")) return;
    if (!confirm("Are you absolutely sure?")) return;
    await fetch('/api/v1/memories', { method: 'DELETE' });
    fetchStats().then(setStats);
    toast.success("All data cleared");
  };

  const handleReindex = async () => {
    setReindexing(true);
    try {
      // Check status first
      const status = await fetchReindexStatus();
      if (!status?.needsReindex) {
        toast.success("All memories already have embeddings!");
        setReindexing(false);
        return;
      }
      toast(`Generating embeddings for ${status.withoutEmbeddings} memories…`);
      // Process in batches
      let remaining = status.withoutEmbeddings;
      while (remaining > 0) {
        const res = await fetch('/api/v1/reindex', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batchSize: 50 }) });
        if (!res.ok) {
          const error = (await res.json()) as MutationResponse;
          throw new Error(error.error || "Reindex failed");
        }
        const data = (await res.json()) as ReindexBatchResponse;
        remaining = data.remaining;
        if (remaining > 0) toast(`${data.processed} done, ${remaining} remaining…`);
      }
      toast.success("All memories now have embeddings! Semantic search enabled.");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Reindex failed"));
    }
    setReindexing(false);
    fetchReindexStatus().then(setReindexStatus);
  };

  const handleSetChatProvider = async (provider: string) => {
    setChatProvider(provider);
    setSavingChat(true);
    try {
      const res = await fetch('/api/v1/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatProvider: provider }),
      });
      const data = (await res.json()) as MutationResponse;
      if (data.ok) {
        toast.success(provider === 'auto' ? 'Chat provider set to auto-detect' : `Chat will use ${provider}`);
      } else {
        toast.error(data.error || 'Failed');
      }
    } catch {
      toast.error('Failed to save preference');
    }
    setSavingChat(false);
  };

  const handleCreateApiKey = async () => {
    setCreatingApiKey(true);
    try {
      const res = await fetch('/api/v1/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'MindStore Everywhere' }),
      });
      const data = (await res.json()) as CreateApiKeyResponse;
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create API key');
      }
      setNewApiKey(data.rawKey || null);
      if (data.apiKey) {
        setApiKeys((current) => [data.apiKey!, ...current.filter((key) => key.id !== data.apiKey?.id)]);
      }
      toast.success('MindStore Everywhere API key created');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to create API key'));
    } finally {
      setCreatingApiKey(false);
    }
  };

  const handleCopyApiKey = async () => {
    if (!newApiKey) return;
    try {
      await navigator.clipboard.writeText(newApiKey);
      toast.success('API key copied');
    } catch {
      toast.error('Failed to copy API key');
    }
  };

  const handleCopyBaseUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicBaseUrl);
      toast.success("Base URL copied");
    } catch {
      toast.error("Failed to copy base URL");
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/api-keys?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = (await res.json()) as MutationResponse;
      if (!res.ok) {
        throw new Error(data.error || 'Failed to revoke API key');
      }
      setApiKeys((current) => current.filter((key) => key.id !== id));
      toast.success('API key revoked');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to revoke API key'));
    }
  };

  const providers = settings?.providers || {};

  return (
    <PageTransition className="space-y-6 md:space-y-8">
      <Stagger>
        <div>
          <h1 className="text-[22px] md:text-[28px] font-semibold tracking-[-0.03em]">Settings</h1>
          <p className="text-[13px] text-zinc-500 mt-0.5">AI providers, data management</p>
        </div>
      </Stagger>

      {/* Active Provider Badge */}
      {settings?.embeddingProvider && (
        <Stagger>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-500/5 border border-teal-500/15">
            <CheckCircle className="w-3.5 h-3.5 text-teal-400" />
            <span className="text-[12px] text-zinc-400">Active: <span className="text-teal-300 font-medium">{settings.embeddingProvider}</span></span>
          </div>
        </Stagger>
      )}

      {/* Reindex nudge */}
      {settings?.hasApiKey && reindexStatus?.needsReindex && !reindexing && (
        <Stagger>
          <button
            onClick={handleReindex}
            className="w-full flex items-center justify-between rounded-2xl bg-gradient-to-r from-amber-500/[0.06] to-orange-500/[0.06] border border-amber-500/15 px-4 py-3 hover:bg-amber-500/[0.1] transition-colors text-left"
          >
            <div>
              <p className="text-[13px] text-amber-300 font-medium">⚡ {reindexStatus.withoutEmbeddings} memories need embeddings</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Tap to enable semantic search for all your data</p>
            </div>
            <RefreshCw className="w-4 h-4 text-amber-400 shrink-0" />
          </button>
        </Stagger>
      )}

      {/* ─── Providers ─── */}
      <Stagger>
      <div className="space-y-3">
        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em] px-1">AI Providers</p>

        {/* Gemini */}
        <ProviderCard
          name="Google Gemini"
          icon={<Sparkles className="w-4 h-4" />}
          iconColor="text-blue-400"
          badge="Free"
          badgeColor="text-emerald-400 bg-emerald-500/10 border-emerald-500/15"
          connected={providers.gemini?.configured}
          preview={providers.gemini?.preview}
          description={<>Free embeddings & chat. <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-blue-400 font-medium">Get key ↗</a></>}
          inputProps={{ type: "password", placeholder: "AIza...", value: geminiKey, onChange: (event: ChangeEvent<HTMLInputElement>) => setGeminiKey(event.target.value) }}
          onSave={() => handleSave('gemini')}
          saving={saving === 'gemini'}
          disabled={!geminiKey.trim()}
          buttonColor="bg-blue-600 hover:bg-blue-500"
        />

        {/* OpenAI */}
        <ProviderCard
          name="OpenAI"
          icon={<Key className="w-4 h-4" />}
          iconColor="text-emerald-400"
          badge="Paid"
          badgeColor="text-zinc-400 bg-zinc-500/10 border-zinc-500/15"
          connected={providers.openai?.configured}
          preview={providers.openai?.preview}
          description={<>GPT-4o-mini + text-embedding-3-small. <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-emerald-400 font-medium">Get key ↗</a></>}
          inputProps={{ type: "password", placeholder: "sk-...", value: openaiKey, onChange: (event: ChangeEvent<HTMLInputElement>) => setOpenaiKey(event.target.value) }}
          onSave={() => handleSave('openai')}
          saving={saving === 'openai'}
          disabled={!openaiKey.trim()}
          buttonColor="bg-emerald-600 hover:bg-emerald-500"
        />

        {/* Ollama */}
        <ProviderCard
          name="Ollama"
          icon={<Server className="w-4 h-4" />}
          iconColor="text-orange-400"
          badge="Local"
          badgeColor="text-orange-400 bg-orange-500/10 border-orange-500/15"
          connected={providers.ollama?.configured}
          preview={providers.ollama?.url}
          description={<>100% local. Install <a href="https://ollama.ai" target="_blank" rel="noreferrer" className="text-orange-400 font-medium">Ollama ↗</a></>}
          inputProps={{ placeholder: "http://localhost:11434", value: ollamaUrl, onChange: (event: ChangeEvent<HTMLInputElement>) => setOllamaUrl(event.target.value) }}
          onSave={() => handleSave('ollama')}
          saving={saving === 'ollama'}
          disabled={!ollamaUrl.trim()}
          buttonColor="bg-orange-600 hover:bg-orange-500"
        />

        {/* OpenRouter */}
        <ProviderCard
          name="OpenRouter"
          icon={<Globe className="w-4 h-4" />}
          iconColor="text-teal-400"
          badge="200+ Models"
          badgeColor="text-teal-400 bg-teal-500/10 border-teal-500/15"
          connected={providers.openrouter?.configured}
          preview={providers.openrouter?.preview}
          description={<>Claude, Llama, Mistral & more. One key. <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-teal-400 font-medium">Get key ↗</a></>}
          inputProps={{ type: "password", placeholder: "sk-or-...", value: openrouterKey, onChange: (event: ChangeEvent<HTMLInputElement>) => setOpenrouterKey(event.target.value) }}
          onSave={() => handleSave('openrouter')}
          saving={saving === 'openrouter'}
          disabled={!openrouterKey.trim()}
          buttonColor="bg-teal-600 hover:bg-teal-500"
        />

        {/* Custom API */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-zinc-500/10 flex items-center justify-center text-zinc-400">
                <Plug className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium">Custom API</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full border font-medium text-zinc-400 bg-zinc-500/10 border-zinc-500/15">Any LLM</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5">Any OpenAI-compatible endpoint (Groq, Together, Fireworks, DeepSeek, etc.)</p>
              </div>
            </div>
            {providers.custom?.configured && (
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <CheckCircle className="w-3 h-3 text-emerald-400" />
                Connected
              </div>
            )}
          </div>
          <div className="space-y-2">
            <input type="text" placeholder="API Base URL (e.g. https://api.groq.com/openai/v1/chat/completions)" value={customApiUrl} onChange={(e) => setCustomApiUrl(e.target.value)} className="w-full h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] placeholder:text-zinc-600 focus:outline-none focus:border-teal-500/30" />
            <input type="password" placeholder="API Key" value={customApiKey} onChange={(e) => setCustomApiKey(e.target.value)} className="w-full h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] placeholder:text-zinc-600 focus:outline-none focus:border-teal-500/30" />
            <input type="text" placeholder="Model name (e.g. llama-3.3-70b-versatile)" value={customApiModel} onChange={(e) => setCustomApiModel(e.target.value)} className="w-full h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] placeholder:text-zinc-600 focus:outline-none focus:border-teal-500/30" />
          </div>
          <button
            onClick={() => handleSave('custom')}
            disabled={!customApiKey.trim() || !customApiUrl.trim() || saving === 'custom'}
            className="h-8 px-4 rounded-xl text-[12px] font-medium bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 transition-all"
          >
            {saving === 'custom' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Connect'}
          </button>
        </div>
      </div>
      </Stagger>

      {/* ─── Chat Provider Preference ─── */}
      {settings?.hasApiKey && (
        <Stagger>
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em]">Chat Provider</p>
            {savingChat && <Loader2 className="w-3 h-3 text-teal-400 animate-spin" />}
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-1.5">
            <p className="text-[12px] text-zinc-500 leading-relaxed px-1 pb-1">
              Choose which AI handles your chat conversations
            </p>
            <ChatProviderOption
              name="Auto-detect"
              description="Uses first available provider"
              icon={<Zap className="w-3.5 h-3.5" />}
              iconColor="text-amber-400"
              active={chatProvider === 'auto'}
              onClick={() => handleSetChatProvider('auto')}
              available={true}
            />
            <ChatProviderOption
              name="Google Gemini"
              description="gemini-2.0-flash · fast & free"
              icon={<Sparkles className="w-3.5 h-3.5" />}
              iconColor="text-blue-400"
              active={chatProvider === 'gemini'}
              onClick={() => handleSetChatProvider('gemini')}
              available={!!providers.gemini?.configured}
            />
            <ChatProviderOption
              name="OpenAI"
              description="gpt-4o-mini · high quality"
              icon={<Key className="w-3.5 h-3.5" />}
              iconColor="text-emerald-400"
              active={chatProvider === 'openai'}
              onClick={() => handleSetChatProvider('openai')}
              available={!!providers.openai?.configured}
            />
            <ChatProviderOption
              name="Ollama"
              description="llama3.2 · 100% local & private"
              icon={<Server className="w-3.5 h-3.5" />}
              iconColor="text-orange-400"
              active={chatProvider === 'ollama'}
              onClick={() => handleSetChatProvider('ollama')}
              available={!!providers.ollama?.configured}
            />
            <ChatProviderOption
              name="OpenRouter"
              description="200+ models · Claude, Llama, Mistral"
              icon={<Globe className="w-3.5 h-3.5" />}
              iconColor="text-teal-400"
              active={chatProvider === 'openrouter'}
              onClick={() => handleSetChatProvider('openrouter')}
              available={!!providers.openrouter?.configured}
            />
            <ChatProviderOption
              name="Custom API"
              description={providers.custom?.model || "any OpenAI-compatible"}
              icon={<Plug className="w-3.5 h-3.5" />}
              iconColor="text-zinc-400"
              active={chatProvider === 'custom'}
              onClick={() => handleSetChatProvider('custom')}
              available={!!providers.custom?.configured}
            />
          </div>
        </div>
        </Stagger>
      )}

      <Stagger>
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em]">MindStore Everywhere</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-300">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[14px] font-medium">Browser capture and extension keys</p>
                  <p className="text-[12px] text-zinc-500">Create API keys for MindStore Everywhere and future external clients.</p>
                </div>
              </div>
            </div>
            <Link
              href="/docs/import-guides/browser-extension"
              className="text-[11px] text-teal-300 hover:text-teal-200"
            >
              Setup docs
            </Link>
          </div>

          {newApiKey && (
            <div className="rounded-2xl border border-teal-500/20 bg-teal-500/[0.06] p-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-teal-300">Copy This Now</p>
              <p className="text-[12px] text-zinc-300">MindStore only shows the raw key once after creation.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded-xl bg-black/30 px-3 py-2 text-[11px] text-zinc-200">
                  {newApiKey}
                </code>
                <button
                  onClick={handleCopyApiKey}
                  className="h-10 px-3 rounded-xl border border-white/[0.08] text-zinc-300 hover:bg-white/[0.04] transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCreateApiKey}
              disabled={creatingApiKey}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white text-[12px] font-medium transition-all"
            >
              {creatingApiKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
              Generate API key
            </button>
            <Link
              href="/docs/api-reference/capture"
              className="inline-flex items-center h-10 px-4 rounded-xl border border-white/[0.08] text-[12px] font-medium text-zinc-300 hover:bg-white/[0.04]"
            >
              Capture API docs
            </Link>
            <a
              href="/api/v1/extension/package"
              className="inline-flex items-center h-10 px-4 rounded-xl border border-white/[0.08] text-[12px] font-medium text-zinc-300 hover:bg-white/[0.04]"
            >
              Download extension ZIP
            </a>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-zinc-200">Quick setup</p>
                <p className="text-[11px] text-zinc-500 mt-1">Use this base URL in the browser extension popup, then test the connection before your first capture.</p>
              </div>
              <button
                onClick={handleCopyBaseUrl}
                className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-white/[0.08] text-[12px] font-medium text-zinc-300 hover:bg-white/[0.04]"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy URL
              </button>
            </div>
            <code className="block overflow-x-auto rounded-xl bg-black/30 px-3 py-2 text-[11px] text-zinc-200">
              {publicBaseUrl}
            </code>
            <div className="grid gap-2 text-[12px] text-zinc-400 md:grid-cols-3">
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                1. Download the ZIP or load the unpacked extension folder in a Chromium browser.
              </div>
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                2. Paste this MindStore URL into the popup. Add an API key for hosted or shared setups.
              </div>
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                3. Use the popup&apos;s <span className="text-zinc-200">Test connection</span> button, then start capturing.
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {apiKeys.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.08] px-4 py-3 text-[12px] text-zinc-500">
                No API keys created yet.
              </div>
            ) : (
              apiKeys.map((apiKey) => (
                <div
                  key={apiKey.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-zinc-200">{apiKey.name}</p>
                    <p className="text-[11px] text-zinc-500">
                      Created {formatTimestamp(apiKey.createdAt)}
                      {apiKey.lastUsedAt ? ` · Last used ${formatTimestamp(apiKey.lastUsedAt)}` : " · Unused yet"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRevokeApiKey(apiKey.id)}
                    className="h-9 px-3 rounded-xl border border-red-500/20 text-[12px] font-medium text-red-400 hover:bg-red-500/5"
                  >
                    Revoke
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      </Stagger>

      {/* ─── Data ─── */}
      <Stagger>
      <div className="space-y-3">
        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em] px-1">Data</p>

        {/* Stats */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Memories", value: stats?.totalMemories || 0 },
              { label: "Sources", value: stats?.totalSources || 0 },
              { label: "ChatGPT", value: stats?.byType?.chatgpt || 0 },
              { label: "Other", value: (stats?.byType?.file || 0) + (stats?.byType?.text || 0) + (stats?.byType?.url || 0) },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-[18px] md:text-[22px] font-semibold tabular-nums">{s.value.toLocaleString()}</p>
                <p className="text-[10px] text-zinc-600 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <ActionButton icon={<Download className="w-4 h-4" />} label="Export" onClick={handleExport} />
          <ActionButton icon={<Upload className="w-4 h-4" />} label="Restore" onClick={() => {
            const input = document.createElement("input");
            input.type = "file"; input.accept = ".json";
              input.onchange = async (event) => {
                const file = (event.target as HTMLInputElement).files?.[0];
                if (!file) return;
                try {
                  const data = JSON.parse(await file.text());
                  if (!data.memories) throw new Error("Invalid format");
                  const res = await fetch('/api/v1/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                  if (!res.ok) throw new Error('Failed');
                  const r = await res.json();
                  fetchStats().then(setStats);
                  toast.success(`Restored ${r.imported} memories`);
                } catch (error: unknown) {
                  toast.error(getErrorMessage(error));
                }
              };
            input.click();
          }} />
          <ActionButton icon={<Key className="w-4 h-4" />} label="Remove Keys" onClick={handleRemoveAll} />
          <ActionButton icon={<RefreshCw className={`w-4 h-4 ${reindexing ? "animate-spin" : ""}`} />} label={reindexing ? "Indexing…" : "Reindex"} onClick={handleReindex} />
          <ActionButton icon={<Trash2 className="w-4 h-4" />} label="Clear All" onClick={handleClear} danger />
        </div>
      </div>
      </Stagger>

      {/* About */}
      <Stagger>
      <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-white/[0.01] p-4">
        <p className="text-[12px] text-zinc-500 leading-relaxed">
          <span className="text-zinc-300 font-medium">MindStore</span> — personal knowledge base. Import conversations, notes, and articles. Search semantically. Connect to any AI via MCP.
        </p>
        <p className="text-[11px] text-zinc-600 mt-2">
          Built by <a href="https://github.com/WarriorSushi" target="_blank" rel="noreferrer" className="text-teal-400 hover:underline">WarriorSushi</a> · v0.3
        </p>
      </div>
      </Stagger>
    </PageTransition>
  );
}

interface ProviderCardProps {
  name: string;
  icon: ReactNode;
  iconColor: string;
  badge: string;
  badgeColor: string;
  connected?: boolean;
  preview?: string;
  description: ReactNode;
  inputProps: InputHTMLAttributes<HTMLInputElement>;
  onSave: () => void;
  saving: boolean;
  disabled: boolean;
  buttonColor: string;
}

function ProviderCard({ name, icon, iconColor, badge, badgeColor, connected, preview, description, inputProps, onSave, saving, disabled, buttonColor }: ProviderCardProps) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl bg-white/[0.04] flex items-center justify-center ${iconColor}`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-medium">{name}</span>
              <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-[2px] rounded-md border ${badgeColor}`}>{badge}</span>
              {connected && (
                <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium">
                  <CheckCircle className="w-3 h-3" /> Connected
                </span>
              )}
            </div>
          </div>
        </div>
        <p className="text-[12px] text-zinc-500 leading-relaxed">{description}</p>
        {preview && (
          <p className="text-[11px] text-zinc-600">Current: <code className="bg-white/[0.06] px-1.5 py-0.5 rounded-md text-[10px]">{preview}</code></p>
        )}
        <div className="flex gap-2">
          <input
            {...inputProps}
            className="flex-1 h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] font-mono placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-teal-500/30 transition-all"
          />
          <button
            onClick={onSave}
            disabled={disabled || saving}
            className={`h-9 px-4 rounded-xl text-[13px] font-medium text-white shrink-0 transition-all active:scale-[0.96] disabled:opacity-40 ${buttonColor}`}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, danger }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 h-10 rounded-xl border text-[12px] font-medium transition-all active:scale-[0.97] ${
        danger
          ? "border-red-500/20 text-red-400 hover:bg-red-500/5"
          : "border-white/[0.06] text-zinc-400 hover:bg-white/[0.04]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ChatProviderOption({ name, description, icon, iconColor, active, onClick, available }: {
  name: string; description: string; icon: ReactNode; iconColor: string;
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
          <span className={`text-[13px] font-medium ${active ? "text-white" : available ? "text-zinc-300" : "text-zinc-500"}`}>{name}</span>
          {!available && <span className="text-[9px] text-zinc-600 font-medium uppercase tracking-wide">Not connected</span>}
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

function formatTimestamp(value?: string | null) {
  if (!value) return "just now";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function getErrorMessage(error: unknown, fallback = "Something went wrong") {
  return error instanceof Error ? error.message : fallback;
}
