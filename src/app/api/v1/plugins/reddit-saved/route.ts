/**
 * Reddit Saved Posts Importer — Plugin API Route (thin wrapper)
 *
 * POST /api/v1/plugins/reddit-saved
 *   Body: FormData with:
 *     - file: Reddit data export (ZIP, CSV, or JSON)
 *     - action: "preview" | "import" (default: "import")
 *
 * Logic delegated to src/server/plugins/ports/reddit-saved.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/server/user';
import { db, schema } from '@/server/db';
import { eq, sql } from 'drizzle-orm';
import { generateEmbeddings } from '@/server/embeddings';
import { buildTreeIndex } from '@/server/retrieval';
import JSZip from 'jszip';
import {
  extractPostsFromCSV,
  parseReferenceCSV,
  parseRedditJSON,
  formatRedditContent,
  chunkContent,
  buildStats,
  buildSampleItems,
  type RedditPost,
} from '@/server/plugins/ports/reddit-saved';

// ─── ZIP Processing (route-level wiring) ────────────────────────

async function processZipExport(buffer: ArrayBuffer): Promise<{ posts: RedditPost[]; comments: RedditPost[] }> {
  const zip = await JSZip.loadAsync(buffer);
  let allPosts: RedditPost[] = [];
  let allComments: RedditPost[] = [];

  const files = Object.keys(zip.files).filter(f => !zip.files[f].dir);

  for (const fileName of files) {
    const baseName = fileName.split('/').pop()?.toLowerCase() || '';
    const content = await zip.files[fileName].async('string');
    if (!content.trim()) continue;

    if (baseName.endsWith('.json')) {
      const items = parseRedditJSON(content);
      for (const item of items) {
        if (item.type === 'comment') allComments.push(item);
        else allPosts.push(item);
      }
      continue;
    }

    if (!baseName.endsWith('.csv')) continue;

    if (baseName.includes('saved_post') || baseName === 'saved_posts.csv') {
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

// ─── Auto-Install ───────────────────────────────────────────────

async function ensurePluginInstalled() {
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

// ─── POST Handler ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    await ensurePluginInstalled();

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
      const isComment = fileName.includes('comment');
      const items = extractPostsFromCSV(text, isComment ? 'comment' : 'post');
      if (items.length === 0) {
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
        { status: 400 },
      );
    }

    // Deduplicate by ID
    const seenIds = new Set<string>();
    posts = posts.filter(p => { if (seenIds.has(p.id)) return false; seenIds.add(p.id); return true; });
    comments = comments.filter(c => { if (seenIds.has(c.id)) return false; seenIds.add(c.id); return true; });

    if (posts.length === 0 && comments.length === 0) {
      return NextResponse.json(
        { error: 'No Reddit posts or comments found in this file. Make sure you uploaded a Reddit data export.' },
        { status: 400 },
      );
    }

    // ─── Preview Mode ───────────────────────────────────────
    if (action === 'preview') {
      return NextResponse.json({
        stats: buildStats(posts, comments),
        sampleItems: buildSampleItems(posts, comments),
      });
    }

    // ─── Import Mode ────────────────────────────────────────
    const allItems = [...posts, ...comments];
    const chunks: Array<{ content: string; title: string; subreddit: string; type: 'post' | 'comment' }> = [];

    for (const item of allItems) {
      const { title, content } = formatRedditContent(item);
      const itemChunks = chunkContent(content, 4000);
      for (let i = 0; i < itemChunks.length; i++) {
        chunks.push({
          content: itemChunks.length > 1 ? `[Part ${i + 1}/${itemChunks.length}]\n\n${itemChunks[i]}` : itemChunks[i],
          title: itemChunks.length > 1 ? `${title} (${i + 1}/${itemChunks.length})` : title,
          subreddit: item.subreddit,
          type: item.type,
        });
      }
    }

    const maxChunks = 500;
    const toEmbed = chunks.slice(0, maxChunks);
    const batchSize = 50;
    let totalEmbedded = 0;

    for (let i = 0; i < toEmbed.length; i += batchSize) {
      const batch = toEmbed.slice(i, i + batchSize);
      const embeddings = await generateEmbeddings(batch.map(c => c.content));

      await Promise.all(batch.map(async (chunk, j) => {
        const embedding = embeddings?.[j];
        const memId = crypto.randomUUID();
        const metadata = JSON.stringify({ subreddit: chunk.subreddit, itemType: chunk.type });

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

    try { await buildTreeIndex(userId); } catch (e) { console.error('Tree index rebuild error:', e); }

    // Subreddit breakdown
    const subCounts = new Map<string, number>();
    for (const c of chunks) {
      if (c.subreddit) subCounts.set(c.subreddit, (subCounts.get(c.subreddit) || 0) + 1);
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
    return NextResponse.json({ error: error.message || 'Failed to import Reddit data' }, { status: 500 });
  }
}
