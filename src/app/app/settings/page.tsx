"use client";

import { useEffect, useState } from "react";
import { Key, Download, Upload, Trash2, Loader2, Sparkles, Server, CheckCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

async function fetchSettings() {
  try { const r = await fetch('/api/v1/settings'); return r.ok ? r.json() : null; } catch { return null; }
}
async function fetchStats() {
  try { const r = await fetch('/api/v1/stats'); return r.ok ? r.json() : null; } catch { return null; }
}

export default function SettingsPage() {
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [reindexing, setReindexing] = useState(false);

  useEffect(() => { fetchSettings().then(setSettings); fetchStats().then(setStats); }, []);

  const handleSave = async (provider: string) => {
    setSaving(provider);
    const body: any = {};
    if (provider === 'openai') body.apiKey = openaiKey.trim();
    if (provider === 'gemini') body.geminiKey = geminiKey.trim();
    if (provider === 'ollama') body.ollamaUrl = ollamaUrl.trim();
    const res = await fetch('/api/v1/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    setSaving(null);
    if (data.ok) {
      toast.success(`${provider} connected`);
      setOpenaiKey(""); setGeminiKey(""); setOllamaUrl("");
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
  };

  const providers = settings?.providers || {};

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-[22px] md:text-[28px] font-semibold tracking-[-0.03em]">Settings</h1>
        <p className="text-[13px] text-zinc-500 mt-0.5">AI providers, data management</p>
      </div>

      {/* Active Provider Badge */}
      {settings?.embeddingProvider && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-500/5 border border-violet-500/15">
          <CheckCircle className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-[12px] text-zinc-400">Active: <span className="text-violet-300 font-medium">{settings.embeddingProvider}</span></span>
        </div>
      )}

      {/* ─── Providers ─── */}
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
      </div>

      {/* ─── Data ─── */}
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

      {/* About */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-[12px] text-zinc-500 leading-relaxed">
          <span className="text-zinc-300 font-medium">MindStore</span> — personal knowledge base. Import conversations, notes, and articles. Search semantically. Connect to any AI via MCP.
        </p>
        <p className="text-[11px] text-zinc-600 mt-2">
          Built by <a href="https://github.com/WarriorSushi" target="_blank" className="text-violet-400 hover:underline">WarriorSushi</a> · v0.3
        </p>
      </div>
    </div>
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
            className="flex-1 h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] font-mono placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-all"
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
