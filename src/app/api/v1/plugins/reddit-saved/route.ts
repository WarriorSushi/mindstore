/**
 * Reddit Saved Posts Importer — Plugin API Route
 *
 * POST /api/v1/plugins/reddit-saved
 *   Body: FormData with:
 *     - file: Reddit data export ZIP (from reddit.com/settings/data-request)
 *       OR individual CSV files (saved_posts.csv, saved_comments.csv)
 *     - action: "preview" | "import" (default: "import")
 *
 *   preview: Parses export → returns stats, subreddit breakdown, sample items
 *   import: Parses, chunks, embeds, stores as memories
 *
 * Supports:
 *   - Reddit GDPR data export (ZIP with CSVs)
 *   - Individual CSV files (saved_posts.csv, saved_comments.csv)
 *   - Reddit JSON export format (newer exports)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/server/user';
import { db, schema } from '@/server/db';
import { eq, sql } from 'drizzle-orm';
import { generateEmbeddings } from '@/server/embeddings';
import { buildTreeIndex } from '@/server/retrieval';
import JSZip from 'jszip';
import crypto from 'crypto';

// ─── Types ──────────────────────────────────────────────────────

interface RedditPost {
  id: string;
  title: string;
  body: string;
  subreddit: string;
  author: string;
  url: string;
  permalink: string;
  score: number;
  created: string;         // ISO date string
  type: 'post' | 'comment';
  parentTitle?: string;     // For comments — the post title
  isLink: boolean;         // Link post (vs self post)
}

interface ParseResult {
  posts: RedditPost[];
  comments: RedditPost[];
  stats: {
    totalPosts: number;
    totalComments: number;
    totalItems: number;
    subreddits: { name: string; count: number }[];
    dateRange: { oldest: string | null; newest: string | null };
    topAuthors: { name: string; count: number }[];
    avgScore: number;
  };
  sampleItems: Array<{
    title: string;
    subreddit: string;
    type: 'post' | 'comment';
    score: number;
    preview: string;
    date: string;
  }>;
}

// ─── CSV Parser ─────────────────────────────────────────────────

/**
 * Parse CSV with proper handling of:
 * - Quoted fields with commas inside
 * - Escaped quotes ("" inside quoted fields)
 * - Newlines inside quoted fields
 * - BOM markers
 */
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Remove BOM
  const clean = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        // Escaped quote
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field);
        field = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        current.push(field);
        field = '';
        if (current.some(f => f.trim())) rows.push(current);
        current = [];
        if (ch === '\r') i++;
      } else {
        field += ch;
      }
    }
  }
  // Last field
  current.push(field);
  if (current.some(f => f.trim())) rows.push(current);

  if (rows.length === 0) return { headers: [], rows: [] };

  const headers = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const dataRows = rows.slice(1).map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (row[i] || '').trim();
    });
    return obj;
  });

  return { headers, rows: dataRows };
}

// ─── Reddit Export Parser ───────────────────────────────────────

/**
 * Reddit GDPR export CSV structure (varies by export version):
 *
 * saved_posts.csv: id, permalink, date (or created_utc)
 * saved_comments.csv: id, permalink, date (or created_utc)
 *
 * posts.csv / post_submissions.csv:
 *   id, permalink, date, title, body, url, subreddit, score, ...
 *
 * comments.csv:
 *   id, permalink, date, body, link_title, subreddit, score, ...
 *
 * Newer exports may use different column names, so we normalize.
 */

function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/^#/, '')
    .trim();
}

function parseRedditDate(dateStr: string): string | null {
  if (!dateStr) return null;

  // Try Unix timestamp (seconds)
  const num = Number(dateStr);
  if (!isNaN(num) && num > 1e9 && num < 1e11) {
    return new Date(num * 1000).toISOString();
  }

  // Try ISO format or common date formats
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString();

  return null;
}

