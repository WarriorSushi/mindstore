"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  Circle,
  Loader2,
  Plus,
  Route,
  Sparkles,
  StickyNote,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageTransition, Stagger } from "@/components/PageTransition";
import { cn } from "@/lib/utils";

interface PathSummary {
  id: string;
  topic: string;
  description: string;
  difficulty: string;
  estimatedHours: number;
  nodeCount: number;
  completedNodes: number;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

interface Resource {
  title: string;
  type: "article" | "video" | "book" | "exercise" | "tool";
  url?: string;
}

interface PathNode {
  id: string;
  title: string;
  description: string;
  type: "concept" | "practice" | "project" | "reading" | "milestone";
  depth: "beginner" | "intermediate" | "advanced";
  estimatedMinutes: number;
  completed: boolean;
  completedAt?: string;
  note?: string;
  resources: Resource[];
  dependencies: string[];
  relatedMemoryIds: string[];
  relatedMemoryTitles: string[];
}

interface LearningPath {
  id: string;
  topic: string;
  description: string;
  difficulty: string;
  estimatedHours: number;
  nodes: PathNode[];
  progress: number;
  existingKnowledge: { title: string; preview: string; sourceType: string }[];
  createdAt: string;
  updatedAt: string;
}

interface Suggestion {
  topic: string;
  reason: string;
  difficulty: string;
  estimatedHours: number;
}

export default function PathsPage() {
  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [paths, setPaths] = useState<PathSummary[]>([]);
  const [activePath, setActivePath] = useState<LearningPath | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const fetchPaths = useCallback(async () => {
    try {
      const [pathResponse, suggestionResponse] = await Promise.all([
        fetch("/api/v1/plugins/learning-paths?action=list"),
        fetch("/api/v1/plugins/learning-paths?action=suggestions"),
      ]);
      const pathData = await pathResponse.json();
      const suggestionData = await suggestionResponse.json();
      if (!pathResponse.ok) {
        throw new Error(pathData.error || "Failed to load learning paths");
      }
      setPaths(pathData.paths || []);
      setSuggestions(suggestionResponse.ok ? suggestionData.suggestions || [] : []);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load learning paths");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPaths();
  }, [fetchPaths]);

  async function openPath(id: string) {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/plugins/learning-paths?action=get&id=${id}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load path");
      }
      setActivePath(data.path);
      setView("detail");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load path");
    } finally {
      setLoading(false);
    }
  }

