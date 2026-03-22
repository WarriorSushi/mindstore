"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Brain, Upload, MessageSquare, Compass, Database, FileText, Globe, MessageCircle, Sparkles, Key, Server, ExternalLink, Check, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkApiKey } from "@/lib/openai";
import { isDemoMode, loadDemoData, clearDemoData } from "@/lib/demo";
import { toast } from "sonner";

async function fetchStats() {
  try {
    const res = await fetch('/api/v1/stats');
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

type SetupTab = "gemini" | "openai" | "ollama";

export default function DashboardPage() {
  const [hasKey, setHasKey] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [testing, setTesting] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [demo, setDemo] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [setupTab, setSetupTab] = useState<SetupTab>("gemini");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");

  useEffect(() => {
    checkApiKey().then((data) => setHasKey(data.hasApiKey));
    setDemo(isDemoMode());
    fetchStats().then(setStats);
    setLoaded(true);
  }, []);

  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("demo") === "true" && !isDemoMode()) {
      checkApiKey().then((data) => {
        if (!data.hasApiKey) handleStartDemo();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleStartDemo = async () => {
    setLoadingDemo(true);
    await loadDemoData();
    setDemo(true);
    const s = await fetchStats();
    setStats(s);
    setLoadingDemo(false);
    toast.success("Demo loaded! Explore 24 sample memories.");
  };

  const handleExitDemo = async () => {
    await clearDemoData();
    setDemo(false);
    setStats(null);
    toast.success("Demo data cleared.");
  };

  const handleSaveProvider = async (provider: string) => {
    const key = keyInput.trim();
    const url = ollamaUrl.trim();
    if (provider === "ollama" && !url) return;
    if (provider !== "ollama" && !key) return;

    setTesting(true);
    try {
      const body: any = {};
      if (provider === "gemini") body.geminiKey = key;
      else if (provider === "openai") body.apiKey = key;
      else if (provider === "ollama") body.ollamaUrl = url;

      const res = await fetch('/api/v1/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.ok) {
        setHasKey(true);
        setKeyInput("");
        toast.success(`${provider === "gemini" ? "Gemini" : provider === "openai" ? "OpenAI" : "Ollama"} connected!`);
      } else {
        toast.error(data.error || "Failed to save. Check your key and try again.");
      }
    } catch (err: any) {
      toast.error(err.message || "Connection failed");
    }
    setTesting(false);
  };

  if (!loaded) return null;

  // Setup wizard if no API key and not in demo mode
  if (!hasKey && !demo) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="w-full max-w-xl space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <Brain className="w-14 h-14 text-violet-400 mx-auto" />
            <h1 className="text-3xl font-bold">Welcome to MindStore</h1>
            <p className="text-zinc-400 text-sm max-w-md mx-auto">
              Connect an AI provider to power search, chat, and embeddings. Pick the one that works for you.
            </p>
          </div>

          {/* Provider Tabs */}
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => { setSetupTab("gemini"); setKeyInput(""); }}
              className={`flex-1 max-w-[160px] rounded-xl border px-4 py-3 text-left transition-all ${
                setupTab === "gemini"
                  ? "border-blue-500/50 bg-blue-500/10"
                  : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <Sparkles className={`w-4 h-4 ${setupTab === "gemini" ? "text-blue-400" : "text-zinc-500"}`} />
                <span className="text-sm font-medium">Gemini</span>
              </div>
              <span className={`text-xs ${setupTab === "gemini" ? "text-blue-400" : "text-zinc-600"}`}>Free</span>
            </button>
            <button
              onClick={() => { setSetupTab("openai"); setKeyInput(""); }}
              className={`flex-1 max-w-[160px] rounded-xl border px-4 py-3 text-left transition-all ${
                setupTab === "openai"
                  ? "border-emerald-500/50 bg-emerald-500/10"
                  : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <Key className={`w-4 h-4 ${setupTab === "openai" ? "text-emerald-400" : "text-zinc-500"}`} />
                <span className="text-sm font-medium">OpenAI</span>
              </div>
              <span className={`text-xs ${setupTab === "openai" ? "text-emerald-400" : "text-zinc-600"}`}>Paid</span>
            </button>
            <button
              onClick={() => { setSetupTab("ollama"); setKeyInput(""); }}
              className={`flex-1 max-w-[160px] rounded-xl border px-4 py-3 text-left transition-all ${
                setupTab === "ollama"
                  ? "border-orange-500/50 bg-orange-500/10"
                  : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <Server className={`w-4 h-4 ${setupTab === "ollama" ? "text-orange-400" : "text-zinc-500"}`} />
                <span className="text-sm font-medium">Ollama</span>
              </div>
              <span className={`text-xs ${setupTab === "ollama" ? "text-orange-400" : "text-zinc-600"}`}>Local</span>
            </button>
          </div>

          {/* Gemini Setup */}
          {setupTab === "gemini" && (
            <Card className="bg-zinc-900 border-blue-500/20">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                  <Sparkles className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="text-blue-200 font-medium">Recommended — Completely Free</p>
                    <p className="text-zinc-400 mt-1">Google Gemini offers free embeddings and chat. No credit card needed. Takes 30 seconds.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center text-xs font-bold text-blue-400">1</div>
                    <span>Go to </span>
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-medium"
                    >
                      Google AI Studio <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center text-xs font-bold text-blue-400">2</div>
                    <span>Click &quot;Create API key&quot; → copy it</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center text-xs font-bold text-blue-400">3</div>
                    <span>Paste it below</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="AIza..."
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveProvider("gemini")}
                    className="bg-zinc-800 border-zinc-700 font-mono"
                  />
                  <Button
                    onClick={() => handleSaveProvider("gemini")}
                    disabled={testing || !keyInput.trim()}
                    className="bg-blue-600 hover:bg-blue-500 shrink-0"
                  >
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* OpenAI Setup */}
          {setupTab === "openai" && (
            <Card className="bg-zinc-900 border-emerald-500/20">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <Key className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="text-emerald-200 font-medium">OpenAI API Key</p>
                    <p className="text-zinc-400 mt-1">Uses GPT-4o-mini for chat and text-embedding-3-small for search. Usage-based billing (~$0.01 per 10 queries).</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="sk-..."
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveProvider("openai")}
                    className="bg-zinc-800 border-zinc-700 font-mono"
                  />
                  <Button
                    onClick={() => handleSaveProvider("openai")}
                    disabled={testing || !keyInput.trim()}
                    className="bg-emerald-600 hover:bg-emerald-500 shrink-0"
                  >
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
                  </Button>
                </div>
                <p className="text-xs text-zinc-500">
                  Get your key at{" "}
                  <a href="https://platform.openai.com/api-keys" target="_blank" className="text-emerald-400 hover:underline">
                    platform.openai.com/api-keys
                  </a>
                </p>
              </CardContent>
            </Card>
          )}

          {/* Ollama Setup */}
          {setupTab === "ollama" && (
            <Card className="bg-zinc-900 border-orange-500/20">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
                  <Server className="w-5 h-5 text-orange-400 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="text-orange-200 font-medium">100% Local & Private</p>
                    <p className="text-zinc-400 mt-1">
                      Run AI on your own machine. Install{" "}
                      <a href="https://ollama.ai" target="_blank" className="text-orange-400 hover:underline">Ollama</a>
                      , then run <code className="bg-zinc-800 px-1 rounded text-xs">ollama pull nomic-embed-text</code>
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="http://localhost:11434"
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveProvider("ollama")}
                    className="bg-zinc-800 border-zinc-700 font-mono"
                  />
                  <Button
                    onClick={() => handleSaveProvider("ollama")}
                    disabled={testing || !ollamaUrl.trim()}
                    className="bg-orange-600 hover:bg-orange-500 shrink-0"
                  >
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-zinc-950 px-3 text-zinc-500">or explore first</span></div>
          </div>

          {/* Demo */}
          <Button
            onClick={handleStartDemo}
            disabled={loadingDemo}
            variant="outline"
            className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            {loadingDemo ? "Loading demo..." : "🎯 Try Demo — No API Key Needed"}
          </Button>
          <p className="text-xs text-zinc-500 text-center -mt-4">
            Explore with 24 sample memories from AI chats, notes, and articles
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Demo Mode Banner */}
      {demo && (
        <div className="flex items-center justify-between rounded-lg bg-violet-950/50 border border-violet-500/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">🎯</span>
            <span className="text-sm text-violet-200">
              <strong>Demo Mode</strong> — Exploring with sample data. Chat & AI features need an API key.
            </span>
          </div>
          <Button onClick={handleExitDemo} variant="ghost" size="sm" className="text-violet-300 hover:text-white hover:bg-violet-900/50 text-xs">
            Exit Demo
          </Button>
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold">Your Mind</h1>
        <p className="text-zinc-400 mt-1">
          {stats?.totalMemories ? `${stats.totalMemories.toLocaleString()} memories across ${stats.totalSources} sources` : "Import some knowledge to get started"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Memories", value: stats?.totalMemories || 0, icon: Database },
          { label: "ChatGPT", value: stats?.byType?.chatgpt || 0, icon: MessageCircle },
          { label: "Files & Notes", value: (stats?.byType?.file || 0) + (stats?.byType?.text || 0), icon: FileText },
          { label: "URLs", value: stats?.byType?.url || 0, icon: Globe },
        ].map((stat) => (
          <Card key={stat.label} className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <stat.icon className="w-5 h-5 text-zinc-500 mb-2" />
              <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
              <div className="text-sm text-zinc-500">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Link href="/app/import">
          <Card className="bg-zinc-900 border-zinc-800 hover:border-violet-500/30 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <Upload className="w-8 h-8 text-violet-400 mb-3" />
              <h3 className="font-medium mb-1">Import Knowledge</h3>
              <p className="text-sm text-zinc-500">ChatGPT exports, notes, files, URLs</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/app/chat">
          <Card className="bg-zinc-900 border-zinc-800 hover:border-violet-500/30 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <MessageSquare className="w-8 h-8 text-violet-400 mb-3" />
              <h3 className="font-medium mb-1">Ask Your Mind</h3>
              <p className="text-sm text-zinc-500">Query your knowledge in natural language</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/app/explore">
          <Card className="bg-zinc-900 border-zinc-800 hover:border-violet-500/30 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <Compass className="w-8 h-8 text-violet-400 mb-3" />
              <h3 className="font-medium mb-1">Explore</h3>
              <p className="text-sm text-zinc-500">Browse and discover your stored knowledge</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Innovation Features */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Link href="/app/fingerprint">
          <Card className="bg-gradient-to-br from-violet-950/50 to-zinc-900 border-violet-500/20 hover:border-violet-500/40 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6 flex items-start gap-4">
              <div className="text-3xl">🧬</div>
              <div>
                <h3 className="font-semibold mb-1">Knowledge Fingerprint</h3>
                <p className="text-sm text-zinc-400">3D visualization of your mind&apos;s topology. See clusters, connections, and blind spots.</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/app/insights">
          <Card className="bg-gradient-to-br from-fuchsia-950/50 to-zinc-900 border-fuchsia-500/20 hover:border-fuchsia-500/40 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6 flex items-start gap-4">
              <div className="text-3xl">⚡</div>
              <div>
                <h3 className="font-semibold mb-1">Mind Insights</h3>
                <p className="text-sm text-zinc-400">Cross-pollinations, contradictions, forgetting risks, and your knowledge metabolism score.</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Top Sources */}
      {stats?.topSources?.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Top Sources</h2>
          <div className="space-y-2">
            {stats.topSources.map((source: any) => (
              <div key={source.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-zinc-800/50">
                <div className="flex items-center gap-3">
                  {source.type === 'chatgpt' ? <MessageCircle className="w-4 h-4 text-green-400" /> :
                   source.type === 'file' ? <FileText className="w-4 h-4 text-blue-400" /> :
                   source.type === 'url' ? <Globe className="w-4 h-4 text-orange-400" /> :
                   <FileText className="w-4 h-4 text-zinc-400" />}
                  <span className="text-sm truncate max-w-md">{source.title}</span>
                </div>
                <span className="text-sm text-zinc-500">{source.itemCount} memories</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
