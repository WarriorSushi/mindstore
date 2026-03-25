"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Copy,
  Download,
  Loader2,
  Mail,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { PageTransition, Stagger } from "@/components/PageTransition";
import { cn } from "@/lib/utils";

type NewsletterStatus = "draft" | "polishing" | "ready";

interface NewsletterSummary {
  id: string;
  title: string;
  subject: string;
  period: string;
  periodDays: number;
  tone: string;
  sectionCount: number;
  wordCount: number;
  sourceCount: number;
  topicsCovered: string[];
  status: NewsletterStatus;
  createdAt: string;
  updatedAt: string;
}

interface NewsletterSection {
  id: string;
  type: "intro" | "topic" | "highlight" | "quicklinks" | "reflection" | "outro";
  title: string;
  content: string;
  sourceCount: number;
}

interface Newsletter extends NewsletterSummary {
  sections: NewsletterSection[];
}

interface Suggestion {
  title: string;
  subject: string;
  topics: string[];
  pitch: string;
}

export default function NewsletterPage() {
  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [newsletters, setNewsletters] = useState<NewsletterSummary[]>([]);
  const [activeNewsletter, setActiveNewsletter] = useState<Newsletter | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingSectionId, setSavingSectionId] = useState<string | null>(null);
  const [refiningSectionId, setRefiningSectionId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [copied, setCopied] = useState(false);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [periodDays, setPeriodDays] = useState(7);
  const [tone, setTone] = useState("casual");
  const [focusTopics, setFocusTopics] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [refineInstruction, setRefineInstruction] = useState<Record<string, string>>({});

  const fetchNewsletters = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/plugins/newsletter-writer?action=newsletters");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load newsletters");
      }
      setNewsletters(data.newsletters || []);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load newsletters");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNewsletters();
  }, [fetchNewsletters]);

  async function openNewsletter(id: string) {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/plugins/newsletter-writer?action=newsletter&id=${id}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load newsletter");
      }
      setActiveNewsletter(data.newsletter);
      setView("detail");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load newsletter");
    } finally {
      setLoading(false);
    }
  }

  async function fetchSuggestions() {
    try {
      setLoadingSuggestions(true);
      const response = await fetch(`/api/v1/plugins/newsletter-writer?action=suggest&days=${periodDays}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load suggestions");
      }
      setSuggestions(data.suggestions || []);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load suggestions");
    } finally {
      setLoadingSuggestions(false);
    }
  }

  async function generateNewsletter() {
    try {
      setGenerating(true);
      const response = await fetch("/api/v1/plugins/newsletter-writer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          title: title || undefined,
          subject: subject || undefined,
          periodDays,
          tone,
          focusTopics: focusTopics ? focusTopics.split(",").map((entry) => entry.trim()).filter(Boolean) : undefined,
          customPrompt: customPrompt || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate newsletter");
      }
      setActiveNewsletter(data.newsletter);
      setView("detail");
      toast.success("Newsletter generated");
      fetchNewsletters();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to generate newsletter");
    } finally {
      setGenerating(false);
    }
  }

  async function saveSection(sectionId: string, content: string) {
    if (!activeNewsletter) {
      return;
    }
    try {
      setSavingSectionId(sectionId);
      const response = await fetch("/api/v1/plugins/newsletter-writer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", id: activeNewsletter.id, sectionId, content }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save section");
      }
      setActiveNewsletter(data.newsletter);
      toast.success("Section saved");
      fetchNewsletters();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save section");
    } finally {
      setSavingSectionId(null);
    }
  }

  async function refineSection(sectionId: string) {
    if (!activeNewsletter || !refineInstruction[sectionId]?.trim()) {
      return;
    }
    try {
      setRefiningSectionId(sectionId);
      const response = await fetch("/api/v1/plugins/newsletter-writer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refine",
          id: activeNewsletter.id,
          sectionId,
          instruction: refineInstruction[sectionId],
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to refine section");
      }
      setActiveNewsletter((current) => current ? {
        ...current,
        sections: current.sections.map((section) => section.id === sectionId ? { ...section, content: data.refined } : section),
      } : current);
      setRefineInstruction((current) => ({ ...current, [sectionId]: "" }));
      toast.success("Section refined");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to refine section");
    } finally {
      setRefiningSectionId(null);
    }
  }

  async function deleteNewsletter(id: string) {
    try {
      const response = await fetch("/api/v1/plugins/newsletter-writer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete newsletter");
      }
      if (activeNewsletter?.id === id) {
        setActiveNewsletter(null);
        setView("list");
      }
      toast.success("Newsletter deleted");
      fetchNewsletters();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete newsletter");
    }
  }

  function copyNewsletter() {
    if (!activeNewsletter) {
      return;
    }
    const content = `# ${activeNewsletter.title}\n\n${activeNewsletter.sections.map((section) => `## ${section.title}\n\n${section.content}`).join("\n\n")}`;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function downloadNewsletter() {
    if (!activeNewsletter) {
      return;
    }
    const blob = new Blob(
      [`# ${activeNewsletter.title}\n\n${activeNewsletter.sections.map((section) => `## ${section.title}\n\n${section.content}`).join("\n\n")}`],
      { type: "text/markdown" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeNewsletter.title.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {(view === "list" || view === "create") && (
          <>
            <div className="mb-8 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-500/20 bg-teal-500/10">
                  <Mail className="h-5 w-5 text-teal-400" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-zinc-100">Newsletter Writer</h1>
                  <p className="text-sm text-zinc-500">Curate digest issues from your recent learning</p>
                </div>
              </div>
              <button onClick={() => setView(view === "create" ? "list" : "create")} className="flex items-center gap-2 rounded-xl border border-teal-500/20 bg-teal-500/10 px-4 py-2.5 text-sm font-medium text-teal-400 transition-all hover:bg-teal-500/20">
                {view === "create" ? <ArrowLeft className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {view === "create" ? "Back" : "New Issue"}
              </button>
            </div>

            {view === "create" && (
              <div className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Issue title" className="rounded-xl border border-white/[0.08] bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-teal-500/30 focus:outline-none" />
                  <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Email subject line" className="rounded-xl border border-white/[0.08] bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-teal-500/30 focus:outline-none" />
                  <select value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value) || 7)} className="rounded-xl border border-white/[0.08] bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 focus:border-teal-500/30 focus:outline-none">
                    <option value={7}>Last 7 days</option>
                    <option value={14}>Last 14 days</option>
                    <option value={30}>Last 30 days</option>
                  </select>
                  <select value={tone} onChange={(event) => setTone(event.target.value)} className="rounded-xl border border-white/[0.08] bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 focus:border-teal-500/30 focus:outline-none">
                    <option value="casual">Casual</option>
                    <option value="professional">Professional</option>
                    <option value="witty">Witty</option>
                  </select>
                  <input value={focusTopics} onChange={(event) => setFocusTopics(event.target.value)} placeholder="Focus topics (comma-separated)" className="sm:col-span-2 rounded-xl border border-white/[0.08] bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-teal-500/30 focus:outline-none" />
                  <textarea value={customPrompt} onChange={(event) => setCustomPrompt(event.target.value)} placeholder="Additional instructions" rows={3} className="sm:col-span-2 rounded-xl border border-white/[0.08] bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-teal-500/30 focus:outline-none" />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={generateNewsletter} disabled={generating} className="flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-black transition-all hover:bg-teal-400 disabled:opacity-50">
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Generate Issue
                  </button>
                  <button onClick={fetchSuggestions} disabled={loadingSuggestions} className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-zinc-900/70 px-4 py-2.5 text-sm text-zinc-300 transition-all hover:border-teal-500/20 hover:text-white">
                    {loadingSuggestions ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Suggest Angles
                  </button>
                </div>

                {suggestions.length > 0 && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion.title}
                        onClick={() => {
                          setTitle(suggestion.title);
                          setSubject(suggestion.subject);
                          setFocusTopics(suggestion.topics.join(", "));
                        }}
                        className="rounded-xl border border-white/[0.06] bg-zinc-900/60 p-3 text-left transition-all hover:border-teal-500/20 hover:bg-zinc-900"
                      >
                        <div className="text-sm font-medium text-zinc-200">{suggestion.title}</div>
                        <div className="mt-1 text-xs text-zinc-500">{suggestion.pitch}</div>
                        <div className="mt-2 text-[11px] text-zinc-600">{suggestion.topics.join(" · ")}</div>
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
            ) : newsletters.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/50 p-12 text-center">
                <Mail className="mx-auto mb-4 h-8 w-8 text-zinc-600" />
                <h2 className="text-base font-medium text-zinc-200">No issues yet</h2>
                <p className="mt-2 text-sm text-zinc-500">Generate a digest from what you learned recently.</p>
              </div>
            ) : (
              <Stagger>
                <div className="space-y-3">
                  {newsletters.map((newsletter) => (
                    <button key={newsletter.id} onClick={() => openNewsletter(newsletter.id)} className="group w-full rounded-2xl border border-white/[0.06] bg-zinc-900/50 p-5 text-left transition-all hover:border-white/[0.12] hover:bg-zinc-900/80">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-medium text-zinc-200 group-hover:text-white">{newsletter.title}</h3>
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide", newsletter.status === "ready" ? "bg-emerald-500/10 text-emerald-400" : newsletter.status === "polishing" ? "bg-amber-500/10 text-amber-400" : "bg-zinc-500/10 text-zinc-400")}>
                              {newsletter.status}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-zinc-500">{newsletter.subject}</p>
                          <p className="mt-3 text-[11px] text-zinc-600">{newsletter.period} · {newsletter.wordCount.toLocaleString()} words · {newsletter.sourceCount} sources</p>
                        </div>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteNewsletter(newsletter.id);
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

        {view === "detail" && activeNewsletter && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button onClick={() => setView("list")} className="flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-300">
                <ArrowLeft className="h-4 w-4" />
                All Issues
              </button>
              <div className="flex items-center gap-2">
                <button onClick={copyNewsletter} className="rounded-lg border border-white/[0.08] bg-zinc-900/70 px-3 py-2 text-xs text-zinc-300 transition-all hover:border-white/[0.12]">
                  {copied ? <Copy className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
                <button onClick={downloadNewsletter} className="rounded-lg border border-white/[0.08] bg-zinc-900/70 px-3 py-2 text-xs text-zinc-300 transition-all hover:border-white/[0.12]">
                  <Download className="h-4 w-4" />
                </button>
                <button onClick={() => deleteNewsletter(activeNewsletter.id)} className="rounded-lg border border-white/[0.08] bg-zinc-900/70 px-3 py-2 text-xs text-zinc-300 transition-all hover:border-rose-500/20 hover:text-rose-400">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/50 p-5">
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">{activeNewsletter.title}</h1>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
                <span>{activeNewsletter.subject}</span>
                <span>{activeNewsletter.period}</span>
                <span>{activeNewsletter.sourceCount} sources</span>
              </div>
            </div>

            <div className="space-y-4">
              {activeNewsletter.sections.map((section) => (
                <div key={section.id} className="rounded-2xl border border-white/[0.06] bg-zinc-900/50 p-5">
                  <div className="mb-3 text-sm font-medium text-zinc-200">{section.title}</div>
                  <textarea
                    value={section.content}
                    onChange={(event) => setActiveNewsletter((current) => current ? {
                      ...current,
                      sections: current.sections.map((entry) => entry.id === section.id ? { ...entry, content: event.target.value } : entry),
                    } : current)}
                    className="min-h-[180px] w-full rounded-xl border border-white/[0.08] bg-zinc-950/80 px-4 py-3 text-sm leading-7 text-zinc-200 outline-none"
                  />
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <input
                      value={refineInstruction[section.id] || ""}
                      onChange={(event) => setRefineInstruction((current) => ({ ...current, [section.id]: event.target.value }))}
                      placeholder="Refine this section..."
                      className="flex-1 rounded-xl border border-white/[0.08] bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-teal-500/30 focus:outline-none"
                    />
                    <button onClick={() => refineSection(section.id)} disabled={refiningSectionId === section.id || !(refineInstruction[section.id] || "").trim()} className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-zinc-900/70 px-4 py-3 text-sm text-teal-400 transition-all hover:border-teal-500/20 disabled:opacity-50">
                      {refiningSectionId === section.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      Refine
                    </button>
                    <button onClick={() => saveSection(section.id, section.content)} disabled={savingSectionId === section.id} className="flex items-center justify-center gap-2 rounded-xl bg-teal-500/10 px-4 py-3 text-sm font-medium text-teal-400 transition-all hover:bg-teal-500/20 disabled:opacity-50">
                      {savingSectionId === section.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                    </button>
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

