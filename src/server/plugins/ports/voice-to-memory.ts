import { and, desc, eq, sql } from "drizzle-orm";
import {
  getTranscriptionConfig,
  transcribeAudio,
} from "@/server/ai-client";
import { db, schema } from "@/server/db";
import { createMemory } from "@/server/memory-ingest";
import { PLUGIN_MANIFESTS } from "@/server/plugins/registry";

const PLUGIN_SLUG = "voice-to-memory";
const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024;

export interface VoiceRecordingRecord {
  id: string;
  title: string;
  transcript: string;
  durationSeconds: number;
  audioSize: number;
  audioFormat: string;
  language: string;
  provider: string;
  model: string;
  confidence: number | null;
  wordCount: number;
  savedAsMemory: boolean;
  memoryId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceRecordingStats {
  totalRecordings: number;
  totalDuration: number;
  totalWords: number;
  savedCount: number;
  avgDuration: number;
}

export interface VoiceProviderStatus {
  available: boolean;
  provider: string | null;
  model: string | null;
}

export interface VoiceTranscriptionInput {
  userId: string;
  audioBuffer: Buffer;
  language?: string;
  title?: string;
  mimeType?: string;
  audioFormat?: string;
}

export async function ensureVoiceToMemoryInstalled() {
  const manifest = PLUGIN_MANIFESTS[PLUGIN_SLUG];
  const [existing] = await db
    .select()
    .from(schema.plugins)
    .where(eq(schema.plugins.slug, PLUGIN_SLUG))
    .limit(1);

  if (existing || !manifest) {
    return;
  }

  await db.insert(schema.plugins).values({
    slug: manifest.slug,
    name: manifest.name,
    description: manifest.description,
    version: manifest.version,
    type: manifest.type,
    status: "active",
    icon: manifest.icon,
    category: manifest.category,
    author: manifest.author,
    metadata: {
      capabilities: manifest.capabilities,
      hooks: manifest.hooks,
      routes: manifest.routes,
      mcpTools: manifest.mcpTools,
      aliases: manifest.aliases || [],
      dashboardWidgets: manifest.ui?.dashboardWidgets || [],
      jobs: manifest.jobs || [],
      jobRuns: {},
    },
  });
}

export async function listVoiceRecordings(
  userId: string,
  input: { limit?: number; offset?: number } = {},
) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);

  const recordings = await db
    .select()
    .from(schema.voiceRecordings)
    .where(eq(schema.voiceRecordings.userId, userId))
    .orderBy(desc(schema.voiceRecordings.createdAt))
    .limit(limit)
    .offset(offset);

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.voiceRecordings)
    .where(eq(schema.voiceRecordings.userId, userId));

  const total = countRow?.total || 0;

  return {
    recordings: recordings.map((recording) => normalizeVoiceRecording(recording)),
    total,
    hasMore: offset + limit < total,
  };
}

export async function getVoiceRecordingStats(userId: string): Promise<VoiceRecordingStats> {
  const [row] = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total_recordings,
      COALESCE(SUM(duration_seconds), 0) AS total_duration,
      COALESCE(SUM(word_count), 0)::int AS total_words,
      COUNT(CASE WHEN saved_as_memory = 1 THEN 1 END)::int AS saved_count,
      COALESCE(AVG(duration_seconds), 0) AS avg_duration
    FROM voice_recordings
    WHERE user_id = ${userId}::uuid
  `) as unknown as Array<{
    total_recordings?: number;
    total_duration?: number;
    total_words?: number;
    saved_count?: number;
    avg_duration?: number;
  }>;

  return {
    totalRecordings: row?.total_recordings || 0,
    totalDuration: Number(row?.total_duration || 0),
    totalWords: row?.total_words || 0,
    savedCount: row?.saved_count || 0,
    avgDuration: Number(row?.avg_duration || 0),
  };
}

export async function getVoiceProviderStatus(): Promise<VoiceProviderStatus> {
  const config = await getTranscriptionConfig();
  return {
    available: !!config,
    provider: config?.type || null,
    model: config?.model || null,
  };
}

export async function transcribeVoiceRecording(input: VoiceTranscriptionInput) {
  if (!input.audioBuffer.length) {
    throw new Error("Empty audio file");
  }

  if (input.audioBuffer.length > MAX_AUDIO_SIZE_BYTES) {
    throw new Error("Audio file too large (max 25MB)");
  }

  const config = await getTranscriptionConfig();
  if (!config) {
    throw new Error("No transcription provider configured. Add an OpenAI or Gemini API key in Settings.");
  }

  const transcription = await transcribeAudio(config, {
    audioBuffer: input.audioBuffer,
    mimeType: input.mimeType || "audio/webm",
    language: input.language,
  });

  if (!transcription.text || !transcription.text.trim()) {
    throw new Error("No speech detected in recording");
  }

  const finalTitle = input.title?.trim() || generateVoiceRecordingTitle(transcription.text);
  const wordCount = transcription.text.split(/\s+/).filter(Boolean).length;

  const [recording] = await db.insert(schema.voiceRecordings).values({
    userId: input.userId,
    title: finalTitle,
    transcript: transcription.text,
    durationSeconds: transcription.duration,
    audioSize: input.audioBuffer.length,
    audioFormat: normalizeAudioFormat(input.audioFormat, input.mimeType),
    language: transcription.language,
    provider: transcription.provider,
    model: transcription.model,
    wordCount,
    metadata: {
      segments: transcription.segments || [],
      mimeType: input.mimeType || "audio/webm",
    },
    updatedAt: new Date(),
  }).returning();

  const normalized = normalizeVoiceRecording(recording);

  return {
    ...normalized,
    transcript: normalized.transcript,
    duration: normalized.durationSeconds,
    wordCount: normalized.wordCount,
    provider: normalized.provider,
  };
}

export async function saveVoiceRecordingAsMemory(
  userId: string,
  recordingId: string,
  customTitle?: string,
) {
  const recording = await getVoiceRecordingById(userId, recordingId);
  if (!recording) {
    throw new Error("Recording not found");
  }

  if (recording.savedAsMemory && recording.memoryId) {
    throw new Error(`Already saved as memory:${recording.memoryId}`);
  }

  const memoryTitle = customTitle?.trim() || recording.title || "Voice Recording";
  const content = `# ${memoryTitle}\n\n${recording.transcript}`;

  const memory = await createMemory({
    userId,
    content,
    sourceType: "audio",
    sourceId: recording.id,
    sourceTitle: memoryTitle,
    metadata: {
      plugin: PLUGIN_SLUG,
      recordingId: recording.id,
      provider: recording.provider,
      model: recording.model,
      language: recording.language,
      durationSeconds: recording.durationSeconds,
      wordCount: recording.wordCount,
    },
  });

  await db
    .update(schema.voiceRecordings)
    .set({
      savedAsMemory: 1,
      memoryId: memory.id,
      updatedAt: new Date(),
    })
    .where(and(
      eq(schema.voiceRecordings.userId, userId),
      eq(schema.voiceRecordings.id, recordingId),
    ));

  return {
    memoryId: memory.id,
    title: memoryTitle,
    wordCount: recording.wordCount,
    message: "Voice recording saved as memory",
  };
}

