"use client";

import { useState, useCallback } from "react";
import { v4 as uuid } from "uuid";
import { motion } from "framer-motion";
import { Upload, FileText, Type, Globe, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { generateEmbeddingsBatch } from "@/lib/openai";
import { parseChatGPTExport, chunkText, createMemoriesFromChunks } from "@/lib/parsers";
import type { ParsedChunk } from "@/lib/parsers";

export default function ImportPage() {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: "" });

  // Text paste state
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");

  async function embedAndStore(chunks: ParsedChunk[], source: 'chatgpt' | 'text' | 'file' | 'url', sourceTitle: string) {
    if (chunks.length === 0) {
      toast.error("No content found to import");
      return;
    }

    setImporting(true);
    const batchSize = 50;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      setProgress({ current: i, total: chunks.length, label: `Embedding ${i + 1}-${Math.min(i + batchSize, chunks.length)} of ${chunks.length} chunks...` });

      try {
        const embeddings = await generateEmbeddingsBatch(batch.map(c => c.content));
        allEmbeddings.push(...embeddings);
      } catch (err) {
        toast.error(`Embedding error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setImporting(false);
        return;
      }
    }

    setProgress({ current: chunks.length, total: chunks.length, label: "Storing memories..." });

    const memories = createMemoriesFromChunks(chunks, allEmbeddings, source);
    await db.memories.bulkAdd(memories);

    // Group chunks by sourceId to create source records
    const sourceIds = new Set(chunks.map(c => c.sourceId));
    for (const sid of sourceIds) {
      const sourceChunks = chunks.filter(c => c.sourceId === sid);
      await db.sources.put({
        id: sid,
        type: source,
        title: sourceChunks[0]?.sourceTitle || sourceTitle,
        itemCount: sourceChunks.length,
        importedAt: new Date(),
        metadata: {},
      });
    }

    toast.success(`Imported ${chunks.length} chunks from ${sourceIds.size} source(s)`);
    setImporting(false);
    setProgress({ current: 0, total: 0, label: "" });
  }

  // ChatGPT JSON handler
  const handleChatGPTFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) {
        toast.error("Invalid format: expected an array of conversations");
        return;
      }
      setProgress({ current: 0, total: 0, label: `Parsing ${data.length} conversations...` });
      const chunks = parseChatGPTExport(data);
      toast.info(`Parsed ${chunks.length} chunks from ${data.length} conversations`);
      await embedAndStore(chunks, 'chatgpt', file.name);
    } catch (err) {
      toast.error(`Parse error: ${err instanceof Error ? err.message : 'Invalid JSON'}`);
    }
  }, []);

  // Text paste handler
  async function handleTextImport() {
    if (!textContent.trim()) { toast.error("Please enter some text"); return; }
    const title = textTitle || "Pasted Text";
    const textChunks = chunkText(textContent);
    const sourceId = uuid();
    const chunks: ParsedChunk[] = textChunks.map((c, i) => ({
      content: c,
      sourceTitle: title,
      sourceId,
      timestamp: new Date(),
      metadata: { chunkIndex: i },
    }));
    await embedAndStore(chunks, 'text', title);
    setTextTitle("");
    setTextContent("");
  }

  // File upload handler
  async function handleFileUpload(files: FileList | null) {
    if (!files) return;
    const allChunks: ParsedChunk[] = [];
    for (const file of Array.from(files)) {
      if (!file.name.match(/\.(txt|md)$/i)) {
        toast.error(`Skipping ${file.name}: only .txt and .md files supported`);
        continue;
      }
      const text = await file.text();
      const textChunks = chunkText(text);
      const sourceId = uuid();
      allChunks.push(...textChunks.map((c, i) => ({
        content: c,
        sourceTitle: file.name,
        sourceId,
        timestamp: new Date(),
        metadata: { fileName: file.name, chunkIndex: i },
      })));
    }
    if (allChunks.length > 0) {
      await embedAndStore(allChunks, 'file', 'File Upload');
    }
  }

  // URL handler
  const [urlInput, setUrlInput] = useState("");

  async function handleUrlImport() {
    if (!urlInput.trim()) return;
    toast.info("URL import: due to browser CORS restrictions, please paste the page content directly using the Text tab.");
    setUrlInput("");
  }

  const isDragging = useState(false);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Knowledge</h1>
        <p className="text-muted-foreground text-sm">Add your knowledge from various sources.</p>
      </div>

      {importing && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                {progress.label}
              </div>
              {progress.total > 0 && (
                <Progress value={(progress.current / progress.total) * 100} />
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Tabs defaultValue="chatgpt">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="chatgpt" className="gap-1.5 text-xs"><Upload className="w-3 h-3" /> ChatGPT</TabsTrigger>
          <TabsTrigger value="text" className="gap-1.5 text-xs"><Type className="w-3 h-3" /> Text</TabsTrigger>
          <TabsTrigger value="files" className="gap-1.5 text-xs"><FileText className="w-3 h-3" /> Files</TabsTrigger>
          <TabsTrigger value="url" className="gap-1.5 text-xs"><Globe className="w-3 h-3" /> URL</TabsTrigger>
        </TabsList>

        <TabsContent value="chatgpt" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Import ChatGPT Export</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Go to ChatGPT → Settings → Data Controls → Export Data. You&apos;ll receive a zip file — extract it and upload the <code className="bg-muted px-1 rounded">conversations.json</code> file.
              </p>
              <div
                className="border-2 border-dashed border-border rounded-lg p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => document.getElementById('chatgpt-file')?.click()}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleChatGPTFile(file);
                }}
              >
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Drop conversations.json here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">Supports the ChatGPT data export format</p>
              </div>
              <input
                id="chatgpt-file"
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleChatGPTFile(file);
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="text" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Paste Text</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  placeholder="Give this text a title..."
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  placeholder="Paste your text here... Notes, articles, ideas — anything you want to remember."
                  className="min-h-[200px] font-mono text-sm"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                />
              </div>
              <Button onClick={handleTextImport} disabled={importing || !textContent.trim()}>
                Import Text
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upload Files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Upload .txt or .md files. Batch upload supported.</p>
              <div
                className="border-2 border-dashed border-border rounded-lg p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => document.getElementById('file-upload')?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFileUpload(e.dataTransfer.files);
                }}
              >
                <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Drop .txt or .md files here or click to browse</p>
              </div>
              <input
                id="file-upload"
                type="file"
                accept=".txt,.md"
                multiple
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="url" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Import from URL</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Due to browser security restrictions, direct URL fetching is limited. We recommend copying the page content and using the Text tab instead.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="https://example.com/article"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
                <Button variant="secondary" onClick={handleUrlImport}>Import</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
