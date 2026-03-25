"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { PageTransition, Stagger } from "@/components/PageTransition";

interface BriefingSummary {
  id: string;
  subject: string;
  type: "person" | "topic" | "company" | "project";
  context?: string;
  sectionCount: number;
  sourceCount: number;
  createdAt: string;
  preview: string;
}

interface BriefingSection {
  title: string;
  icon: string;
  items: string[];
}

interface Briefing extends BriefingSummary {
  sections: BriefingSection[];
  sourceMemoryIds: string[];
}

export default function ConversationPrepPage() {
  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [briefings, setBriefings] = useState<BriefingSummary[]>([]);
  const [activeBriefing, setActiveBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [subject, setSubject] = useState("");
  const [type, setType] = useState<Briefing["type"]>("person");
  const [context, setContext] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const fetchBriefings = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/plugins/conversation-prep?action=history");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load briefings");
      }
      setBriefings(data.briefings || []);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load briefings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBriefings();
  }, [fetchBriefings]);

  async function openBriefing(id: string) {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/plugins/conversation-prep?action=briefing&id=${id}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load briefing");
      }
      setActiveBriefing(data.briefing);
      setView("detail");
      setAnswer("");
      setQuestion("");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load briefing");
    } finally {
      setLoading(false);
    }
  }

  async function prepare() {
    if (!subject.trim()) {
      toast.error("Enter who or what you want to prepare for");
      return;
    }
    try {
      setPreparing(true);
      const response = await fetch("/api/v1/plugins/conversation-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prepare", subject, type, context }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to prepare briefing");
      }
      setActiveBriefing(data.briefing);
      setView("detail");
      setAnswer("");
      setQuestion("");
      toast.success("Briefing prepared");
      fetchBriefings();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to prepare briefing");
    } finally {
      setPreparing(false);
    }
  }

  async function askFollowUp() {
    if (!activeBriefing || !question.trim()) {
      return;
    }
    try {
      setAsking(true);
      const response = await fetch("/api/v1/plugins/conversation-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "follow-up", id: activeBriefing.id, question }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to answer follow-up");
      }
      setAnswer(data.answer || "");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to answer follow-up");
    } finally {
      setAsking(false);
    }
  }

  async function deleteBriefing(id: string) {
    try {
      const response = await fetch("/api/v1/plugins/conversation-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete briefing");
      }
      toast.success("Briefing deleted");
      if (activeBriefing?.id === id) {
        setActiveBriefing(null);
        setView("list");
      }
      fetchBriefings();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete briefing");
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
                  <UserCheck className="h-5 w-5 text-teal-400" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-zinc-100">Conversation Prep</h1>
                  <p className="text-sm text-zinc-500">Brief yourself before meetings, calls, or interviews</p>
                </div>
              </div>
              <button
                onClick={() => setView(view === "create" ? "list" : "create")}
                className="flex items-center gap-2 rounded-xl border border-teal-500/20 bg-teal-500/10 px-4 py-2.5 text-sm font-medium text-teal-400 transition-all hover:bg-teal-500/20"
              >
                {view === "create" ? <ArrowLeft className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {view === "create" ? "Back" : "New Briefing"}
              </button>
            </div>

            {view === "create" && (
              <div className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">Subject</label>
                    <input
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      placeholder="Who or what are you preparing for?"
                      className="w-full rounded-xl border border-white/[0.08] bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-teal-500/30 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">Type</label>
                    <select value={type} onChange={(event) => setType(event.target.value as Briefing["type"])} className="w-full rounded-xl border border-white/[0.08] bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 focus:border-teal-500/30 focus:outline-none">
                      <option value="person">Person</option>
                      <option value="topic">Topic</option>
                      <option value="company">Company</option>
                      <option value="project">Project</option>
                    </select>
                  </div>
                  <div className="sm:col-span-1">
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">Context</label>
                    <input
                      value={context}
                      onChange={(event) => setContext(event.target.value)}
                      placeholder="Upcoming call, interview, partnership chat..."
                      className="w-full rounded-xl border border-white/[0.08] bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-teal-500/30 focus:outline-none"
                    />
                  </div>
                </div>

                <button onClick={prepare} disabled={preparing} className="mt-4 flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-black transition-all hover:bg-teal-400 disabled:opacity-50">
                  {preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                  Prepare Briefing
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
              </div>
            ) : briefings.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/50 p-12 text-center">
                <MessageSquare className="mx-auto mb-4 h-8 w-8 text-zinc-600" />
                <h2 className="text-base font-medium text-zinc-200">No briefings yet</h2>
                <p className="mt-2 text-sm text-zinc-500">Create a briefing for a person, topic, company, or project.</p>
              </div>
            ) : (
              <Stagger>
                <div className="space-y-3">
                  {briefings.map((briefing) => (
                    <button key={briefing.id} onClick={() => openBriefing(briefing.id)} className="group w-full rounded-2xl border border-white/[0.06] bg-zinc-900/50 p-5 text-left transition-all hover:border-white/[0.12] hover:bg-zinc-900/80">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-medium text-zinc-200 group-hover:text-white">{briefing.subject}</h3>
                            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">{briefing.type}</span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm text-zinc-500">{briefing.preview}</p>
                          <p className="mt-3 text-[11px] text-zinc-600">{briefing.sectionCount} sections · {briefing.sourceCount} sources</p>
                        </div>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteBriefing(briefing.id);
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

        {view === "detail" && activeBriefing && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button onClick={() => setView("list")} className="flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-300">
                <ArrowLeft className="h-4 w-4" />
                All Briefings
              </button>
              <button onClick={() => deleteBriefing(activeBriefing.id)} className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-zinc-900/70 px-3 py-2 text-xs text-zinc-300 transition-all hover:border-rose-500/20 hover:text-rose-400">
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/50 p-5">
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">{activeBriefing.subject}</h1>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
                <span>{activeBriefing.type}</span>
                {activeBriefing.context ? <span>{activeBriefing.context}</span> : null}
                <span>{activeBriefing.sourceCount} sources</span>
              </div>
            </div>

            <div className="space-y-4">
              {activeBriefing.sections.map((section) => (
                <div key={section.title} className="rounded-2xl border border-white/[0.06] bg-zinc-900/50 p-5">
                  <div className="mb-3 text-sm font-medium text-zinc-200">{section.title}</div>
                  <div className="space-y-2">
                    {section.items.map((item, index) => (
                      <div key={`${section.title}-${index}`} className="flex gap-3 text-sm text-zinc-400">
                        <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400/60" />
                        <div>{item}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/50 p-5">
              <div className="mb-3 text-sm font-medium text-zinc-200">Ask a Follow-up</div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="What should I ask them? What do I know about their priorities?"
                  className="flex-1 rounded-xl border border-white/[0.08] bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-teal-500/30 focus:outline-none"
                />
                <button onClick={askFollowUp} disabled={asking || !question.trim()} className="flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-3 text-sm font-semibold text-black transition-all hover:bg-teal-400 disabled:opacity-50">
                  {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Ask
                </button>
              </div>

              {answer && (
                <div className="mt-4 rounded-xl border border-teal-500/10 bg-teal-500/[0.03] p-4 text-sm leading-7 text-zinc-300">
                  {answer}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