function extractPostsFromCSV(csvText: string, type: 'post' | 'comment'): RedditPost[] {
  const { headers, rows } = parseCSV(csvText);
  if (rows.length === 0) return [];

  // Map of possible column names → our field names
  const fieldMap: Record<string, string[]> = {
    id: ['id', 'post_id', 'comment_id', 'thing_id'],
    title: ['title', 'post_title', 'link_title', 'submission_title'],
    body: ['body', 'selftext', 'self_text', 'text', 'content', 'comment_body'],
    subreddit: ['subreddit', 'subreddit_name', 'community', 'sr'],
    author: ['author', 'author_name', 'username', 'user'],
    url: ['url', 'link_url', 'post_url'],
    permalink: ['permalink', 'link', 'post_link'],
    score: ['score', 'upvotes', 'ups', 'points'],
    created: ['date', 'created', 'created_utc', 'created_at', 'timestamp', 'time', 'post_date'],
  };

  function findField(row: Record<string, string>, candidates: string[]): string {
    for (const c of candidates) {
      if (row[c] !== undefined && row[c] !== '') return row[c];
    }
    return '';
  }

  return rows
    .map(row => {
      const id = findField(row, fieldMap.id) || Math.random().toString(36).slice(2);
      const title = findField(row, fieldMap.title);
      const body = findField(row, fieldMap.body);
      const subreddit = findField(row, fieldMap.subreddit).replace(/^r\//, '');
      const author = findField(row, fieldMap.author).replace(/^u\//, '');
      const url = findField(row, fieldMap.url);
      const permalink = findField(row, fieldMap.permalink);
      const scoreStr = findField(row, fieldMap.score);
      const createdStr = findField(row, fieldMap.created);

      // Skip if no meaningful content
      if (!title && !body && !permalink) return null;

      const created = parseRedditDate(createdStr);
      const score = parseInt(scoreStr) || 0;
      const isLink = !!(url && url !== permalink && !url.includes('reddit.com'));

      return {
        id,
        title: title || (type === 'comment' ? 'Comment' : 'Post'),
        body: body || '',
        subreddit,
        author,
        url: url || '',
        permalink: permalink || '',
        score,
        created: created || new Date().toISOString(),
        type,
        parentTitle: type === 'comment' ? title : undefined,
        isLink,
      } as RedditPost;
    })
    .filter(Boolean) as RedditPost[];
}

/**
 * For saved_posts.csv / saved_comments.csv that only contain
 * id + permalink + date (reference files), try to extract
 * subreddit from permalink: /r/subreddit/comments/...
 */
function parseReferenceCSV(csvText: string, type: 'post' | 'comment'): RedditPost[] {
  const { rows } = parseCSV(csvText);
  if (rows.length === 0) return [];

  return rows
    .map(row => {
      const id = row.id || row.thing_id || Math.random().toString(36).slice(2);
      const permalink = row.permalink || row.link || '';
      const dateStr = row.date || row.created || row.created_utc || '';

      if (!permalink) return null;

      // Extract subreddit from permalink: /r/subreddit/comments/abc123/title/
      const subMatch = permalink.match(/\/r\/([^/]+)/);
      const subreddit = subMatch ? subMatch[1] : '';

      // Extract title from permalink slug
      const titleMatch = permalink.match(/\/comments\/[^/]+\/([^/]+)/);
      const title = titleMatch
        ? titleMatch[1].replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
        : (type === 'comment' ? 'Saved Comment' : 'Saved Post');

      return {
        id,
        title,
        body: '',
        subreddit,
        author: '',
        url: `https://www.reddit.com${permalink}`,
        permalink,
        score: 0,
        created: parseRedditDate(dateStr) || new Date().toISOString(),
        type,
        isLink: false,
      } as RedditPost;
    })
    .filter(Boolean) as RedditPost[];
}

// ─── JSON Export Parser ─────────────────────────────────────────

function parseRedditJSON(jsonText: string): RedditPost[] {
  try {
    const data = JSON.parse(jsonText);

    // Could be an array directly, or wrapped in an object
    const items = Array.isArray(data) ? data : (data.data || data.children || data.posts || data.saved || []);

    return items
      .map((item: any) => {
        // Handle Reddit API "thing" format: { kind: "t3", data: { ... } }
        const d = item.data || item;

        const type: 'post' | 'comment' = (
          d.body !== undefined || item.kind === 't1' || d.type === 'comment'
        ) ? 'comment' : 'post';

        return {
          id: d.id || d.name || Math.random().toString(36).slice(2),
          title: d.title || d.link_title || (type === 'comment' ? 'Comment' : 'Post'),
          body: d.body || d.selftext || d.self_text || d.text || '',
          subreddit: (d.subreddit || d.subreddit_name_prefixed || '').replace(/^r\//, ''),
          author: (d.author || d.author_name || '').replace(/^u\//, ''),
          url: d.url || d.link_url || '',
          permalink: d.permalink || '',
          score: d.score || d.ups || 0,
          created: parseRedditDate(String(d.created_utc || d.created || d.date || '')) || new Date().toISOString(),
          type,
          parentTitle: type === 'comment' ? (d.link_title || d.title) : undefined,
          isLink: !!(d.url && !d.is_self && !d.url.includes('reddit.com')),
        } as RedditPost;
      })
      .filter((p: RedditPost) => p.title || p.body);
  } catch {
    return [];
  }
}

// ─── Process ZIP export ─────────────────────────────────────────

async function processZipExport(buffer: ArrayBuffer): Promise<{ posts: RedditPost[]; comments: RedditPost[] }> {
  const zip = await JSZip.loadAsync(buffer);
  let allPosts: RedditPost[] = [];
  let allComments: RedditPost[] = [];

  // Gather all relevant files
  const files = Object.keys(zip.files).filter(f => !zip.files[f].dir);

  for (const fileName of files) {
    const baseName = fileName.split('/').pop()?.toLowerCase() || '';
    const content = await zip.files[fileName].async('string');

    if (!content.trim()) continue;

    // JSON files
    if (baseName.endsWith('.json')) {
      const items = parseRedditJSON(content);
      for (const item of items) {
        if (item.type === 'comment') allComments.push(item);
        else allPosts.push(item);
      }
      continue;
    }

    // CSV files
    if (!baseName.endsWith('.csv')) continue;

    if (baseName.includes('saved_post') || baseName === 'saved_posts.csv') {
      // Could be reference-only or full data
      const full = extractPostsFromCSV(content, 'post');
      if (full.length > 0 && full.some(p => p.body || p.title !== 'Post')) {
        allPosts.push(...full);
      } else {
        allPosts.push(...parseReferenceCSV(content, 'post'));
      }
    } else if (baseName.includes('saved_comment') || baseName === 'saved_comments.csv') {
      const full = extractPostsFromCSV(content, 'comment');
      if (full.length > 0 && full.some(c => c.body || c.title !== 'Comment')) {
        allComments.push(...full);
      } else {
        allComments.push(...parseReferenceCSV(content, 'comment'));
      }
    } else if (baseName === 'posts.csv' || baseName === 'post_submissions.csv' || baseName === 'submissions.csv') {
      allPosts.push(...extractPostsFromCSV(content, 'post'));
    } else if (baseName === 'comments.csv' || baseName === 'comment_replies.csv') {
      allComments.push(...extractPostsFromCSV(content, 'comment'));
    }
  }

  return { posts: allPosts, comments: allComments };
}

// ─── Content Formatter ──────────────────────────────────────────

function formatRedditContent(item: RedditPost): { title: string; content: string } {
  const parts: string[] = [];

  // Header
  if (item.type === 'comment') {
    parts.push(`**Comment** on r/${item.subreddit}`);
    if (item.parentTitle) {
      parts.push(`Re: ${item.parentTitle}`);
    }
  } else {
    parts.push(`**${item.title}**`);
    parts.push(`r/${item.subreddit}`);
  }

  // Metadata line
  const meta: string[] = [];
  if (item.author) meta.push(`u/${item.author}`);
  if (item.score) meta.push(`${item.score} points`);
  if (item.created) {
    const d = new Date(item.created);
    meta.push(d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }));
  }
  if (meta.length > 0) parts.push(meta.join(' · '));

  // Body
  if (item.body) {
    parts.push('');
    parts.push(item.body);
  }

  // External link
  if (item.isLink && item.url) {
    parts.push('');
    parts.push(`🔗 ${item.url}`);
  }

  // Permalink
  if (item.permalink) {
    const fullUrl = item.permalink.startsWith('http')
      ? item.permalink
      : `https://www.reddit.com${item.permalink}`;
    parts.push('');
    parts.push(`Source: ${fullUrl}`);
  }

  const title = item.type === 'comment'
    ? `💬 Comment on r/${item.subreddit}: ${item.parentTitle || item.title}`.slice(0, 200)
    : `📝 r/${item.subreddit}: ${item.title}`.slice(0, 200);

  return { title, content: parts.join('\n') };
}

// ─── Smart Chunking ─────────────────────────────────────────────

function chunkContent(content: string, maxChars: number = 4000): string[] {
  if (content.length <= maxChars) return [content];

  const chunks: string[] = [];
  const paragraphs = content.split('\n\n');
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxChars && current) {
      chunks.push(current.trim());
      current = '';
    }
    current += (current ? '\n\n' : '') + para;
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// ─── Build Stats ────────────────────────────────────────────────

function buildStats(posts: RedditPost[], comments: RedditPost[]): ParseResult['stats'] {
  const all = [...posts, ...comments];

  // Subreddit counts
  const subCounts = new Map<string, number>();
  for (const item of all) {
    if (item.subreddit) {
      subCounts.set(item.subreddit, (subCounts.get(item.subreddit) || 0) + 1);
    }
  }
  const subreddits = Array.from(subCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Author counts
  const authorCounts = new Map<string, number>();
  for (const item of all) {
    if (item.author) {
      authorCounts.set(item.author, (authorCounts.get(item.author) || 0) + 1);
    }
  }
  const topAuthors = Array.from(authorCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Date range
  const dates = all
    .map(i => new Date(i.created).getTime())
    .filter(t => !isNaN(t))
    .sort();

  const oldest = dates.length > 0
    ? new Date(dates[0]).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
    : null;
  const newest = dates.length > 0
    ? new Date(dates[dates.length - 1]).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
    : null;

  // Average score
  const totalScore = all.reduce((s, i) => s + (i.score || 0), 0);
  const avgScore = all.length > 0 ? Math.round(totalScore / all.length) : 0;

  return {
    totalPosts: posts.length,
    totalComments: comments.length,
    totalItems: all.length,
    subreddits,
    dateRange: { oldest, newest },
    topAuthors,
    avgScore,
  };
}

function buildSampleItems(posts: RedditPost[], comments: RedditPost[]): ParseResult['sampleItems'] {
  const all = [...posts, ...comments]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 8);

  return all.map(item => ({
    title: item.type === 'comment'
      ? (item.parentTitle || item.title || 'Comment').slice(0, 100)
      : (item.title || 'Post').slice(0, 100),
    subreddit: item.subreddit,
    type: item.type,
    score: item.score,
    preview: (item.body || '').slice(0, 150),
    date: item.created
      ? new Date(item.created).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : '',
  }));
}

// ─── Auto-Install ───────────────────────────────────────────────

async function ensurePluginInstalled(userId: string) {
  const existing = await db
    .select()
    .from(schema.plugins)
    .where(eq(schema.plugins.slug, 'reddit-saved'))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(schema.plugins).values({
      name: 'Reddit Saved Posts',
      slug: 'reddit-saved',
      description: 'Import saved posts and comments from Reddit data export',
      version: '1.0.0',
      type: 'extension',
      category: 'import',
      icon: 'MessageSquare',
      status: 'active',
      config: {},
    });
  }
}

// ─── Route Handler ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    await ensurePluginInstalled(userId);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const action = formData.get('action') as string || 'import';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // ─── Determine format and parse ─────────────────────────

    let posts: RedditPost[] = [];
    let comments: RedditPost[] = [];

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.zip')) {
      const buffer = await file.arrayBuffer();
      const result = await processZipExport(buffer);
      posts = result.posts;
      comments = result.comments;
    } else if (fileName.endsWith('.json')) {
      const text = await file.text();
      const items = parseRedditJSON(text);
      posts = items.filter(i => i.type === 'post');
      comments = items.filter(i => i.type === 'comment');
    } else if (fileName.endsWith('.csv')) {
      const text = await file.text();
      // Detect type from filename
      const isComment = fileName.includes('comment');
      const items = extractPostsFromCSV(text, isComment ? 'comment' : 'post');
      if (items.length === 0) {
        // Try reference format
        const refItems = parseReferenceCSV(text, isComment ? 'comment' : 'post');
        if (isComment) comments = refItems;
        else posts = refItems;
      } else {
        if (isComment) comments = items;
        else posts = items;
      }
    } else {
      return NextResponse.json(
        { error: 'Unsupported file format. Upload a ZIP, CSV, or JSON file from Reddit data export.' },
        { status: 400 }
      );
    }

    // Deduplicate by ID
    const seenIds = new Set<string>();
    posts = posts.filter(p => {
      if (seenIds.has(p.id)) return false;
      seenIds.add(p.id);
      return true;
    });
    comments = comments.filter(c => {
      if (seenIds.has(c.id)) return false;
      seenIds.add(c.id);
      return true;
    });

    if (posts.length === 0 && comments.length === 0) {
      return NextResponse.json(
        { error: 'No Reddit posts or comments found in this file. Make sure you uploaded a Reddit data export.' },
        { status: 400 }
      );
    }

    // ─── Preview Mode ───────────────────────────────────────

    if (action === 'preview') {
      const stats = buildStats(posts, comments);
      const sampleItems = buildSampleItems(posts, comments);

      return NextResponse.json({
        stats,
        sampleItems,
      });
    }

    // ─── Import Mode ────────────────────────────────────────

    const allItems = [...posts, ...comments];

    // Format & chunk all items
    const chunks: Array<{
      content: string;
      title: string;
      subreddit: string;
      type: 'post' | 'comment';
    }> = [];

    for (const item of allItems) {
      const { title, content } = formatRedditContent(item);
      const itemChunks = chunkContent(content, 4000);

      for (let i = 0; i < itemChunks.length; i++) {
        chunks.push({
          content: itemChunks.length > 1
            ? `[Part ${i + 1}/${itemChunks.length}]\n\n${itemChunks[i]}`
            : itemChunks[i],
          title: itemChunks.length > 1
            ? `${title} (${i + 1}/${itemChunks.length})`
            : title,
          subreddit: item.subreddit,
          type: item.type,
        });
      }
    }

    // Cap at 500 chunks max
    const maxChunks = 500;
    const toEmbed = chunks.slice(0, maxChunks);

    // Generate embeddings in batches and insert
    const batchSize = 50;
    let totalEmbedded = 0;

    for (let i = 0; i < toEmbed.length; i += batchSize) {
      const batch = toEmbed.slice(i, i + batchSize);

      const embeddings = await generateEmbeddings(
        batch.map(c => c.content)
      );

      // Insert memories via raw SQL (matching existing plugin patterns)
      await Promise.all(batch.map(async (chunk, j) => {
        const embedding = embeddings?.[j];
        const memId = crypto.randomUUID();
        const metadata = JSON.stringify({
          subreddit: chunk.subreddit,
          itemType: chunk.type,
        });

        if (embedding) {
          const embStr = `[${embedding.join(',')}]`;
          await db.execute(sql`
            INSERT INTO memories (id, user_id, content, embedding, source_type, source_title, metadata, created_at, imported_at)
            VALUES (${memId}, ${userId}::uuid, ${chunk.content}, ${embStr}::vector, 'reddit', ${chunk.title}, ${metadata}::jsonb, NOW(), NOW())
          `);
        } else {
          await db.execute(sql`
            INSERT INTO memories (id, user_id, content, source_type, source_title, metadata, created_at, imported_at)
            VALUES (${memId}, ${userId}::uuid, ${chunk.content}, 'reddit', ${chunk.title}, ${metadata}::jsonb, NOW(), NOW())
          `);
        }

        totalEmbedded++;
      }));
    }

    // Build tree index
    try {
      await buildTreeIndex(userId);
    } catch (e) {
      console.error('Tree index rebuild error:', e);
    }

    // Subreddit breakdown for response
    const subCounts = new Map<string, number>();
    for (const c of chunks) {
      if (c.subreddit) {
        subCounts.set(c.subreddit, (subCounts.get(c.subreddit) || 0) + 1);
      }
    }
    const topSubreddits = Array.from(subCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return NextResponse.json({
      imported: {
        totalItems: allItems.length,
        totalPosts: posts.length,
        totalComments: comments.length,
        chunks: totalEmbedded,
        skipped: chunks.length > maxChunks ? chunks.length - maxChunks : 0,
        topSubreddits,
      },
    });
  } catch (error: any) {
    console.error('Reddit import error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import Reddit data' },
      { status: 500 }
    );
  }
}
