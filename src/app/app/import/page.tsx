"use client";

import { useState, useCallback } from "react";
import { Upload, FileJson, FileText, Globe, Type, Loader2, CheckCircle, MessageCircle, BookOpen, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type ImportState = "idle" | "parsing" | "uploading" | "done" | "error";
type Tab = "chatgpt" | "text" | "files" | "url" | "obsidian" | "notion";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "chatgpt", label: "ChatGPT", icon: MessageCircle },
  { id: "text", label: "Text", icon: Type },
  { id: "files", label: "Files", icon: FileText },
  { id: "url", label: "URL", icon: Globe },
  { id: "obsidian", label: "Obsidian", icon: BookOpen },
  { id: "notion", label: "Notion", icon: StickyNote },
];

export default function ImportPage() {
  const [tab, setTab] = useState<Tab>("chatgpt");
  const [state, setState] = useState<ImportState>("idle");
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [urlInput, setUrlInput] = useState("");

  const importViaApi = async (formData: FormData) => {
    setState("uploading");
    setProgress(50);
    setProgressText("Uploading and processing...");
    try {
      const res = await fetch('/api/v1/import', { method: 'POST', body: formData });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Import failed'); }
      const result = await res.json();
      setState("done");
      setProgress(100);
      setProgressText(`Added ${result.imported.chunks} memories from ${result.imported.documents} source(s).`);
      toast.success(`Imported ${result.imported.chunks} memories!`);
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
      setState("error");
      setProgressText(`Error: ${err.message}`);
    }
  };

  const importJsonViaApi = async (documents: Array<{ title: string; content: string; sourceType: string }>) => {
    setState("uploading");
    setProgress(50);
    setProgressText("Processing...");
    try {
      const res = await fetch('/api/v1/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Import failed'); }
      const result = await res.json();
      setState("done");
      setProgress(100);
      setProgressText(`Added ${result.imported.chunks} memories from ${result.imported.documents} source(s).`);
      toast.success(`Imported ${result.imported.chunks} memories!`);
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
      setState("error");
      setProgressText(`Error: ${err.message}`);
    }
  };

  const handleChatGPTImport = useCallback(async (file: File) => {
    setState("parsing");
    setProgressText("Uploading ChatGPT export...");
    setProgress(10);
    const formData = new FormData();
    formData.append('files', file);
    formData.append('source_type', 'chatgpt');
    await importViaApi(formData);
  }, []);

  const handleTextImport = async () => {
    if (!textContent.trim()) return;
    const title = textTitle.trim() || `Note — ${new Date().toLocaleDateString()}`;
    setState("parsing");
    setProgressText("Processing text...");
    await importJsonViaApi([{ title, content: textContent, sourceType: 'text' }]);
    setTextTitle("");
    setTextContent("");
  };

  const handleFileImport = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setState("parsing");
    const formData = new FormData();
    formData.append('source_type', 'file');
    for (const file of Array.from(files)) {
      if (!file.name.match(/\.(txt|md|markdown)$/i)) {
        toast.error(`Skipped ${file.name} — only .txt and .md files supported`);
        continue;
      }
      formData.append('files', file);
    }
    await importViaApi(formData);
  };

  const handleUrlImport = async () => {
    if (!urlInput.trim()) return;
    setState("parsing");
    setProgressText("Fetching URL...");
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(urlInput.trim())}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error("Failed to fetch URL");
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      doc.querySelectorAll("script, style, nav, footer, header").forEach((el) => el.remove());
      const text = doc.body?.innerText || doc.body?.textContent || "";
      if (text.trim().length < 50) { toast.error("Could not extract content."); setState("idle"); return; }
      await importJsonViaApi([{ title: doc.title || urlInput, content: text, sourceType: 'url' }]);
      setUrlInput("");
    } catch (err: any) {
      toast.error(`URL fetch failed: ${err.message}`);
      setState("error");
    }
  };

  const handleVaultImport = async (files: FileList | null, type: string) => {
    if (!files || files.length === 0) return;
    setState("parsing");
    setProgressText(`Reading ${type} files...`);
    const formData = new FormData();
    formData.append('source_type', 'file');
    for (const file of Array.from(files)) {
      if (file.name.endsWith('.md') || file.name.endsWith('.txt')) {
        formData.append('files', file);
      }
    }
    await importViaApi(formData);
  };

  const resetState = () => { setState("idle"); setProgress(0); setProgressText(""); };
  const isProcessing = state !== "idle" && state !== "done" && state !== "error";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl md:text-3xl font-bold">Import Knowledge</h1>
        <p className="text-zinc-400 text-xs md:text-sm mt-0.5">Feed your mind. The more you import, the smarter it gets.</p>
      </div>

      {/* Progress Banner */}
      {state !== "idle" && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-2.5">
          <div className="flex items-center gap-2.5">
            {state === "done" ? <CheckCircle className="w-4 h-4 text-green-400" /> :
             state === "error" ? <span className="text-red-400 text-xs">✕</span> :
             <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />}
            <span className="text-sm">{progressText}</span>
          </div>
          <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          {(state === "done" || state === "error") && (
            <Button variant="outline" size="sm" onClick={resetState} className="h-7 text-xs border-zinc-700">
              Import More
            </Button>
          )}
        </div>
      )}

      {/* Tab Selector — horizontally scrollable on mobile */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
              tab === t.id
                ? "bg-violet-500/15 text-violet-300 border border-violet-500/20"
                : "text-zinc-400 border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
        {tab === "chatgpt" && (
          <>
            <div className="text-xs text-zinc-400 space-y-1.5">
              <p className="font-medium text-zinc-300">How to export from ChatGPT:</p>
              <ol className="list-decimal list-inside space-y-1 text-zinc-500">
                <li>Go to <a href="https://chatgpt.com" target="_blank" className="text-violet-400">chatgpt.com</a></li>
                <li>Profile → Settings → Data Controls → Export</li>
                <li>Download ZIP from email</li>
                <li>Drop it below</li>
              </ol>
            </div>
            <DropZone
              id="chatgpt-file"
              accept=".json,.zip"
              icon={<Upload className="w-8 h-8 text-zinc-600" />}
              text="Drop ChatGPT export"
              subtext=".zip or .json"
              disabled={isProcessing}
              onFile={(f) => handleChatGPTImport(f)}
            />
          </>
        )}

        {tab === "text" && (
          <>
            <Input
              placeholder="Title (optional)"
              value={textTitle}
              onChange={(e) => setTextTitle(e.target.value)}
              className="bg-zinc-800/50 border-white/[0.06] h-9 text-sm"
            />
            <Textarea
              placeholder="Paste notes, articles, thoughts..."
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              rows={8}
              className="bg-zinc-800/50 border-white/[0.06] text-sm"
            />
            <Button onClick={handleTextImport} disabled={isProcessing || !textContent.trim()} className="bg-violet-600 hover:bg-violet-500 h-9 text-sm">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Import Text
            </Button>
          </>
        )}

        {tab === "files" && (
          <>
            <p className="text-xs text-zinc-500">Upload .txt or .md files. Select multiple files at once.</p>
            <DropZone
              id="file-upload"
              accept=".txt,.md,.markdown"
              multiple
              icon={<FileText className="w-8 h-8 text-zinc-600" />}
              text="Drop files here"
              subtext=".txt or .md"
              disabled={isProcessing}
              onFiles={(f) => handleFileImport(f)}
            />
          </>
        )}

        {tab === "url" && (
          <>
            <p className="text-xs text-zinc-500">Paste a URL to extract text content.</p>
            <div className="flex gap-2">
              <Input
                placeholder="https://..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUrlImport()}
                className="bg-zinc-800/50 border-white/[0.06] h-9 text-sm"
              />
              <Button onClick={handleUrlImport} disabled={isProcessing || !urlInput.trim()} className="bg-violet-600 hover:bg-violet-500 h-9 text-sm shrink-0">
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Import"}
              </Button>
            </div>
            <p className="text-[10px] text-zinc-600">Some websites may block extraction due to CORS.</p>
          </>
        )}

        {tab === "obsidian" && (
          <>
            <div className="text-xs text-zinc-400 space-y-1">
              <p className="font-medium text-zinc-300">Import from Obsidian:</p>
              <p className="text-zinc-500">Select .md files from your vault folder.</p>
            </div>
            <DropZone
              id="obsidian-upload"
              accept=".md,.txt,.markdown"
              multiple
              icon={<BookOpen className="w-8 h-8 text-zinc-600" />}
              text="Drop Obsidian .md files"
              subtext="select multiple"
              disabled={isProcessing}
              onFiles={(f) => handleVaultImport(f, "Obsidian")}
            />
          </>
        )}

        {tab === "notion" && (
          <>
            <div className="text-xs text-zinc-400 space-y-1">
              <p className="font-medium text-zinc-300">Import from Notion:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-zinc-500">
                <li>Settings → Export → Markdown & CSV</li>
                <li>Extract ZIP, select .md files</li>
              </ol>
            </div>
            <DropZone
              id="notion-upload"
              accept=".md,.markdown"
              multiple
              icon={<StickyNote className="w-8 h-8 text-zinc-600" />}
              text="Drop Notion .md files"
              subtext="UUID suffixes auto-cleaned"
              disabled={isProcessing}
              onFiles={(f) => handleVaultImport(f, "Notion")}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Reusable Drop Zone ───
function DropZone({
  id, accept, multiple, icon, text, subtext, disabled,
  onFile, onFiles,
}: {
  id: string; accept: string; multiple?: boolean;
  icon: React.ReactNode; text: string; subtext: string;
  disabled: boolean;
  onFile?: (f: File) => void;
  onFiles?: (f: FileList) => void;
}) {
  return (
    <>
      <div
        className="border-2 border-dashed border-white/[0.08] rounded-xl p-8 md:p-10 text-center hover:border-violet-500/30 transition-all cursor-pointer active:scale-[0.99]"
        onClick={() => document.getElementById(id)?.click()}
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-violet-500/30", "bg-violet-500/5"); }}
        onDragLeave={(e) => { e.currentTarget.classList.remove("border-violet-500/30", "bg-violet-500/5"); }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("border-violet-500/30", "bg-violet-500/5");
          if (onFile) onFile(e.dataTransfer.files[0]);
          if (onFiles) onFiles(e.dataTransfer.files);
        }}
      >
        <div className="mb-2">{icon}</div>
        <p className="text-sm text-zinc-400">{text}</p>
        <p className="text-[11px] text-zinc-600 mt-0.5">{subtext}</p>
      </div>
      <input
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          if (onFile && e.target.files?.[0]) onFile(e.target.files[0]);
          if (onFiles && e.target.files) onFiles(e.target.files);
        }}
      />
    </>
  );
}
