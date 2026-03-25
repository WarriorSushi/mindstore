"use client";

import { useEffect, useState } from "react";
import { Key, Download, Upload, Trash2, Loader2, Sparkles, Server, CheckCircle, RefreshCw, MessageSquare, Zap, Globe, Plug, Link, HardDrive, Database, Activity, Shield, Cpu, BarChart3, TrendingUp, Layers, Clock, Hash } from "lucide-react";
import { toast } from "sonner";
import { PageTransition, Stagger } from "@/components/PageTransition";
import { usePageTitle } from "@/lib/use-page-title";

async function fetchSettings() {
  try { const r = await fetch('/api/v1/settings'); return r.ok ? r.json() : null; } catch { return null; }
}
async function fetchStats() {
  try { const r = await fetch('/api/v1/stats'); return r.ok ? r.json() : null; } catch { return null; }
}
async function fetchHealth() {
  try { const r = await fetch('/api/v1/health'); return r.ok ? r.json() : null; } catch { return null; }
}

interface HealthData {
  status: string;
  memories: { total: number; withEmbeddings: number; withoutEmbeddings: number; embeddingPercent: number; pinned: number; oldest: string; newest: string };
  embeddings: { dimensions: { dims: number; count: number }[]; coverage: string };
  sources: { type: string; count: number; totalChars: number; avgChars: number; size: string }[];
  storage: { contentSize: string; tableSize: string; indexSize: string; totalSize: string; raw: { contentBytes: number; tableBytes: number; indexBytes: number; totalBytes: number } };
  activity: { day: string; count: number }[];
  plugins: { total: number; enabled: number };
  connections: number;
  database: { version: string; serverTime: string; healthy: boolean };
}

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
  const [activeTab, setActiveTab] = useState<'providers' | 'health' | 'data'>('providers');

  useEffect(() => {
    fetchSettings().then((s) => {
      setSettings(s);
      if (s?.chatProvider) setChatProvider(s.chatProvider);
    });
    fetchStats().then(setStats);
    fetchHealth().then(setHealth);
    fetch('/api/v1/reindex').then(r => r.json()).then(setReindexStatus).catch(() => {});
  }, []);

  const handleSave = async (provider: string) => {
    setSaving(provider);
    const body: any = {};
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
    const data = await res.json();
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
    } catch (err: any) { toast.error(err.message); }
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
      const statusRes = await fetch('/api/v1/reindex');
      const status = await statusRes.json();
      if (!status.needsReindex) {
        toast.success("All memories already have embeddings!");
        setReindexing(false);
        return;
      }
      toast(`Generating embeddings for ${status.withoutEmbeddings} memories…`);
      // Process in batches
      let remaining = status.withoutEmbeddings;
      while (remaining > 0) {
        const res = await fetch('/api/v1/reindex', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batchSize: 50 }) });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
        const data = await res.json();
        remaining = data.remaining;
        if (remaining > 0) toast(`${data.processed} done, ${remaining} remaining…`);
      }
      toast.success("All memories now have embeddings! Semantic search enabled.");
    } catch (err: any) {
      toast.error(err.message || "Reindex failed");
    }
    setReindexing(false);
    fetch('/api/v1/reindex').then(r => r.json()).then(setReindexStatus).catch(() => {});
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
      const data = await res.json();
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

  const providers = settings?.providers || {};

  return (
    <PageTransition className="space-y-6 md:space-y-8">
      <Stagger>
        <div>
          <h1 className="text-[22px] md:text-[28px] font-semibold tracking-[-0.03em]">Settings</h1>
          <p className="text-[13px] text-zinc-500 mt-0.5">AI providers, system health, data management</p>
        </div>
      </Stagger>

      {/* Tab navigation */}
      <Stagger>
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          {([
            { id: 'providers' as const, label: 'Providers', icon: <Key className="w-3.5 h-3.5" /> },
            { id: 'health' as const, label: 'System Health', icon: <Activity className="w-3.5 h-3.5" /> },
            { id: 'data' as const, label: 'Data', icon: <Database className="w-3.5 h-3.5" /> },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </Stagger>

      {/* Active Provider Badge */}
      {activeTab === 'providers' && settings?.embeddingProvider && (
        <Stagger>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-500/5 border border-teal-500/15">
            <CheckCircle className="w-3.5 h-3.5 text-teal-400" />
            <span className="text-[12px] text-zinc-400">Active: <span className="text-teal-300 font-medium">{settings.embeddingProvider}</span></span>
          </div>
        </Stagger>
      )}

      {/* Reindex nudge */}
      {activeTab === 'providers' && settings?.hasApiKey && reindexStatus?.needsReindex && !reindexing && (
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
      {activeTab === 'providers' && (
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
          description={<>Free embeddings & chat. <a href="https://aistudio.google.com/apikey" target="_blank" className="text-blue-400 font-medium">Get key ↗</a></>}
          inputProps={{ type: "password", placeholder: "AIza...", value: geminiKey, onChange: (e: any) => setGeminiKey(e.target.value) }}
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
          description={<>GPT-4o-mini + text-embedding-3-small. <a href="https://platform.openai.com/api-keys" target="_blank" className="text-emerald-400 font-medium">Get key ↗</a></>}
          inputProps={{ type: "password", placeholder: "sk-...", value: openaiKey, onChange: (e: any) => setOpenaiKey(e.target.value) }}
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
          description={<>100% local. Install <a href="https://ollama.ai" target="_blank" className="text-orange-400 font-medium">Ollama ↗</a></>}
          inputProps={{ placeholder: "http://localhost:11434", value: ollamaUrl, onChange: (e: any) => setOllamaUrl(e.target.value) }}
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
          description={<>Claude, Llama, Mistral & more. One key. <a href="https://openrouter.ai/keys" target="_blank" className="text-teal-400 font-medium">Get key ↗</a></>}
          inputProps={{ type: "password", placeholder: "sk-or-...", value: openrouterKey, onChange: (e: any) => setOpenrouterKey(e.target.value) }}
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
      )}

      {/* ─── Chat Provider Preference ─── */}
      {activeTab === 'providers' && settings?.hasApiKey && (
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

      {/* ─── SYSTEM HEALTH TAB ─── */}
      {activeTab === 'health' && (
        <Stagger>
          <div className="space-y-4">
            {!health ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
              </div>
            ) : (
              <>
                {/* Status Banner */}
                <div className={`rounded-2xl border p-4 flex items-center gap-3 ${
                  health.status === 'healthy'
                    ? 'bg-emerald-500/[0.04] border-emerald-500/15'
                    : 'bg-red-500/[0.04] border-red-500/15'
                }`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    health.status === 'healthy' ? 'bg-emerald-500/10' : 'bg-red-500/10'
                  }`}>
                    <Shield className={`w-5 h-5 ${health.status === 'healthy' ? 'text-emerald-400' : 'text-red-400'}`} />
                  </div>
                  <div>
                    <p className={`text-[14px] font-semibold ${health.status === 'healthy' ? 'text-emerald-300' : 'text-red-300'}`}>
                      {health.status === 'healthy' ? 'System Healthy' : 'Issues Detected'}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {health.database?.version || 'Unknown DB'} · Last checked {new Date().toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  <MetricCard
                    label="Total Memories"
                    value={health.memories.total.toLocaleString()}
                    icon={<Layers className="w-3.5 h-3.5" />}
                    color="text-teal-400"
                    bg="bg-teal-500/10"
                  />
                  <MetricCard
                    label="Embedded"
                    value={`${health.memories.embeddingPercent}%`}
                    icon={<Cpu className="w-3.5 h-3.5" />}
                    color={health.memories.embeddingPercent >= 90 ? "text-emerald-400" : health.memories.embeddingPercent >= 50 ? "text-amber-400" : "text-red-400"}
                    bg={health.memories.embeddingPercent >= 90 ? "bg-emerald-500/10" : health.memories.embeddingPercent >= 50 ? "bg-amber-500/10" : "bg-red-500/10"}
                    sub={`${health.memories.withEmbeddings} / ${health.memories.total}`}
                  />
                  <MetricCard
                    label="Storage"
                    value={health.storage.totalSize}
                    icon={<HardDrive className="w-3.5 h-3.5" />}
                    color="text-sky-400"
                    bg="bg-sky-500/10"
                    sub={`Content: ${health.storage.contentSize}`}
                  />
                  <MetricCard
                    label="Connections"
                    value={health.connections.toLocaleString()}
                    icon={<TrendingUp className="w-3.5 h-3.5" />}
                    color="text-amber-400"
                    bg="bg-amber-500/10"
                  />
                </div>

                {/* Embedding Coverage Bar */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-medium text-zinc-300">Embedding Coverage</p>
                    <span className="text-[11px] text-zinc-500">{health.memories.withEmbeddings} / {health.memories.total} memories</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        health.memories.embeddingPercent >= 90 ? 'bg-emerald-500' :
                        health.memories.embeddingPercent >= 50 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${health.memories.embeddingPercent}%` }}
                    />
                  </div>
                  {health.memories.withoutEmbeddings > 0 && (
                    <p className="text-[11px] text-amber-400/80">
                      {health.memories.withoutEmbeddings} memories without embeddings — semantic search won't find them
                    </p>
                  )}
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
                    <p className="text-[12px] font-medium text-zinc-300">Source Breakdown</p>
                    <div className="space-y-2">
                      {health.sources.map((s) => {
                        const pct = health.memories.total > 0 ? (s.count / health.memories.total) * 100 : 0;
                        return (
                          <div key={s.type} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-medium text-zinc-300 capitalize">{s.type}</span>
                                <span className="text-[10px] text-zinc-600">{s.count.toLocaleString()}</span>
                              </div>
                              <span className="text-[10px] text-zinc-500">{s.size} · {Math.round(pct)}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-teal-500/60"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Recent Activity Sparkline */}
                {health.activity.length > 0 && (
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                    <p className="text-[12px] font-medium text-zinc-300">Activity (Last 7 Days)</p>
                    <div className="flex items-end gap-1 h-16">
                      {(() => {
                        // Fill missing days
                        const days: { day: string; count: number }[] = [];
                        for (let i = 6; i >= 0; i--) {
                          const d = new Date();
                          d.setDate(d.getDate() - i);
                          const dayStr = d.toISOString().split('T')[0];
                          const found = health.activity.find(a => a.day?.split('T')[0] === dayStr);
                          days.push({ day: dayStr, count: found?.count || 0 });
                        }
                        const max = Math.max(...days.map(d => d.count), 1);
                        return days.map((day, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div
                              className="w-full rounded-t-md bg-teal-500/40 hover:bg-teal-500/60 transition-colors min-h-[2px]"
                              style={{ height: `${Math.max((day.count / max) * 100, 3)}%` }}
                              title={`${day.day}: ${day.count} memories`}
                            />
                            <span className="text-[8px] text-zinc-600">
                              {new Date(day.day).toLocaleDateString(undefined, { weekday: 'narrow' })}
                            </span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

                {/* Storage Breakdown */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                  <p className="text-[12px] font-medium text-zinc-300">Storage Breakdown</p>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="text-center">
                      <p className="text-[16px] font-semibold text-zinc-200">{health.storage.contentSize}</p>
                      <p className="text-[10px] text-zinc-600">Content</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[16px] font-semibold text-zinc-200">{health.storage.indexSize}</p>
                      <p className="text-[10px] text-zinc-600">Indexes</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[16px] font-semibold text-zinc-200">{health.storage.totalSize}</p>
                      <p className="text-[10px] text-zinc-600">Total</p>
                    </div>
                  </div>
                </div>

                {/* Plugin & System Info */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
                  <p className="text-[12px] font-medium text-zinc-300">System Info</p>
                  <div className="space-y-1.5">
                    <InfoRow label="Database" value={health.database?.version || 'Unknown'} />
                    <InfoRow label="Plugins Installed" value={`${health.plugins.total} (${health.plugins.enabled} active)`} />
                    <InfoRow label="Knowledge Span" value={
                      health.memories.oldest && health.memories.newest
                        ? `${new Date(health.memories.oldest).toLocaleDateString()} — ${new Date(health.memories.newest).toLocaleDateString()}`
                        : 'N/A'
                    } />
                    <InfoRow label="Pinned Memories" value={String(health.memories.pinned)} />
                  </div>
                </div>
              </>
            )}
          </div>
        </Stagger>
      )}

      {/* ─── Data ─── */}
      {activeTab === 'data' && (
      <Stagger>
      <div className="space-y-3">
        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em] px-1">Data</p>

        {/* Stats */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
            input.onchange = async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (!file) return;
              try {
                const data = JSON.parse(await file.text());
                if (!data.memories) throw new Error("Invalid format");
                const res = await fetch('/api/v1/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                if (!res.ok) throw new Error('Failed');
                const r = await res.json();
                fetchStats().then(setStats);
                toast.success(`Restored ${r.imported} memories`);
              } catch (err: any) { toast.error(err.message); }
            };
            input.click();
          }} />
          <ActionButton icon={<Key className="w-4 h-4" />} label="Remove Keys" onClick={handleRemoveAll} />
          <ActionButton icon={<RefreshCw className={`w-4 h-4 ${reindexing ? "animate-spin" : ""}`} />} label={reindexing ? "Indexing…" : "Reindex"} onClick={handleReindex} />
          <ActionButton icon={<Trash2 className="w-4 h-4" />} label="Clear All" onClick={handleClear} danger />
        </div>
      </div>
      </Stagger>
      )}

      {/* About */}
      <Stagger>
      <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-white/[0.01] p-4">
        <p className="text-[12px] text-zinc-500 leading-relaxed">
          <span className="text-zinc-300 font-medium">MindStore</span> — personal knowledge base. Import conversations, notes, and articles. Search semantically. Connect to any AI via MCP.
        </p>
        <p className="text-[11px] text-zinc-600 mt-2">
          Built by <a href="https://github.com/WarriorSushi" target="_blank" className="text-teal-400 hover:underline">WarriorSushi</a> · v0.3
        </p>
      </div>
      </Stagger>
    </PageTransition>
  );
}

function ProviderCard({ name, icon, iconColor, badge, badgeColor, connected, preview, description, inputProps, onSave, saving, disabled, buttonColor }: any) {
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

function ActionButton({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
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

function MetricCard({ label, value, icon, color, bg, sub }: {
  label: string; value: string; icon: React.ReactNode; color: string; bg: string; sub?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-1">
      <div className="flex items-center gap-1.5">
        <div className={`w-6 h-6 rounded-lg ${bg} flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      <p className={`text-[18px] font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[10px] text-zinc-600 font-medium">{label}</p>
      {sub && <p className="text-[9px] text-zinc-700">{sub}</p>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[11px] text-zinc-500">{label}</span>
      <span className="text-[11px] text-zinc-400 text-right truncate max-w-[200px]">{value}</span>
    </div>
  );
}
