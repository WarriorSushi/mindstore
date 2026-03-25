"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Copy, Check, ExternalLink, Brain, Terminal, Shield, Server, Puzzle, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { PageTransition, Stagger } from "@/components/PageTransition";

interface ConnectionConfig {
  name: string;
  icon: string;
  description: string;
  configSnippet: string;
  docsUrl: string;
  notes: string[];
}

interface ExtensionSetupResponse {
  product?: {
    extensionName?: string;
    extensionVersion?: string;
  };
  connection?: {
    baseUrl?: string;
    captureUrl?: string;
    queryUrl?: string;
    mcpUrl?: string;
    docsUrl?: string;
    downloadUrl?: string;
  };
}

const DEFAULT_API_ENDPOINT = "https://mindstore-sandy.vercel.app/api/mcp";

function subscribeToWindowLocation() {
  return () => {};
}

function getApiEndpointSnapshot() {
  if (typeof window === "undefined") {
    return DEFAULT_API_ENDPOINT;
  }

  return `${window.location.origin}/api/mcp`;
}

export default function ConnectPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const [stats, setStats] = useState({ memories: 0, sources: 0 });
  const [activeClient, setActiveClient] = useState("Browser Extension");
  const [setup, setSetup] = useState<ExtensionSetupResponse | null>(null);
  const apiEndpoint = useSyncExternalStore(
    subscribeToWindowLocation,
    getApiEndpointSnapshot,
    () => DEFAULT_API_ENDPOINT
  );

  useEffect(() => {
    async function loadPageData() {
      try {
        const [statsRes, setupRes] = await Promise.allSettled([
          fetch("/api/v1/stats"),
          fetch("/api/v1/extension/setup"),
        ]);

        if (statsRes.status === "fulfilled" && statsRes.value.ok) {
          const data = await statsRes.value.json();
          setStats({ memories: data.totalMemories || 0, sources: data.totalSources || 0 });
        }

        if (setupRes.status === "fulfilled" && setupRes.value.ok) {
          const data = (await setupRes.value.json()) as ExtensionSetupResponse;
          setSetup(data);
        }
      } catch {
        // Leave the default empty state in place if setup loading fails.
      }
    }

    void loadPageData();
  }, []);

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(null), 2000);
  }

  const mcpUrl = setup?.connection?.mcpUrl || apiEndpoint;
  const browserExtensionSnippet = [
    `Base URL: ${setup?.connection?.baseUrl || apiEndpoint.replace(/\/api\/mcp$/, "")}`,
    `Capture API: ${setup?.connection?.captureUrl || `${apiEndpoint.replace(/\/api\/mcp$/, "")}/api/v1/capture`}`,
    `Query API: ${setup?.connection?.queryUrl || `${apiEndpoint.replace(/\/api\/mcp$/, "")}/api/v1/capture/query`}`,
    `Extension ZIP: ${setup?.connection?.downloadUrl || `${apiEndpoint.replace(/\/api\/mcp$/, "")}/api/v1/extension/package`}`,
  ].join("\n");

  const remoteMcpConfig = `{
  "mcpServers": {
    "mindstore": {
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer <mindstore-api-key>"
      },
      "description": "MindStore personal knowledge layer"
    }
  }
}`;

  const localMcpConfig = `{
  "mcpServers": {
    "mindstore": {
      "url": "${mcpUrl}",
      "description": "MindStore personal knowledge layer"
    }
  }
}`;

  const clients: ConnectionConfig[] = [
    {
      name: "Browser Extension",
      icon: "🧩",
      description: "MindStore Everywhere captures pages, selections, and supported AI conversations from the browser.",
      configSnippet: browserExtensionSnippet,
      docsUrl: setup?.connection?.docsUrl || "/docs/getting-started/mindstore-everywhere",
      notes: [
        "Load the extension ZIP or unpacked folder in a Chromium browser.",
        "Paste your MindStore base URL into the popup, then use Test connection.",
        "Generate an API key in Settings for hosted or shared deployments.",
      ],
    },
    {
      name: "Cursor / VS Code",
      icon: "⚡",
      description: "Add MindStore as a remote MCP server in your editor so coding agents can search your memory layer.",
      configSnippet: remoteMcpConfig,
      docsUrl: "/docs/mcp/clients",
      notes: [
        "Keep the Authorization header for hosted or shared setups.",
        "If MindStore is local and single-user, you can omit the headers block.",
        "Restart the client after saving the MCP config.",
      ],
    },
    {
      name: "Claude / MCP Hosts",
      icon: "🤖",
      description: "Use the same remote MCP endpoint in Claude-compatible hosts that accept HTTP MCP servers.",
      configSnippet: remoteMcpConfig,
      docsUrl: "/docs/mcp/clients",
      notes: [
        "Some hosts use a UI instead of a JSON file. The key inputs are the URL and optional bearer token.",
        "MindStore exposes tools, resources, and plugin-provided prompts through the same endpoint.",
        "Use the hosted snippet unless you are on local single-user mode.",
      ],
    },
    {
      name: "OpenClaw",
      icon: "🦞",
      description: "Connect OpenClaw to the same personal knowledge layer so your agent can reason over saved memory.",
      configSnippet: remoteMcpConfig,
      docsUrl: "/docs/mcp/clients",
      notes: [
        "Use the remote MCP URL below in your OpenClaw server configuration.",
        "Hosted setups should pass a bearer API key header.",
        "Local single-user installs can use the header-free variant instead.",
      ],
    },
    {
      name: "Local Single-User",
      icon: "🏠",
      description: "Minimal MCP config for localhost or trusted single-user deployments where API keys are not needed.",
      configSnippet: localMcpConfig,
      docsUrl: "/docs/mcp/clients",
      notes: [
        "This is the fastest setup for a private localhost MindStore install.",
        "Do not use the header-free variant on hosted or shared deployments.",
        "If you later move MindStore behind a public URL, switch to the hosted config and generate an API key.",
      ],
    },
  ];

  const activeClientData = clients.find((client) => client.name === activeClient) ?? clients[0];

  return (
    <PageTransition className="space-y-5 md:space-y-6">
      <Stagger>
        <div>
          <h1 className="text-[22px] md:text-[28px] font-semibold tracking-[-0.03em]">Connect</h1>
          <p className="text-[13px] text-zinc-500 mt-0.5">Give every AI client the same MindStore memory layer</p>
        </div>
      </Stagger>

      <Stagger>
        <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-teal-500/[0.06] to-sky-500/[0.06] border border-teal-500/15 px-4 py-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0">
            <Brain className="w-4 h-4 text-teal-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium">Your Mind Layer</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {stats.memories > 0
                ? `${stats.memories.toLocaleString()} memories from ${stats.sources} sources are ready for browser capture and MCP clients`
                : "Import some knowledge first, then connect the extension or an MCP-compatible client"}
            </p>
          </div>
          <span
            className={`text-[9px] font-bold uppercase tracking-[0.08em] px-2 py-[3px] rounded-md border shrink-0 ${
              stats.memories > 0
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/15"
                : "bg-zinc-500/10 text-zinc-400 border-zinc-500/15"
            }`}
          >
            {stats.memories > 0 ? "Ready" : "Empty"}
          </span>
        </div>
      </Stagger>

      <Stagger>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <KeyRound className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <p className="text-[13px] font-medium">Hosted or shared deployment?</p>
              <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                Generate an API key in Settings and keep the <code>Authorization</code> header in your browser extension or MCP config. Local single-user installs can omit it.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/app/settings"
              className="inline-flex items-center h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[12px] font-medium transition-all"
            >
              Open Settings
            </Link>
            <a
              href={setup?.connection?.downloadUrl || "/api/v1/extension/package"}
              className="inline-flex items-center h-10 px-4 rounded-xl border border-white/[0.08] text-[12px] font-medium text-zinc-300 hover:bg-white/[0.04]"
            >
              Download Extension
            </a>
          </div>
        </div>
      </Stagger>

      <Stagger>
        <div className="space-y-2.5">
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em] px-1">How it works</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              {
                icon: Puzzle,
                title: "Capture Everywhere",
                desc: "MindStore Everywhere saves pages, selections, and supported AI conversations without leaving the current tab.",
                color: "text-teal-400",
              },
              {
                icon: Server,
                title: "One MCP Endpoint",
                desc: "The same /api/mcp endpoint exposes core tools plus plugin-provided tools, resources, and prompts.",
                color: "text-blue-400",
              },
              {
                icon: Shield,
                title: "Your Access Rules",
                desc: "Use API keys for hosted or shared deployments, and keep local single-user setups fast and simple.",
                color: "text-amber-400",
              },
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

      <Stagger>
        <div className="space-y-2.5">
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em] px-1">Connect a surface</p>

          <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 pb-0.5">
            {clients.map((client) => (
              <button
                key={client.name}
                onClick={() => setActiveClient(client.name)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-[6px] rounded-full text-[12px] font-medium transition-all active:scale-[0.95] ${
                  activeClient === client.name
                    ? "bg-teal-500/15 text-teal-300 border border-teal-500/25 shadow-sm shadow-teal-500/10"
                    : "text-zinc-500 border border-white/[0.06] hover:bg-white/[0.04]"
                }`}
              >
                <span className="text-[13px]">{client.icon}</span>
                <span>{client.name}</span>
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="px-4 md:px-5 pt-4 md:pt-5 pb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl leading-none">{activeClientData.icon}</span>
                  <h3 className="text-[15px] font-semibold">{activeClientData.name}</h3>
                </div>
                <p className="text-[12px] text-zinc-500 mt-1">{activeClientData.description}</p>
              </div>
              <a
                href={activeClientData.docsUrl}
                target={activeClientData.docsUrl.startsWith("http") ? "_blank" : undefined}
                rel={activeClientData.docsUrl.startsWith("http") ? "noopener noreferrer" : undefined}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors shrink-0"
              >
                <ExternalLink className="w-3 h-3" />
                Docs
              </a>
            </div>

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
                    <>
                      <Check className="w-3 h-3 text-emerald-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Copy
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 space-y-2">
                {activeClientData.notes.map((note) => (
                  <p key={note} className="text-[11px] text-zinc-500 leading-relaxed">
                    {note}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Stagger>

      <Stagger>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-zinc-500" />
            <p className="text-[13px] font-medium">Remote MCP endpoint</p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white/[0.04] border border-white/[0.06] px-3.5 py-2.5 rounded-xl text-[12px] font-mono text-zinc-300 overflow-x-auto">
              {mcpUrl}
            </code>
            <button
              onClick={() => copyToClipboard(mcpUrl, "endpoint")}
              className="h-9 w-9 rounded-xl border border-white/[0.06] flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all active:scale-[0.95] shrink-0"
            >
              {copied === "endpoint" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[11px] text-zinc-600 leading-relaxed">
            This endpoint is plugin-driven, so installed plugins can extend the same MCP surface with extra tools, resources, prompts, widgets, and jobs over time.
          </p>
        </div>
      </Stagger>
    </PageTransition>
  );
}
