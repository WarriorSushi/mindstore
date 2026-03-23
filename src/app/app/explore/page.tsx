"use client";

import { useEffect, useState } from "react";
import { Search, MessageCircle, FileText, Globe, Type, ChevronDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";

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

const typeConfig: Record<string, { icon: any; color: string }> = {
  chatgpt: { icon: MessageCircle, color: "text-green-400 bg-green-500/10" },
  text: { icon: Type, color: "text-violet-400 bg-violet-500/10" },
  file: { icon: FileText, color: "text-blue-400 bg-blue-500/10" },
  url: { icon: Globe, color: "text-orange-400 bg-orange-500/10" },
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
    const t = setTimeout(() => {
      const p = new URLSearchParams({ limit: '500' });
      if (search) p.set('search', search);
      if (filter) p.set('source', filter);
      fetch(`/api/v1/memories?${p}`).then(r => r.json()).then(d => {
        setMemories(d.memories || []);
        setTotalMemories(d.total || 0);
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [search, filter]);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[22px] md:text-[28px] font-semibold tracking-[-0.03em]">Explore</h1>
        <p className="text-[13px] text-zinc-500 mt-0.5">{totalMemories.toLocaleString()} memories · {sources.length} sources</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
        <input
          placeholder="Search your knowledge…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-9 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500/30 focus:border-violet-500/30 transition-all"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5">
            <X className="w-3.5 h-3.5 text-zinc-500" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 pb-0.5">
        <FilterPill active={filter === null} onClick={() => setFilter(null)} label="All" />
        {(["chatgpt", "text", "file", "url"] as const).map((type) => {
          const count = sources.filter(s => s.type === type).reduce((sum, s) => sum + s.itemCount, 0);
          if (count === 0) return null;
          const Icon = typeConfig[type]?.icon || FileText;
          return <FilterPill key={type} active={filter === type} onClick={() => setFilter(filter === type ? null : type)} label={type} count={count} icon={<Icon className="w-3 h-3" />} />;
        })}
      </div>

      {/* Memory Cards */}
      <div className="space-y-1.5">
        {memories.slice(0, visibleCount).map((m) => {
          const cfg = typeConfig[m.source] || { icon: FileText, color: "text-zinc-400 bg-zinc-500/10" };
          const Icon = cfg.icon;
          return (
            <button
              key={m.id}
              onClick={() => setSelected(m)}
              className="w-full text-left p-3.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-[2px] rounded-md font-semibold uppercase tracking-wide ${cfg.color}`}>
                  <Icon className="w-2.5 h-2.5" />
                  {m.source}
                </span>
                <span className="text-[11px] text-zinc-600 truncate flex-1">{m.sourceTitle}</span>
                <span className="text-[10px] text-zinc-700 tabular-nums shrink-0">
                  {new Date(m.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <p className="text-[13px] text-zinc-300 line-clamp-2 leading-relaxed">{m.content}</p>
            </button>
          );
        })}

        {memories.length > visibleCount && (
          <button
            onClick={() => setVisibleCount(v => v + 50)}
            className="w-full py-3 rounded-2xl border border-white/[0.06] text-[12px] text-zinc-500 hover:bg-white/[0.04] transition-colors flex items-center justify-center gap-1.5 font-medium"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            {memories.length - visibleCount} more
          </button>
        )}

        {memories.length === 0 && !loading && (
          <div className="text-center py-20 text-zinc-600 text-[13px]">
            {totalMemories === 0 ? "No memories yet" : "No results"}
          </div>
        )}
      </div>

      {/* Detail Bottom Sheet */}
      {selected && (
        <div className="fixed inset-0 z-[60]" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
          <div
            className="absolute bottom-0 inset-x-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg bg-[#111113] border-t md:border border-white/[0.08] rounded-t-3xl md:rounded-3xl overflow-hidden animate-in slide-in-from-bottom shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="md:hidden flex justify-center pt-2.5 pb-1">
              <div className="w-9 h-1 rounded-full bg-white/[0.15]" />
            </div>
            <div className="px-5 py-3 flex items-start justify-between border-b border-white/[0.06]">
              <div className="min-w-0 pr-3">
                <h3 className="text-[15px] font-semibold truncate">{selected.sourceTitle}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] px-1.5 py-[2px] rounded-md font-semibold uppercase tracking-wide ${typeConfig[selected.source]?.color || ""}`}>
                    {selected.source}
                  </span>
                  <span className="text-[11px] text-zinc-500">{new Date(selected.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 -mr-1 hover:bg-white/[0.06] rounded-lg shrink-0">
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto max-h-[55dvh] md:max-h-[50vh]">
              <p className="whitespace-pre-wrap text-[13px] text-zinc-300 leading-[1.7]">{selected.content}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterPill({ active, onClick, label, count, icon }: {
  active: boolean; onClick: () => void; label: string; count?: number; icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 flex items-center gap-1.5 px-3 py-[6px] rounded-full text-[12px] font-medium transition-all active:scale-[0.95] ${
        active
          ? "bg-violet-500/15 text-violet-300 border border-violet-500/25 shadow-sm shadow-violet-500/10"
          : "text-zinc-500 border border-white/[0.06] hover:bg-white/[0.04]"
      }`}
    >
      {icon}
      {label}
      {count !== undefined && <span className="text-[10px] opacity-60">{count}</span>}
    </button>
  );
}
