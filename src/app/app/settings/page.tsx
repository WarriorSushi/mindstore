"use client";

import { useState, useEffect } from "react";
import { Key, Download, Upload, Trash2, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getApiKey, setApiKey, removeApiKey, testApiKey } from "@/lib/openai";
import { exportAllData, importBackup, clearAllData, db } from "@/lib/db";

export default function SettingsPage() {
  const [apiKey, setApiKeyState] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showClear, setShowClear] = useState(false);
  const [stats, setStats] = useState({ memories: 0, sources: 0 });

  useEffect(() => {
    const key = getApiKey();
    setHasKey(!!key);
    if (key) setApiKeyState(key);
    loadStats();
  }, []);

  async function loadStats() {
    const memories = await db.memories.count();
    const sources = await db.sources.count();
    setStats({ memories, sources });
  }

  async function handleSaveKey() {
    if (!apiKey.trim()) return;
    setTesting(true);
    const valid = await testApiKey(apiKey);
    if (valid) {
      setApiKey(apiKey);
      setHasKey(true);
      toast.success("API key saved and verified");
    } else {
      toast.error("Invalid API key");
    }
    setTesting(false);
  }

  function handleRemoveKey() {
    removeApiKey();
    setApiKeyState("");
    setHasKey(false);
    toast.success("API key removed");
  }

  async function handleExport() {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mindstore-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported");
  }

  async function handleImportBackup(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.memories || !data.sources) throw new Error("Invalid backup format");
      await importBackup(data);
      await loadStats();
      toast.success(`Imported ${data.memories.length} memories and ${data.sources.length} sources`);
    } catch (err) {
      toast.error(`Import error: ${err instanceof Error ? err.message : "Invalid file"}`);
    }
  }

  async function handleClearAll() {
    await clearAllData();
    await loadStats();
    setShowClear(false);
    toast.success("All data cleared");
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your API key and data.</p>
      </div>

      {/* API Key */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Key className="w-4 h-4" /> API Key</CardTitle>
          <CardDescription>Your OpenAI API key is stored locally and used for embeddings and chat.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>OpenAI API Key</Label>
            <Input
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKeyState(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSaveKey} disabled={!apiKey.trim() || testing}>
              {testing ? "Verifying..." : "Save Key"}
            </Button>
            {hasKey && (
              <Button variant="outline" onClick={handleRemoveKey}>Remove Key</Button>
            )}
          </div>
          {hasKey && (
            <p className="text-sm text-green-500 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> API key is set
            </p>
          )}
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Download className="w-4 h-4" /> Data Management</CardTitle>
          <CardDescription>Export, import, or clear your stored knowledge.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Stored data</span>
            <span>{stats.memories} memories · {stats.sources} sources</span>
          </div>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Export All Data</p>
                <p className="text-xs text-muted-foreground">Download your entire knowledge base as JSON</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="w-3 h-3 mr-1" /> Export
              </Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Import Backup</p>
                <p className="text-xs text-muted-foreground">Restore from a previous export</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => document.getElementById('backup-file')?.click()}>
                <Upload className="w-3 h-3 mr-1" /> Import
              </Button>
              <input
                id="backup-file"
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportBackup(file);
                }}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-destructive">Clear All Data</p>
                <p className="text-xs text-muted-foreground">Permanently delete all memories and sources</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setShowClear(true)}>
                <Trash2 className="w-3 h-3 mr-1" /> Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Info className="w-4 h-4" /> About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p><strong className="text-foreground">Mindstore</strong> is a 100% client-side personal knowledge base.</p>
          <p>All your data is stored in your browser&apos;s IndexedDB. Nothing is ever sent to any server except OpenAI for embeddings and chat (using your own API key).</p>
          <p>Built with Next.js, Tailwind CSS, shadcn/ui, Dexie.js, and OpenAI.</p>
        </CardContent>
      </Card>

      {/* Clear confirmation */}
      <Dialog open={showClear} onOpenChange={setShowClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" /> Clear All Data
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete all {stats.memories} memories and {stats.sources} sources. This action cannot be undone. Consider exporting first.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClear(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleClearAll}>Delete Everything</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
