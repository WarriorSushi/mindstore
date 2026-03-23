"use client";

import { useEffect, useState } from "react";
import { Search, MessageCircle, FileText, Globe, Type, Calendar, ChevronDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Memory {
  id: string;
  content: string;
  source: string;
  sourceId: string;
  sourceTitle: string;
  timestamp: string;
  importedAt: string;
  metadata: Record<string, any>;
}

interface Source {
  id: string;
  type: string;
  title: string;
  itemCount: number;
}

const sourceIcons: Record<string, any> = {
  chatgpt: MessageCircle,
  text: Type,
  file: FileText,
  url: Globe,
};

const sourceColors: Record<string, string> = {
  chatgpt: "text-green-400 bg-green-500/10",
  text: "text-violet-400 bg-violet-500/10",
  file: "text-blue-400 bg-blue-500/10",
  url: "text-orange-400 bg-orange-500/10",
};

export default function ExplorePage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [totalMemories, setTotalMemories] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Memory | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/sources').then(r => r.json()),
      fetch('/api/v1/memories?limit=500').then(r => r.json()),
    ]).then(([srcData, memData]) => {
      setSources(srcData.sources || []);
      setMemories(memData.memories || []);
      setTotalMemories(memData.total || 0);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams({ limit: '500' });
      if (search) params.set('search', search);
      if (filter) params.set('source', filter);
      fetch(`/api/v1/memories?${params}`).then(r => r.json()).then(data => {
        setMemories(data.memories || []);
        setTotalMemories(data.total || 0);
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, filter]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-3xl font-bold">Explore Your Mind</h1>
        <p className="text-zinc-400 text-xs md:text-sm mt-0.5">
          {totalMemories.toLocaleString()} memories · {sources.length} sources
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <Input
          placeholder="Search your knowledge..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white/[0.04] border-white/[0.06] h-10 text-sm rounded-xl"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        )}
      </div>

      {/* Filter pills — scrollable */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none -mx-1 px-1">
        <button
          onClick={() => setFilter(null)}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            filter === null ? "bg-violet-500/15 text-violet-300 border border-violet-500/20" : "text-zinc-400 border border-white/[0.06]"
          }`}
        >
          All
        </button>
        {(["chatgpt", "text", "file", "url"] as const).map((type) => {
          const count = sources.filter((s) => s.type === type).reduce((sum, s) => sum + s.itemCount, 0);
          if (count === 0) return null;
          const Icon = sourceIcons[type];
          return (
            <button
              key={type}
              onClick={() => setFilter(filter === type ? null : type)}
              className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === type ? "bg-violet-500/15 text-violet-300 border border-violet-500/20" : "text-zinc-400 border border-white/[0.06]"
              }`}
            >
              <Icon className="w-3 h-3" />
              {type} · {count}
            </button>
          );
        })}
      </div>

      {/* Memory List */}
      <div className="space-y-1.5">
        {memories.slice(0, visibleCount).map((m) => {
          const Icon = sourceIcons[m.source] || FileText;
          const colorClass = sourceColors[m.source] || "text-zinc-400 bg-zinc-500/10";

          return (
            <div
              key={m.id}
              onClick={() => setSelected(m)}
              className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium ${colorClass}`}>
                  <Icon className="w-2.5 h-2.5" />
                  {m.source}
                </span>
                <span className="text-[11px] text-zinc-500 truncate flex-1">{m.sourceTitle}</span>
                <span className="text-[10px] text-zinc-600 shrink-0">
                  {new Date(m.timestamp).toLocaleDateString()}
                </span>
              </div>
              <p className="text-[13px] text-zinc-300 line-clamp-2 leading-relaxed">{m.content}</p>
            </div>
          );
        })}

        {memories.length > visibleCount && (
          <button
            onClick={() => setVisibleCount((v) => v + 50)}
            className="w-full py-2.5 rounded-xl border border-white/[0.06] text-xs text-zinc-400 hover:bg-white/[0.04] transition-colors flex items-center justify-center gap-1.5"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            Show more ({memories.length - visibleCount} remaining)
          </button>
        )}

        {memories.length === 0 && !loading && (
          <div className="text-center py-16 text-zinc-500 text-sm">
            {totalMemories === 0 ? "No memories yet. Import some knowledge to get started." : "No results match your search."}
          </div>
        )}
      </div>

      {/* Detail Sheet */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full md:max-w-lg max-h-[80vh] bg-zinc-950 border border-white/[0.08] rounded-t-2xl md:rounded-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* Handle bar (mobile) */}
            <div className="md:hidden flex justify-center pt-2 pb-1">
              <div className="w-8 h-1 rounded-full bg-white/[0.15]" />
            </div>

            <div className="px-4 py-3 border-b border-white/[0.06] flex items-start justify-between">
              <div className="min-w-0">
                <h3 className="font-semibold text-sm truncate">{selected.sourceTitle}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium ${sourceColors[selected.source]}`}>
                    {selected.source}
                  </span>
                  <span className="text-[11px] text-zinc-500">{new Date(selected.timestamp).toLocaleString()}</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-white/[0.06] rounded-lg">
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            <div className="px-4 py-4 overflow-y-auto max-h-[60vh]">
              <p className="whitespace-pre-wrap text-[13px] text-zinc-300 leading-relaxed">{selected.content}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
