/**
 * YouTube Transcript Importer — Plugin API Route
 *
 * POST /api/v1/plugins/youtube-transcript
 *   Body JSON: { url: string, action?: "preview" | "import" }
 *
 *   preview: Fetches video metadata + transcript → returns structured preview
 *   import (default): Fetches transcript, chunks by topic segments, stores as memories
 *
 * No API key required — uses youtube-transcript library (unofficial YTB API)
 * Supports: youtube.com/watch?v=..., youtu.be/..., youtube.com/embed/...
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/server/user';
import { db, schema } from '@/server/db';
import { eq, sql } from 'drizzle-orm';
import { generateEmbeddings } from '@/server/embeddings';
import { buildTreeIndex } from '@/server/retrieval';
import { YoutubeTranscript } from 'youtube-transcript';

// ─── Types ──────────────────────────────────────────────────────

interface TranscriptSegment {
  text: string;
  offset: number;   // seconds
  duration: number;  // seconds
}

interface VideoMetadata {
  title: string;
  channel: string;
  videoId: string;
  description: string;
  duration: string;       // formatted "HH:MM:SS" or "MM:SS"
  thumbnailUrl: string;
  publishDate: string;
}

interface TopicChunk {
  title: string;
  content: string;
  startTime: number;      // seconds
  endTime: number;        // seconds
  startTimestamp: string;  // formatted
  endTimestamp: string;    // formatted
  wordCount: number;
}

// ─── YouTube URL Parsing ────────────────────────────────────────

const YT_REGEX = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i;

function extractVideoId(url: string): string | null {
  const match = url.match(YT_REGEX);
  return match?.[1] || null;
}

// ─── Video Metadata Extraction ──────────────────────────────────

async function fetchVideoMetadata(videoId: string): Promise<VideoMetadata> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) throw new Error(`Failed to fetch video page: ${res.status}`);

    const html = await res.text();

    // Extract from meta tags and JSON-LD
    const title =
      extractMeta(html, 'og:title') ||
      extractMeta(html, 'title') ||
      extractBetween(html, '<title>', '</title>')?.replace(' - YouTube', '') ||
      'Untitled Video';

    const channel =
      extractMeta(html, 'og:video:tag') || // sometimes has channel
      extractJsonField(html, '"ownerChannelName"') ||
      extractJsonField(html, '"author"') ||
      'Unknown Channel';

    const description =
      extractMeta(html, 'og:description') ||
      extractMeta(html, 'description') ||
      '';

    const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    // Duration from itemprop or JSON
    const durationISO = extractMeta(html, 'duration', 'itemprop');
    const durationSeconds = durationISO ? parseISODuration(durationISO) : 0;
    const duration = durationSeconds > 0 ? formatTime(durationSeconds) : '';

    const publishDate =
      extractMeta(html, 'datePublished', 'itemprop') ||
      extractJsonField(html, '"publishDate"') ||
      '';

    return { title, channel, videoId, description, duration, thumbnailUrl, publishDate };
  } catch (e) {
    // Fallback with minimal info
    return {
      title: 'YouTube Video',
      channel: 'Unknown',
      videoId,
      description: '',
      duration: '',
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      publishDate: '',
    };
  }
}

function extractMeta(html: string, name: string, attr: string = 'property'): string {
  // Try property="..." content="..."
  const r1 = new RegExp(`<meta\\s+${attr}="${name}"\\s+content="([^"]*)"`, 'i');
  const r2 = new RegExp(`<meta\\s+content="([^"]*)"\\s+${attr}="${name}"`, 'i');
  // Also try name="..."
  const r3 = new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, 'i');
  const r4 = new RegExp(`<meta\\s+content="([^"]*)"\\s+name="${name}"`, 'i');

  return r1.exec(html)?.[1] || r2.exec(html)?.[1] || r3.exec(html)?.[1] || r4.exec(html)?.[1] || '';
}

function extractBetween(html: string, start: string, end: string): string | null {
  const s = html.indexOf(start);
  if (s === -1) return null;
  const e = html.indexOf(end, s + start.length);
  if (e === -1) return null;
  return html.slice(s + start.length, e).trim();
}

function extractJsonField(html: string, field: string): string {
  // Find "fieldName":"value" in inline JSON
  const pattern = new RegExp(`${field.replace(/"/g, '"')}\\s*:\\s*"([^"]{1,200})"`, 'i');
  const match = html.match(pattern);
  return match?.[1] || '';
}

function parseISODuration(iso: string): number {
  // Parse PT1H2M3S format
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || '0') * 3600) + (parseInt(m[2] || '0') * 60) + parseInt(m[3] || '0');
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Transcript Processing ──────────────────────────────────────

function cleanTranscriptText(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n/g, ' ')
    .trim();
}

/**
 * Smart chunking: group transcript segments into topic-based chunks.
 * Instead of arbitrary character splits, we detect natural breakpoints:
 * - Pauses > 3 seconds between segments
 * - Accumulated text reaching ~3000 chars (target chunk size)
 * - Sentence boundaries near the target size
 *
 * Each chunk gets a timestamp range and auto-generated title.
 */
