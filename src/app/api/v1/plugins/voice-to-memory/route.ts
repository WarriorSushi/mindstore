import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { generateEmbeddings } from '@/server/embeddings';
import { sql } from 'drizzle-orm';

/**
 * Voice-to-Memory Plugin — Record → Transcribe → Save as searchable memory
 *
 * GET  ?action=recordings       — List all voice recordings (recent first)
 * GET  ?action=stats            — Voice recording stats
 * POST ?action=transcribe       — Upload audio → transcribe via Whisper/Gemini
 * POST ?action=save             — Save transcription as a memory
 * POST ?action=delete           — Delete a voice recording
 * POST ?action=retranscribe     — Re-transcribe with different settings
 */

const PLUGIN_SLUG = 'voice-to-memory';

// ─── Auto-install ────────────────────────────────────────────

async function ensurePluginInstalled() {
  const existing = await db.execute(sql`SELECT id FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
  if ((existing as any[]).length === 0) {
    await db.execute(sql`
      INSERT INTO plugins (slug, name, description, type, status, icon, category)
      VALUES (
        ${PLUGIN_SLUG},
        'Voice-to-Memory',
        'Record voice → transcribe → save as memory. Think-aloud capture with Whisper.',
        'extension',
        'active',
        'Mic',
        'ai'
      )
    `);
  }
}

// ─── Ensure voice_recordings table ───────────────────────────

async function ensureVoiceTable() {
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

// ─── AI Config ───────────────────────────────────────────────

interface AIConfig {
  type: 'openai' | 'gemini';
  key: string;
  model: string;
}

async function getTranscriptionConfig(): Promise<AIConfig | null> {
  const settings = await db.execute(
    sql`SELECT key, value FROM settings WHERE key IN ('openai_api_key', 'gemini_api_key', 'chat_provider')`
  );
  const config: Record<string, string> = {};
  for (const row of settings as any[]) {
    config[row.key] = row.value;
  }

  // Also check env vars
  const openaiKey = config.openai_api_key || process.env.OPENAI_API_KEY;
  const geminiKey = config.gemini_api_key || process.env.GEMINI_API_KEY;

  // OpenAI Whisper is best for transcription
  if (openaiKey) {
    return { type: 'openai', key: openaiKey, model: 'whisper-1' };
  }
  // Gemini can also transcribe audio
  if (geminiKey) {
    return { type: 'gemini', key: geminiKey, model: 'gemini-2.0-flash' };
  }

  return null;
}

// ─── Transcribe with OpenAI Whisper ──────────────────────────

async function transcribeWithWhisper(
  audioBuffer: Buffer,
  apiKey: string,
  language?: string
): Promise<{ text: string; language: string; duration: number; segments?: any[] }> {
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

// ─── Transcribe with Gemini ──────────────────────────────────

async function transcribeWithGemini(
  audioBuffer: Buffer,
  apiKey: string,
  language?: string
): Promise<{ text: string; language: string; duration: number }> {
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
            {
              inlineData: {
                mimeType: 'audio/webm',
                data: base64Audio,
              },
            },
            {
              text: `Transcribe this audio recording accurately and completely. Return ONLY the transcription text, nothing else. Preserve the speaker's exact words.${langHint} If the audio is unclear or silent, respond with "[inaudible]".`,
            },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
        },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  return {
    text: text.trim(),
    language: language || 'auto',
    duration: 0, // Gemini doesn't return duration
  };
}

// ─── Generate title from transcript ──────────────────────────

function generateTitle(transcript: string): string {
  if (!transcript || transcript === '[inaudible]') return 'Voice Recording';

  // Take first meaningful sentence or phrase
  const cleaned = transcript.replace(/\s+/g, ' ').trim();
  const firstSentence = cleaned.split(/[.!?]\s/)[0];

  if (firstSentence.length <= 60) {
    return firstSentence.replace(/[.!?]$/, '');
  }

  // Truncate at word boundary
  const truncated = firstSentence.substring(0, 57);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated) + '…';
}

// ─── GET Handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensurePluginInstalled();
    await ensureVoiceTable();

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'recordings';

    // ─── List recordings ──────────────────────────────────────
    if (action === 'recordings') {
      const limit = parseInt(searchParams.get('limit') || '50');
      const offset = parseInt(searchParams.get('offset') || '0');

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

      return NextResponse.json({
        recordings: recordings as any[],
        total,
        hasMore: offset + limit < total,
      });
    }

    // ─── Stats ────────────────────────────────────────────────
    if (action === 'stats') {
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

      return NextResponse.json({
        totalRecordings: parseInt(row.total_recordings || '0'),
        totalDuration: parseFloat(row.total_duration || '0'),
        totalWords: parseInt(row.total_words || '0'),
        savedCount: parseInt(row.saved_count || '0'),
        avgDuration: parseFloat(row.avg_duration || '0'),
      });
    }

    // ─── Check provider availability ──────────────────────────
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

