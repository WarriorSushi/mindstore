"use client";

import { useEffect, useState } from "react";
import { Search, MessageCircle, FileText, Globe, Type, Calendar, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { db, type Memory, type Source } from "@/lib/db";

const sourceIcons: Record<string, any> = {
  chatgpt: MessageCircle,
  text: Type,
  file: FileText,
  url: Globe,
};

const sourceColors: Record<string, string> = {
  chatgpt: "text-green-400 bg-green-400/10",
  text: "text-violet-400 bg-violet-400/10",
  file: "text-blue-400 bg-blue-400/10",
  url: "text-orange-400 bg-orange-400/10",
};

export default function ExplorePage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Memory | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);

  useEffect(() => {
    db.sources.toArray().then(setSources);
    db.memories.toArray().then(setMemories);
  }, []);

  const filtered = memories
    .filter((m) => {
      if (filter && m.source !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return m.content.toLowerCase().includes(q) || m.sourceTitle.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const topTopics = sources
    .reduce((acc, s) => {
      const title = s.title.slice(0, 40);
      acc[title] = (acc[title] || 0) + s.itemCount;
      return acc;
    }, {} as Record<string, number>);

  const topTopicsSorted = Object.entries(topTopics)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Explore Your Mind</h1>
        <p className="text-zinc-400 mt-1">{memories.length.toLocaleString()} memories from {sources.length} sources</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Search your knowledge..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-zinc-900 border-zinc-800"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === null ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(null)}
            className={filter === null ? "bg-violet-600" : "border-zinc-700"}
          >
            All
          </Button>
          {(["chatgpt", "text", "file", "url"] as const).map((type) => {
            const count = memories.filter((m) => m.source === type).length;
            if (count === 0) return null;
            const Icon = sourceIcons[type];
            return (
              <Button
                key={type}
                variant={filter === type ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(filter === type ? null : type)}
                className={filter === type ? "bg-violet-600" : "border-zinc-700"}
              >
                <Icon className="w-3.5 h-3.5 mr-1" />
                {type} ({count})
              </Button>
            );
          })}
        </div>
      </div>

      {/* Topic Cloud */}
      {topTopicsSorted.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {topTopicsSorted.map(([topic, count]) => (
            <Badge
              key={topic}
              variant="outline"
              className="border-zinc-700 text-zinc-400 hover:border-violet-500/30 cursor-pointer transition-colors"
              onClick={() => setSearch(topic)}
            >
              {topic} ({count})
            </Badge>
          ))}
        </div>
      )}

      {/* Memory List */}
      <div className="space-y-2">
        {filtered.slice(0, visibleCount).map((m) => {
          const Icon = sourceIcons[m.source] || FileText;
          const colorClass = sourceColors[m.source] || "text-zinc-400 bg-zinc-400/10";

          return (
            <div
              key={m.id}
              onClick={() => setSelected(m)}
              className="p-4 rounded-lg border border-zinc-800/50 bg-zinc-900/50 hover:border-zinc-700 cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${colorClass}`}>
                      <Icon className="w-3 h-3" />
                      {m.source}
                    </span>
                    <span className="text-xs text-zinc-600 truncate">{m.sourceTitle}</span>
                  </div>
                  <p className="text-sm text-zinc-300 line-clamp-2">{m.content}</p>
                </div>
                <div className="text-xs text-zinc-600 whitespace-nowrap flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(m.timestamp).toLocaleDateString()}
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length > visibleCount && (
          <Button
            variant="outline"
            onClick={() => setVisibleCount((v) => v + 50)}
            className="w-full border-zinc-700"
          >
            <ChevronDown className="w-4 h-4 mr-2" />
            Show more ({filtered.length - visibleCount} remaining)
          </Button>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            {memories.length === 0 ? "No memories yet. Import some knowledge to get started." : "No results found."}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">{selected?.sourceTitle}</DialogTitle>
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${sourceColors[selected?.source || "text"]}`}>
                {selected?.source}
              </span>
              <span>{selected?.timestamp ? new Date(selected.timestamp).toLocaleString() : ""}</span>
            </div>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm text-zinc-300 leading-relaxed mt-4">
            {selected?.content}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
