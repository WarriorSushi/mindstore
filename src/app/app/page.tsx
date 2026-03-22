"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Brain, Upload, MessageSquare, Compass, Database, FileText, Globe, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiKey, setApiKey, testApiKey } from "@/lib/openai";
import { isDemoMode, loadDemoData, clearDemoData } from "@/lib/demo";
import { toast } from "sonner";

async function fetchStats() {
  try {
    const res = await fetch('/api/v1/stats');
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export default function DashboardPage() {
  const [apiKey, setKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [testing, setTesting] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [demo, setDemo] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);

  useEffect(() => {
    setKey(getApiKey());
    setDemo(isDemoMode());
    fetchStats().then(setStats);
    setLoaded(true);
  }, []);

  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("demo") === "true" && !isDemoMode() && !getApiKey()) {
      handleStartDemo();
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

  const handleSetKey = async () => {
    if (!keyInput.trim()) return;
    setTesting(true);
    const valid = await testApiKey(keyInput.trim());
    setTesting(false);
    if (valid) {
      setApiKey(keyInput.trim());
      setKey(keyInput.trim());
      toast.success("API key verified and saved!");
    } else {
      toast.error("Invalid API key. Please check and try again.");
    }
  };

  if (!loaded) return null;

  // Setup wizard if no API key and not in demo mode
  if (!apiKey && !demo) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Card className="w-full max-w-lg bg-zinc-900 border-zinc-800">
          <CardHeader className="text-center">
            <Brain className="w-12 h-12 text-violet-400 mx-auto mb-4" />
            <CardTitle className="text-2xl">Welcome to Mindstore</CardTitle>
            <p className="text-zinc-400 mt-2">
              To get started, you&apos;ll need an OpenAI API key. Your key stays in your browser — we never see it.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">OpenAI API Key</label>
              <Input
                type="password"
                placeholder="sk-..."
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSetKey()}
                className="bg-zinc-800 border-zinc-700"
              />
              <p className="text-xs text-zinc-500">
                Get yours at{" "}
                <a href="https://platform.openai.com/api-keys" target="_blank" className="text-violet-400 hover:underline">
                  platform.openai.com/api-keys
                </a>
              </p>
            </div>
            <Button onClick={handleSetKey} disabled={testing || !keyInput.trim()} className="w-full bg-violet-600 hover:bg-violet-500">
              {testing ? "Verifying..." : "Save & Continue"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-zinc-900 px-2 text-zinc-500">or</span></div>
            </div>

            <Button
              onClick={handleStartDemo}
              disabled={loadingDemo}
              variant="outline"
              className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              {loadingDemo ? "Loading demo..." : "🎯 Try Demo — No API Key Needed"}
            </Button>
            <p className="text-xs text-zinc-500 text-center">
              Explore with 24 sample memories from AI chats, notes, and articles
            </p>
          </CardContent>
        </Card>
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
