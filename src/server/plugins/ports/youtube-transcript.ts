/**
 * YouTube Transcript — Portable Logic
 *
 * Extracts URL parsing, metadata fetching, transcript processing,
 * and smart chunking from the route into pure/testable functions.
 * No HTTP route handling — just data in, data out.
 *
 * Capabilities:
 * - Parse video IDs from any YouTube URL format
 * - Fetch video metadata (title, channel, duration, etc.)
 * - Clean and normalize transcript segments
 * - Smart chunking by topic/pause/sentence boundaries
 * - Format chunks for memory storage with context headers
 */

// ─── Types ──────────────────────────────────────────────────────

export interface TranscriptSegment {
  text: string;
  offset: number;   // seconds
  duration: number;  // seconds
}

export interface VideoMetadata {
  title: string;
  channel: string;
  videoId: string;
  description: string;
  duration: string;       // formatted "HH:MM:SS" or "MM:SS"
  thumbnailUrl: string;
  publishDate: string;
}

export interface TopicChunk {
  title: string;
  content: string;
  startTime: number;      // seconds
  endTime: number;        // seconds
  startTimestamp: string;  // formatted
  endTimestamp: string;    // formatted
  wordCount: number;
}

export interface FormattedChunk {
  content: string;
  sourceTitle: string;
}

export interface TranscriptPreview {
  totalWords: number;
  totalSegments: number;
  totalChunks: number;
  durationFormatted: string;
  readingTime: string;
  preview: string;
  chunks: {
    title: string;
    startTimestamp: string;
    endTimestamp: string;
    wordCount: number;
    preview: string;
  }[];
}

// ─── YouTube URL Parsing ────────────────────────────────────────

const YT_REGEX =
  /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i;

export function extractVideoId(url: string): string | null {
  const match = url.match(YT_REGEX);
  return match?.[1] || null;
}

// ─── Time Formatting ────────────────────────────────────────────

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function parseISODuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (
    parseInt(m[1] || '0') * 3600 +
    parseInt(m[2] || '0') * 60 +
    parseInt(m[3] || '0')
  );
}

// ─── HTML Meta Extraction ───────────────────────────────────────

function extractMeta(html: string, name: string, attr: string = 'property'): string {
  const r1 = new RegExp(`<meta\\s+${attr}="${name}"\\s+content="([^"]*)"`, 'i');
  const r2 = new RegExp(`<meta\\s+content="([^"]*)"\\s+${attr}="${name}"`, 'i');
  const r3 = new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, 'i');
  const r4 = new RegExp(`<meta\\s+content="([^"]*)"\\s+name="${name}"`, 'i');
  return (
    r1.exec(html)?.[1] ||
    r2.exec(html)?.[1] ||
    r3.exec(html)?.[1] ||
    r4.exec(html)?.[1] ||
    ''
  );
}

function extractBetween(html: string, start: string, end: string): string | null {
  const s = html.indexOf(start);
  if (s === -1) return null;
  const e = html.indexOf(end, s + start.length);
  if (e === -1) return null;
  return html.slice(s + start.length, e).trim();
}

function extractJsonField(html: string, field: string): string {
  const pattern = new RegExp(
    `${field.replace(/"/g, '"')}\\s*:\\s*"([^"]{1,200})"`,
    'i',
  );
  const match = html.match(pattern);
  return match?.[1] || '';
}

// ─── Video Metadata ─────────────────────────────────────────────

