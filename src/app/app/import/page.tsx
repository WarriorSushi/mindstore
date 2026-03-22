"use client";

import { useState, useCallback } from "react";
import { Upload, FileJson, FileText, Globe, Type, Loader2, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

type ImportState = "idle" | "parsing" | "uploading" | "done" | "error";

export default function ImportPage() {
  const [state, setState] = useState<ImportState>("idle");
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [urlInput, setUrlInput] = useState("");

  const importViaApi = async (
    formData: FormData
  ) => {
    setState("uploading");
    setProgress(50);
    setProgressText("Uploading and processing...");

    try {
      const res = await fetch('/api/v1/import', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Import failed');
      }

      const result = await res.json();
      setState("done");
      setProgress(100);
      setProgressText(`Done! Added ${result.imported.chunks} memories from ${result.imported.documents} source(s).`);
      toast.success(`Imported ${result.imported.chunks} memories!`);
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
      setState("error");
      setProgressText(`Error: ${err.message}`);
    }
  };

  const importJsonViaApi = async (
    documents: Array<{ title: string; content: string; sourceType: string; timestamp?: string }>,
  ) => {
    setState("uploading");
    setProgress(50);
    setProgressText("Uploading and processing...");

    try {
      const res = await fetch('/api/v1/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documents }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Import failed');
      }

      const result = await res.json();
      setState("done");
      setProgress(100);
      setProgressText(`Done! Added ${result.imported.chunks} memories from ${result.imported.documents} source(s).`);
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

      if (text.trim().length < 50) {
        toast.error("Could not extract meaningful content from this URL.");
        setState("idle");
        return;
      }

      const title = doc.title || urlInput.trim();
      await importJsonViaApi([{ title, content: text, sourceType: 'url' }]);
      setUrlInput("");
    } catch (err: any) {
      toast.error(`URL fetch failed: ${err.message}`);
      setState("error");
    }
  };

  const handleObsidianImport = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setState("parsing");
    setProgressText("Reading Obsidian vault...");

    const formData = new FormData();
    formData.append('source_type', 'file');
    for (const file of Array.from(files)) {
      if (file.name.endsWith('.md') || file.name.endsWith('.txt')) {
        formData.append('files', file);
      }
    }

    await importViaApi(formData);
  };

  const handleNotionImport = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setState("parsing");
    setProgressText("Reading Notion export...");

    const formData = new FormData();
    formData.append('source_type', 'file');
    for (const file of Array.from(files)) {
      if (file.name.endsWith('.md')) {
        formData.append('files', file);
      }
    }

    await importViaApi(formData);
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
          <TabsTrigger value="obsidian" className="data-[state=active]:bg-zinc-800">
            <FileText className="w-4 h-4 mr-2" /> Obsidian
          </TabsTrigger>
          <TabsTrigger value="notion" className="data-[state=active]:bg-zinc-800">
            <FileText className="w-4 h-4 mr-2" /> Notion
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
                  <li>Download the ZIP file</li>
                  <li>Drop the ZIP <strong>or</strong> the extracted <code className="bg-zinc-800 px-1 rounded">conversations.json</code> below</li>
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
                <p className="text-zinc-400">Drop your ChatGPT export here</p>
                <p className="text-sm text-zinc-600 mt-1">Accepts <code className="bg-zinc-800 px-1 rounded">.zip</code> or <code className="bg-zinc-800 px-1 rounded">.json</code></p>
              </div>
              <input
                id="chatgpt-file"
                type="file"
                accept=".json,.zip"
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

        <TabsContent value="obsidian" className="mt-6">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg">Import Obsidian Vault</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-zinc-400 space-y-2">
                <p><strong>How to import:</strong></p>
                <ol className="list-decimal list-inside space-y-1 text-zinc-500">
                  <li>Find your Obsidian vault folder on your computer</li>
                  <li>Select all .md files from the vault (or a subfolder)</li>
                  <li>Drop them below or click to browse</li>
                </ol>
              </div>
              <div
                className="border-2 border-dashed border-zinc-700 rounded-xl p-10 text-center hover:border-violet-500/50 transition-colors cursor-pointer"
                onClick={() => document.getElementById("obsidian-upload")?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-violet-500/50"); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove("border-violet-500/50"); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-violet-500/50");
                  handleObsidianImport(e.dataTransfer.files);
                }}
              >
                <Upload className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
                <p className="text-zinc-400">Drop your Obsidian .md files here</p>
                <p className="text-sm text-zinc-600 mt-1">Supports .md and .txt</p>
              </div>
              <input
                id="obsidian-upload"
                type="file"
                accept=".md,.txt,.markdown"
                multiple
                className="hidden"
                disabled={isProcessing}
                onChange={(e) => handleObsidianImport(e.target.files)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notion" className="mt-6">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg">Import Notion Export</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-zinc-400 space-y-2">
                <p><strong>How to export from Notion:</strong></p>
                <ol className="list-decimal list-inside space-y-1 text-zinc-500">
                  <li>In Notion, go to Settings → Export all workspace content</li>
                  <li>Choose &quot;Markdown &amp; CSV&quot; format</li>
                  <li>Download and extract the ZIP file</li>
                  <li>Select the .md files from the extracted folder</li>
                </ol>
              </div>
              <div
                className="border-2 border-dashed border-zinc-700 rounded-xl p-10 text-center hover:border-violet-500/50 transition-colors cursor-pointer"
                onClick={() => document.getElementById("notion-upload")?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-violet-500/50"); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove("border-violet-500/50"); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-violet-500/50");
                  handleNotionImport(e.dataTransfer.files);
                }}
              >
                <Upload className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
                <p className="text-zinc-400">Drop your Notion .md files here</p>
                <p className="text-sm text-zinc-600 mt-1">UUID suffixes in filenames are automatically cleaned</p>
              </div>
              <input
                id="notion-upload"
                type="file"
                accept=".md,.markdown"
                multiple
                className="hidden"
                disabled={isProcessing}
                onChange={(e) => handleNotionImport(e.target.files)}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
