"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Brain, Upload, FileText, MessageCircle, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type DropState = "idle" | "hovering" | "importing" | "done" | "error";

/**
 * Global drag-and-drop overlay — drop files anywhere in the app to import them.
 * Detects file type and routes to the correct import handler:
 * - .json/.zip → ChatGPT import
 * - .txt/.md/.markdown → File import
 * Shows a full-screen overlay when dragging files over the window.
 */
export function GlobalDropZone() {
  const [state, setState] = useState<DropState>("idle");
  const [importResult, setImportResult] = useState<string>("");
  const dragCountRef = useRef(0);
  const router = useRouter();
  const pathname = usePathname();

  // Don't show overlay if we're already on the Import page (it has its own drop zones)
  const isImportPage = pathname === "/app/import";

  const handleImport = useCallback(async (files: FileList) => {
    if (files.length === 0) return;

    setState("importing");
    setImportResult("");

    try {
      // Categorize files
      const chatgptFiles: File[] = [];
      const textFiles: File[] = [];
      const unsupported: string[] = [];

      for (const file of Array.from(files)) {
        const name = file.name.toLowerCase();
        if (name.endsWith(".json") || name.endsWith(".zip")) {
          chatgptFiles.push(file);
        } else if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".markdown")) {
          textFiles.push(file);
        } else {
          unsupported.push(file.name);
        }
      }

      if (chatgptFiles.length === 0 && textFiles.length === 0) {
        setState("error");
        setImportResult(
          `Unsupported file${unsupported.length > 1 ? "s" : ""}: ${unsupported.slice(0, 3).join(", ")}${unsupported.length > 3 ? "…" : ""}. Supported: .json, .zip, .txt, .md`
        );
        setTimeout(() => { setState("idle"); setImportResult(""); }, 3500);
        return;
      }

      let totalChunks = 0;
      let totalDocs = 0;

      // Import ChatGPT files
      for (const file of chatgptFiles) {
        const fd = new FormData();
        fd.append("files", file);
        fd.append("source_type", "chatgpt");
        const res = await fetch("/api/v1/import", { method: "POST", body: fd });
        if (!res.ok) {
          const e = await res.json();
          throw new Error(e.error || `Failed to import ${file.name}`);
        }
        const r = await res.json();
        totalChunks += r.imported.chunks;
        totalDocs += r.imported.documents;
      }

      // Import text/markdown files
      if (textFiles.length > 0) {
        const fd = new FormData();
        fd.append("source_type", "file");
        for (const file of textFiles) {
          fd.append("files", file);
        }
        const res = await fetch("/api/v1/import", { method: "POST", body: fd });
        if (!res.ok) {
          const e = await res.json();
          throw new Error(e.error || "Failed to import files");
        }
        const r = await res.json();
        totalChunks += r.imported.chunks;
        totalDocs += r.imported.documents;
      }

      setState("done");
      const resultText = `${totalChunks} memories from ${totalDocs} source${totalDocs !== 1 ? "s" : ""}`;
      setImportResult(resultText);
      toast.success(`Imported ${resultText}`);

      if (unsupported.length > 0) {
        toast(`Skipped ${unsupported.length} unsupported file${unsupported.length > 1 ? "s" : ""}`, {
          description: unsupported.slice(0, 3).join(", "),
        });
      }

      // Auto-dismiss after 2.5s
      setTimeout(() => { setState("idle"); setImportResult(""); }, 2500);
    } catch (err: any) {
      setState("error");
      setImportResult(err.message || "Import failed");
      toast.error(err.message || "Import failed");
      setTimeout(() => { setState("idle"); setImportResult(""); }, 3500);
    }
  }, []);

  useEffect(() => {
    // Skip if on import page
    if (isImportPage) return;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      // Only react to file drags (not text/link drags)
      if (!e.dataTransfer?.types.includes("Files")) return;
      dragCountRef.current++;
      if (dragCountRef.current === 1) {
        setState("hovering");
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCountRef.current--;
      if (dragCountRef.current <= 0) {
        dragCountRef.current = 0;
        setState((prev) => (prev === "hovering" ? "idle" : prev));
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      // Required to allow drop
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCountRef.current = 0;
      if (e.dataTransfer?.files?.length) {
        handleImport(e.dataTransfer.files);
      } else {
        setState("idle");
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [isImportPage, handleImport]);

  if (state === "idle" || isImportPage) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ animation: "gdz-fade-in 150ms ease-out" }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" />

      {/* Content */}
      <div className="relative flex flex-col items-center gap-4 px-8">
        {state === "hovering" && (
          <>
            {/* Animated ring */}
            <div className="relative">
              <div
                className="absolute inset-0 rounded-3xl bg-violet-500/20 blur-2xl"
                style={{ animation: "gdz-pulse 2s ease-in-out infinite" }}
              />
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 border-2 border-dashed border-violet-400/50 flex items-center justify-center">
                <Upload className="w-8 h-8 text-violet-300" style={{ animation: "gdz-bounce 1.5s ease-in-out infinite" }} />
              </div>
            </div>
            <div className="text-center">
              <p className="text-[17px] font-semibold text-white tracking-[-0.01em]">
                Drop to import
              </p>
              <p className="text-[13px] text-zinc-400 mt-1">
                .json, .zip, .txt, .md files
              </p>
            </div>
          </>
        )}

        {state === "importing" && (
          <>
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-[17px] font-semibold text-white tracking-[-0.01em]">
                Importing…
              </p>
              <p className="text-[13px] text-zinc-400 mt-1">
                Processing your files
              </p>
            </div>
          </>
        )}

        {state === "done" && (
          <>
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-400" style={{ animation: "gdz-scale-in 300ms ease-out" }} />
            </div>
            <div className="text-center">
              <p className="text-[17px] font-semibold text-white tracking-[-0.01em]">
                Imported!
              </p>
              <p className="text-[13px] text-emerald-400 mt-1">
                {importResult}
              </p>
            </div>
          </>
        )}

        {state === "error" && (
          <>
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <div className="text-center max-w-xs">
              <p className="text-[17px] font-semibold text-white tracking-[-0.01em]">
                Import failed
              </p>
              <p className="text-[13px] text-red-400 mt-1">
                {importResult}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes gdz-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes gdz-pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.15); opacity: 0.8; }
        }
        @keyframes gdz-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes gdz-scale-in {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
