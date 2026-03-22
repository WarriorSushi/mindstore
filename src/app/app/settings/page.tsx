"use client";

import { useEffect, useState } from "react";
import { Key, Download, Upload, Trash2, Info, Loader2, Sparkles, Server } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

async function fetchSettings() {
  const res = await fetch('/api/v1/settings');
  if (!res.ok) return null;
  return res.json();
}

async function fetchStats() {
  const res = await fetch('/api/v1/stats');
  if (!res.ok) return null;
  return res.json();
}

export default function SettingsPage() {
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchSettings().then(setSettings);
    fetchStats().then(setStats);
  }, []);

  const handleSave = async (provider: string) => {
    setSaving(provider);
    const body: any = {};
    if (provider === 'openai') body.apiKey = openaiKey.trim();
    if (provider === 'gemini') body.geminiKey = geminiKey.trim();
    if (provider === 'ollama') body.ollamaUrl = ollamaUrl.trim();

    const res = await fetch('/api/v1/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(null);

    if (data.ok) {
      toast.success(`${provider} settings saved!`);
      setOpenaiKey(""); setGeminiKey(""); setOllamaUrl("");
      fetchSettings().then(setSettings);
    } else {
      toast.error(data.error || 'Failed to save');
    }
  };

  const handleRemoveAll = async () => {
    const res = await fetch('/api/v1/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove' }),
    });
    if (res.ok) {
      toast.success("All API keys removed.");
      fetchSettings().then(setSettings);
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch('/api/v1/export');
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mindstore-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded!");
    } catch (err: any) {
      toast.error(`Export failed: ${err.message}`);
    }
  };

  const handleImportBackup = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.memories) throw new Error("Invalid backup format");
        const res = await fetch('/api/v1/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Restore failed');
        const result = await res.json();
        fetchStats().then(setStats);
        toast.success(`Restored ${result.imported} memories!`);
      } catch (err: any) {
        toast.error(`Import failed: ${err.message}`);
      }
    };
    input.click();
  };

  const handleClear = async () => {
    if (!confirm("Are you sure? This will delete ALL your memories. This cannot be undone.")) return;
    if (!confirm("Really sure? Export a backup first if you want to keep your data.")) return;
    try {
      const res = await fetch('/api/v1/memories', { method: 'DELETE' });
      if (!res.ok) throw new Error('Clear failed');
      fetchStats().then(setStats);
      toast.success("All data cleared.");
    } catch (err: any) {
      toast.error(`Clear failed: ${err.message}`);
    }
  };

  const providers = settings?.providers || {};

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-zinc-400 mt-1">Configure AI providers, manage data, and more.</p>
      </div>

      {/* Active Provider */}
      {settings?.embeddingProvider && (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Sparkles className="w-4 h-4 text-violet-400" />
          Active embedding provider: <Badge variant="secondary" className="bg-violet-500/10 text-violet-400">{settings.embeddingProvider}</Badge>
        </div>
      )}

      {/* OpenAI */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="w-5 h-5 text-emerald-400" />
            OpenAI
            {providers.openai?.configured && <Badge className="bg-emerald-500/10 text-emerald-400 text-xs">Connected</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-zinc-500">For embeddings (text-embedding-3-small) and chat (GPT-4o-mini).</p>
          {providers.openai?.preview && (
            <p className="text-sm text-zinc-400">Current: <code className="bg-zinc-800 px-2 py-0.5 rounded">{providers.openai.preview}</code></p>
          )}
          <div className="flex gap-2">
            <Input type="password" placeholder="sk-..." value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} className="bg-zinc-800 border-zinc-700 font-mono" />
            <Button onClick={() => handleSave('openai')} disabled={!openaiKey.trim() || saving === 'openai'} className="bg-emerald-600 hover:bg-emerald-500 shrink-0">
              {saving === 'openai' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Gemini */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400" />
            Google Gemini
            {providers.gemini?.configured && <Badge className="bg-blue-500/10 text-blue-400 text-xs">Connected</Badge>}
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-xs">Free Tier</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-zinc-500">Free embeddings (text-embedding-004) and chat (Gemini 2.0 Flash). Get a key at <a href="https://aistudio.google.com/apikey" target="_blank" className="text-blue-400 hover:underline">aistudio.google.com</a>.</p>
          {providers.gemini?.preview && (
            <p className="text-sm text-zinc-400">Current: <code className="bg-zinc-800 px-2 py-0.5 rounded">{providers.gemini.preview}</code></p>
          )}
          <div className="flex gap-2">
            <Input type="password" placeholder="AIza..." value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} className="bg-zinc-800 border-zinc-700 font-mono" />
            <Button onClick={() => handleSave('gemini')} disabled={!geminiKey.trim() || saving === 'gemini'} className="bg-blue-600 hover:bg-blue-500 shrink-0">
              {saving === 'gemini' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ollama */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Server className="w-5 h-5 text-orange-400" />
            Ollama (Local)
            {providers.ollama?.configured && <Badge className="bg-orange-500/10 text-orange-400 text-xs">Connected</Badge>}
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-xs">Free & Private</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-zinc-500">Run embeddings locally with Ollama. Install from <a href="https://ollama.ai" target="_blank" className="text-orange-400 hover:underline">ollama.ai</a>, then run <code className="bg-zinc-800 px-1 rounded">ollama pull nomic-embed-text</code>.</p>
          {providers.ollama?.url && (
            <p className="text-sm text-zinc-400">Current: <code className="bg-zinc-800 px-2 py-0.5 rounded">{providers.ollama.url}</code></p>
          )}
          <div className="flex gap-2">
            <Input placeholder="http://localhost:11434" value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} className="bg-zinc-800 border-zinc-700 font-mono" />
            <Button onClick={() => handleSave('ollama')} disabled={!ollamaUrl.trim() || saving === 'ollama'} className="bg-orange-600 hover:bg-orange-500 shrink-0">
              {saving === 'ollama' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader><CardTitle className="text-lg">Data Management</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg bg-zinc-800/50">
            <div><div className="text-2xl font-bold">{stats?.totalMemories?.toLocaleString() || 0}</div><div className="text-sm text-zinc-500">Memories</div></div>
            <div><div className="text-2xl font-bold">{stats?.totalSources || 0}</div><div className="text-sm text-zinc-500">Sources</div></div>
            <div><div className="text-2xl font-bold">{stats?.byType?.chatgpt || 0}</div><div className="text-sm text-zinc-500">ChatGPT</div></div>
            <div><div className="text-2xl font-bold">{(stats?.byType?.file || 0) + (stats?.byType?.text || 0) + (stats?.byType?.url || 0)}</div><div className="text-sm text-zinc-500">Other</div></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExport} className="border-zinc-700"><Download className="w-4 h-4 mr-2" /> Export Backup</Button>
            <Button variant="outline" onClick={handleImportBackup} className="border-zinc-700"><Upload className="w-4 h-4 mr-2" /> Restore Backup</Button>
            <Button variant="outline" onClick={handleRemoveAll} className="border-zinc-700"><Key className="w-4 h-4 mr-2" /> Remove All Keys</Button>
            <Button variant="outline" onClick={handleClear} className="border-red-900/50 text-red-400 hover:bg-red-950/50"><Trash2 className="w-4 h-4 mr-2" /> Clear All Data</Button>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Info className="w-5 h-5 text-violet-400" /> About MindStore</CardTitle></CardHeader>
        <CardContent className="text-sm text-zinc-400 space-y-2">
          <p><strong className="text-zinc-200">MindStore</strong> — your personal knowledge base. Import ChatGPT conversations, notes, and articles. Search semantically. Get answers from your own brain.</p>
          <p>Supports OpenAI, Google Gemini (free), and Ollama (local) for embeddings and chat. All data stored in PostgreSQL. All AI calls server-side.</p>
          <p className="pt-2">Built by <a href="https://github.com/WarriorSushi" target="_blank" className="text-violet-400 hover:underline">WarriorSushi</a></p>
        </CardContent>
      </Card>
    </div>
  );
}
