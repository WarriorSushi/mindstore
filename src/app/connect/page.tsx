'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function ConnectPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const claudeConfig = JSON.stringify({
    "mcpServers": {
      "mindstore": {
        "command": "npx",
        "args": ["mindstore-mcp"],
        "env": {
          "MINDSTORE_DB_PATH": "~/mindstore/data/mindstore.db"
        }
      }
    }
  }, null, 2);

  const vscodeConfig = JSON.stringify({
    "mcp": {
      "servers": {
        "mindstore": {
          "command": "npx",
          "args": ["mindstore-mcp"]
        }
      }
    }
  }, null, 2);

  const cursorConfig = JSON.stringify({
    "mcpServers": {
      "mindstore": {
        "command": "npx",
        "args": ["mindstore-mcp"]
      }
    }
  }, null, 2);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <nav className="border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-sm font-bold">M</div>
              <span className="text-lg font-semibold tracking-tight">MindStore</span>
            </Link>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/50">
            <Link href="/" className="hover:text-white/90 transition">Dashboard</Link>
            <Link href="/import" className="hover:text-white/90 transition">Import</Link>
            <Link href="/chat" className="hover:text-white/90 transition">Chat</Link>
            <Link href="/connect" className="text-white/90">Connect</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Connect Your AI</h1>
        <p className="text-white/40 mb-10">
          MindStore exposes an MCP server that any AI client can connect to. 
          Your AI gets full context about you — without you repeating yourself.
        </p>

        {/* How It Works */}
        <div className="bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5 border border-white/5 rounded-2xl p-8 mb-12">
          <h2 className="text-xl font-semibold mb-4">How MCP Works</h2>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div>
              <div className="text-2xl mb-2">1️⃣</div>
              <div className="font-medium mb-1">You import knowledge</div>
              <div className="text-white/40">Obsidian, Notion, ChatGPT exports, or just type it in</div>
            </div>
            <div>
              <div className="text-2xl mb-2">2️⃣</div>
              <div className="font-medium mb-1">MindStore indexes it</div>
              <div className="text-white/40">Semantic chunking, embeddings, knowledge graph — your mind, organized</div>
            </div>
            <div>
              <div className="text-2xl mb-2">3️⃣</div>
              <div className="font-medium mb-1">Any AI can query it</div>
              <div className="text-white/40">Via MCP protocol — Claude, ChatGPT, VS Code, Cursor, any MCP client</div>
            </div>
          </div>
        </div>

        {/* Connection Configs */}
        <div className="space-y-8">
          <ConfigBlock
            title="Claude Desktop"
            icon="🟣"
            description="Add to ~/Library/Application Support/Claude/claude_desktop_config.json (macOS) or %APPDATA%/Claude/claude_desktop_config.json (Windows)"
            config={claudeConfig}
            id="claude"
            copied={copied}
            onCopy={copyToClipboard}
          />
          <ConfigBlock
            title="VS Code / GitHub Copilot"
            icon="💻"
            description="Add to your VS Code settings.json"
            config={vscodeConfig}
            id="vscode"
            copied={copied}
            onCopy={copyToClipboard}
          />
          <ConfigBlock
            title="Cursor"
            icon="⚡"
            description="Add to ~/.cursor/mcp.json"
            config={cursorConfig}
            id="cursor"
            copied={copied}
            onCopy={copyToClipboard}
          />

          {/* API Access */}
          <div className="border border-white/5 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🔑</span>
              <h3 className="text-lg font-semibold">REST API</h3>
            </div>
            <p className="text-sm text-white/40 mb-4">
              MindStore also exposes a REST API for direct integration with any application.
            </p>
            <div className="bg-black/40 rounded-xl p-4 font-mono text-sm text-white/70 space-y-2">
              <div><span className="text-emerald-400">GET</span> /api/search?q=your+query</div>
              <div><span className="text-emerald-400">GET</span> /api/profile</div>
              <div><span className="text-emerald-400">GET</span> /api/stats</div>
              <div><span className="text-blue-400">POST</span> /api/import</div>
              <div><span className="text-blue-400">POST</span> /api/profile</div>
              <div><span className="text-blue-400">POST</span> /api/chat</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ConfigBlock({ title, icon, description, config, id, copied, onCopy }: {
  title: string; icon: string; description: string; config: string; 
  id: string; copied: string | null; onCopy: (text: string, id: string) => void;
}) {
  return (
    <div className="border border-white/5 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{icon}</span>
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-white/40 mb-4">{description}</p>
      <div className="relative">
        <pre className="bg-black/40 rounded-xl p-4 font-mono text-sm text-white/70 overflow-x-auto">
          {config}
        </pre>
        <button
          onClick={() => onCopy(config, id)}
          className="absolute top-3 right-3 bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg text-xs transition"
        >
          {copied === id ? '✅ Copied' : '📋 Copy'}
        </button>
      </div>
    </div>
  );
}
