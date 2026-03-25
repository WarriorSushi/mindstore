/**
 * Voice-to-Memory — Portable logic module
 * 
 * Extracted from the route for convergence with codex runtime.
 * This module handles: transcription (Whisper/Gemini), recording management,
 * and saving transcripts as memories.
 */

import { db } from '@/server/db';
import { generateEmbeddings } from '@/server/embeddings';
import { sql } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────

export interface TranscriptionConfig {
  type: 'openai' | 'gemini';
  key: string;
  model: string;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  duration: number;
  segments?: any[];
}

export interface VoiceRecording {
  id: string;
  userId: string;
  title: string;
  transcript: string;
  durationSeconds: number;
  audioSize: number;
  audioFormat: string;
  language: string;
  provider: string;
  model: string;
  wordCount: number;
  savedAsMemory: boolean;
  memoryId: string | null;
  createdAt: string;
}

export interface VoiceStats {
  totalRecordings: number;
  totalDuration: number;
  totalWords: number;
  savedCount: number;
  avgDuration: number;
}

// ─── Table Setup ──────────────────────────────────────────────

export async function ensureVoiceTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS voice_recordings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      title TEXT,
      transcript TEXT,
      duration_seconds REAL,
      audio_size INTEGER,
      audio_format TEXT DEFAULT 'webm',
      language TEXT,
      provider TEXT,
      model TEXT,
      confidence REAL,
      word_count INTEGER,
      saved_as_memory BOOLEAN DEFAULT false,
      memory_id UUID,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// ─── Transcription Config ─────────────────────────────────────

export async function getTranscriptionConfig(): Promise<TranscriptionConfig | null> {
  const settings = await db.execute(
    sql`SELECT key, value FROM settings WHERE key IN ('openai_api_key', 'gemini_api_key', 'chat_provider')`
  );
  const config: Record<string, string> = {};
  for (const row of settings as any[]) {
    config[row.key] = row.value;
  }

  const openaiKey = config.openai_api_key || process.env.OPENAI_API_KEY;
  const geminiKey = config.gemini_api_key || process.env.GEMINI_API_KEY;

  if (openaiKey) return { type: 'openai', key: openaiKey, model: 'whisper-1' };
  if (geminiKey) return { type: 'gemini', key: geminiKey, model: 'gemini-2.0-flash' };
  return null;
}

// ─── Transcription Providers ──────────────────────────────────

export async function transcribeAudio(
  audioBuffer: Buffer,
  config: TranscriptionConfig,
  language?: string,
): Promise<TranscriptionResult> {
  if (config.type === 'openai') {
    return transcribeWithWhisper(audioBuffer, config.key, language);
  }
  return transcribeWithGemini(audioBuffer, config.key, language);
}

async function transcribeWithWhisper(
  audioBuffer: Buffer,
  apiKey: string,
  language?: string,
): Promise<TranscriptionResult> {
  const formData = new FormData();
  const uint8 = new Uint8Array(audioBuffer);
  const blob = new Blob([uint8], { type: 'audio/webm' });
  formData.append('file', blob, 'recording.webm');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  if (language) formData.append('language', language);

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Whisper API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return {
    text: data.text || '',
    language: data.language || 'en',
    duration: data.duration || 0,
    segments: data.segments,
  };
}

async function transcribeWithGemini(
  audioBuffer: Buffer,
  apiKey: string,
  language?: string,
): Promise<TranscriptionResult> {
  const base64Audio = audioBuffer.toString('base64');
  const langHint = language ? ` The audio is in ${language}.` : '';

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType: 'audio/webm', data: base64Audio } },
            { text: `Transcribe this audio recording accurately and completely. Return ONLY the transcription text, nothing else.${langHint} If the audio is unclear or silent, respond with "[inaudible]".` },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { text: text.trim(), language: language || 'auto', duration: 0 };
}

// ─── Title Generation ─────────────────────────────────────────

export function generateTitle(transcript: string): string {
  if (!transcript || transcript === '[inaudible]') return 'Voice Recording';
  const cleaned = transcript.replace(/\s+/g, ' ').trim();
  const firstSentence = cleaned.split(/[.!?]\s/)[0]!;
  if (firstSentence.length <= 60) return firstSentence.replace(/[.!?]$/, '');
  const truncated = firstSentence.substring(0, 57);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated) + '…';
}

// ─── Recording Management ─────────────────────────────────────

