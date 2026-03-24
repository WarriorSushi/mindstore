"use client";

import { useState, useCallback, useEffect } from "react";
import { FileText, Globe, Type, Loader2, CheckCircle, MessageCircle, BookOpen, StickyNote, Clock, Compass, Package, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { PageTransition, Stagger } from "@/components/PageTransition";

type ImportState = "idle" | "parsing" | "uploading" | "done" | "error";
type Tab = "chatgpt" | "text" | "files" | "url" | "obsidian" | "notion";

const TABS: { id: Tab; label: string; icon: any; desc: string }[] = [
  { id: "chatgpt", label: "ChatGPT", icon: MessageCircle, desc: "ZIP or JSON" },
  { id: "text", label: "Text", icon: Type, desc: "Paste anything" },
  { id: "files", label: "Files", icon: FileText, desc: ".txt, .md" },
  { id: "url", label: "URL", icon: Globe, desc: "Extract page" },
  { id: "obsidian", label: "Obsidian", icon: BookOpen, desc: "Vault export" },
  { id: "notion", label: "Notion", icon: StickyNote, desc: "MD export" },
];

interface ImportSource {
  id: string;
  type: string;
  title: string;
  itemCount: number;
  importedAt: string;
}

export default function ImportPage() {
  const [tab, setTab] = useState<Tab>("chatgpt");
  const [state, setState] = useState<ImportState>("idle");
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [importHistory, setImportHistory] = useState<ImportSource[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [totalMemories, setTotalMemories] = useState(0);

  // Fetch import history on mount
  const refreshHistory = useCallback(async () => {
    try {
      const [sourcesRes, statsRes] = await Promise.all([
        fetch('/api/v1/sources'),
        fetch('/api/v1/stats'),
      ]);
      if (sourcesRes.ok) {
        const data = await sourcesRes.json();
        // Sort by importedAt (most recent first)
        const sorted = (data.sources || []).sort((a: ImportSource, b: ImportSource) =>
          new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
        );
        setImportHistory(sorted);
      }
      if (statsRes.ok) {
        const stats = await statsRes.json();
        setTotalMemories(stats.totalMemories || 0);
      }
    } catch {}
    setHistoryLoading(false);
  }, []);

  useEffect(() => { refreshHistory(); }, [refreshHistory]);

  const importViaApi = async (formData: FormData) => {
    setState("uploading"); setProgress(50); setProgressText("Processing…");
    try {
      const res = await fetch('/api/v1/import', { method: 'POST', body: formData });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      const r = await res.json();
      setState("done"); setProgress(100);
      setProgressText(`${r.imported.chunks} memories from ${r.imported.documents} source(s)`);
      toast.success(`Imported ${r.imported.chunks} memories`);
      refreshHistory(); // Refresh import history after successful import
    } catch (err: any) { toast.error(err.message); setState("error"); setProgressText(err.message); }
  };

  const importJsonViaApi = async (docs: Array<{ title: string; content: string; sourceType: string }>) => {
    setState("uploading"); setProgress(50); setProgressText("Processing…");
    try {
      const res = await fetch('/api/v1/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documents: docs }) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      const r = await res.json();
      setState("done"); setProgress(100);
      setProgressText(`${r.imported.chunks} memories from ${r.imported.documents} source(s)`);
      toast.success(`Imported ${r.imported.chunks} memories`);
      refreshHistory(); // Refresh import history after successful import
    } catch (err: any) { toast.error(err.message); setState("error"); setProgressText(err.message); }
  };

  const handleChatGPTImport = useCallback(async (file: File) => {
    setState("parsing"); setProgressText("Reading export…"); setProgress(10);
    const fd = new FormData(); fd.append('files', file); fd.append('source_type', 'chatgpt');
    await importViaApi(fd);
  }, []);

  const handleTextImport = async () => {
    if (!textContent.trim()) return;
    await importJsonViaApi([{ title: textTitle.trim() || `Note — ${new Date().toLocaleDateString()}`, content: textContent, sourceType: 'text' }]);
    setTextTitle(""); setTextContent("");
  };

  const handleFileImport = async (files: FileList | null) => {
    if (!files?.length) return; setState("parsing");
    const fd = new FormData(); fd.append('source_type', 'file');
    for (const f of Array.from(files)) { if (f.name.match(/\.(txt|md|markdown)$/i)) fd.append('files', f); }
    await importViaApi(fd);
  };

  const handleUrlImport = async () => {
    if (!urlInput.trim()) return; setState("parsing"); setProgressText("Fetching page…");
    try {
      // Server-side fetch — no CORS proxy needed
      const fetchRes = await fetch('/api/v1/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      if (!fetchRes.ok) {
        const e = await fetchRes.json();
        throw new Error(e.error || 'Failed to fetch URL');
      }
      const { title, content } = await fetchRes.json();
      await importJsonViaApi([{ title, content, sourceType: 'url' }]);
      setUrlInput("");
    } catch (err: any) { toast.error(err.message); setState("error"); setProgressText(err.message); }
  };

  const handleVaultImport = async (files: FileList | null) => {
    if (!files?.length) return; setState("parsing");
    const fd = new FormData(); fd.append('source_type', 'file');
    for (const f of Array.from(files)) { if (f.name.endsWith('.md') || f.name.endsWith('.txt')) fd.append('files', f); }
    await importViaApi(fd);
  };

  const handleNotionImport = async (files: FileList | null) => {
    if (!files?.length) return; setState("parsing"); setProgressText("Cleaning Notion files…");
    // Notion exports have UUIDs in filenames and content links
    // e.g. "My Page 32 char hex.md" and "[link](Another%20Page%2032charhex)"
    const notionIdPattern = /\s+[a-f0-9]{32}(?=\.(md|csv)$)/i;
    const notionLinkIdPattern = /(%20)?[a-f0-9]{32}/gi;
    const docs: Array<{ title: string; content: string; sourceType: string }> = [];

    for (const f of Array.from(files)) {
      if (!f.name.endsWith('.md') && !f.name.endsWith('.txt')) continue;
      let text = await f.text();
      // Clean title: remove Notion UUID from filename
      const title = f.name.replace(notionIdPattern, '').replace(/\.(md|txt)$/, '');
      // Clean content: remove UUIDs from internal links
      text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
        const cleanUrl = url.replace(notionLinkIdPattern, '');
        return `[${label}](${cleanUrl})`;
      });
      docs.push({ title, content: text, sourceType: 'file' });
    }

    if (docs.length === 0) { toast.error("No .md files found"); setState("idle"); return; }
    await importJsonViaApi(docs);
  };

  const reset = () => { setState("idle"); setProgress(0); setProgressText(""); };
  const busy = state === "parsing" || state === "uploading";

  return (
    <PageTransition className="space-y-5 md:space-y-6">
      {/* Header */}
      <Stagger>
        <div>
          <h1 className="text-[22px] md:text-[28px] font-semibold tracking-[-0.03em]">Import</h1>
          <p className="text-[13px] text-zinc-500 mt-0.5">Add knowledge from anywhere</p>
        </div>
      </Stagger>

      {/* Progress */}
      {state !== "idle" && (
        <Stagger>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            {state === "done" ? <CheckCircle className="w-4 h-4 text-green-400" /> :
             state === "error" ? <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center"><span className="text-[10px] text-red-400">!</span></div> :
             <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />}
            <span className="text-[13px]">{progressText}</span>
          </div>
          <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
          </div>
          {(state === "done" || state === "error") && (
            <button onClick={reset} className="text-[12px] text-violet-400 font-medium hover:text-violet-300 transition-colors">
              Import more →
            </button>
          )}
        </div>
        </Stagger>
      )}

      {/* Source Selector */}
      <Stagger>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-col items-center gap-1 p-3 rounded-2xl border transition-all active:scale-[0.96] ${
              tab === t.id
                ? "bg-violet-500/10 border-violet-500/25 shadow-sm shadow-violet-500/10"
                : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
            }`}
          >
            <t.icon className={`w-5 h-5 ${tab === t.id ? "text-violet-400" : "text-zinc-500"}`} />
            <span className={`text-[11px] font-medium ${tab === t.id ? "text-violet-300" : "text-zinc-400"}`}>{t.label}</span>
          </button>
        ))}
      </div>
      </Stagger>

      {/* Tab Content */}
      <Stagger>
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="p-4 md:p-5 space-y-4">
          {tab === "chatgpt" && (
            <>
              <div className="text-[12px] text-zinc-500 space-y-1">
                <p className="text-zinc-300 font-medium">How to export from ChatGPT</p>
                <p>Profile → Settings → Data Controls → Export data → Download ZIP from email</p>
              </div>
              <DropZone
                id="chatgpt-file" accept=".json,.zip" disabled={busy}
                onFile={handleChatGPTImport}
                title="Drop your ChatGPT export"
                subtitle=".zip or .json file"
                icon={<MessageCircle className="w-6 h-6 text-zinc-600" />}
              />
            </>
          )}
          {tab === "text" && (
            <>
              <input
                placeholder="Title (optional)"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                className="w-full h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-all"
              />
              <textarea
                placeholder="Paste notes, articles, thoughts…"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={7}
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-all resize-none"
              />
              <button
                onClick={handleTextImport}
                disabled={busy || !textContent.trim()}
                className="h-9 px-5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-[13px] font-medium text-white transition-all active:scale-[0.97] flex items-center gap-2"
              >
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Import
              </button>
            </>
          )}
          {tab === "files" && (
            <DropZone
              id="file-upload" accept=".txt,.md,.markdown" multiple disabled={busy}
              onFiles={handleFileImport}
              title="Drop text files"
              subtitle=".txt or .md — select multiple"
              icon={<FileText className="w-6 h-6 text-zinc-600" />}
            />
          )}
          {tab === "url" && (
            <>
              <p className="text-[12px] text-zinc-500">Extract text from any webpage</p>
              <div className="flex gap-2">
                <input
                  placeholder="https://…"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUrlImport()}
                  className="flex-1 h-10 px-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-all"
                />
                <button
                  onClick={handleUrlImport}
                  disabled={busy || !urlInput.trim()}
                  className="h-10 px-5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-[13px] font-medium text-white shrink-0 transition-all active:scale-[0.97]"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Import"}
                </button>
              </div>
            </>
          )}
          {tab === "obsidian" && (
            <>
              <p className="text-[12px] text-zinc-500">Select .md files from your Obsidian vault folder</p>
              <DropZone
                id="obsidian-upload" accept=".md,.txt,.markdown" multiple disabled={busy}
                onFiles={(f) => handleVaultImport(f)}
                title="Drop Obsidian files"
                subtitle=".md files from your vault"
                icon={<BookOpen className="w-6 h-6 text-zinc-600" />}
              />
            </>
          )}
          {tab === "notion" && (
            <>
              <div className="text-[12px] text-zinc-500 space-y-1">
                <p className="text-zinc-300 font-medium">Export from Notion</p>
                <p>Settings → Export → Markdown & CSV → Extract ZIP → Select .md files</p>
              </div>
              <DropZone
                id="notion-upload" accept=".md,.markdown" multiple disabled={busy}
                onFiles={(f) => handleNotionImport(f)}
                title="Drop Notion files"
                subtitle=".md files — UUIDs auto-cleaned"
                icon={<StickyNote className="w-6 h-6 text-zinc-600" />}
              />
            </>
          )}
        </div>
      </div>
      </Stagger>

      {/* Import History */}
      {!historyLoading && importHistory.length > 0 && (
        <Stagger>
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <Package className="w-3 h-3 text-zinc-500" />
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em]">Import History</p>
                <span className="text-[10px] text-zinc-600 tabular-nums">{importHistory.length} source{importHistory.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-600 tabular-nums">{totalMemories.toLocaleString()} total memories</span>
                <Link href="/app/explore" className="text-[11px] text-zinc-600 hover:text-violet-400 font-medium transition-colors flex items-center gap-0.5">
                  <Compass className="w-3 h-3" />
                  <span className="hidden sm:inline">Explore all</span>
                </Link>
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden divide-y divide-white/[0.04]">
              {importHistory.slice(0, 8).map((src, i) => {
                const typeIcons: Record<string, any> = { chatgpt: MessageCircle, file: FileText, url: Globe, text: Type };
                const typeColors: Record<string, string> = {
                  chatgpt: "text-green-400 bg-green-500/10",
                  file: "text-blue-400 bg-blue-500/10",
                  url: "text-orange-400 bg-orange-500/10",
                  text: "text-violet-400 bg-violet-500/10",
                };
                const Icon = typeIcons[src.type] || FileText;
                const color = typeColors[src.type] || "text-zinc-400 bg-zinc-500/10";
                return (
                  <Link key={src.id || i} href={`/app/explore?q=${encodeURIComponent(src.title)}`}>
                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${color.split(' ').slice(1).join(' ')}`}>
                        <Icon className={`w-3.5 h-3.5 ${color.split(' ')[0]}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-zinc-300 font-medium truncate group-hover:text-white transition-colors">{src.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] font-semibold uppercase tracking-wide ${color.split(' ')[0]}`}>{src.type}</span>
                          <span className="text-[10px] text-zinc-700">·</span>
                          <span className="text-[10px] text-zinc-600 tabular-nums">{src.itemCount} chunk{src.itemCount !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Clock className="w-2.5 h-2.5 text-zinc-700" />
                        <span className="text-[10px] text-zinc-600 whitespace-nowrap">{formatRelativeTime(src.importedAt)}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            {importHistory.length > 8 && (
              <div className="text-center">
                <Link href="/app/explore" className="text-[11px] text-violet-400 hover:text-violet-300 font-medium transition-colors">
                  View all {importHistory.length} sources in Explore →
                </Link>
              </div>
            )}
          </div>
        </Stagger>
      )}

      {/* Empty state — no imports yet */}
      {!historyLoading && importHistory.length === 0 && state === "idle" && (
        <Stagger>
          <div className="rounded-2xl border border-dashed border-white/[0.06] bg-white/[0.01] p-6 text-center">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
              <Package className="w-4 h-4 text-zinc-600" />
            </div>
            <p className="text-[13px] text-zinc-400 font-medium">No imports yet</p>
            <p className="text-[11px] text-zinc-600 mt-1">Choose a source above to add your first knowledge</p>
          </div>
        </Stagger>
      )}
    </PageTransition>
  );
}

