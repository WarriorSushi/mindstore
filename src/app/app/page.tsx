"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Brain, Upload, MessageSquare, Compass, Database, FileText,
  Globe, MessageCircle, Sparkles, Key, Server, ExternalLink,
  Loader2, GraduationCap, Lightbulb, Network, Fingerprint,
  ChevronRight, ArrowRight,
} from "lucide-react";
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

  // ─── Setup Wizard ───
  if (!hasKey && !demo) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-full max-w-md space-y-5">
          <div className="text-center space-y-2">
            <Brain className="w-12 h-12 text-violet-400 mx-auto" />
            <h1 className="text-2xl font-bold">Welcome to MindStore</h1>
            <p className="text-zinc-400 text-sm">
              Connect an AI provider to power search & chat.
            </p>
          </div>

          {/* Provider Tabs */}
          <div className="flex gap-2">
            {[
              { id: "gemini" as SetupTab, label: "Gemini", sub: "Free", icon: Sparkles, color: "blue" },
              { id: "openai" as SetupTab, label: "OpenAI", sub: "Paid", icon: Key, color: "emerald" },
              { id: "ollama" as SetupTab, label: "Ollama", sub: "Local", icon: Server, color: "orange" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => { setSetupTab(p.id); setKeyInput(""); }}
                className={`flex-1 rounded-xl border px-3 py-2.5 text-left transition-all ${
                  setupTab === p.id
                    ? `border-${p.color}-500/50 bg-${p.color}-500/10`
                    : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <p.icon className={`w-3.5 h-3.5 ${setupTab === p.id ? `text-${p.color}-400` : "text-zinc-500"}`} />
                  <span className="text-xs font-medium">{p.label}</span>
                </div>
                <span className={`text-[10px] ${setupTab === p.id ? `text-${p.color}-400` : "text-zinc-600"}`}>{p.sub}</span>
              </button>
            ))}
          </div>

          {/* Provider Forms */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-4">
            {setupTab === "gemini" && (
              <>
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
                  <Sparkles className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <p className="text-blue-200 font-medium">Completely Free</p>
                    <p className="text-zinc-400 mt-0.5">No credit card. 30 seconds.</p>
                  </div>
                </div>
                <ol className="space-y-2 text-xs text-zinc-400">
                  <li className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center text-[10px] font-bold text-blue-400 shrink-0">1</span>
                    Go to{" "}
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-blue-400 font-medium">
                      Google AI Studio <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center text-[10px] font-bold text-blue-400 shrink-0">2</span>
                    Create API key → copy
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center text-[10px] font-bold text-blue-400 shrink-0">3</span>
                    Paste below
                  </li>
                </ol>
              </>
            )}
            {setupTab === "openai" && (
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                <Key className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <p className="text-emerald-200 font-medium">OpenAI API Key</p>
                  <p className="text-zinc-400 mt-0.5">
                    ~$0.01/10 queries.{" "}
                    <a href="https://platform.openai.com/api-keys" target="_blank" className="text-emerald-400">Get key →</a>
                  </p>
                </div>
              </div>
            )}
            {setupTab === "ollama" && (
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-orange-500/5 border border-orange-500/10">
                <Server className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <p className="text-orange-200 font-medium">100% Local & Private</p>
                  <p className="text-zinc-400 mt-0.5">
                    Install <a href="https://ollama.ai" target="_blank" className="text-orange-400">Ollama</a>, then <code className="bg-zinc-800 px-1 rounded text-[10px]">ollama pull nomic-embed-text</code>
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {setupTab === "ollama" ? (
                <Input
                  placeholder="http://localhost:11434"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveProvider("ollama")}
                  className="bg-zinc-800 border-zinc-700 font-mono text-sm h-10"
                />
              ) : (
                <Input
                  type="password"
                  placeholder={setupTab === "gemini" ? "AIza..." : "sk-..."}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveProvider(setupTab)}
                  className="bg-zinc-800 border-zinc-700 font-mono text-sm h-10"
                />
              )}
              <Button
                onClick={() => handleSaveProvider(setupTab)}
                disabled={testing || (setupTab === "ollama" ? !ollamaUrl.trim() : !keyInput.trim())}
                className={`shrink-0 h-10 ${
                  setupTab === "gemini" ? "bg-blue-600 hover:bg-blue-500" :
                  setupTab === "openai" ? "bg-emerald-600 hover:bg-emerald-500" :
                  "bg-orange-600 hover:bg-orange-500"
                }`}
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800" /></div>
            <div className="relative flex justify-center text-[10px]"><span className="bg-zinc-950 px-3 text-zinc-500">or explore first</span></div>
          </div>

          <Button
            onClick={handleStartDemo}
            disabled={loadingDemo}
            variant="outline"
            className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-10"
          >
            {loadingDemo ? "Loading demo..." : "🎯 Try Demo — No API Key Needed"}
          </Button>
        </div>
      </div>
    );
  }

  // ─── Main Dashboard ───
  const totalMemories = stats?.totalMemories || 0;

  return (
    <div className="space-y-6">
      {/* Demo Banner */}
      {demo && (
        <div className="flex items-center justify-between rounded-xl bg-violet-950/50 border border-violet-500/30 px-3 py-2.5">
          <span className="text-xs text-violet-200">
            🎯 <strong>Demo</strong> — exploring sample data
          </span>
          <Button onClick={handleExitDemo} variant="ghost" size="sm" className="text-violet-300 hover:text-white text-[11px] h-7 px-2">
            Exit
          </Button>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Your Mind</h1>
        <p className="text-zinc-400 text-sm mt-0.5">
          {totalMemories > 0
            ? `${totalMemories.toLocaleString()} memories · ${stats?.totalSources || 0} sources`
            : "Import knowledge to get started"}
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-2 md:gap-4">
        {[
          { label: "Memories", value: totalMemories, icon: Database, color: "text-violet-400" },
          { label: "ChatGPT", value: stats?.byType?.chatgpt || 0, icon: MessageCircle, color: "text-green-400" },
          { label: "Notes", value: (stats?.byType?.file || 0) + (stats?.byType?.text || 0), icon: FileText, color: "text-blue-400" },
          { label: "URLs", value: stats?.byType?.url || 0, icon: Globe, color: "text-orange-400" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 md:p-4">
            <stat.icon className={`w-4 h-4 ${stat.color} mb-1.5`} />
            <div className="text-lg md:text-2xl font-bold tabular-nums">{stat.value.toLocaleString()}</div>
            <div className="text-[11px] text-zinc-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-400 px-0.5">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { href: "/app/import", icon: Upload, label: "Import", desc: "Add knowledge", color: "violet" },
            { href: "/app/chat", icon: MessageSquare, label: "Chat", desc: "Ask your mind", color: "blue" },
            { href: "/app/explore", icon: Compass, label: "Explore", desc: "Browse all", color: "emerald" },
            { href: "/app/learn", icon: GraduationCap, label: "Learn", desc: "Teach MindStore", color: "amber" },
          ].map((action) => (
            <Link key={action.href} href={action.href}>
              <div className="group rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-violet-500/20 transition-all p-3 md:p-4 h-full">
                <action.icon className="w-5 h-5 text-violet-400 mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-medium">{action.label}</p>
                <p className="text-[11px] text-zinc-500">{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-400 px-0.5">Discover</h2>
        <div className="space-y-1.5">
          {[
            { href: "/app/fingerprint", icon: "🧬", label: "Knowledge Fingerprint", desc: "3D map of your mind", badge: "WebGL" },
            { href: "/app/insights", icon: "⚡", label: "Mind Insights", desc: "Connections, contradictions, metabolism" },
            { href: "/app/connect", icon: "🔌", label: "Connect AI", desc: "Use with Claude, Cursor, etc.", badge: "MCP" },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-violet-500/20 transition-all p-3 group">
                <span className="text-xl">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{item.label}</p>
                    {item.badge && (
                      <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500">{item.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Top Sources */}
      {stats?.topSources?.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-400 px-0.5">Recent Sources</h2>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04] overflow-hidden">
            {stats.topSources.slice(0, 5).map((source: any) => (
              <div key={source.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                  {source.type === 'chatgpt' ? <MessageCircle className="w-3.5 h-3.5 text-green-400" /> :
                   source.type === 'file' ? <FileText className="w-3.5 h-3.5 text-blue-400" /> :
                   source.type === 'url' ? <Globe className="w-3.5 h-3.5 text-orange-400" /> :
                   <FileText className="w-3.5 h-3.5 text-zinc-400" />}
                </div>
                <span className="text-sm truncate flex-1 min-w-0">{source.title}</span>
                <span className="text-[11px] text-zinc-500 tabular-nums shrink-0">{source.itemCount}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