export async function fetchVideoMetadata(videoId: string): Promise<VideoMetadata> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) throw new Error(`Failed to fetch video page: ${res.status}`);
    const html = await res.text();

    const title =
      extractMeta(html, 'og:title') ||
      extractMeta(html, 'title') ||
      extractBetween(html, '<title>', '</title>')?.replace(' - YouTube', '') ||
      'Untitled Video';

    const channel =
      extractMeta(html, 'og:video:tag') ||
      extractJsonField(html, '"ownerChannelName"') ||
      extractJsonField(html, '"author"') ||
      'Unknown Channel';

    const description =
      extractMeta(html, 'og:description') ||
      extractMeta(html, 'description') ||
      '';

    const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    const durationISO = extractMeta(html, 'duration', 'itemprop');
    const durationSeconds = durationISO ? parseISODuration(durationISO) : 0;
    const duration = durationSeconds > 0 ? formatTime(durationSeconds) : '';

    const publishDate =
      extractMeta(html, 'datePublished', 'itemprop') ||
      extractJsonField(html, '"publishDate"') ||
      '';

    return {
      title,
      channel,
      videoId,
      description,
      duration,
      thumbnailUrl,
      publishDate,
    };
  } catch {
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

// ─── Transcript Processing ──────────────────────────────────────

export function cleanTranscriptText(text: string): string {
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
 * Normalize raw transcript segments from the youtube-transcript library.
 * The library returns mixed units depending on the API path used:
 * - InnerTube (JSON): offset/duration in milliseconds
 * - Fallback (XML): offset/duration in seconds (floats)
 * Detect which by checking magnitude and normalize to seconds.
 */
export function normalizeSegments(
  raw: { text: string; offset: number; duration: number }[],
): TranscriptSegment[] {
  if (raw.length === 0) return [];

  const firstOffset = raw[0].offset || 0;
  const isMilliseconds =
    firstOffset > 1000 || (raw.length > 1 && raw[1].offset > 100);

  return raw.map((s) => ({
    text: s.text,
    offset: isMilliseconds ? s.offset / 1000 : s.offset,
    duration: isMilliseconds ? s.duration / 1000 : s.duration,
  }));
}

/**
 * Smart chunking: group transcript segments into topic-based chunks.
 * Detects natural breakpoints:
 * - Pauses > 3 seconds between segments
 * - Accumulated text reaching maxChunkChars
 * - Sentence boundaries near the target size
 */
export function chunkTranscript(
  segments: TranscriptSegment[],
  videoTitle: string,
  maxChunkChars: number = 3500,
): TopicChunk[] {
  if (segments.length === 0) return [];

  const chunks: TopicChunk[] = [];
  let currentSegments: TranscriptSegment[] = [];
  let currentText = '';
  let chunkStartTime = segments[0].offset;

  const flushChunk = () => {
    if (!currentText.trim()) return;

    const endSeg = currentSegments[currentSegments.length - 1];
    const endTime = endSeg.offset + endSeg.duration;
    const startTs = formatTime(Math.floor(chunkStartTime));
    const endTs = formatTime(Math.floor(endTime));
    const wordCount = currentText.split(/\s+/).filter(Boolean).length;

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

    const prevSeg = currentSegments[currentSegments.length - 1];
    const gap = prevSeg ? seg.offset - (prevSeg.offset + prevSeg.duration) : 0;
    const isLongPause = gap > 3;

    const wouldExceedTarget = currentText.length + cleanText.length > maxChunkChars;
    const atMinSize = currentText.length > 800;

    if (atMinSize && (isLongPause || wouldExceedTarget)) {
      if (wouldExceedTarget && !isLongPause) {
        const lastPeriod = currentText.lastIndexOf('. ');
        const lastQuestion = currentText.lastIndexOf('? ');
        const lastExclaim = currentText.lastIndexOf('! ');
        const splitPoint = Math.max(lastPeriod, lastQuestion, lastExclaim);

        if (splitPoint > currentText.length * 0.5) {
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

  flushChunk();
  return chunks;
}

// ─── Memory Formatting ──────────────────────────────────────────

/**
 * Format a single chunk for storage as a memory.
 * Includes video context header + transcript text.
 */
export function formatChunkForMemory(
  chunk: TopicChunk,
  metadata: VideoMetadata,
  chunkIndex: number,
  totalChunks: number,
): FormattedChunk {
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

  return {
    content: parts.join('\n'),
    sourceTitle:
      totalChunks === 1
        ? metadata.title
        : `${metadata.title} (Part ${chunkIndex + 1})`,
  };
}

/**
 * Process an entire transcript into formatted memory chunks.
 */
export function processTranscriptForImport(
  segments: TranscriptSegment[],
  metadata: VideoMetadata,
): FormattedChunk[] {
  const chunks = chunkTranscript(segments, metadata.title);
  return chunks.map((chunk, i) => formatChunkForMemory(chunk, metadata, i, chunks.length));
}

/**
 * Build a preview of the transcript for the UI.
 */
export function buildTranscriptPreview(
  segments: TranscriptSegment[],
  metadata: VideoMetadata,
): TranscriptPreview {
  const fullText = segments.map((s) => cleanTranscriptText(s.text)).join(' ');
  const totalWords = fullText.split(/\s+/).filter(Boolean).length;
  const chunks = chunkTranscript(segments, metadata.title);
  const preview = fullText.substring(0, 500) + (fullText.length > 500 ? '…' : '');

  return {
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
  };
}

/**
 * Compute total transcript stats from segments.
 */
export function computeTranscriptStats(segments: TranscriptSegment[]): {
  totalWords: number;
  totalDuration: number;
  durationFormatted: string;
} {
  const totalWords = segments.reduce(
    (sum, s) => sum + cleanTranscriptText(s.text).split(/\s+/).filter(Boolean).length,
    0,
  );
  const lastSeg = segments[segments.length - 1];
  const totalDuration = lastSeg ? lastSeg.offset + lastSeg.duration : 0;
  return {
    totalWords,
    totalDuration,
    durationFormatted: formatTime(Math.floor(totalDuration)),
  };
}
