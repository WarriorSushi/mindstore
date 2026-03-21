'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Stats {
  documents: number;
  chunks: number;
  facts: number;
  profileItems: number;
  conversations: number;
  sources: Array<{ source_type: string; count: number }>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-sm font-bold">
              M
            </div>
            <span className="text-lg font-semibold tracking-tight">MindStore</span>
            <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full">beta</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/50">
            <Link href="/" className="text-white/90">Dashboard</Link>
            <Link href="/import" className="hover:text-white/90 transition">Import</Link>
            <Link href="/chat" className="hover:text-white/90 transition">Chat</Link>
            <Link href="/connect" className="hover:text-white/90 transition">Connect</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="mb-16">
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Your Mind,{' '}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              Connected
            </span>
          </h1>
          <p className="text-white/50 text-lg max-w-2xl">
            Import your knowledge from anywhere. Connect it to any AI. 
            MindStore is the memory layer between you and every AI you use.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          <StatCard label="Documents" value={stats?.documents || 0} icon="📄" />
          <StatCard label="Knowledge Chunks" value={stats?.chunks || 0} icon="🧠" />
          <StatCard label="Facts Learned" value={stats?.facts || 0} icon="💡" />
          <StatCard label="Profile Items" value={stats?.profileItems || 0} icon="👤" />
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <ActionCard
            href="/import"
            title="Import Knowledge"
            description="Upload your Obsidian vault, Notion export, ChatGPT conversations, or any text files."
            icon="📥"
            gradient="from-violet-500/20 to-violet-500/5"
          />
          <ActionCard
            href="/chat"
            title="Teach Your Mind"
            description="Talk to AI that learns about you. Answer questions. Build your profile."
            icon="💬"
            gradient="from-fuchsia-500/20 to-fuchsia-500/5"
          />
          <ActionCard
            href="/connect"
            title="Connect AI"
            description="Set up MCP server to connect MindStore with ChatGPT, Claude, VS Code, Cursor."
            icon="🔗"
            gradient="from-cyan-500/20 to-cyan-500/5"
          />
        </div>

        {/* Sources */}
        {stats?.sources && stats.sources.length > 0 && (
          <div className="mb-16">
            <h2 className="text-xl font-semibold mb-6">Knowledge Sources</h2>
            <div className="flex gap-3 flex-wrap">
              {stats.sources.map(s => (
                <div key={s.source_type} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className="text-lg">{sourceIcon(s.source_type)}</span>
                  <div>
                    <div className="text-sm font-medium capitalize">{s.source_type}</div>
                    <div className="text-xs text-white/40">{s.count} documents</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!stats || stats.documents === 0) && (
          <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl">
            <div className="text-6xl mb-6">🧠</div>
            <h2 className="text-2xl font-bold mb-3">Your MindStore is empty</h2>
            <p className="text-white/40 mb-8 max-w-md mx-auto">
              Start by importing your knowledge — Obsidian notes, Notion pages, 
              ChatGPT conversations, or any text files.
            </p>
            <Link
              href="/import"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 transition"
            >
              📥 Import Your First Knowledge
            </Link>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-8 mt-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-white/30">
          <span>MindStore — Your personal mind layer</span>
          <span>Built by AltCorp</span>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition">
      <div className="flex items-center justify-between mb-4">
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-3xl font-bold tabular-nums">{value.toLocaleString()}</div>
      <div className="text-sm text-white/40 mt-1">{label}</div>
    </div>
  );
}

function ActionCard({ href, title, description, icon, gradient }: {
  href: string; title: string; description: string; icon: string; gradient: string;
}) {
  return (
    <Link href={href} className="group block">
      <div className={`bg-gradient-to-br ${gradient} border border-white/5 rounded-2xl p-6 hover:border-white/15 transition h-full`}>
        <div className="text-3xl mb-4">{icon}</div>
        <h3 className="text-lg font-semibold mb-2 group-hover:text-white transition">{title}</h3>
        <p className="text-sm text-white/40 leading-relaxed">{description}</p>
      </div>
    </Link>
  );
}

function sourceIcon(type: string): string {
  const icons: Record<string, string> = {
    obsidian: '💎',
    notion: '📝',
    chatgpt: '🤖',
    claude: '🟣',
    text: '📄',
    manual: '✍️',
  };
  return icons[type] || '📄';
}
