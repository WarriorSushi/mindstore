"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Upload, MessageSquare, Compass, Database, FileText, Clock, AlertCircle, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getApiKey, setApiKey, testApiKey } from "@/lib/openai";
import { getStats, db } from "@/lib/db";
import type { Source } from "@/lib/db";

export default function DashboardPage() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [testing, setTesting] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [stats, setStats] = useState({ totalMemories: 0, totalSources: 0, sourceTypes: 0, lastActivity: undefined as Date | undefined });
  const [recentSources, setRecentSources] = useState<Source[]>([]);

  useEffect(() => {
    setHasKey(!!getApiKey());
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const s = await getStats();
      setStats(s);
      const sources = await db.sources.orderBy('importedAt').reverse().limit(5).toArray();
      setRecentSources(sources);
    } catch { /* db not ready */ }
  }

  async function handleSaveKey() {
    setTesting(true);
    setKeyError("");
    const valid = await testApiKey(keyInput);
    if (valid) {
      setApiKey(keyInput);
      setHasKey(true);
    } else {
      setKeyError("Invalid API key. Please check and try again.");
    }
    setTesting(false);
  }

  if (hasKey === null) return null;

  if (!hasKey) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <motion.div
          className="max-w-md w-full space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">Welcome to Mindstore</h1>
            <p className="text-muted-foreground text-sm">To get started, enter your OpenAI API key. It&apos;s stored locally in your browser and used only for embeddings and chat.</p>
          </div>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <Input
                type="password"
                placeholder="sk-..."
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
              />
              {keyError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {keyError}
                </p>
              )}
              <Button onClick={handleSaveKey} disabled={!keyInput || testing} className="w-full">
                {testing ? "Verifying..." : "Save & Continue"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Get your key at{" "}
                <a href="https://platform.openai.com/api-keys" target="_blank" className="underline">
                  platform.openai.com
                </a>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Your personal knowledge base at a glance.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Memories", value: stats.totalMemories, icon: Database },
          { label: "Sources", value: stats.totalSources, icon: FileText },
          { label: "Source Types", value: stats.sourceTypes, icon: Compass },
          { label: "Last Import", value: stats.lastActivity ? new Date(stats.lastActivity).toLocaleDateString() : "Never", icon: Clock },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold mt-1">{s.value}</p>
                </div>
                <s.icon className="w-5 h-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { href: "/app/import", icon: Upload, label: "Import Knowledge", desc: "Add ChatGPT exports, text, or files" },
          { href: "/app/learn", icon: Sparkles, label: "Teach MindStore", desc: "AI interviews you to learn who you are" },
          { href: "/app/chat", icon: MessageSquare, label: "Ask Your Brain", desc: "Chat with your personal knowledge" },
          { href: "/app/explore", icon: Compass, label: "Browse Memories", desc: "Explore and search your knowledge" },
        ].map((action) => (
          <Link key={action.href} href={action.href}>
            <Card className="hover:bg-muted/30 transition-colors cursor-pointer h-full">
              <CardContent className="pt-5 pb-4">
                <action.icon className="w-6 h-6 text-primary mb-3" />
                <h3 className="font-medium text-sm">{action.label}</h3>
                <p className="text-xs text-muted-foreground mt-1">{action.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Sources */}
      {recentSources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Imports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentSources.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{s.type}</Badge>
                    <span>{s.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {s.itemCount} chunks · {new Date(s.importedAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {stats.totalMemories === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Database className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium mb-1">No knowledge imported yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Start by importing your ChatGPT conversations or pasting some text.</p>
            <Link href="/app/import">
              <Button>Import Knowledge</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
