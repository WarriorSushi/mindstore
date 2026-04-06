"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Mic, MicOff, Square, Save, Trash2, Loader2,
  FileText, Check, RotateCcw, Pencil, Globe,
} from "lucide-react";
import { toast } from "sonner";
import { PageTransition, Stagger } from "@/components/PageTransition";
import { usePageTitle } from "@/lib/use-page-title";

// ─── Types ────────────────────────────────────────────────────

type RecordingState = "idle" | "recording" | "done" | "error";

interface SavedRecording {
  id: string;
  title: string;
  transcript: string;
  wordCount: number;
  duration: number;
  savedAt: string;
}

const STORAGE_KEY = "mindstore-voice-recordings";
const MAX_SAVED = 20;

function getSavedRecordings(): SavedRecording[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function addSavedRecording(rec: SavedRecording): void {
  const existing = getSavedRecordings();
  existing.unshift(rec);
  if (existing.length > MAX_SAVED) existing.length = MAX_SAVED;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

function deleteSavedRecording(id: string): void {
  const existing = getSavedRecordings().filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

// ─── Format helpers ───────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Component ────────────────────────────────────────────────

export default function VoicePage() {
  usePageTitle("Voice");

  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [currentTranscript, setCurrentTranscript] = useState<{
    title: string; transcript: string; duration: number; wordCount: number;
  } | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const [history, setHistory] = useState<SavedRecording[]>([]);
  const [browserSupported, setBrowserSupported] = useState<boolean | null>(null);

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>("");
  const recordingStateRef = useRef<RecordingState>("idle");
  useEffect(() => { recordingStateRef.current = recordingState; }, [recordingState]);

  useEffect(() => {
    const supported = typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
    setBrowserSupported(supported);
    setHistory(getSavedRecordings());
  }, []);

  // ─── Browser STT ───────────────────────────────────────────────

  const startRecording = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Browser speech recognition not supported. Use Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    transcriptRef.current = "";

    recognition.onresult = (e: any) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + " ";
        else interim += e.results[i][0].transcript;
      }
      transcriptRef.current = final + interim;
    };

    recognition.onerror = (e: any) => {
      if (e.error !== "aborted") {
        toast.error(`Speech recognition error: ${e.error}`);
        setRecordingState("error");
      }
    };

    recognition.onend = () => {
      if (recordingStateRef.current === "recording") {
        recognition.start(); // auto-restart on silence
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setRecordingState("recording");
    setRecordingTime(0);
    setCurrentTranscript(null);
    timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
  }, []);

  const stopRecording = useCallback(() => {
    recordingStateRef.current = "done";
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    const transcript = transcriptRef.current.trim();
    if (!transcript) {
      toast.error("No speech detected");
      setRecordingState("error");
      return;
    }

    const wordCount = transcript.split(/\s+/).filter(Boolean).length;
    const title = transcript.split(" ").slice(0, 6).join(" ") + "…";
    setCurrentTranscript({ title, transcript, duration: recordingTime, wordCount });
    setTitleDraft(title);
    setRecordingState("done");
  }, [recordingTime]);

  // ─── Save ──────────────────────────────────────────────────────

  async function handleSave() {
    if (!currentTranscript) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents: [{
            title: titleDraft || currentTranscript.title,
            content: currentTranscript.transcript,
            sourceType: "audio",
          }],
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Save failed"); }

      // Save to local history
      const saved: SavedRecording = {
        id: Date.now().toString(36),
        title: titleDraft || currentTranscript.title,
        transcript: currentTranscript.transcript,
        wordCount: currentTranscript.wordCount,
        duration: currentTranscript.duration,
        savedAt: new Date().toISOString(),
      };
      addSavedRecording(saved);
      setHistory(getSavedRecordings());

      toast.success("Saved to your knowledge base!");
      resetRecorder();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id: string) {
    deleteSavedRecording(id);
    setHistory(getSavedRecordings());
    toast.success("Removed from history");
  }

  function resetRecorder() {
    setRecordingState("idle");
    setCurrentTranscript(null);
    setRecordingTime(0);
    setEditingTitle(false);
    transcriptRef.current = "";
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) { recognitionRef.current.onend = null; recognitionRef.current.stop(); }
    };
  }, []);

  // ─── Render ──────────────────────────────────────────────────

  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-24">
        {/* Header */}
        <Stagger>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1">
              <h1 className="text-[20px] font-semibold text-white tracking-tight">Voice-to-Memory</h1>
              <p className="text-[13px] text-zinc-500 mt-0.5">
                Record your thoughts — transcribed and saved as searchable knowledge
              </p>
            </div>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-500/[0.06] border border-teal-500/[0.12] text-[11px] font-medium text-teal-400">
              <Globe className="w-3 h-3" /> Browser · free
            </span>
          </div>

          {/* Not supported warning */}
          {browserSupported === false && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5 mb-6">
              <p className="text-[13px] text-amber-400/80 leading-relaxed">
                Voice recording requires a browser that supports speech recognition.
                Please use <strong>Chrome</strong> or <strong>Edge</strong> for this feature.
              </p>
            </div>
          )}
        </Stagger>

        {/* Recording Studio */}
        <Stagger>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] overflow-hidden mb-8">
            {/* Visualizer area */}
            <div className="relative h-48 sm:h-56 flex items-center justify-center bg-gradient-to-b from-white/[0.01] to-transparent">
              <div className="relative z-10 text-center px-4">
                {recordingState === "idle" && (
                  <div>
                    <div className="w-16 h-16 rounded-full bg-teal-500/[0.08] border border-teal-500/20 flex items-center justify-center mx-auto mb-3">
                      <Mic className="w-7 h-7 text-teal-400" />
                    </div>
                    <p className="text-[14px] text-zinc-400">Tap to start recording</p>
                    <p className="text-[12px] text-zinc-600 mt-1">Uses your browser's built-in speech recognition — no API key needed</p>
                  </div>
                )}

                {recordingState === "recording" && (
                  <div>
                    <div className="flex items-center gap-2 justify-center mb-2">
                      <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                      <span className="text-[13px] font-medium text-red-400 uppercase tracking-wider">Recording</span>
                    </div>
                    <div className="text-[36px] sm:text-[42px] font-mono font-light text-white tabular-nums">
                      {formatDuration(recordingTime)}
                    </div>
                    {transcriptRef.current && (
                      <p className="text-[12px] text-zinc-500 mt-2 max-w-xs mx-auto line-clamp-2">
                        {transcriptRef.current.slice(-120)}
                      </p>
                    )}
                  </div>
                )}

                {recordingState === "done" && currentTranscript && (
                  <div>
                    <div className="w-10 h-10 rounded-full bg-emerald-500/[0.08] border border-emerald-500/20 flex items-center justify-center mx-auto mb-2">
                      <Check className="w-5 h-5 text-emerald-400" />
                    </div>
                    <p className="text-[13px] text-emerald-400 font-medium">Transcription complete</p>
                    <p className="text-[12px] text-zinc-500 mt-1">{currentTranscript.wordCount} words · {formatDuration(currentTranscript.duration)}</p>
                  </div>
                )}

                {recordingState === "error" && (
                  <div>
                    <div className="w-10 h-10 rounded-full bg-red-500/[0.08] border border-red-500/20 flex items-center justify-center mx-auto mb-2">
                      <MicOff className="w-5 h-5 text-red-400" />
                    </div>
                    <p className="text-[13px] text-red-400 font-medium">No speech detected</p>
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 py-5 border-t border-white/[0.04]">
              {recordingState === "idle" && (
                <button
                  onClick={startRecording}
                  disabled={browserSupported === false}
                  className="w-14 h-14 rounded-full bg-teal-500 hover:bg-teal-400 active:scale-95 flex items-center justify-center transition-all shadow-lg shadow-teal-500/20 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Mic className="w-6 h-6 text-white" />
                </button>
              )}

              {recordingState === "recording" && (
                <button
                  onClick={stopRecording}
                  className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-400 active:scale-95 flex items-center justify-center transition-all shadow-lg shadow-red-500/20"
                >
                  <Square className="w-5 h-5 text-white fill-white" />
                </button>
              )}

              {recordingState === "done" && (
                <>
                  <button
                    onClick={resetRecorder}
                    className="w-11 h-11 rounded-full bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] flex items-center justify-center transition-all"
                    title="Record another"
                  >
                    <RotateCcw className="w-4 h-4 text-zinc-400" />
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="h-11 px-6 rounded-full bg-teal-500 hover:bg-teal-400 active:scale-[0.97] flex items-center gap-2 transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Save className="w-4 h-4 text-white" />}
                    <span className="text-[13px] font-medium text-white">Save to Knowledge Base</span>
                  </button>
                </>
              )}

              {recordingState === "error" && (
                <button
                  onClick={resetRecorder}
                  className="h-11 px-6 rounded-full bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] flex items-center gap-2 transition-all"
                >
                  <RotateCcw className="w-4 h-4 text-zinc-400" />
                  <span className="text-[13px] font-medium text-zinc-300">Try Again</span>
                </button>
              )}
            </div>
          </div>
        </Stagger>

        {/* Current transcript */}
        {currentTranscript && recordingState === "done" && (
          <Stagger>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 mb-8">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-teal-500/[0.08] border border-teal-500/[0.15] flex items-center justify-center shrink-0 mt-0.5">
                  <FileText className="w-4 h-4 text-teal-400" />
                </div>
                <div className="flex-1 min-w-0">
                  {editingTitle ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={titleDraft}
                        onChange={e => setTitleDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") setEditingTitle(false);
                          if (e.key === "Escape") setEditingTitle(false);
                        }}
                        className="flex-1 bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-1.5 text-[14px] text-white outline-none focus:border-teal-500/30"
                        autoFocus
                      />
                      <button onClick={() => setEditingTitle(false)} className="text-[12px] text-teal-400 hover:text-teal-300">
                        Done
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="text-[15px] font-medium text-white truncate">{titleDraft}</h3>
                      <button onClick={() => setEditingTitle(true)} className="text-zinc-600 hover:text-zinc-400 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500">
                    <span>{currentTranscript.wordCount} words</span>
                    <span className="text-zinc-700">·</span>
                    <span>{formatDuration(currentTranscript.duration)}</span>
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-4">
                <p className="text-[13px] text-zinc-300 leading-relaxed whitespace-pre-wrap">{currentTranscript.transcript}</p>
              </div>
            </div>
          </Stagger>
        )}

        {/* History */}
        {history.length > 0 && (
          <Stagger>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.04]">
                <h2 className="text-[13px] font-semibold text-zinc-300 uppercase tracking-wider">Saved Recordings</h2>
                <span className="text-[11px] text-zinc-600">{history.length}</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {history.map(rec => (
                  <div key={rec.id} className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-white/[0.02] transition-colors group">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/[0.12] flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[13px] font-medium text-white truncate">{rec.title}</h4>
                      <p className="text-[12px] text-zinc-500 line-clamp-1 mt-0.5">{rec.transcript.substring(0, 100)}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-600">
                        <span>{rec.wordCount} words</span>
                        <span className="text-zinc-700">·</span>
                        <span>{formatRelativeTime(rec.savedAt)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(rec.id)}
                      className="w-7 h-7 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-red-500/10 hover:border-red-500/20 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shrink-0"
                    >
                      <Trash2 className="w-3 h-3 text-zinc-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </Stagger>
        )}
      </div>
    </PageTransition>
  );
}