  async function generatePath() {
    if (!topic.trim()) {
      toast.error("Enter a topic first");
      return;
    }
    try {
      setGenerating(true);
      const response = await fetch("/api/v1/plugins/learning-paths", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", topic, context }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate path");
      }
      setActivePath(data.path);
      setView("detail");
      toast.success("Learning path generated");
      fetchPaths();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to generate path");
    } finally {
      setGenerating(false);
    }
  }

  async function toggleNode(nodeId: string, completed: boolean) {
    if (!activePath) {
      return;
    }
    try {
      const response = await fetch("/api/v1/plugins/learning-paths", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-progress", pathId: activePath.id, nodeId, completed }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update progress");
      }
      setActivePath(data.path);
      fetchPaths();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update progress");
    }
  }

  async function saveNote(nodeId: string) {
    if (!activePath) {
      return;
    }
    try {
      setSavingNoteId(nodeId);
      const response = await fetch("/api/v1/plugins/learning-paths", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add-note", pathId: activePath.id, nodeId, note: noteDrafts[nodeId] || "" }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save note");
      }
      setActivePath(data.path);
      toast.success("Note saved");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save note");
    } finally {
      setSavingNoteId(null);
    }
  }

  async function removePath(id: string) {
    try {
      const response = await fetch("/api/v1/plugins/learning-paths", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete path");
      }
      if (activePath?.id === id) {
        setActivePath(null);
        setView("list");
      }
      toast.success("Path deleted");
      fetchPaths();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete path");
    }
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {(view === "list" || view === "create") && (
          <>
            <div className="mb-8 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-500/20 bg-teal-500/10">
                  <Route className="h-5 w-5 text-teal-400" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-zinc-100">Learning Paths</h1>
                  <p className="text-sm text-zinc-500">Structured plans for what to learn next</p>
                </div>
              </div>
              <button onClick={() => setView(view === "create" ? "list" : "create")} className="flex items-center gap-2 rounded-xl border border-teal-500/20 bg-teal-500/10 px-4 py-2.5 text-sm font-medium text-teal-400 transition-all hover:bg-teal-500/20">
                {view === "create" ? <ArrowLeft className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {view === "create" ? "Back" : "New Path"}
              </button>
            </div>

            {view === "create" && (
              <div className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="space-y-4">
                  <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="What do you want to learn?" className="w-full rounded-xl border border-white/[0.08] bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-teal-500/30 focus:outline-none" />
                  <textarea value={context} onChange={(event) => setContext(event.target.value)} placeholder="Context, goals, or current level" rows={3} className="w-full rounded-xl border border-white/[0.08] bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-teal-500/30 focus:outline-none" />
                  <button onClick={generatePath} disabled={generating} className="flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-black transition-all hover:bg-teal-400 disabled:opacity-50">
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Generate Path
                  </button>
                </div>

                {suggestions.length > 0 && (
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {suggestions.map((suggestion) => (
                      <button key={suggestion.topic} onClick={() => setTopic(suggestion.topic)} className="rounded-xl border border-white/[0.06] bg-zinc-900/60 p-3 text-left transition-all hover:border-teal-500/20 hover:bg-zinc-900">
                        <div className="text-sm font-medium text-zinc-200">{suggestion.topic}</div>
                        <div className="mt-1 text-xs text-zinc-500">{suggestion.reason}</div>
                        <div className="mt-2 text-[11px] text-zinc-600">{suggestion.difficulty} · ~{suggestion.estimatedHours}h</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
              </div>
            ) : paths.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/50 p-12 text-center">
                <Route className="mx-auto mb-4 h-8 w-8 text-zinc-600" />
                <h2 className="text-base font-medium text-zinc-200">No learning paths yet</h2>
                <p className="mt-2 text-sm text-zinc-500">Generate a plan from your current knowledge and interests.</p>
              </div>
            ) : (
              <Stagger>
                <div className="space-y-3">
                  {paths.map((path) => (
                    <button key={path.id} onClick={() => openPath(path.id)} className="group w-full rounded-2xl border border-white/[0.06] bg-zinc-900/50 p-5 text-left transition-all hover:border-white/[0.12] hover:bg-zinc-900/80">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-zinc-200 group-hover:text-white">{path.topic}</div>
                          <div className="mt-1 text-sm text-zinc-500">{path.description}</div>
                          <div className="mt-3 text-xs text-zinc-600">{path.progress}% complete · {path.completedNodes}/{path.nodeCount} nodes · {path.estimatedHours}h</div>
                        </div>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            removePath(path.id);
                          }}
                          className="rounded-lg px-3 py-2 text-xs text-zinc-500 opacity-0 transition-all hover:bg-rose-500/10 hover:text-rose-400 group-hover:opacity-100"
                        >
                          Delete
                        </button>
                      </div>
                    </button>
                  ))}
                </div>
              </Stagger>
            )}
          </>
        )}

        {view === "detail" && activePath && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button onClick={() => setView("list")} className="flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-300">
                <ArrowLeft className="h-4 w-4" />
                All Paths
              </button>
              <button onClick={() => removePath(activePath.id)} className="rounded-lg border border-white/[0.08] bg-zinc-900/70 px-3 py-2 text-xs text-zinc-300 transition-all hover:border-rose-500/20 hover:text-rose-400">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/50 p-5">
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">{activePath.topic}</h1>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
                <span>{activePath.difficulty}</span>
                <span>{activePath.estimatedHours}h</span>
                <span>{activePath.progress}% complete</span>
              </div>
            </div>

            {activePath.existingKnowledge.length > 0 && (
              <div className="rounded-2xl border border-sky-500/10 bg-sky-500/[0.03] p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-sky-400">
                  <Brain className="h-4 w-4" />
                  What you already know
                </div>
                <div className="space-y-2">
                  {activePath.existingKnowledge.slice(0, 5).map((memory) => (
                    <div key={`${memory.sourceType}-${memory.title}`} className="text-sm text-zinc-400">
                      <span className="text-zinc-300">{memory.title}</span> - {memory.preview}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {activePath.nodes.map((node) => (
                <div key={node.id} className="rounded-2xl border border-white/[0.06] bg-zinc-900/50 p-5">
                  <div className="flex items-start gap-3">
                    <button onClick={() => toggleNode(node.id, !node.completed)} className="mt-1">
                      {node.completed ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5 text-zinc-600" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-zinc-200">{node.title}</div>
                      <div className="mt-1 text-xs text-zinc-500">{node.type} · {node.depth} · {node.estimatedMinutes}m</div>
                      <p className={cn("mt-3 text-sm leading-7 text-zinc-400", node.completed && "text-zinc-600 line-through")}>{node.description}</p>

                      {node.relatedMemoryTitles.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {node.relatedMemoryTitles.map((title) => (
                            <span key={title} className="rounded-full bg-sky-500/10 px-2 py-1 text-[11px] text-sky-400">{title}</span>
                          ))}
                        </div>
                      )}

                      {node.resources.length > 0 && (
                        <div className="mt-3 space-y-1 text-xs text-zinc-500">
                          {node.resources.map((resource, index) => (
                            <div key={`${node.id}-${index}`}>{resource.title} · {resource.type}</div>
                          ))}
                        </div>
                      )}

                      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <input
                          value={noteDrafts[node.id] ?? node.note ?? ""}
                          onChange={(event) => setNoteDrafts((current) => ({ ...current, [node.id]: event.target.value }))}
                          placeholder="Add a note for this step..."
                          className="flex-1 rounded-xl border border-white/[0.08] bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-teal-500/30 focus:outline-none"
                        />
                        <button onClick={() => saveNote(node.id)} disabled={savingNoteId === node.id} className="flex items-center justify-center gap-2 rounded-xl bg-teal-500/10 px-4 py-3 text-sm font-medium text-teal-400 transition-all hover:bg-teal-500/20 disabled:opacity-50">
                          {savingNoteId === node.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <StickyNote className="h-4 w-4" />}
                          Save Note
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

