"use client";

import { useEffect, useState } from "react";
import { Key, Download, Upload, Trash2, Info, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkApiKey, saveApiKey, removeApiKey } from "@/lib/openai";
import { toast } from "sonner";

async function fetchStats() {
  try {
    const res = await fetch('/api/v1/stats');
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export default function SettingsPage() {
  const [key, setKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [keyPreview, setKeyPreview] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    checkApiKey().then((data) => {
      setHasKey(data.hasApiKey);
      setKeyPreview(data.apiKeyPreview);
    });
    fetchStats().then(setStats);
  }, []);

  const handleSaveKey = async () => {
    if (!key.trim()) return;
    setTesting(true);
    const result = await saveApiKey(key.trim());
    setTesting(false);
    if (result.ok) {
      setHasKey(true);
      setKeyPreview(`sk-...${key.trim().slice(-4)}`);
      setKey("");
      toast.success("API key saved!");
    } else {
      toast.error(result.error || "Invalid API key.");
    }
  };

  const handleRemoveKey = async () => {
    await removeApiKey();
    setKey("");
    setHasKey(false);
    setKeyPreview(null);
    toast.success("API key removed.");
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-zinc-400 mt-1">Manage your API key, data, and preferences.</p>
      </div>

      {/* API Key */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="w-5 h-5 text-violet-400" />
            OpenAI API Key
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasKey && keyPreview && (
            <p className="text-sm text-zinc-400">
              Current key: <code className="bg-zinc-800 px-2 py-0.5 rounded">{keyPreview}</code>
            </p>
          )}
          <Input
            type="password"
            placeholder="sk-..."
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="bg-zinc-800 border-zinc-700 font-mono"
          />
          <div className="flex gap-2">
            <Button onClick={handleSaveKey} disabled={testing} className="bg-violet-600 hover:bg-violet-500">
              {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {hasKey ? "Update Key" : "Save Key"}
            </Button>
            {hasKey && (
              <Button variant="outline" onClick={handleRemoveKey} className="border-zinc-700">
                Remove Key
              </Button>
            )}
          </div>
          <p className="text-xs text-zinc-500">
            Your key is stored securely on the server. It&apos;s used to create embeddings and generate answers.
          </p>
        </CardContent>
      </Card>

      {/* Data */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg">Data Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg bg-zinc-800/50">
            <div>
              <div className="text-2xl font-bold">{stats?.totalMemories?.toLocaleString() || 0}</div>
              <div className="text-sm text-zinc-500">Memories</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{stats?.totalSources || 0}</div>
              <div className="text-sm text-zinc-500">Sources</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{stats?.byType?.chatgpt || 0}</div>
              <div className="text-sm text-zinc-500">ChatGPT</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{(stats?.byType?.file || 0) + (stats?.byType?.text || 0) + (stats?.byType?.url || 0)}</div>
              <div className="text-sm text-zinc-500">Other</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExport} className="border-zinc-700">
              <Download className="w-4 h-4 mr-2" /> Export Backup
            </Button>
            <Button variant="outline" onClick={handleImportBackup} className="border-zinc-700">
              <Upload className="w-4 h-4 mr-2" /> Restore Backup
            </Button>
            <Button variant="outline" onClick={handleClear} className="border-red-900/50 text-red-400 hover:bg-red-950/50">
              <Trash2 className="w-4 h-4 mr-2" /> Clear All Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="w-5 h-5 text-violet-400" />
            About MindStore
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-400 space-y-2">
          <p><strong className="text-zinc-200">MindStore</strong> is your personal knowledge base. Import your ChatGPT conversations, notes, and articles, then ask questions and get synthesized answers from your own brain.</p>
          <p>All data and API keys are stored securely on the server in PostgreSQL. OpenAI calls are handled server-side — your key never touches the browser.</p>
          <p className="pt-2">
            Built by{" "}
            <a href="https://github.com/WarriorSushi" target="_blank" className="text-violet-400 hover:underline">
              WarriorSushi
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
