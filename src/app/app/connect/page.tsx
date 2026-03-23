"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plug, Copy, Check, ExternalLink, Brain, Terminal, Shield, Zap, Server } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Plug className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Connect Your Mind</h1>
            <p className="text-muted-foreground text-sm">
              Give any AI access to your knowledge via MCP
            </p>
          </div>
        </div>
      </motion.div>

      {/* Status Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Brain className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">Your Mind Layer</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.memories > 0
                      ? `${stats.memories.toLocaleString()} memories from ${stats.sources} sources — ready to connect`
                      : "Import some knowledge first to connect your mind to AI"}
                  </p>
                </div>
              </div>
              <Badge variant={stats.memories > 0 ? "default" : "secondary"}>
                {stats.memories > 0 ? "Ready" : "Empty"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* How it Works */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="space-y-4"
      >
        <h2 className="text-lg font-semibold">How it works</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: Server, title: "MCP Protocol", desc: "MindStore exposes your knowledge as an MCP server that any compatible AI can query" },
            { icon: Shield, title: "You Control Access", desc: "Only AI clients you explicitly configure get access. Revoke anytime." },
            { icon: Zap, title: "Instant Context", desc: "AI gets relevant context from YOUR knowledge — not generic training data" },
          ].map((item, i) => (
            <Card key={i} className="bg-card/50">
              <CardContent className="p-4 space-y-2">
                <item.icon className="w-5 h-5 text-primary" />
                <h3 className="font-medium text-sm">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Client Configs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        <h2 className="text-lg font-semibold">Connect to an AI</h2>
        <Tabs defaultValue="Claude Desktop" className="space-y-4">
          <TabsList className="w-full justify-start">
            {clients.map((c) => (
              <TabsTrigger key={c.name} value={c.name} className="gap-2">
                <span>{c.icon}</span>
                <span className="hidden sm:inline">{c.name}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {clients.map((client) => (
            <TabsContent key={client.name} value={client.name}>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="text-xl">{client.icon}</span>
                        {client.name}
                        {!client.supported && (
                          <Badge variant="secondary" className="text-[10px]">Coming Soon</Badge>
                        )}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{client.description}</p>
                    </div>
                    {client.docsUrl !== "#" && (
                      <a href={client.docsUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="gap-1.5">
                          <ExternalLink className="w-3.5 h-3.5" />
                          Docs
                        </Button>
                      </a>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="relative">
                    <pre className="bg-black/80 text-green-400 text-xs p-4 rounded-lg overflow-x-auto font-mono leading-relaxed">
                      {client.configSnippet}
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 h-7 gap-1.5"
                      onClick={() => copyToClipboard(client.configSnippet, client.name)}
                    >
                      {copied === client.name ? (
                        <><Check className="w-3 h-3" /> Copied</>
                      ) : (
                        <><Copy className="w-3 h-3" /> Copy</>
                      )}
                    </Button>
                  </div>
                  {client.supported && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                      <Terminal className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <p>
                        Paste this into your {client.name} MCP configuration file, then restart the app. 
                        The AI will automatically have access to search your MindStore knowledge.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </motion.div>

      {/* API Endpoint */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card className="bg-card/50">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              API Endpoint
            </h3>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded text-xs font-mono">
                {apiEndpoint || "https://mindstore-sandy.vercel.app/api/mcp"}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(apiEndpoint || "https://mindstore-sandy.vercel.app/api/mcp", "endpoint")}
              >
                {copied === "endpoint" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Use this endpoint for any MCP-compatible client not listed above, or for building custom integrations.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