function chunkTranscript(
  segments: TranscriptSegment[],
  videoTitle: string,
  maxChunkChars: number = 3500,
): TopicChunk[] {
  if (segments.length === 0) return [];

  const chunks: TopicChunk[] = [];
  let currentSegments: TranscriptSegment[] = [];
  let currentText = '';
  let chunkStartTime = segments[0].offset;
  let chunkIndex = 0;

  const flushChunk = () => {
    if (!currentText.trim()) return;

    const endSeg = currentSegments[currentSegments.length - 1];
    const endTime = endSeg.offset + endSeg.duration;
    const startTs = formatTime(Math.floor(chunkStartTime));
    const endTs = formatTime(Math.floor(endTime));
    const wordCount = currentText.split(/\s+/).filter(Boolean).length;

    chunkIndex++;
    chunks.push({
      title: `${videoTitle} [${startTs}–${endTs}]`,
      content: currentText.trim(),
      startTime: chunkStartTime,
      endTime,
      startTimestamp: startTs,
      endTimestamp: endTs,
      wordCount,
    });

    currentSegments = [];
    currentText = '';
  };

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const cleanText = cleanTranscriptText(seg.text);

    if (currentSegments.length === 0) {
      chunkStartTime = seg.offset;
    }

    // Detect natural breakpoints
    const prevSeg = currentSegments[currentSegments.length - 1];
    const gap = prevSeg ? seg.offset - (prevSeg.offset + prevSeg.duration) : 0;
    const isLongPause = gap > 3; // >3 second pause

    // Check if we should split
    const wouldExceedTarget = (currentText.length + cleanText.length) > maxChunkChars;
    const atMinSize = currentText.length > 800; // Don't split too small

    if (atMinSize && (isLongPause || wouldExceedTarget)) {
      // Try to split at a sentence boundary
      if (wouldExceedTarget && !isLongPause) {
        // Find last sentence-ending punctuation
        const lastPeriod = currentText.lastIndexOf('. ');
        const lastQuestion = currentText.lastIndexOf('? ');
        const lastExclaim = currentText.lastIndexOf('! ');
        const splitPoint = Math.max(lastPeriod, lastQuestion, lastExclaim);

        if (splitPoint > currentText.length * 0.5) {
          // Split at sentence boundary — adjust currentText
          const overflow = currentText.slice(splitPoint + 2);
          currentText = currentText.slice(0, splitPoint + 1);
          flushChunk();
          chunkStartTime = seg.offset;
          currentText = overflow + ' ';
        } else {
          flushChunk();
          chunkStartTime = seg.offset;
        }
      } else {
        flushChunk();
        chunkStartTime = seg.offset;
      }
    }

    currentSegments.push(seg);
    currentText += (currentText ? ' ' : '') + cleanText;
  }

  // Flush remaining
  flushChunk();

  return chunks;
}

/**
 * Format a full chunk for storage as a memory.
 * Includes video context header + transcript text.
 */
