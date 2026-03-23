"use client";

import { useState, useEffect } from "react";
import { Plug, Copy, Check, ExternalLink, Brain, Terminal, Shield, Zap, Server } from "lucide-react";
import { toast } from "sonner";
import { PageTransition, Stagger } from "@/components/PageTransition";

interface ConnectionConfig {
  name: string;
  icon: string;
  description: string;
  configSnippet: string;
  docsUrl: string;
  supported: boolean;
}

export default function ConnectPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const [stats, setStats] = useState({ memories: 0, sources: 0 });
  const [apiEndpoint, setApiEndpoint] = useState("");
  const [activeClient, setActiveClient] = useState("Claude Desktop");

  useEffect(() => {
    loadStats();
    setApiEndpoint(typeof window !== "undefined" ? `${window.location.origin}/api/mcp` : "https://mindstore-sandy.vercel.app/api/mcp");
  }, []);

  async function loadStats() {
    try {
      const res = await fetch('/api/v1/stats');
      const data = await res.json();
      setStats({ memories: data.totalMemories || 0, sources: data.totalSources || 0 });
    } catch { /* ignore */ }
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(null), 2000);
  }

  const mcpConfig = `{
  "mcpServers": {
    "mindstore": {
      "url": "${apiEndpoint || "https://mindstore-sandy.vercel.app/api/mcp"}",
      "description": "Your personal MindStore — searchable knowledge from your conversations, notes, and documents"
    }
  }
}`;

  const claudeDesktopConfig = `{
  "mcpServers": {
    "mindstore": {
      "command": "npx",
      "args": ["mindstore-mcp"],
      "env": {
        "MINDSTORE_URL": "${apiEndpoint || "https://mindstore-sandy.vercel.app/api/mcp"}"
      }
    }
  }
}`;

  const clients: ConnectionConfig[] = [
    {
      name: "Claude Desktop",
      icon: "🤖",
      description: "Add MindStore to Claude Desktop via MCP config",
      configSnippet: claudeDesktopConfig,
      docsUrl: "https://modelcontextprotocol.io/quickstart/user",
      supported: true,
    },
    {
      name: "ChatGPT",
      icon: "💬",
      description: "Connect via browser extension (coming soon)",
      configSnippet: "# Browser extension coming soon\n# Will inject MindStore context into ChatGPT automatically",
      docsUrl: "#",
      supported: false,
    },
    {
      name: "Cursor / VS Code",
      icon: "⚡",
      description: "Add to your editor's MCP configuration",
      configSnippet: mcpConfig,
      docsUrl: "https://docs.cursor.com/context/model-context-protocol",
      supported: true,
    },
    {
      name: "OpenClaw",
      icon: "🦞",
      description: "Connect your mind to your OpenClaw agent",
      configSnippet: mcpConfig,
      docsUrl: "https://openclaw.dev",
      supported: true,
    },
  ];

  const activeClientData = clients.find(c => c.name === activeClient)!;

  return (
    <PageTransition className="space-y-5 md:space-y-6">
      {/* Header */}
      <Stagger>
        <div>
          <h1 className="text-[22px] md:text-[28px] font-semibold tracking-[-0.03em]">Connect</h1>
          <p className="text-[13px] text-zinc-500 mt-0.5">Give any AI access to your knowledge via MCP</p>
        </div>
      </Stagger>

      {/* Status Banner */}
      <Stagger>
      <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-violet-500/[0.06] to-fuchsia-500/[0.06] border border-violet-500/15 px-4 py-3">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
          <Brain className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium">Your Mind Layer</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {stats.memories > 0
              ? `${stats.memories.toLocaleString()} memories from ${stats.sources} sources — ready to connect`
              : "Import some knowledge first to connect your mind to AI"}
          </p>
        </div>
        <span className={`text-[9px] font-bold uppercase tracking-[0.08em] px-2 py-[3px] rounded-md border shrink-0 ${
          stats.memories > 0
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/15"
            : "bg-zinc-500/10 text-zinc-400 border-zinc-500/15"
        }`}>
          {stats.memories > 0 ? "Ready" : "Empty"}
        </span>
      </div>
      </Stagger>

      {/* How it Works */}
      <Stagger>
      <div className="space-y-2.5">
        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em] px-1">How it works</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { icon: Server, title: "MCP Protocol", desc: "MindStore exposes your knowledge as an MCP server that any compatible AI can query", color: "text-violet-400" },
            { icon: Shield, title: "You Control Access", desc: "Only AI clients you explicitly configure get access. Revoke anytime.", color: "text-blue-400" },
            { icon: Zap, title: "Instant Context", desc: "AI gets relevant context from YOUR knowledge — not generic training data", color: "text-amber-400" },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2.5">
              <item.icon className={`w-4 h-4 ${item.color}`} />
              <div>
                <p className="text-[13px] font-medium">{item.title}</p>
                <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      </Stagger>

      {/* Client Configs */}
      <Stagger>
      <div className="space-y-2.5">
        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em] px-1">Connect to an AI</p>

        {/* Client Selector Tabs */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 pb-0.5">
          {clients.map((c) => (
            <button
              key={c.name}
              onClick={() => setActiveClient(c.name)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-[6px] rounded-full text-[12px] font-medium transition-all active:scale-[0.95] ${
                activeClient === c.name
                  ? "bg-violet-500/15 text-violet-300 border border-violet-500/25 shadow-sm shadow-violet-500/10"
                  : "text-zinc-500 border border-white/[0.06] hover:bg-white/[0.04]"
              }`}
            >
              <span className="text-[13px]">{c.icon}</span>
              <span className="hidden sm:inline">{c.name}</span>
              <span className="sm:hidden">{c.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* Active Client Card */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          {/* Client Header */}
          <div className="px-4 md:px-5 pt-4 md:pt-5 pb-3 flex items-start justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="text-xl leading-none">{activeClientData.icon}</span>
                <h3 className="text-[15px] font-semibold">{activeClientData.name}</h3>
                {!activeClientData.supported && (
                  <span className="text-[9px] font-bold uppercase tracking-[0.08em] px-1.5 py-[2px] rounded-md bg-zinc-500/10 text-zinc-400 border border-zinc-500/15">
                    Coming Soon
                  </span>
                )}
              </div>
              <p className="text-[12px] text-zinc-500 mt-1">{activeClientData.description}</p>
            </div>
            {activeClientData.docsUrl !== "#" && (
              <a
                href={activeClientData.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors shrink-0"
              >
                <ExternalLink className="w-3 h-3" />
                Docs
              </a>
            )}
          </div>

          {/* Config Snippet */}
          <div className="px-4 md:px-5 pb-4 md:pb-5 space-y-3">
            <div className="relative">
              <pre className="bg-black/40 text-emerald-400 text-[11px] md:text-[12px] p-4 rounded-xl overflow-x-auto font-mono leading-relaxed border border-white/[0.04]">
                {activeClientData.configSnippet}
              </pre>
              <button
                onClick={() => copyToClipboard(activeClientData.configSnippet, activeClientData.name)}
                className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-zinc-200 transition-all active:scale-[0.95]"
              >
                {copied === activeClientData.name ? (
                  <><Check className="w-3 h-3 text-emerald-400" /> Copied</>
                ) : (
                  <><Copy className="w-3 h-3" /> Copy</>
                )}
              </button>
            </div>

            {activeClientData.supported && (
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <Terminal className="w-3.5 h-3.5 text-zinc-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Paste this into your {activeClientData.name} MCP configuration file, then restart the app. 
                  The AI will automatically have access to search your MindStore knowledge.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* API Endpoint */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-zinc-500" />
          <p className="text-[13px] font-medium">API Endpoint</p>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-white/[0.04] border border-white/[0.06] px-3.5 py-2.5 rounded-xl text-[12px] font-mono text-zinc-300 overflow-x-auto">
            {apiEndpoint || "https://mindstore-sandy.vercel.app/api/mcp"}
          </code>
          <button
            onClick={() => copyToClipboard(apiEndpoint || "https://mindstore-sandy.vercel.app/api/mcp", "endpoint")}
            className="h-9 w-9 rounded-xl border border-white/[0.06] flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all active:scale-[0.95] shrink-0"
          >
            {copied === "endpoint" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className="text-[11px] text-zinc-600 leading-relaxed">
          Use this endpoint for any MCP-compatible client not listed above, or for building custom integrations.
        </p>
      </div>
    </Stagger>
    </PageTransition>
  );
}
