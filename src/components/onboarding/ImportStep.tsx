"use client";

import { useState, useRef, useCallback } from "react";
import {
  MessageCircle, Type, Globe, Upload, Loader2, Check,
  AlertCircle, ChevronRight, FileText, ArrowRight,
} from "lucide-react";
import type { StepProps } from "./types";

type ImportMethod = "chatgpt" | "text" | "url";

export function ImportStep({ onNext, onSkip, state, setState }: StepProps) {
  const [method, setMethod] = useState<ImportMethod | null>(null);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [error, setError] = useState("");

  // Text paste
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteContent, setPasteContent] = useState("");

  // URL
  const [urlInput, setUrlInput] = useState("");

  // File ref
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileImport = useCallback(async (file: File) => {
    setImporting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/v1/import", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const count = data.imported || data.count || 1;
        setImportCount(count);
        setImportDone(true);
        setState(prev => ({ ...prev, hasMemories: true, memoryCount: count }));
        setTimeout(() => onNext(), 800);
      } else {
        // Try JSON import as fallback
        try {
          const text = await file.text();
          const json = JSON.parse(text);
          const conversations = Array.isArray(json) ? json : [json];
          const documents: { title: string; content: string; sourceType: string; sourceId: string }[] = [];

          for (const conv of conversations) {
            if (conv.mapping) {
              const title = conv.title || "Untitled";
              const messages = Object.values(conv.mapping) as any[];
              for (const node of messages) {
                const msg = (node as any)?.message;
                if (msg?.content?.parts?.length && msg.author?.role === "assistant") {
                  documents.push({
                    title,
                    content: msg.content.parts.join("\n"),
                    sourceType: "chatgpt",
                    sourceId: conv.id || "__import__",
                  });
                }
              }
            }
          }

          if (documents.length > 0) {
            const importRes = await fetch("/api/v1/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ documents }),
            });

            if (importRes.ok) {
              setImportCount(documents.length);
              setImportDone(true);
              setState(prev => ({ ...prev, hasMemories: true, memoryCount: documents.length }));
              setTimeout(() => onNext(), 800);
            } else {
              setError("Import failed — please try again");
            }
          } else {
            setError("No conversations found in this file. Make sure it's a ChatGPT export.");
          }
        } catch {
          setError("Could not parse that file. Try a ChatGPT ZIP or JSON export.");
        }
      }
    } catch {
      setError("Upload failed — please check the file and try again");
    }
    setImporting(false);
  }, [onNext, setState]);

  const handleTextImport = useCallback(async () => {
    if (!pasteContent.trim()) return;
    setImporting(true);
    setError("");

    try {
      const res = await fetch("/api/v1/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents: [{
            title: pasteTitle.trim() || "Imported note",
            content: pasteContent.trim(),
            sourceType: "text",
            sourceId: `onboarding-${Date.now()}`,
          }],
        }),
      });

      if (res.ok) {
        setImportCount(1);
        setImportDone(true);
        setState(prev => ({ ...prev, hasMemories: true, memoryCount: prev.memoryCount + 1 }));
        setTimeout(() => onNext(), 800);
      } else {
        setError("Import failed — please try again");
      }
    } catch {
      setError("Import failed — please try again");
    }
    setImporting(false);
  }, [pasteTitle, pasteContent, onNext, setState]);

  const handleUrlImport = useCallback(async () => {
    if (!urlInput.trim()) return;
    setImporting(true);
    setError("");

    try {
      const res = await fetch("/api/v1/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents: [{
            title: urlInput.trim(),
            content: urlInput.trim(),
            sourceType: "url",
            sourceId: urlInput.trim(),
          }],
        }),
      });

      if (res.ok) {
        setImportCount(1);
        setImportDone(true);
        setState(prev => ({ ...prev, hasMemories: true, memoryCount: prev.memoryCount + 1 }));
        setTimeout(() => onNext(), 800);
      } else {
        setError("Import failed — please check the URL and try again");
      }
    } catch {
      setError("Import failed — please try again");
    }
    setImporting(false);
  }, [urlInput, onNext, setState]);

  // Success state
  if (importDone) {
    return (
      <div className="text-center space-y-6 py-8">
        <div
          className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto"
          style={{ animation: "onb-check-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards" }}
        >
          <Check className="w-8 h-8 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-[18px] font-semibold">
            {importCount} {importCount === 1 ? "memory" : "memories"} imported
          </h3>
          <p className="text-[13px] text-zinc-500 mt-1">
            Moving to the next step...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-[24px] md:text-[28px] font-bold tracking-[-0.03em] leading-[1.1]">
          Add your first
          <br />
          <span className="text-zinc-400">knowledge</span>
        </h2>
        <p className="text-[14px] text-zinc-500 mt-2">
          Pick the easiest way to get started. You can always import more later.
        </p>
      </div>

      {/* Import method cards */}
      {method === null ? (
        <div className="space-y-2.5">
          {/* ChatGPT — highlighted as primary */}
          <button
            onClick={() => setMethod("chatgpt")}
            className="w-full group rounded-2xl border border-teal-500/20 bg-teal-500/[0.05] hover:bg-teal-500/[0.08] p-4 text-left transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-teal-500/15 flex items-center justify-center shrink-0 group-hover:bg-teal-500/20 transition-colors">
                <MessageCircle className="w-5 h-5 text-teal-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-medium text-white">ChatGPT Export</p>
                  <span className="text-[9px] px-1.5 py-[2px] rounded-md bg-teal-500/15 text-teal-400 border border-teal-500/20 font-bold tracking-wide">
                    BEST START
                  </span>
                </div>
                <p className="text-[12px] text-zinc-500 mt-0.5">
                  Upload your ChatGPT data export (ZIP or JSON)
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-teal-500/50 group-hover:text-teal-400 transition-colors shrink-0" />
            </div>
          </button>

          {/* Text / Notes */}
          <button
            onClick={() => setMethod("text")}
            className="w-full group rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] p-4 text-left transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-sky-500/10 flex items-center justify-center shrink-0 group-hover:bg-sky-500/15 transition-colors">
                <Type className="w-5 h-5 text-sky-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-zinc-200">Paste Text or Notes</p>
                <p className="text-[12px] text-zinc-500 mt-0.5">
                  Paste anything — notes, ideas, highlights, snippets
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0" />
            </div>
          </button>

          {/* URL */}
          <button
            onClick={() => setMethod("url")}
            className="w-full group rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] p-4 text-left transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 group-hover:bg-amber-500/15 transition-colors">
                <Globe className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-zinc-200">Import a URL</p>
                <p className="text-[12px] text-zinc-500 mt-0.5">
                  Save any article, blog post, or webpage
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0" />
            </div>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Back to method selection */}
          <button
            onClick={() => { setMethod(null); setError(""); }}
            className="text-[12px] text-zinc-500 hover:text-zinc-400 font-medium transition-colors"
          >
            &larr; Back to options
          </button>

          {/* ChatGPT upload */}
          {method === "chatgpt" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-500/15 flex items-center justify-center shrink-0">
                    <MessageCircle className="w-4.5 h-4.5 text-teal-400" />
                  </div>
                  <h3 className="text-[15px] font-medium">ChatGPT Export</h3>
                </div>

                <ol className="space-y-2 text-[13px] text-zinc-400">
                  <li className="flex items-start gap-2.5">
                    <span className="text-teal-500 font-bold mt-0.5 shrink-0">1.</span>
                    <span>Go to <span className="text-zinc-200">chatgpt.com</span> &rarr; Settings &rarr; Data controls &rarr; Export data</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-teal-500 font-bold mt-0.5 shrink-0">2.</span>
                    <span>Download the ZIP from your email</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-teal-500 font-bold mt-0.5 shrink-0">3.</span>
                    <span>Upload the file below</span>
                  </li>
                </ol>

                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={importing}
                  className="w-full h-24 rounded-xl border-2 border-dashed border-white/[0.08] hover:border-teal-500/30 bg-white/[0.01] hover:bg-teal-500/[0.03] flex flex-col items-center justify-center gap-2 transition-all group"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
                      <span className="text-[13px] text-teal-400">Importing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-zinc-600 group-hover:text-teal-400 transition-colors" />
                      <span className="text-[13px] text-zinc-500 group-hover:text-zinc-400 transition-colors">
                        Drop file or click to upload
                      </span>
                    </>
                  )}
                </button>

                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,.zip"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileImport(file);
                  }}
                />
              </div>
            </div>
          )}

          {/* Text paste */}
          {method === "text" && (
            <div className="space-y-3">
              <input
                type="text"
                value={pasteTitle}
                onChange={(e) => setPasteTitle(e.target.value)}
                placeholder="Title (optional)"
                className="w-full h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-sky-500/30 focus:border-sky-500/30 transition-all"
              />
              <textarea
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                placeholder="Paste your text, notes, or ideas here..."
                rows={6}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-sky-500/30 focus:border-sky-500/30 transition-all resize-none"
              />
              <button
                onClick={handleTextImport}
                disabled={!pasteContent.trim() || importing}
                className="w-full h-11 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-white/[0.06] disabled:text-zinc-600 text-white text-[14px] font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Save to MindStore
                  </>
                )}
              </button>
            </div>
          )}

          {/* URL */}
          {method === "url" && (
            <div className="space-y-3">
              <div className="relative">
                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUrlImport()}
                  placeholder="https://example.com/article"
                  className="w-full h-12 pl-10 pr-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[14px] placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500/30 transition-all"
                />
              </div>
              <button
                onClick={handleUrlImport}
                disabled={!urlInput.trim() || importing}
                className="w-full h-11 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-white/[0.06] disabled:text-zinc-600 text-white text-[14px] font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Globe className="w-4 h-4" />
                    Import URL
                  </>
                )}
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-[12px] text-red-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
        </div>
      )}

      {/* Skip */}
      {!importDone && (
        <button
          onClick={onSkip}
          className="w-full h-10 text-[13px] text-zinc-500 hover:text-zinc-400 font-medium transition-colors"
        >
          Skip — I&apos;ll import later
        </button>
      )}
    </div>
  );
}
