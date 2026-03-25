/**
 * Voice-to-Memory Plugin — Route (thin wrapper)
 *
 * GET  ?action=recordings       — List all voice recordings
 * GET  ?action=stats            — Voice recording stats
 * GET  ?action=check            — Check transcription provider
 * POST (multipart/audio)        — Upload audio → transcribe
 * POST ?action=save             — Save transcription as a memory
 * POST ?action=delete           — Delete a voice recording
 * POST ?action=update           — Update recording title
 *
 * Logic delegated to src/server/plugins/ports/voice-to-memory.ts
 */

import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/server/db';
import { sql, eq } from 'drizzle-orm';
import {
  ensureVoiceTable,
  getTranscriptionConfig,
  transcribeAudio,
  generateTitle,
  listRecordings,
  getVoiceStats,
  saveRecordingMetadata,
  saveRecordingAsMemory,
  deleteRecording,
  updateRecordingTitle,
} from '@/server/plugins/ports/voice-to-memory';

const PLUGIN_SLUG = 'voice-to-memory';

async function ensureInstalled() {
  const existing = await db.select().from(schema.plugins).where(eq(schema.plugins.slug, PLUGIN_SLUG)).limit(1);
  if (existing.length === 0) {
    await db.insert(schema.plugins).values({
      slug: PLUGIN_SLUG,
      name: 'Voice-to-Memory',
      description: 'Record voice → transcribe → save as memory. Think-aloud capture with Whisper.',
      version: '1.0.0',
      type: 'extension',
      status: 'active',
      icon: 'Mic',
      category: 'ai',
      config: {},
    });
  }
}

// ─── GET ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureInstalled();
    await ensureVoiceTable();

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'recordings';

    if (action === 'recordings') {
      const limit = parseInt(searchParams.get('limit') || '50');
      const offset = parseInt(searchParams.get('offset') || '0');
      return NextResponse.json(await listRecordings(userId, limit, offset));
    }

    if (action === 'stats') {
      return NextResponse.json(await getVoiceStats(userId));
    }

    if (action === 'check') {
      const config = await getTranscriptionConfig();
      return NextResponse.json({
        available: !!config,
        provider: config?.type || null,
        model: config?.model || null,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('Voice-to-Memory GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureInstalled();
    await ensureVoiceTable();

    const contentType = req.headers.get('content-type') || '';

    // ─── Transcribe audio ──────────────────────────────────
    if (contentType.includes('multipart/form-data') || contentType.includes('audio/')) {
      const config = await getTranscriptionConfig();
      if (!config) {
        return NextResponse.json({
          error: 'No transcription provider configured. Add an OpenAI or Gemini API key in Settings.',
        }, { status: 400 });
      }

      let audioBuffer: Buffer;
      let language: string | undefined;
      let title: string | undefined;

      if (contentType.includes('multipart/form-data')) {
        const formData = await req.formData();
        const audioFile = formData.get('audio') as File;
        if (!audioFile) return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
        audioBuffer = Buffer.from(await audioFile.arrayBuffer());
        language = formData.get('language') as string || undefined;
        title = formData.get('title') as string || undefined;
      } else {
        audioBuffer = Buffer.from(await req.arrayBuffer());
        const { searchParams } = new URL(req.url);
        language = searchParams.get('language') || undefined;
      }

      if (audioBuffer.length === 0) return NextResponse.json({ error: 'Empty audio file' }, { status: 400 });
      if (audioBuffer.length > 25 * 1024 * 1024) {
        return NextResponse.json({ error: 'Audio file too large (max 25MB)' }, { status: 400 });
      }

      const result = await transcribeAudio(audioBuffer, config, language);

      if (!result.text || result.text.trim().length === 0) {
        return NextResponse.json({ error: 'No speech detected in recording' }, { status: 422 });
      }

      const finalTitle = title || generateTitle(result.text);
      const wordCount = result.text.split(/\s+/).filter(Boolean).length;

      const recording = await saveRecordingMetadata(userId, result, audioBuffer.length, config, finalTitle);

      return NextResponse.json({
        id: recording.id,
        title: recording.title,
        transcript: result.text,
        language: result.language,
        duration: result.duration,
        wordCount: recording.wordCount,
        provider: config.type,
        model: config.model,
      });
    }

    // ─── JSON actions ──────────────────────────────────────
    const body = await req.json();
    const { action } = body;

    if (action === 'save') {
      const { recordingId, title: customTitle } = body;
      if (!recordingId) return NextResponse.json({ error: 'recordingId required' }, { status: 400 });

      try {
        const result = await saveRecordingAsMemory(userId, recordingId, customTitle);
        return NextResponse.json(result);
      } catch (e: any) {
        const status = e.message.includes('not found') ? 404 : e.message.includes('Already') ? 409 : 500;
        return NextResponse.json({ error: e.message }, { status });
      }
    }

    if (action === 'delete') {
      const { recordingId } = body;
      if (!recordingId) return NextResponse.json({ error: 'recordingId required' }, { status: 400 });
      await deleteRecording(userId, recordingId);
      return NextResponse.json({ deleted: true });
    }

    if (action === 'update') {
      const { recordingId, title } = body;
      if (!recordingId) return NextResponse.json({ error: 'recordingId required' }, { status: 400 });
      await updateRecordingTitle(userId, recordingId, title);
      return NextResponse.json({ updated: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('Voice-to-Memory POST error:', err);
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
