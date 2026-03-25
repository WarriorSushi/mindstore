"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Clock,
  FileText,
  Loader2,
  Mic,
  MicOff,
  Pencil,
  RotateCcw,
  Save,
  Square,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageTransition, Stagger } from "@/components/PageTransition";

interface Recording {
  id: string;
  title: string;
  transcript: string;
  durationSeconds: number;
  language: string;
  provider: string;
  wordCount: number;
  savedAsMemory: boolean;
  createdAt: string;
}

interface VoiceStats {
  totalRecordings: number;
  totalDuration: number;
  totalWords: number;
  savedCount: number;
}

interface ProviderStatus {
  available: boolean;
  provider: string | null;
  model: string | null;
}

interface CurrentTranscript {
  id: string;
  title: string;
  transcript: string;
  language: string;
  duration: number;
  wordCount: number;
  provider: string;
}

type RecordingState = "idle" | "recording" | "transcribing" | "done" | "error";

function formatDuration(seconds: number) {
  const minutes = Math.floor(Math.max(seconds, 0) / 60);
  const remainingSeconds = Math.floor(Math.max(seconds, 0) % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function formatRelativeTime(dateString: string) {
  const diffMinutes = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

export default function VoicePage() {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [stats, setStats] = useState<VoiceStats | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState<CurrentTranscript | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const loadPageData = useCallback(async () => {
    try {
      const [providerResponse, statsResponse, recordingsResponse] = await Promise.all([
        fetch("/api/v1/plugins/voice-to-memory?action=check"),
        fetch("/api/v1/plugins/voice-to-memory?action=stats"),
        fetch("/api/v1/plugins/voice-to-memory?action=recordings&limit=20"),
      ]);

      if (providerResponse.ok) {
        setProviderStatus(await providerResponse.json() as ProviderStatus);
      }
      if (statsResponse.ok) {
        setStats(await statsResponse.json() as VoiceStats);
      }
      if (recordingsResponse.ok) {
        const data = await recordingsResponse.json() as { recordings?: Recording[] };
        setRecordings(data.recordings || []);
      }
    } catch (error: unknown) {
      console.error("Failed to load voice page:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadPageData();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadPageData]);

  const transcribeAudio = useCallback(async (chunks: Blob[]) => {
    setRecordingState("transcribing");

    try {
      const formData = new FormData();
      formData.append("audio", new Blob(chunks, { type: "audio/webm" }), "recording.webm");

      const response = await fetch("/api/v1/plugins/voice-to-memory", {
        method: "POST",
        body: formData,
      });
      const data = await response.json() as {
        error?: string;
        id?: string;
        title?: string;
        transcript?: string;
        language?: string;
        duration?: number;
        wordCount?: number;
        provider?: string;
      };

      if (!response.ok || !data.id || !data.transcript) {
        throw new Error(data.error || "Transcription failed");
      }

      setCurrentTranscript({
        id: data.id,
        title: data.title || "Voice Recording",
        transcript: data.transcript,
        language: data.language || "auto",
        duration: data.duration || 0,
        wordCount: data.wordCount || 0,
        provider: data.provider || "unknown",
      });
      setTitleDraft(data.title || "Voice Recording");
      setRecordingState("done");
      toast.success("Transcription complete");
      void loadPageData();
    } catch (error: unknown) {
      setRecordingState("error");
      toast.error(error instanceof Error ? error.message : "Transcription failed");
    }
  }, [loadPageData]);

  useEffect(() => {
    if (!audioChunks.length || recordingState !== "recording") {
      return;
    }

    const timeout = window.setTimeout(() => {
      void transcribeAudio(audioChunks);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [audioChunks, recordingState, transcribeAudio]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });

      const mimeType = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => setAudioChunks(chunks);

      recorder.start(1000);
      setAudioChunks([]);
      setCurrentTranscript(null);
      setMediaRecorder(recorder);
      setMediaStream(stream);
      setRecordingState("recording");
      setRecordingTime(0);

      timerRef.current = window.setInterval(() => {
        setRecordingTime((current) => current + 1);
      }, 1000);
    } catch (error: unknown) {
      console.error("Mic access failed:", error);
      setRecordingState("error");
      toast.error("Microphone access denied");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
    }
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [mediaRecorder, mediaStream]);

  const saveAsMemory = useCallback(async (recordingId: string, title?: string) => {
    setSaving(recordingId);
    try {
      const response = await fetch("/api/v1/plugins/voice-to-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", recordingId, title }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to save recording");
      }

      toast.success("Saved to your knowledge base");
      if (currentTranscript?.id === recordingId) {
        setCurrentTranscript(null);
        setRecordingState("idle");
      }
      void loadPageData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save recording");
    } finally {
      setSaving(null);
    }
  }, [currentTranscript?.id, loadPageData]);

  const updateTitle = useCallback(async (recordingId: string, title: string) => {
    try {
      const response = await fetch("/api/v1/plugins/voice-to-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", recordingId, title }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to update title");
      }
      setEditingTitle(false);
      setCurrentTranscript((current) => current ? { ...current, title } : null);
      void loadPageData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update title");
    }
  }, [loadPageData]);

  const deleteRecording = useCallback(async (recordingId: string) => {
    try {
      const response = await fetch("/api/v1/plugins/voice-to-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", recordingId }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete recording");
      }
      toast.success("Recording deleted");
      if (currentTranscript?.id === recordingId) {
        setCurrentTranscript(null);
        setRecordingState("idle");
      }
      void loadPageData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete recording");
    }
  }, [currentTranscript?.id, loadPageData]);

  const resetRecorder = useCallback(() => {
    setRecordingState("idle");
    setCurrentTranscript(null);
    setAudioChunks([]);
    setRecordingTime(0);
    setEditingTitle(false);
  }, []);

  useEffect(() => () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
    }
  }, [mediaStream]);

  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-24">
        <Stagger>
          <div className="flex items-center gap-3 mb-8">
            <Link
              href="/app/plugins"
              className="w-8 h-8 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.06] transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-zinc-400" />
            </Link>
            <div className="flex-1">
              <h1 className="text-[20px] font-semibold text-white tracking-tight">Voice-to-Memory</h1>
              <p className="text-[13px] text-zinc-500 mt-0.5">
                Record a thought, transcribe it, and save it as searchable memory
              </p>
            </div>
          </div>
        </Stagger>

        {providerStatus?.available === false && (
          <Stagger>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[13px] text-amber-400/70 leading-relaxed">
                Voice-to-Memory needs an OpenAI or Gemini API key for transcription. Add one in{" "}
                <Link href="/app/settings" className="underline hover:text-amber-300">Settings</Link>.
              </p>
            </div>
          </Stagger>
        )}

        {stats && stats.totalRecordings > 0 && (
          <Stagger>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: "Recordings", value: stats.totalRecordings.toString(), icon: Mic },
                { label: "Total Time", value: formatDuration(stats.totalDuration), icon: Clock },
                { label: "Words", value: stats.totalWords.toLocaleString(), icon: FileText },
                { label: "Saved", value: stats.savedCount.toString(), icon: Save },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3 text-center">
                  <stat.icon className="w-3.5 h-3.5 text-zinc-600 mx-auto mb-1.5" />
                  <div className="text-[16px] font-semibold text-white">{stat.value}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </Stagger>
        )}

        <Stagger>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6 mb-8 text-center">
            {recordingState === "idle" && (
              <>
                <div className="w-16 h-16 rounded-full bg-teal-500/[0.08] border border-teal-500/20 flex items-center justify-center mx-auto mb-3">
                  <Mic className="w-7 h-7 text-teal-400" />
                </div>
                <p className="text-[14px] text-zinc-400 mb-4">Tap to start recording</p>
                <button
                  onClick={() => { void startRecording(); }}
                  disabled={providerStatus?.available === false}
                  className="w-14 h-14 rounded-full bg-teal-500 hover:bg-teal-400 active:scale-95 flex items-center justify-center transition-all shadow-lg shadow-teal-500/20 disabled:opacity-30 disabled:cursor-not-allowed mx-auto"
                >
                  <Mic className="w-6 h-6 text-white" />
                </button>
              </>
            )}

            {recordingState === "recording" && (
              <>
                <div className="flex items-center gap-2 justify-center mb-2">
                  <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  <span className="text-[13px] font-medium text-red-400 uppercase tracking-wider">Recording</span>
                </div>
                <div className="text-[36px] sm:text-[42px] font-mono font-light text-white tabular-nums mb-4">
                  {formatDuration(recordingTime)}
                </div>
                <button
                  onClick={stopRecording}
                  className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-400 active:scale-95 flex items-center justify-center transition-all shadow-lg shadow-red-500/20 mx-auto"
                >
                  <Square className="w-5 h-5 text-white fill-white" />
                </button>
              </>
            )}

            {recordingState === "transcribing" && (
              <>
                <Loader2 className="w-10 h-10 text-teal-400 animate-spin mx-auto mb-3" />
                <p className="text-[14px] text-zinc-400 font-medium">Transcribing...</p>
                <p className="text-[12px] text-zinc-600 mt-1">
                  {providerStatus?.provider === "openai" ? "Using Whisper" : "Using Gemini"}
                </p>
              </>
            )}

            {recordingState === "error" && (
              <>
                <div className="w-10 h-10 rounded-full bg-red-500/[0.08] border border-red-500/20 flex items-center justify-center mx-auto mb-2">
                  <MicOff className="w-5 h-5 text-red-400" />
                </div>
                <p className="text-[13px] text-red-400 font-medium mb-3">Recording failed</p>
                <button
                  onClick={resetRecorder}
                  className="h-11 px-6 rounded-full bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] inline-flex items-center gap-2 transition-all"
                >
                  <RotateCcw className="w-4 h-4 text-zinc-400" />
                  <span className="text-[13px] font-medium text-zinc-300">Try Again</span>
                </button>
              </>
            )}

            {recordingState === "done" && currentTranscript && (
              <div className="text-left">
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
                          onChange={(event) => setTitleDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void updateTitle(currentTranscript.id, titleDraft);
                            if (event.key === "Escape") setEditingTitle(false);
                          }}
                          className="flex-1 bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-1.5 text-[14px] text-white outline-none focus:border-teal-500/30"
                          autoFocus
                        />
                        <button onClick={() => { void updateTitle(currentTranscript.id, titleDraft); }} className="text-[12px] text-teal-400 hover:text-teal-300">
                          Save
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="text-[15px] font-medium text-white truncate">{currentTranscript.title}</h3>
                        <button
                          onClick={() => {
                            setEditingTitle(true);
                            setTitleDraft(currentTranscript.title);
                          }}
                          className="text-zinc-600 hover:text-zinc-400 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500">
                      <span>{currentTranscript.wordCount} words</span>
                      <span className="text-zinc-700">·</span>
                      <span>{currentTranscript.language}</span>
                      <span className="text-zinc-700">·</span>
                      <span className="capitalize">{currentTranscript.provider}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-4 mb-4">
                  <p className="text-[13px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {currentTranscript.transcript}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => { void saveAsMemory(currentTranscript.id, titleDraft); }}
                    disabled={saving === currentTranscript.id}
                    className="h-11 px-6 rounded-full bg-teal-500 hover:bg-teal-400 active:scale-[0.97] flex items-center gap-2 transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50"
                  >
                    {saving === currentTranscript.id ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 text-white" />
                    )}
                    <span className="text-[13px] font-medium text-white">Save to Knowledge Base</span>
                  </button>
                  <button onClick={resetRecorder} className="h-11 px-4 rounded-full bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] text-zinc-300">
                    Record Another
                  </button>
                  <button
                    onClick={() => { void deleteRecording(currentTranscript.id); }}
                    className="w-11 h-11 rounded-full bg-white/[0.04] border border-white/[0.08] hover:bg-red-500/10 hover:border-red-500/20 flex items-center justify-center transition-all"
                  >
                    <Trash2 className="w-4.5 h-4.5 text-zinc-400 hover:text-red-400" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </Stagger>

        <Stagger>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/[0.04]">
              <h2 className="text-[13px] font-semibold text-zinc-300 uppercase tracking-wider">Recent Recordings</h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
              </div>
            ) : recordings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-3">
                  <Mic className="w-5 h-5 text-zinc-600" />
                </div>
                <p className="text-[13px] text-zinc-400 mb-1">No recordings yet</p>
                <p className="text-[12px] text-zinc-600">Tap the record button above to capture your first thought</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {recordings.map((recording) => (
                  <div key={recording.id} className="flex items-center gap-3.5 px-5 py-3.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      recording.savedAsMemory
                        ? "bg-emerald-500/[0.06] border border-emerald-500/[0.12]"
                        : "bg-white/[0.03] border border-white/[0.06]"
                    }`}>
                      {recording.savedAsMemory ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Mic className="w-4 h-4 text-zinc-500" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-[13px] font-medium text-white truncate">{recording.title}</h4>
                      <p className="text-[12px] text-zinc-500 line-clamp-1 mt-0.5">{recording.transcript.substring(0, 100)}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-600">
                        <span>{formatDuration(recording.durationSeconds)}</span>
                        <span className="text-zinc-700">·</span>
                        <span>{recording.wordCount} words</span>
                        <span className="text-zinc-700">·</span>
                        <span>{formatRelativeTime(recording.createdAt)}</span>
                      </div>
                    </div>

                    {!recording.savedAsMemory && (
                      <button
                        onClick={() => { void saveAsMemory(recording.id); }}
                        disabled={saving === recording.id}
                        className="h-7 px-2.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-[11px] font-medium text-teal-400 hover:bg-teal-500/15 transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {saving === recording.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Save
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Stagger>
      </div>
    </PageTransition>
  );
}