export async function listRecordings(
  userId: string,
  limit = 50,
  offset = 0,
): Promise<{ recordings: any[]; total: number; hasMore: boolean }> {
  const recordings = await db.execute(sql`
    SELECT id, title, transcript, duration_seconds, audio_size, audio_format,
           language, provider, model, confidence, word_count,
           saved_as_memory, memory_id, metadata, created_at
    FROM voice_recordings
    WHERE user_id = ${userId}::uuid
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const countResult = await db.execute(sql`
    SELECT COUNT(*) as total FROM voice_recordings WHERE user_id = ${userId}::uuid
  `);
  const total = parseInt((countResult as any[])[0]?.total || '0');

  return { recordings: recordings as any[], total, hasMore: offset + limit < total };
}

export async function getVoiceStats(userId: string): Promise<VoiceStats> {
  const stats = await db.execute(sql`
    SELECT
      COUNT(*) as total_recordings,
      COALESCE(SUM(duration_seconds), 0) as total_duration,
      COALESCE(SUM(word_count), 0) as total_words,
      COUNT(CASE WHEN saved_as_memory = true THEN 1 END) as saved_count,
      COALESCE(AVG(duration_seconds), 0) as avg_duration
    FROM voice_recordings
    WHERE user_id = ${userId}::uuid
  `);
  const row = (stats as any[])[0] || {};
  return {
    totalRecordings: parseInt(row.total_recordings || '0'),
    totalDuration: parseFloat(row.total_duration || '0'),
    totalWords: parseInt(row.total_words || '0'),
    savedCount: parseInt(row.saved_count || '0'),
    avgDuration: parseFloat(row.avg_duration || '0'),
  };
}

export async function saveRecordingMetadata(
  userId: string,
  result: TranscriptionResult,
  audioSize: number,
  config: TranscriptionConfig,
  title?: string,
): Promise<{ id: string; title: string; wordCount: number }> {
  const finalTitle = title || generateTitle(result.text);
  const wordCount = result.text.split(/\s+/).filter(Boolean).length;
  const recordingId = crypto.randomUUID();

  await db.execute(sql`
    INSERT INTO voice_recordings (id, user_id, title, transcript, duration_seconds,
      audio_size, audio_format, language, provider, model, word_count, metadata)
    VALUES (
      ${recordingId}::uuid, ${userId}::uuid, ${finalTitle}, ${result.text},
      ${result.duration}, ${audioSize}, 'webm',
      ${result.language}, ${config.type}, ${config.model}, ${wordCount},
      ${JSON.stringify({ segments: result.segments || [] })}::jsonb
    )
  `);

  return { id: recordingId, title: finalTitle, wordCount };
}

// ─── Save as Memory ───────────────────────────────────────────

export async function saveRecordingAsMemory(
  userId: string,
  recordingId: string,
  customTitle?: string,
): Promise<{ memoryId: string; title: string; wordCount: number }> {
  const recordings = await db.execute(sql`
    SELECT * FROM voice_recordings
    WHERE id = ${recordingId}::uuid AND user_id = ${userId}::uuid
  `);
  const recording = (recordings as any[])[0];
  if (!recording) throw new Error('Recording not found');
  if (recording.saved_as_memory) throw new Error('Already saved as memory');

  const memoryTitle = customTitle || recording.title || 'Voice Recording';
  const content = `# ${memoryTitle}\n\n${recording.transcript}`;

  let embedding: number[] | null = null;
  try {
    const embeds = await generateEmbeddings([content]);
    if (embeds?.length) embedding = embeds[0]!;
  } catch (e) {
    console.error('Embedding generation failed (non-fatal):', e);
  }

  const memoryId = crypto.randomUUID();
  if (embedding) {
    const embStr = `[${embedding.join(',')}]`;
    await db.execute(sql`
      INSERT INTO memories (id, user_id, content, embedding, source_type, source_title, created_at, imported_at)
      VALUES (${memoryId}::uuid, ${userId}::uuid, ${content}, ${embStr}::vector, 'audio', ${memoryTitle}, NOW(), NOW())
    `);
  } else {
    await db.execute(sql`
      INSERT INTO memories (id, user_id, content, source_type, source_title, created_at, imported_at)
      VALUES (${memoryId}::uuid, ${userId}::uuid, ${content}, 'audio', ${memoryTitle}, NOW(), NOW())
    `);
  }

  await db.execute(sql`
    UPDATE voice_recordings SET saved_as_memory = true, memory_id = ${memoryId}::uuid
    WHERE id = ${recordingId}::uuid
  `);

  return { memoryId, title: memoryTitle, wordCount: recording.word_count };
}

// ─── Delete Recording ─────────────────────────────────────────

export async function deleteRecording(userId: string, recordingId: string): Promise<void> {
  await db.execute(sql`
    DELETE FROM voice_recordings
    WHERE id = ${recordingId}::uuid AND user_id = ${userId}::uuid
  `);
}

// ─── Update Recording ─────────────────────────────────────────

export async function updateRecordingTitle(userId: string, recordingId: string, title: string): Promise<void> {
  await db.execute(sql`
    UPDATE voice_recordings SET title = ${title}
    WHERE id = ${recordingId}::uuid AND user_id = ${userId}::uuid
  `);
}