function formatChunkContent(
  chunk: TopicChunk,
  metadata: VideoMetadata,
  chunkIndex: number,
  totalChunks: number,
): string {
  const parts: string[] = [];

  parts.push(`# ${metadata.title}`);
  parts.push(`**Channel:** ${metadata.channel}`);
  if (metadata.publishDate) parts.push(`**Published:** ${metadata.publishDate}`);
  parts.push(`**Segment:** ${chunk.startTimestamp} – ${chunk.endTimestamp}`);
  if (totalChunks > 1) parts.push(`**Part:** ${chunkIndex + 1} of ${totalChunks}`);
  parts.push(`**Words:** ${chunk.wordCount.toLocaleString()}`);
  parts.push('');
  parts.push('---');
  parts.push('');
  parts.push(chunk.content);

  return parts.join('\n');
}

// ─── POST Handler ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();

    // Parse request body
    const body = await req.json();
    const { url, action } = body as { url: string; action?: 'preview' | 'import' };

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'No YouTube URL provided' }, { status: 400 });
    }

    // Extract video ID
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

    // Map to our segment type
    // The library returns mixed units depending on the API path used:
    // - InnerTube (JSON) path: offset/duration in milliseconds (integers from <p t="...">)
    // - Fallback (XML) path: offset/duration in seconds (floats from <text start="...">)
    // Detect which by checking if values are large (ms) or small (seconds)
    const firstOffset = rawTranscript[0]?.offset || 0;
    const isMilliseconds = firstOffset > 1000 || (rawTranscript.length > 1 && rawTranscript[1]?.offset > 100);

    const segments: TranscriptSegment[] = rawTranscript.map((s) => ({
      text: s.text,
      offset: isMilliseconds ? s.offset / 1000 : s.offset,
      duration: isMilliseconds ? s.duration / 1000 : s.duration,
    }));

    // Calculate total duration from segments
    const lastSeg = segments[segments.length - 1];
    const totalDuration = lastSeg.offset + lastSeg.duration;
    const totalWords = segments.reduce(
      (sum, s) => sum + cleanTranscriptText(s.text).split(/\s+/).filter(Boolean).length,
      0,
    );

    // Update metadata duration if we got better info from transcript
    if (!metadata.duration && totalDuration > 0) {
      metadata.duration = formatTime(Math.floor(totalDuration));
    }

    // Smart chunk the transcript
    const chunks = chunkTranscript(segments, metadata.title);

    // ─── Preview mode ─────────────────────────────────────────
    if (action === 'preview') {
      // Build a preview of the first few hundred chars of transcript
      const fullText = segments.map((s) => cleanTranscriptText(s.text)).join(' ');
      const preview = fullText.substring(0, 500) + (fullText.length > 500 ? '…' : '');

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
        transcript: {
          totalWords,
          totalSegments: segments.length,
          totalChunks: chunks.length,
          durationFormatted: metadata.duration,
          readingTime: `${Math.ceil(totalWords / 225)} min`,
          preview,
          chunks: chunks.map((c) => ({
            title: c.title,
            startTimestamp: c.startTimestamp,
            endTimestamp: c.endTimestamp,
            wordCount: c.wordCount,
            preview: c.content.substring(0, 150) + (c.content.length > 150 ? '…' : ''),
          })),
        },
      });
    }

    // ─── Import mode ──────────────────────────────────────────

    // Format chunks for storage
    const allChunks = chunks.map((chunk, i) => ({
      content: formatChunkContent(chunk, metadata, i, chunks.length),
      sourceTitle: chunks.length === 1
        ? metadata.title
        : `${metadata.title} (Part ${i + 1})`,
    }));

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
    try {
      await buildTreeIndex(userId);
    } catch (e) {
      console.error('Tree index build failed (non-fatal):', e);
    }

    // Send notification
    try {
      const { notifyImportComplete } = await import('@/server/notifications');
      await notifyImportComplete(
        'youtube-importer', 'YouTube',
        allChunks.length,
        '/app/explore?source=youtube'
      );
    } catch (e) { /* non-fatal */ }

    return NextResponse.json({
      imported: {
        video: {
          title: metadata.title,
          channel: metadata.channel,
          videoId: metadata.videoId,
          duration: metadata.duration,
        },
        totalWords,
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
