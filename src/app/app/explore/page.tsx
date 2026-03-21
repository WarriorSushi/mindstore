"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, FileText, MessageSquare, Globe, Type, X, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { db, type Memory, type Source } from "@/lib/db";
import { semanticSearch } from "@/lib/search";
import { getApiKey } from "@/lib/openai";

const sourceIcons: Record<string, React.ElementType> = {
  chatgpt: MessageSquare,
  text: Type,
  file: FileText,
  url: Globe,
};

export default function ExplorePage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<(Memory & { score?: number })[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [filterSource, setFilterSource] = useState<string | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const mems = await db.memories.orderBy('importedAt').reverse().limit(200).toArray();
    setMemories(mems);
    const srcs = await db.sources.toArray();
    setSources(srcs);
  }

  async function handleSearch() {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      if (getApiKey()) {
        const results = await semanticSearch(query, 20);
        setSearchResults(results);
      } else {
        // Keyword fallback
        const lower = query.toLowerCase();
        const all = await db.memories.toArray();
        setSearchResults(all.filter(m => m.content.toLowerCase().includes(lower)).slice(0, 20));
      }
    } catch {
      // Keyword fallback
      const lower = query.toLowerCase();
      setSearchResults(memories.filter(m => m.content.toLowerCase().includes(lower)));
    }
    setSearching(false);
  }

  const displayMemories = searchResults || memories;
  const filtered = filterSource ? displayMemories.filter(m => m.source === filterSource) : displayMemories;
  const shown = showAll ? filtered : filtered.slice(0, 50);

  // Topic extraction (simple: group by sourceTitle)
  const topicCounts: Record<string, number> = {};
  memories.forEach(m => {
    topicCounts[m.sourceTitle] = (topicCounts[m.sourceTitle] || 0) + 1;
  });
  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border/50 px-6 py-3 shrink-0 space-y-3">
        <div>
          <h1 className="text-lg font-semibold">Explore Memories</h1>
          <p className="text-xs text-muted-foreground">{memories.length} memories across {sources.length} sources</p>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search your knowledge (semantic + keyword)..."
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <Button onClick={handleSearch} disabled={searching} size="sm">
            {searching ? "Searching..." : "Search"}
          </Button>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Badge
            variant={filterSource === null ? "default" : "secondary"}
            className="cursor-pointer text-xs"
            onClick={() => setFilterSource(null)}
          >
            All
          </Badge>
          {["chatgpt", "text", "file", "url"].map(type => {
            const count = memories.filter(m => m.source === type).length;
            if (count === 0) return null;
            return (
              <Badge
                key={type}
                variant={filterSource === type ? "default" : "secondary"}
                className="cursor-pointer text-xs"
                onClick={() => setFilterSource(filterSource === type ? null : type)}
              >
                {type} ({count})
              </Badge>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Topic cloud */}
          {!searchResults && topTopics.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Topics</h3>
              <div className="flex flex-wrap gap-1.5">
                {topTopics.map(([topic, count]) => (
                  <Badge
                    key={topic}
                    variant="outline"
                    className="cursor-pointer text-xs hover:bg-muted"
                    onClick={() => { setQuery(topic); }}
                  >
                    {topic} <span className="ml-1 text-muted-foreground">({count})</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          <div className="space-y-2">
            {searchResults && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{filtered.length} results for &ldquo;{query}&rdquo;</p>
                <Button variant="ghost" size="sm" onClick={() => { setSearchResults(null); setQuery(""); }}>
                  <X className="w-3 h-3 mr-1" /> Clear
                </Button>
              </div>
            )}

            <AnimatePresence>
              {shown.map((memory, i) => {
                const Icon = sourceIcons[memory.source] || FileText;
                return (
                  <motion.div
                    key={memory.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.5) }}
                  >
                    <Card
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setSelectedMemory(memory)}
                    >
                      <CardContent className="py-3 px-4">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded bg-muted flex items-center justify-center shrink-0 mt-0.5">
                            <Icon className="w-3 h-3" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium truncate">{memory.sourceTitle}</span>
                              {'score' in memory && (memory as Memory & {score: number}).score !== undefined && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {Math.round(((memory as Memory & {score: number}).score) * 100)}% match
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">{memory.content}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {new Date(memory.timestamp).toLocaleDateString()} · {memory.source}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filtered.length > 50 && !showAll && (
              <Button variant="ghost" className="w-full" onClick={() => setShowAll(true)}>
                <ChevronDown className="w-4 h-4 mr-1" /> Show all {filtered.length} results
              </Button>
            )}

            {filtered.length === 0 && (
              <div className="text-center py-20 text-muted-foreground">
                <Search className="w-10 h-10 mx-auto mb-3" />
                <p className="text-sm">No memories found. Import some knowledge to get started.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selectedMemory} onOpenChange={() => setSelectedMemory(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedMemory && (() => {
                const Icon = sourceIcons[selectedMemory.source] || FileText;
                return <Icon className="w-4 h-4" />;
              })()}
              {selectedMemory?.sourceTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Badge variant="secondary">{selectedMemory?.source}</Badge>
              <Badge variant="outline">{selectedMemory && new Date(selectedMemory.timestamp).toLocaleDateString()}</Badge>
            </div>
            <Separator />
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{selectedMemory?.content}</div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