export async function deleteVoiceRecording(userId: string, recordingId: string) {
  const [deleted] = await db
    .delete(schema.voiceRecordings)
    .where(and(
      eq(schema.voiceRecordings.userId, userId),
      eq(schema.voiceRecordings.id, recordingId),
    ))
    .returning({ id: schema.voiceRecordings.id });

  if (!deleted) {
    throw new Error("Recording not found");
  }

  return { deleted: true };
}

export async function updateVoiceRecordingTitle(
  userId: string,
  recordingId: string,
  title: string,
) {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new Error("Title required");
  }

  const [updated] = await db
    .update(schema.voiceRecordings)
    .set({
      title: trimmedTitle,
      updatedAt: new Date(),
    })
    .where(and(
      eq(schema.voiceRecordings.userId, userId),
      eq(schema.voiceRecordings.id, recordingId),
    ))
    .returning();

  if (!updated) {
    throw new Error("Recording not found");
  }

  return {
    updated: true,
    recording: normalizeVoiceRecording(updated),
  };
}

export function generateVoiceRecordingTitle(transcript: string) {
  if (!transcript || transcript.trim() === "[inaudible]") {
    return "Voice Recording";
  }

  const cleaned = transcript.replace(/\s+/g, " ").trim();
  const firstSentence = cleaned.split(/[.!?]\s/)[0] || cleaned;

  if (firstSentence.length <= 60) {
    return firstSentence.replace(/[.!?]$/, "");
  }

  const truncated = firstSentence.slice(0, 57);
  const lastSpace = truncated.lastIndexOf(" ");
  const safeSlice = lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated;
  return `${safeSlice}...`;
}

async function getVoiceRecordingById(userId: string, recordingId: string) {
  const [recording] = await db
    .select()
    .from(schema.voiceRecordings)
    .where(and(
      eq(schema.voiceRecordings.userId, userId),
      eq(schema.voiceRecordings.id, recordingId),
    ))
    .limit(1);

  return recording ? normalizeVoiceRecording(recording) : null;
}

function normalizeVoiceRecording(row: typeof schema.voiceRecordings.$inferSelect): VoiceRecordingRecord {
  return {
    id: row.id,
    title: row.title || "Voice Recording",
    transcript: row.transcript || "",
    durationSeconds: row.durationSeconds || 0,
    audioSize: row.audioSize || 0,
    audioFormat: row.audioFormat || "webm",
    language: row.language || "auto",
    provider: row.provider || "unknown",
    model: row.model || "",
    confidence: row.confidence ?? null,
    wordCount: row.wordCount || 0,
    savedAsMemory: row.savedAsMemory === 1,
    memoryId: row.memoryId || null,
    metadata: isRecord(row.metadata) ? row.metadata : {},
    createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString() || new Date().toISOString(),
  };
}

function normalizeAudioFormat(audioFormat?: string, mimeType?: string) {
  if (audioFormat?.trim()) {
    return audioFormat.trim().toLowerCase();
  }

  if (!mimeType) {
    return "webm";
  }

  const [, subtype] = mimeType.split("/");
  return subtype?.split(";")[0]?.trim().toLowerCase() || "webm";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
