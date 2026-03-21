'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';

const SOURCES = [
  { id: 'obsidian', name: 'Obsidian', icon: '💎', accept: '.md,.json', description: 'Upload your vault\'s .md files', multi: true },
  { id: 'notion', name: 'Notion', icon: '📝', accept: '.md,.csv,.html', description: 'Upload your Notion export files', multi: true },
  { id: 'chatgpt', name: 'ChatGPT', icon: '🤖', accept: '.json', description: 'Upload conversations.json from ChatGPT data export', multi: false },
  { id: 'claude', name: 'Claude', icon: '🟣', accept: '.json,.md', description: 'Upload Claude conversation exports', multi: true },
  { id: 'text', name: 'Text / Markdown', icon: '📄', accept: '.txt,.md,.csv', description: 'Upload any text or markdown files', multi: true },
];

export default function ImportPage() {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ documents: number; chunks: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...droppedFiles]);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  }, []);

  const handleImport = async () => {
    if (!selectedSource || files.length === 0) return;
    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.set('source_type', selectedSource);
      for (const file of files) {
        formData.append('files', file);
      }

      const res = await fetch('/api/import', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Import failed');
      setResult(data.imported);
      setFiles([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <nav className="border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-sm font-bold">M</div>
              <span className="text-lg font-semibold tracking-tight">MindStore</span>
            </Link>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/50">
            <Link href="/" className="hover:text-white/90 transition">Dashboard</Link>
            <Link href="/import" className="text-white/90">Import</Link>
            <Link href="/chat" className="hover:text-white/90 transition">Chat</Link>
            <Link href="/connect" className="hover:text-white/90 transition">Connect</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Import Knowledge</h1>
        <p className="text-white/40 mb-10">Feed your mind. Choose a source and upload your files.</p>

        {/* Source Selection */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-10">
          {SOURCES.map(source => (
            <button
              key={source.id}
              onClick={() => { setSelectedSource(source.id); setFiles([]); setResult(null); }}
              className={`p-4 rounded-xl border text-center transition ${
                selectedSource === source.id
                  ? 'border-violet-500/50 bg-violet-500/10'
                  : 'border-white/5 bg-white/[0.02] hover:border-white/10'
              }`}
            >
              <div className="text-2xl mb-2">{source.icon}</div>
              <div className="text-sm font-medium">{source.name}</div>
            </button>
          ))}
        </div>

        {/* Upload Zone */}
        {selectedSource && (
          <div className="mb-8">
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-white/10 rounded-2xl p-12 text-center hover:border-white/20 transition cursor-pointer"
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <div className="text-4xl mb-4">📂</div>
              <p className="text-white/60 mb-2">
                Drag & drop your {SOURCES.find(s => s.id === selectedSource)?.name} files here
              </p>
              <p className="text-white/30 text-sm">
                {SOURCES.find(s => s.id === selectedSource)?.description}
              </p>
              <input
                id="file-input"
                type="file"
                multiple={SOURCES.find(s => s.id === selectedSource)?.multi}
                accept={SOURCES.find(s => s.id === selectedSource)?.accept}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-6 space-y-2">
                <div className="text-sm text-white/40 mb-3">{files.length} file(s) selected</div>
                {files.slice(0, 10).map((file, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white/[0.03] rounded-lg px-4 py-2 text-sm">
                    <span className="text-white/60">📄</span>
                    <span className="text-white/80 flex-1 truncate">{file.name}</span>
                    <span className="text-white/30">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                ))}
                {files.length > 10 && (
                  <div className="text-sm text-white/30 pl-4">...and {files.length - 10} more</div>
                )}
              </div>
            )}

            {/* Import Button */}
            {files.length > 0 && (
              <button
                onClick={handleImport}
                disabled={importing}
                className="mt-6 w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white py-3 rounded-xl font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {importing ? '⏳ Importing...' : `🧠 Import ${files.length} file(s) into MindStore`}
              </button>
            )}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 mb-8">
            <div className="text-lg font-semibold text-emerald-400 mb-2">✅ Import Complete</div>
            <div className="text-white/60">
              Imported {result.documents} document(s) → {result.chunks} knowledge chunks
            </div>
            <Link href="/" className="inline-block mt-4 text-sm text-violet-400 hover:text-violet-300">
              ← Back to Dashboard
            </Link>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 mb-8">
            <div className="text-lg font-semibold text-red-400 mb-2">❌ Import Failed</div>
            <div className="text-white/60">{error}</div>
          </div>
        )}
      </main>
    </div>
  );
}
