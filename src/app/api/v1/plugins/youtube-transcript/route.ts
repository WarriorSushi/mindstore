/**
 * YouTube Transcript Importer — Plugin API Route (thin wrapper)
 *
 * POST /api/v1/plugins/youtube-transcript
 *   Body JSON: { url: string, action?: "preview" | "import" }
 *
 * Logic delegated to src/server/plugins/ports/youtube-transcript.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/server/user';
import { db, schema } from '@/server/db';
import { eq, sql } from 'drizzle-orm';
import { generateEmbeddings } from '@/server/embeddings';
import { buildTreeIndex } from '@/server/retrieval';
import { YoutubeTranscript } from 'youtube-transcript';
import {
  extractVideoId,
  fetchVideoMetadata,
  normalizeSegments,
  processTranscriptForImport,
  buildTranscriptPreview,
  computeTranscriptStats,
  chunkTranscript,
  formatTime,
} from '@/server/plugins/ports/youtube-transcript';

// ─── POST Handler ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();

    const body = await req.json();
    const { url, action } = body as { url: string; action?: 'preview' | 'import' };

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'No YouTube URL provided' }, { status: 400 });
    }

    const videoId = extractVideoId(url.trim());
    if (!videoId) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL. Supported formats: youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/...' },
        { status: 400 },
      );
    }

    // Auto-install plugin if needed
    let [plugin] = await db
      .select()
      .from(schema.plugins)
      .where(eq(schema.plugins.slug, 'youtube-transcript'))
      .limit(1);

    if (!plugin) {
      [plugin] = await db
        .insert(schema.plugins)
        .values({
          slug: 'youtube-transcript',
          name: 'YouTube Transcript',
          description: 'Import transcripts from YouTube videos.',
          version: '1.0.0',
          type: 'extension',
          status: 'active',
          icon: 'PlayCircle',
          category: 'import',
          author: 'MindStore',
          config: {},
          metadata: {},
        })
        .returning();
    }

    if (plugin.status === 'disabled') {
      return NextResponse.json(
        { error: 'YouTube Transcript plugin is disabled. Enable it in the Plugins page.' },
        { status: 403 },
      );
    }

    // Fetch metadata + transcript in parallel
    const [metadata, rawTranscript] = await Promise.all([
      fetchVideoMetadata(videoId),
      YoutubeTranscript.fetchTranscript(videoId).catch((e: Error) => {
        throw new Error(
          e.message?.includes('disabled')
            ? 'Transcripts are disabled for this video.'
            : e.message?.includes('not available') || e.message?.includes('No transcripts')
              ? 'No transcripts available for this video. It may not have captions.'
              : e.message?.includes('Too many')
                ? 'YouTube rate limit hit. Please wait a minute and try again.'
                : `Failed to fetch transcript: ${e.message}`,
        );
      }),
    ]);

    if (!rawTranscript || rawTranscript.length === 0) {
      return NextResponse.json(
        { error: 'No transcript content found for this video.' },
        { status: 404 },
      );
    }

    // Normalize ms/s and compute stats via port
    const segments = normalizeSegments(rawTranscript);
    const stats = computeTranscriptStats(segments);

    // Update metadata duration if we got better info from transcript
    if (!metadata.duration && stats.totalDuration > 0) {
      metadata.duration = formatTime(Math.floor(stats.totalDuration));
    }

    // ─── Preview mode ─────────────────────────────────────────
    if (action === 'preview') {
      const preview = buildTranscriptPreview(segments, metadata);
      return NextResponse.json({
        video: {
          title: metadata.title,
          channel: metadata.channel,
          videoId: metadata.videoId,
          duration: metadata.duration,
          thumbnailUrl: metadata.thumbnailUrl,
          publishDate: metadata.publishDate,
          url: `https://www.youtube.com/watch?v=${videoId}`,
        },
        transcript: preview,
      });
    }

    // ─── Import mode ──────────────────────────────────────────
    const allChunks = processTranscriptForImport(segments, metadata);
    const chunks = chunkTranscript(segments, metadata.title);

    // Generate embeddings
    let embeddings: number[][] | null = null;
    const MAX_EMBED_CHUNKS = 100;
    if (allChunks.length <= MAX_EMBED_CHUNKS) {
      try {
        embeddings = await generateEmbeddings(allChunks.map((c) => c.content));
      } catch (e) {
        console.error('YouTube transcript embeddings failed (non-fatal):', e);
      }
    }

    // Insert into DB
    for (let i = 0; i < allChunks.length; i++) {
      const chunk = allChunks[i];
      const embedding = embeddings?.[i];
      const memId = crypto.randomUUID();

      if (embedding) {
        const embStr = `[${embedding.join(',')}]`;
        await db.execute(sql`
          INSERT INTO memories (id, user_id, content, embedding, source_type, source_title, created_at, imported_at)
          VALUES (${memId}, ${userId}::uuid, ${chunk.content}, ${embStr}::vector, 'youtube', ${chunk.sourceTitle}, NOW(), NOW())
        `);
      } else {
        await db.execute(sql`
          INSERT INTO memories (id, user_id, content, source_type, source_title, created_at, imported_at)
          VALUES (${memId}, ${userId}::uuid, ${chunk.content}, 'youtube', ${chunk.sourceTitle}, NOW(), NOW())
        `);
      }
    }

    // Rebuild tree index
    try { await buildTreeIndex(userId); } catch (e) { console.error('Tree index build failed (non-fatal):', e); }

    // Send notification
    try {
      const { notifyImportComplete } = await import('@/server/notifications');
      await notifyImportComplete('youtube-importer', 'YouTube', allChunks.length, '/app/explore?source=youtube');
    } catch { /* non-fatal */ }

    return NextResponse.json({
      imported: {
        video: {
          title: metadata.title,
          channel: metadata.channel,
          videoId: metadata.videoId,
          duration: metadata.duration,
        },
        totalWords: stats.totalWords,
        chunks: allChunks.length,
        embedded: embeddings?.length || 0,
        chunkDetails: chunks.map((c) => ({
          title: c.title,
          startTimestamp: c.startTimestamp,
          endTimestamp: c.endTimestamp,
          wordCount: c.wordCount,
        })),
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('YouTube transcript import error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
