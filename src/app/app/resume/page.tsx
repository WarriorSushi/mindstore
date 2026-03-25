"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileUser,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { PageTransition, Stagger } from "@/components/PageTransition";

interface ResumeSummary {
  id: string;
  title: string;
  targetRole: string;
  template: string;
  sectionCount: number;
  sourceCount: number;
  createdAt: string;
  updatedAt: string;
  preview: string;
}

interface ResumeSection {
  id: string;
  type: string;
  title: string;
  content: string;
  visible: boolean;
  order: number;
}

interface Resume {
  id: string;
  title: string;
  targetRole: string;
  template: string;
  sections: ResumeSection[];
  sourceMemoryIds: string[];
  sourceCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ResumeTemplate {
  id: string;
  name: string;
  description: string;
  sections: string[];
}

export default function ResumePage() {
  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [activeResume, setActiveResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingSectionId, setSavingSectionId] = useState<string | null>(null);
  const [refiningSectionId, setRefiningSectionId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [targetRole, setTargetRole] = useState("");
  const [template, setTemplate] = useState("modern");
  const [additionalContext, setAdditionalContext] = useState("");
  const [refineInstruction, setRefineInstruction] = useState<Record<string, string>>({});

  const fetchResumes = useCallback(async () => {
    try {
      const [resumeResponse, templateResponse] = await Promise.all([
        fetch("/api/v1/plugins/resume-builder?action=list"),
        fetch("/api/v1/plugins/resume-builder?action=templates"),
      ]);
      const resumeData = await resumeResponse.json();
      const templateData = await templateResponse.json();
      if (!resumeResponse.ok) {
        throw new Error(resumeData.error || "Failed to load resumes");
      }
      setResumes(resumeData.resumes || []);
      setTemplates(templateResponse.ok ? templateData.templates || [] : []);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load resumes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResumes();
  }, [fetchResumes]);

  async function openResume(id: string) {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/plugins/resume-builder?action=get&id=${id}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load resume");
      }
      setActiveResume(data.resume);
      setView("detail");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load resume");
    } finally {
      setLoading(false);
    }
  }

  async function generateResume() {
    if (!targetRole.trim()) {
      toast.error("Enter a target role first");
      return;
    }
    try {
      setGenerating(true);
      const response = await fetch("/api/v1/plugins/resume-builder?action=generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole, template, additionalContext }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate resume");
      }
      setActiveResume(data.resume);
      setView("detail");
      toast.success("Resume generated");
      fetchResumes();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to generate resume");
    } finally {
      setGenerating(false);
    }
  }