// ─── POST Handler ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensurePluginInstalled();
    await ensureVoiceTable();

    const contentType = req.headers.get('content-type') || '';

    // ─── Transcribe audio ─────────────────────────────────────
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
        if (!audioFile) {
          return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
        }
        audioBuffer = Buffer.from(await audioFile.arrayBuffer());
        language = formData.get('language') as string || undefined;
        title = formData.get('title') as string || undefined;
      } else {
        // Raw audio body
        audioBuffer = Buffer.from(await req.arrayBuffer());
        const { searchParams } = new URL(req.url);
        language = searchParams.get('language') || undefined;
      }

      if (audioBuffer.length === 0) {
        return NextResponse.json({ error: 'Empty audio file' }, { status: 400 });
      }

      // Size limit: 25MB (Whisper limit)
      if (audioBuffer.length > 25 * 1024 * 1024) {
        return NextResponse.json({ error: 'Audio file too large (max 25MB)' }, { status: 400 });
      }

      // Transcribe
      let result: { text: string; language: string; duration: number; segments?: any[] };

      if (config.type === 'openai') {
        result = await transcribeWithWhisper(audioBuffer, config.key, language);
      } else {
        result = await transcribeWithGemini(audioBuffer, config.key, language);
      }

      if (!result.text || result.text.trim().length === 0) {
        return NextResponse.json({ error: 'No speech detected in recording' }, { status: 422 });
      }

      // Generate title if not provided
      const finalTitle = title || generateTitle(result.text);
      const wordCount = result.text.split(/\s+/).filter(Boolean).length;

      // Save recording metadata
      const recordingId = crypto.randomUUID();
      await db.execute(sql`
        INSERT INTO voice_recordings (id, user_id, title, transcript, duration_seconds,
          audio_size, audio_format, language, provider, model, word_count, metadata)
        VALUES (
          ${recordingId}::uuid, ${userId}::uuid, ${finalTitle}, ${result.text},
          ${result.duration}, ${audioBuffer.length}, 'webm',
          ${result.language}, ${config.type}, ${config.model}, ${wordCount},
          ${JSON.stringify({ segments: result.segments || [] })}::jsonb
        )
      `);

      return NextResponse.json({
        id: recordingId,
        title: finalTitle,
        transcript: result.text,
        language: result.language,
        duration: result.duration,
        wordCount,
        provider: config.type,
        model: config.model,
      });
    }

    // ─── JSON actions ─────────────────────────────────────────
    const body = await req.json();
    const { action } = body;

    // ─── Save as memory ───────────────────────────────────────
    if (action === 'save') {
      const { recordingId, title: customTitle, tags } = body;

      if (!recordingId) {
        return NextResponse.json({ error: 'recordingId required' }, { status: 400 });
      }

      // Fetch recording
      const recordings = await db.execute(sql`
        SELECT * FROM voice_recordings
        WHERE id = ${recordingId}::uuid AND user_id = ${userId}::uuid
      `);
      const recording = (recordings as any[])[0];
      if (!recording) {
        return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
      }

      if (recording.saved_as_memory) {
        return NextResponse.json({ error: 'Already saved as memory', memoryId: recording.memory_id }, { status: 409 });
      }

      const memoryTitle = customTitle || recording.title || 'Voice Recording';
      const content = `# ${memoryTitle}\n\n${recording.transcript}`;

      // Generate embedding
      let embedding: number[] | null = null;
      try {
        const embeds = await generateEmbeddings([content]);
        if (embeds && embeds.length > 0) embedding = embeds[0];
      } catch (e) {
        console.error('Embedding generation failed (non-fatal):', e);
      }

      // Create memory
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

      // Update recording
      await db.execute(sql`
        UPDATE voice_recordings
        SET saved_as_memory = true, memory_id = ${memoryId}::uuid
        WHERE id = ${recordingId}::uuid
      `);

      return NextResponse.json({
        memoryId,
        title: memoryTitle,
        wordCount: recording.word_count,
        message: 'Voice recording saved as memory',
      });
    }

    // ─── Delete recording ─────────────────────────────────────
    if (action === 'delete') {
      const { recordingId } = body;
      if (!recordingId) {
        return NextResponse.json({ error: 'recordingId required' }, { status: 400 });
      }

      await db.execute(sql`
        DELETE FROM voice_recordings
        WHERE id = ${recordingId}::uuid AND user_id = ${userId}::uuid
      `);

      return NextResponse.json({ deleted: true });
    }

    // ─── Update title ─────────────────────────────────────────
    if (action === 'update') {
      const { recordingId, title } = body;
      if (!recordingId) {
        return NextResponse.json({ error: 'recordingId required' }, { status: 400 });
      }

      await db.execute(sql`
        UPDATE voice_recordings
        SET title = ${title}
        WHERE id = ${recordingId}::uuid AND user_id = ${userId}::uuid
      `);

      return NextResponse.json({ updated: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('Voice-to-Memory POST error:', err);
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
