"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  FileEdit,
  Lightbulb,
  Loader2,
  PenSquare,
  Plus,
  Save,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { PageTransition, Stagger } from "@/components/PageTransition";
import { cn } from "@/lib/utils";

type DraftStatus = "draft" | "refining" | "ready";

interface DraftSummary {
  id: string;
  title: string;
  topic: string;
  style: string;
  tone: string;
  wordCount: number;
  sourceCount: number;
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
  preview: string;
}

interface Draft extends DraftSummary {
  content: string;
  outline: string[];
  sourceMemoryIds: string[];
}

interface TopicSuggestion {
  title: string;
  description: string;
  readingTime: number;
  style: string;
}

const STYLES = ["technical", "casual", "storytelling", "tutorial", "opinion"];
const TONES = ["professional", "conversational", "academic", "witty"];

export default function BlogPage() {
  const [view, setView] = useState<"list" | "create" | "edit" | "preview">("list");
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [activeDraft, setActiveDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [refining, setRefining] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [copied, setCopied] = useState(false);

  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("casual");
  const [tone, setTone] = useState("conversational");
  const [targetLength, setTargetLength] = useState(1200);
  const [refineInstruction, setRefineInstruction] = useState("");
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);

  const fetchDrafts = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/plugins/blog-draft?action=drafts");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load drafts");
      }
      setDrafts(data.drafts || []);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load drafts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const activeWordCount = useMemo(
    () => activeDraft?.content.split(/\s+/).filter(Boolean).length || 0,
    [activeDraft?.content],
  );

  async function loadDraft(id: string) {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/plugins/blog-draft?action=draft&id=${id}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load draft");
      }
      setActiveDraft(data.draft);
      setView("edit");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load draft");
    } finally {
      setLoading(false);
    }
  }

  async function createDraft() {
    if (!topic.trim()) {
      toast.error("Enter a topic first");
      return;
    }

    try {
      setGenerating(true);
      const response = await fetch("/api/v1/plugins/blog-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", topic, style, tone, targetLength }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate draft");
      }
      setActiveDraft(data.draft);
      setView("edit");
      toast.success("Draft generated");
      fetchDrafts();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to generate draft");
    } finally {
      setGenerating(false);
    }
  }

  async function saveDraft() {
    if (!activeDraft) {
      return;
    }
    try {
      setSaving(true);
      const response = await fetch("/api/v1/plugins/blog-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          id: activeDraft.id,
          content: activeDraft.content,
          title: activeDraft.title,
          status: activeDraft.status,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save draft");
      }
      setActiveDraft(data.draft);
      toast.success("Draft saved");
      fetchDrafts();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save draft");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDraft(id: string) {
    try {
      const response = await fetch("/api/v1/plugins/blog-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete draft");
      }
      toast.success("Draft deleted");
      if (activeDraft?.id === id) {
        setActiveDraft(null);
        setView("list");
      }
      fetchDrafts();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete draft");
    }
  }

  async function refineDraft() {
    if (!activeDraft || !refineInstruction.trim()) {
      return;
    }

    try {
      setRefining(true);
      const response = await fetch("/api/v1/plugins/blog-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refine",
          id: activeDraft.id,
          instruction: refineInstruction,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to refine draft");
      }
      setActiveDraft((current) => current ? { ...current, content: data.refined, status: "refining" } : current);
      setRefineInstruction("");
      toast.success("Draft refined");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to refine draft");
    } finally {
      setRefining(false);
    }
  }

  async function fetchSuggestions() {
    try {
      setLoadingTopics(true);
      const response = await fetch("/api/v1/plugins/blog-draft?action=topics");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load suggestions");
      }
      setSuggestions(data.topics || []);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load suggestions");
    } finally {
      setLoadingTopics(false);
    }
  }

  async function exportDraft(format: "markdown" | "html") {
    if (!activeDraft) {
      return;
    }
    try {
      const response = await fetch("/api/v1/plugins/blog-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export", id: activeDraft.id, format }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to export draft");
      }
      const blob = new Blob([data.content], { type: format === "html" ? "text/html" : "text/markdown" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = data.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to export draft");
    }
  }

  function copyDraft() {
    if (!activeDraft) {
      return;
    }
    navigator.clipboard.writeText(activeDraft.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function renderMarkdown(markdown: string) {
    return markdown
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
      .replace(/^- (.+)$/gm, "<li>$1</li>")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br/>");
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {(view === "list" || view === "create") && (
          <>
            <div className="mb-8 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-500/20 bg-teal-500/10">
                  <PenSquare className="h-5 w-5 text-teal-400" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-zinc-100">Blog Writer</h1>
                  <p className="text-sm text-zinc-500">Turn your memories into long-form drafts</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setView(view === "create" ? "list" : "create");
                  setSuggestions([]);
                }}
                className="flex items-center gap-2 rounded-xl border border-teal-500/20 bg-teal-500/10 px-4 py-2.5 text-sm font-medium text-teal-400 transition-all hover:bg-teal-500/20"
              >
                {view === "create" ? <ArrowLeft className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {view === "create" ? "Back" : "New Draft"}
              </button>
            </div>

            {view === "create" && (
              <div className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">Topic</label>
                    <input
                      value={topic}
                      onChange={(event) => setTopic(event.target.value)}
                      placeholder="What do you want to write about?"
                      className="w-full rounded-xl border border-white/[0.08] bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-teal-500/30 focus:outline-none"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">Style</label>
                      <select value={style} onChange={(event) => setStyle(event.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 focus:border-teal-500/30 focus:outline-none">
                        {STYLES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">Tone</label>
                      <select value={tone} onChange={(event) => setTone(event.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 focus:border-teal-500/30 focus:outline-none">
                        {TONES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">Target Length</label>
                      <input value={targetLength} onChange={(event) => setTargetLength(Number(event.target.value) || 1200)} type="number" min={400} max={3200} className="w-full rounded-xl border border-white/[0.08] bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 focus:border-teal-500/30 focus:outline-none" />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button onClick={createDraft} disabled={generating} className="flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-black transition-all hover:bg-teal-400 disabled:opacity-50">
                      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Generate Draft
                    </button>
                    <button onClick={fetchSuggestions} disabled={loadingTopics} className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-zinc-900/70 px-4 py-2.5 text-sm text-zinc-300 transition-all hover:border-teal-500/20 hover:text-white">
                      {loadingTopics ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
                      Suggest Topics
                    </button>
                  </div>

                  {suggestions.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {suggestions.map((suggestion) => (
                        <button
                          key={suggestion.title}
                          onClick={() => {
                            setTopic(suggestion.title);
                            setStyle(suggestion.style || "casual");
                          }}
                          className="rounded-xl border border-white/[0.06] bg-zinc-900/60 p-3 text-left transition-all hover:border-teal-500/20 hover:bg-zinc-900"
                        >
                          <div className="text-sm font-medium text-zinc-200">{suggestion.title}</div>
                          <div className="mt-1 text-xs text-zinc-500">{suggestion.description}</div>
                          <div className="mt-2 text-[11px] text-zinc-600">{suggestion.readingTime} min read · {suggestion.style}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
              </div>
            ) : drafts.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/50 p-12 text-center">
                <FileEdit className="mx-auto mb-4 h-8 w-8 text-zinc-600" />
                <h2 className="text-base font-medium text-zinc-200">No drafts yet</h2>
                <p className="mt-2 text-sm text-zinc-500">Generate a first post from your stored knowledge.</p>
              </div>
            ) : (
              <Stagger>
                <div className="space-y-3">
                  {drafts.map((draft) => (
                    <button key={draft.id} onClick={() => loadDraft(draft.id)} className="group w-full rounded-2xl border border-white/[0.06] bg-zinc-900/50 p-5 text-left transition-all hover:border-white/[0.12] hover:bg-zinc-900/80">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-medium text-zinc-200 group-hover:text-white">{draft.title}</h3>
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide", draft.status === "ready" ? "bg-emerald-500/10 text-emerald-400" : draft.status === "refining" ? "bg-amber-500/10 text-amber-400" : "bg-zinc-500/10 text-zinc-400")}>
                              {draft.status}
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm text-zinc-500">{draft.preview}</p>
                          <p className="mt-3 text-[11px] text-zinc-600">{draft.style} · {draft.wordCount.toLocaleString()} words · {draft.sourceCount} sources</p>
                        </div>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteDraft(draft.id);
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

        {(view === "edit" || view === "preview") && activeDraft && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button onClick={() => setView("list")} className="flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-300">
                <ArrowLeft className="h-4 w-4" />
                All Drafts
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setView(view === "edit" ? "preview" : "edit")} className="rounded-lg border border-white/[0.08] bg-zinc-900/70 px-3 py-2 text-xs text-zinc-300 transition-all hover:border-white/[0.12]">
                  {view === "edit" ? "Preview" : "Edit"}
                </button>
                <button onClick={copyDraft} className="rounded-lg border border-white/[0.08] bg-zinc-900/70 px-3 py-2 text-xs text-zinc-300 transition-all hover:border-white/[0.12]">
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
                <button onClick={() => exportDraft("markdown")} className="rounded-lg border border-white/[0.08] bg-zinc-900/70 px-3 py-2 text-xs text-zinc-300 transition-all hover:border-white/[0.12]">
                  <Download className="h-4 w-4" />
                </button>
                <button onClick={saveDraft} disabled={saving} className="flex items-center gap-2 rounded-lg bg-teal-500/10 px-3 py-2 text-xs font-medium text-teal-400 transition-all hover:bg-teal-500/20 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/50 p-5">
              <input
                value={activeDraft.title}
                onChange={(event) => setActiveDraft((current) => current ? { ...current, title: event.target.value } : current)}
                className="w-full bg-transparent text-3xl font-semibold tracking-tight text-zinc-100 outline-none"
              />
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
                <span>{activeDraft.style}</span>
                <span>{activeDraft.tone}</span>
                <span>{activeWordCount.toLocaleString()} words</span>
                <span>{activeDraft.sourceCount} sources</span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/50 p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-zinc-200">AI Refine</div>
                <button onClick={() => exportDraft("html")} className="text-xs text-zinc-500 transition-colors hover:text-teal-400">Export HTML</button>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={refineInstruction}
                  onChange={(event) => setRefineInstruction(event.target.value)}
                  placeholder="Make it sharper, more concise, more technical..."
                  className="flex-1 rounded-xl border border-white/[0.08] bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-teal-500/30 focus:outline-none"
                />
                <button onClick={refineDraft} disabled={refining || !refineInstruction.trim()} className="flex items-center justify-center gap-2 rounded-xl bg-zinc-950/80 px-4 py-3 text-sm text-teal-400 transition-all hover:bg-zinc-950 disabled:opacity-40">
                  {refining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  Refine
                </button>
              </div>
            </div>

            {view === "edit" ? (
              <textarea
                value={activeDraft.content}
                onChange={(event) => setActiveDraft((current) => current ? { ...current, content: event.target.value } : current)}
                className="min-h-[60vh] w-full rounded-2xl border border-white/[0.06] bg-zinc-950/80 px-5 py-4 font-mono text-sm leading-7 text-zinc-200 outline-none"
              />
            ) : (
              <div className="prose prose-invert max-w-none rounded-2xl border border-white/[0.06] bg-zinc-900/50 p-6">
                <div dangerouslySetInnerHTML={{ __html: `<p>${renderMarkdown(activeDraft.content)}</p>` }} />
              </div>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}