  async function saveSection(sectionId: string, content: string, title?: string, visible?: boolean) {
    if (!activeResume) {
      return;
    }
    try {
      setSavingSectionId(sectionId);
      const response = await fetch("/api/v1/plugins/resume-builder?action=update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeResume.id, sectionId, content, title, visible }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save section");
      }
      setActiveResume(data.resume);
      toast.success("Resume section saved");
      fetchResumes();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save section");
    } finally {
      setSavingSectionId(null);
    }
  }

  async function refineSection(sectionId: string) {
    if (!activeResume) {
      return;
    }
    try {
      setRefiningSectionId(sectionId);
      const response = await fetch("/api/v1/plugins/resume-builder?action=refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeResume.id,
          sectionId,
          instruction: refineInstruction[sectionId] || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to refine section");
      }
      setActiveResume((current) => current ? {
        ...current,
        sections: current.sections.map((section) => section.id === sectionId ? { ...section, content: data.section.content } : section),
      } : current);
      setRefineInstruction((current) => ({ ...current, [sectionId]: "" }));
      toast.success("Section refined");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to refine section");
    } finally {
      setRefiningSectionId(null);
    }
  }

  async function removeResume(id: string) {
    try {
      const response = await fetch("/api/v1/plugins/resume-builder?action=delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete resume");
      }
      if (activeResume?.id === id) {
        setActiveResume(null);
        setView("list");
      }
      toast.success("Resume deleted");
      fetchResumes();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete resume");
    }
  }

  function copyResume() {
    if (!activeResume) {
      return;
    }
    const markdown = `# ${activeResume.title}\n\n${activeResume.sections.filter((section) => section.visible).map((section) => `## ${section.title}\n\n${section.content}`).join("\n\n")}`;
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function downloadResume() {
    if (!activeResume) {
      return;
    }
    const blob = new Blob(
      [`# ${activeResume.title}\n\n${activeResume.sections.filter((section) => section.visible).map((section) => `## ${section.title}\n\n${section.content}`).join("\n\n")}`],
      { type: "text/markdown" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeResume.targetRole.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}-resume.md`;
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
                  <FileUser className="h-5 w-5 text-teal-400" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-zinc-100">Resume Builder</h1>
                  <p className="text-sm text-zinc-500">Build a resume from your professional memories</p>
                </div>
              </div>
              <button onClick={() => setView(view === "create" ? "list" : "create")} className="flex items-center gap-2 rounded-xl border border-teal-500/20 bg-teal-500/10 px-4 py-2.5 text-sm font-medium text-teal-400 transition-all hover:bg-teal-500/20">
                {view === "create" ? <ArrowLeft className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {view === "create" ? "Back" : "New Resume"}
              </button>
            </div>

            {view === "create" && (
              <div className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="space-y-4">
                  <input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="Target role" className="w-full rounded-xl border border-white/[0.08] bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-teal-500/30 focus:outline-none" />
                  <select value={template} onChange={(event) => setTemplate(event.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 focus:border-teal-500/30 focus:outline-none">
                    {templates.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                  </select>
                  <textarea value={additionalContext} onChange={(event) => setAdditionalContext(event.target.value)} placeholder="Additional context, roles, or companies you want to target" rows={3} className="w-full rounded-xl border border-white/[0.08] bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-teal-500/30 focus:outline-none" />
                  <button onClick={generateResume} disabled={generating} className="flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-black transition-all hover:bg-teal-400 disabled:opacity-50">
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Generate Resume
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
              </div>
            ) : resumes.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/50 p-12 text-center">
                <FileUser className="mx-auto mb-4 h-8 w-8 text-zinc-600" />
                <h2 className="text-base font-medium text-zinc-200">No resumes yet</h2>
                <p className="mt-2 text-sm text-zinc-500">Generate a resume from your work history, skills, and projects.</p>
              </div>
            ) : (
              <Stagger>
                <div className="space-y-3">
                  {resumes.map((resume) => (
                    <button key={resume.id} onClick={() => openResume(resume.id)} className="group w-full rounded-2xl border border-white/[0.06] bg-zinc-900/50 p-5 text-left transition-all hover:border-white/[0.12] hover:bg-zinc-900/80">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-zinc-200 group-hover:text-white">{resume.title}</div>
                          <div className="mt-1 text-sm text-zinc-500">{resume.targetRole}</div>
                          <div className="mt-2 text-xs text-zinc-600">{resume.template} · {resume.sectionCount} sections · {resume.sourceCount} sources</div>
                        </div>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            removeResume(resume.id);
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

        {view === "detail" && activeResume && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button onClick={() => setView("list")} className="flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-300">
                <ArrowLeft className="h-4 w-4" />
                All Resumes
              </button>
              <div className="flex items-center gap-2">
                <button onClick={copyResume} className="rounded-lg border border-white/[0.08] bg-zinc-900/70 px-3 py-2 text-xs text-zinc-300 transition-all hover:border-white/[0.12]">
                  {copied ? <Copy className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
                <button onClick={downloadResume} className="rounded-lg border border-white/[0.08] bg-zinc-900/70 px-3 py-2 text-xs text-zinc-300 transition-all hover:border-white/[0.12]">
                  <Download className="h-4 w-4" />
                </button>
                <button onClick={() => removeResume(activeResume.id)} className="rounded-lg border border-white/[0.08] bg-zinc-900/70 px-3 py-2 text-xs text-zinc-300 transition-all hover:border-rose-500/20 hover:text-rose-400">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/50 p-5">
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">{activeResume.title}</h1>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
                <span>{activeResume.targetRole}</span>
                <span>{activeResume.template}</span>
                <span>{activeResume.sourceCount} sources</span>
              </div>
            </div>

            <div className="space-y-4">
              {activeResume.sections.map((section) => (
                <div key={section.id} className="rounded-2xl border border-white/[0.06] bg-zinc-900/50 p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <input
                      value={section.title}
                      onChange={(event) => setActiveResume((current) => current ? {
                        ...current,
                        sections: current.sections.map((entry) => entry.id === section.id ? { ...entry, title: event.target.value } : entry),
                      } : current)}
                      className="flex-1 bg-transparent text-sm font-medium text-zinc-200 outline-none"
                    />
                    <button onClick={() => saveSection(section.id, section.content, section.title, !section.visible)} className="rounded-lg border border-white/[0.08] bg-zinc-900/70 px-3 py-2 text-xs text-zinc-300 transition-all hover:border-white/[0.12]">
                      {section.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                  </div>
                  <textarea
                    value={section.content}
                    onChange={(event) => setActiveResume((current) => current ? {
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
                    <button onClick={() => refineSection(section.id)} disabled={refiningSectionId === section.id} className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-zinc-900/70 px-4 py-3 text-sm text-teal-400 transition-all hover:border-teal-500/20 disabled:opacity-50">
                      {refiningSectionId === section.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      Refine
                    </button>
                    <button onClick={() => saveSection(section.id, section.content, section.title, section.visible)} disabled={savingSectionId === section.id} className="flex items-center justify-center gap-2 rounded-xl bg-teal-500/10 px-4 py-3 text-sm font-medium text-teal-400 transition-all hover:bg-teal-500/20 disabled:opacity-50">
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

