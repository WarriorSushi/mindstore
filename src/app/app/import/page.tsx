"use client";

import { useState, useCallback } from "react";
import { Upload, FileJson, FileText, Globe, Type, Loader2, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { db } from "@/lib/db";
import { getApiKey, getEmbeddings } from "@/lib/openai";
import { parseChatGPTExport, createTextMemories } from "@/lib/parsers";
import { toast } from "sonner";

type ImportState = "idle" | "parsing" | "embedding" | "storing" | "done" | "error";

export default function ImportPage() {
  const [state, setState] = useState<ImportState>("idle");
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [urlInput, setUrlInput] = useState("");

  const embedAndStore = async (
    memories: { id: string; content: string; source: string; sourceId: string; sourceTitle: string; timestamp: Date; importedAt: Date; metadata: Record<string, any> }[],
    sources: any[]
  ) => {
    const apiKey = getApiKey();
    if (!apiKey) {
      toast.error("No API key set. Go to Settings.");
      return;
    }

    setState("embedding");
    const contents = memories.map((m: any) => m.content);
    const batchSize = 50;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < contents.length; i += batchSize) {
      const batch = contents.slice(i, i + batchSize);
      setProgress(Math.round((i / contents.length) * 100));
      setProgressText(`Embedding ${i + 1}-${Math.min(i + batchSize, contents.length)} of ${contents.length}...`);

      try {
        const embeddings = await getEmbeddings(batch, apiKey);
        allEmbeddings.push(...embeddings);
      } catch (err: any) {
        toast.error(`Embedding failed: ${err.message}`);
        setState("error");
        return;
      }
    }

    setState("storing");
    setProgressText("Saving to your mind...");

    const fullMemories = memories.map((m: any, i: number) => ({
      ...m,
      embedding: allEmbeddings[i],
    }));

    await db.memories.bulkPut(fullMemories);
    await db.sources.bulkPut(sources);

    setState("done");
    setProgress(100);
    setProgressText(`Done! Added ${memories.length} memories from ${sources.length} source(s).`);
    toast.success(`Imported ${memories.length} memories!`);
  };

  const handleChatGPTImport = useCallback(async (file: File) => {
    setState("parsing");
    setProgressText("Parsing ChatGPT export...");
    setProgress(10);

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const data = Array.isArray(json) ? json : [json];
      const { memories, sources } = parseChatGPTExport(data);

      if (memories.length === 0) {
        toast.error("No conversations found in this file.");
        setState("idle");
        return;
      }

      setProgressText(`Found ${memories.length} chunks from ${sources.length} conversations. Embedding...`);
      await embedAndStore(memories, sources);
    } catch (err: any) {
      toast.error(`Parse error: ${err.message}`);
      setState("error");
    }
  }, []);

  const handleTextImport = async () => {
    if (!textContent.trim()) return;
    const title = textTitle.trim() || `Note — ${new Date().toLocaleDateString()}`;
    setState("parsing");
    setProgressText("Processing text...");

    const { memories, source } = createTextMemories(textContent, title, "text");
    if (memories.length === 0) {
      toast.error("Text too short to import.");
      setState("idle");
      return;
    }

    await embedAndStore(memories, [source]);
    setTextTitle("");
    setTextContent("");
  };

  const handleFileImport = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setState("parsing");

    const allMemories: any[] = [];
    const allSources: any[] = [];

    for (const file of Array.from(files)) {
      if (!file.name.match(/\.(txt|md|markdown)$/i)) {
        toast.error(`Skipped ${file.name} — only .txt and .md files supported`);
        continue;
      }
      setProgressText(`Reading ${file.name}...`);
      const text = await file.text();
      const { memories, source } = createTextMemories(text, file.name, "file");
      allMemories.push(...memories);
      allSources.push(source);
    }

    if (allMemories.length === 0) {
      toast.error("No importable content found.");
      setState("idle");
      return;
    }

    await embedAndStore(allMemories, allSources);
  };

  const handleUrlImport = async () => {
    if (!urlInput.trim()) return;
    setState("parsing");
    setProgressText("Fetching URL...");

    try {
      // Use a CORS proxy or allorigins
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(urlInput.trim())}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error("Failed to fetch URL");
      const html = await res.text();

      // Basic HTML to text extraction
      const doc = new DOMParser().parseFromString(html, "text/html");
      // Remove scripts and styles
      doc.querySelectorAll("script, style, nav, footer, header").forEach((el) => el.remove());
      const text = doc.body?.innerText || doc.body?.textContent || "";

      if (text.trim().length < 50) {
        toast.error("Could not extract meaningful content from this URL.");
        setState("idle");
        return;
      }

      const title = doc.title || urlInput.trim();
      const { memories, source } = createTextMemories(text, title, "url");
      source.metadata = { ...source.metadata, url: urlInput.trim() };

      await embedAndStore(memories, [source]);
      setUrlInput("");
    } catch (err: any) {
      toast.error(`URL fetch failed: ${err.message}`);
      setState("error");
    }
  };

  const resetState = () => {
    setState("idle");
    setProgress(0);
    setProgressText("");
  };

  const isProcessing = state !== "idle" && state !== "done" && state !== "error";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Import Knowledge</h1>
        <p className="text-zinc-400 mt-1">Feed your mind. The more you import, the smarter it gets.</p>
      </div>

      {/* Progress */}
      {state !== "idle" && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-3">
              {state === "done" ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : state === "error" ? (
                <span className="text-red-400 text-sm">Error</span>
              ) : (
                <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
              )}
              <span className="text-sm">{progressText}</span>
            </div>
            <Progress value={progress} className="h-2" />
            {(state === "done" || state === "error") && (
              <Button variant="outline" size="sm" onClick={resetState} className="border-zinc-700">
                Import More
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import Tabs */}
      <Tabs defaultValue="chatgpt" className="w-full">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="chatgpt" className="data-[state=active]:bg-zinc-800">
            <FileJson className="w-4 h-4 mr-2" /> ChatGPT
          </TabsTrigger>
          <TabsTrigger value="text" className="data-[state=active]:bg-zinc-800">
            <Type className="w-4 h-4 mr-2" /> Text
          </TabsTrigger>
          <TabsTrigger value="files" className="data-[state=active]:bg-zinc-800">
            <FileText className="w-4 h-4 mr-2" /> Files
          </TabsTrigger>
          <TabsTrigger value="url" className="data-[state=active]:bg-zinc-800">
            <Globe className="w-4 h-4 mr-2" /> URL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chatgpt" className="mt-6">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg">Import ChatGPT Conversations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-zinc-400 space-y-2">
                <p><strong>How to export:</strong></p>
                <ol className="list-decimal list-inside space-y-1 text-zinc-500">
                  <li>Go to <a href="https://chatgpt.com" target="_blank" className="text-violet-400 hover:underline">chatgpt.com</a></li>
                  <li>Click your profile → Settings → Data Controls</li>
                  <li>Click &quot;Export data&quot; and wait for the email</li>
                  <li>Download the ZIP, extract it, find <code className="bg-zinc-800 px-1 rounded">conversations.json</code></li>
                  <li>Drop that file below</li>
                </ol>
              </div>
              <div
                className="border-2 border-dashed border-zinc-700 rounded-xl p-10 text-center hover:border-violet-500/50 transition-colors cursor-pointer"
                onClick={() => document.getElementById("chatgpt-file")?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-violet-500/50"); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove("border-violet-500/50"); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-violet-500/50");
                  const file = e.dataTransfer.files[0];
                  if (file) handleChatGPTImport(file);
                }}
              >
                <Upload className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
                <p className="text-zinc-400">Drop your <code className="bg-zinc-800 px-1 rounded">conversations.json</code> here</p>
                <p className="text-sm text-zinc-600 mt-1">or click to browse</p>
              </div>
              <input
                id="chatgpt-file"
                type="file"
                accept=".json"
                className="hidden"
                disabled={isProcessing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleChatGPTImport(file);
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="text" className="mt-6">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg">Paste Text</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Title (optional)"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                className="bg-zinc-800 border-zinc-700"
              />
              <Textarea
                placeholder="Paste your notes, articles, thoughts, anything..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={10}
                className="bg-zinc-800 border-zinc-700"
              />
              <Button
                onClick={handleTextImport}
                disabled={isProcessing || !textContent.trim()}
                className="bg-violet-600 hover:bg-violet-500"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Import Text
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="mt-6">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg">Upload Files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-zinc-500">Upload .txt or .md files. You can select multiple files.</p>
              <div
                className="border-2 border-dashed border-zinc-700 rounded-xl p-10 text-center hover:border-violet-500/50 transition-colors cursor-pointer"
                onClick={() => document.getElementById("file-upload")?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-violet-500/50"); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove("border-violet-500/50"); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-violet-500/50");
                  handleFileImport(e.dataTransfer.files);
                }}
              >
                <FileText className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
                <p className="text-zinc-400">Drop .txt / .md files here</p>
                <p className="text-sm text-zinc-600 mt-1">or click to browse</p>
              </div>
              <input
                id="file-upload"
                type="file"
                accept=".txt,.md,.markdown"
                multiple
                className="hidden"
                disabled={isProcessing}
                onChange={(e) => handleFileImport(e.target.files)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="url" className="mt-6">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg">Import from URL</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-zinc-500">Paste a URL and we&apos;ll extract the text content.</p>
              <div className="flex gap-2">
                <Input
                  placeholder="https://..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUrlImport()}
                  className="bg-zinc-800 border-zinc-700"
                />
                <Button
                  onClick={handleUrlImport}
                  disabled={isProcessing || !urlInput.trim()}
                  className="bg-violet-600 hover:bg-violet-500"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Import"}
                </Button>
              </div>
              <p className="text-xs text-zinc-600">Note: Some websites may block content extraction due to CORS restrictions.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