/** Format a timestamp to relative time */
function formatRelativeTime(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function DropZone({ id, accept, multiple, disabled, onFile, onFiles, title, subtitle, icon }: {
  id: string; accept: string; multiple?: boolean; disabled: boolean;
  onFile?: (f: File) => void; onFiles?: (f: FileList) => void;
  title: string; subtitle: string; icon: React.ReactNode;
}) {
  const [over, setOver] = useState(false);
  return (
    <>
      <div
        onClick={() => !disabled && document.getElementById(id)?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setOver(false);
          if (onFile) onFile(e.dataTransfer.files[0]);
          if (onFiles) onFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center py-10 md:py-12 rounded-2xl border-2 border-dashed transition-all cursor-pointer active:scale-[0.99] ${
          over
            ? "border-violet-500/40 bg-violet-500/5"
            : "border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02]"
        }`}
      >
        <div className="mb-2.5">{icon}</div>
        <p className="text-[13px] text-zinc-400 font-medium">{title}</p>
        <p className="text-[11px] text-zinc-600 mt-0.5">{subtitle}</p>
      </div>
      <input
        id={id} type="file" accept={accept} multiple={multiple}
        className="hidden" disabled={disabled}
        onChange={(e) => {
          if (onFile && e.target.files?.[0]) onFile(e.target.files[0]);
          if (onFiles && e.target.files) onFiles(e.target.files);
        }}
      />
    </>
  );
}
