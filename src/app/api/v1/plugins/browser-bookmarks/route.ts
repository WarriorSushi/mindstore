/**
 * Browser Bookmarks Importer — Plugin API Route
 *
 * POST /api/v1/plugins/browser-bookmarks
 *   Body: FormData with:
 *     - file: bookmarks HTML file (Netscape format — universal across Chrome, Firefox, Safari, Edge, Brave, Arc)
 *     - action: "preview" | "import" (default: "import")
 *     - fetchContent: "true" | "false" (default: "false") — optionally fetch full page content via readability
 *
 *   preview: Parses bookmarks file → returns structured tree with stats
 *   import: Parses bookmarks, optionally fetches content, stores as memories
 *
 * Supports: Chrome, Firefox, Safari, Edge, Brave, Arc, Opera (all export Netscape bookmark HTML)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/server/user';
import { db, schema } from '@/server/db';
import { eq, sql } from 'drizzle-orm';
import { generateEmbeddings } from '@/server/embeddings';
import { buildTreeIndex } from '@/server/retrieval';

// ─── Types ──────────────────────────────────────────────────────

interface Bookmark {
  title: string;
  url: string;
  addDate: number | null;      // Unix timestamp (seconds)
  folder: string;              // Full folder path: "Bookmarks Bar / Design / Inspiration"
  content?: string;            // Fetched page content (optional)
}

interface BookmarkFolder {
  name: string;
  path: string;
  bookmarks: Bookmark[];
  children: BookmarkFolder[];
}

interface ParseResult {
  root: BookmarkFolder;
  all: Bookmark[];
  stats: {
    totalBookmarks: number;
    totalFolders: number;
    topFolders: { name: string; count: number }[];
    oldestDate: string | null;
    newestDate: string | null;
  };
}

// ─── Netscape Bookmark HTML Parser ──────────────────────────────

function parseBookmarksHTML(html: string): ParseResult {
  const all: Bookmark[] = [];
  const root: BookmarkFolder = { name: 'Bookmarks', path: '', bookmarks: [], children: [] };
  const folderCounts = new Map<string, number>();

  // State machine — walk through lines
  const lines = html.split('\n');
  const folderStack: BookmarkFolder[] = [root];
  let currentFolder = root;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Folder open: <DT><H3 ...>Folder Name</H3>
    const folderMatch = line.match(/<DT>\s*<H3[^>]*>(.*?)<\/H3>/i);
    if (folderMatch) {
      const folderName = decodeHTMLEntities(folderMatch[1]);
      const path = currentFolder.path
        ? `${currentFolder.path} / ${folderName}`
        : folderName;
      const newFolder: BookmarkFolder = {
        name: folderName,
        path,
        bookmarks: [],
        children: [],
      };
      currentFolder.children.push(newFolder);
      folderStack.push(newFolder);
      currentFolder = newFolder;
      continue;
    }

    // Bookmark: <DT><A HREF="..." ADD_DATE="..." ...>Title</A>
    const bookmarkMatch = line.match(
      /<DT>\s*<A\s+([^>]*)>(.*?)<\/A>/i,
    );
    if (bookmarkMatch) {
      const attrs = bookmarkMatch[1];
      const title = decodeHTMLEntities(bookmarkMatch[2]);

      const hrefMatch = attrs.match(/HREF="([^"]*)"/i);
      const addDateMatch = attrs.match(/ADD_DATE="(\d+)"/i);

      if (hrefMatch) {
        const url = hrefMatch[1];
        // Skip internal browser URLs
        if (url.startsWith('javascript:') || url.startsWith('data:') || url.startsWith('chrome://') || url.startsWith('about:') || url.startsWith('edge://') || url.startsWith('brave://')) {
          continue;
        }

        const addDate = addDateMatch ? parseInt(addDateMatch[1]) : null;

        const bookmark: Bookmark = {
          title: title || extractDomainTitle(url),
          url,
          addDate,
          folder: currentFolder.path || 'Uncategorized',
        };

        currentFolder.bookmarks.push(bookmark);
        all.push(bookmark);

        // Track folder counts
        const topFolder = currentFolder.path.split(' / ')[0] || 'Uncategorized';
        folderCounts.set(topFolder, (folderCounts.get(topFolder) || 0) + 1);
      }
      continue;
    }

    // Folder close: </DL>
    if (line.match(/<\/DL>/i)) {
      if (folderStack.length > 1) {
        folderStack.pop();
        currentFolder = folderStack[folderStack.length - 1];
      }
      continue;
    }
  }

  // Calculate stats
  const dates = all.filter(b => b.addDate).map(b => b.addDate!);
  const oldestDate = dates.length > 0 ? new Date(Math.min(...dates) * 1000).toISOString().split('T')[0] : null;
  const newestDate = dates.length > 0 ? new Date(Math.max(...dates) * 1000).toISOString().split('T')[0] : null;

  // Count all folders recursively
  let totalFolders = 0;
  const countFolders = (f: BookmarkFolder) => {
    totalFolders += f.children.length;
    f.children.forEach(countFolders);
  };
  countFolders(root);

  // Top folders by count
  const topFolders = [...folderCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  return {
    root,
    all,
    stats: {
      totalBookmarks: all.length,
      totalFolders,
      topFolders,
      oldestDate,
      newestDate,
    },
  };
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function extractDomainTitle(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url.substring(0, 60);
  }
}

// ─── Content Fetching (optional) ────────────────────────────────

async function fetchPageContent(url: string, timeoutMs: number = 8000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    });

    clearTimeout(timer);

    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return null; // Skip non-HTML (PDFs, images, etc.)
    }

    const html = await res.text();

    // Basic readability extraction — strip tags, get text content
    return extractReadableText(html);
  } catch {
    return null;
  }
}

function extractReadableText(html: string): string {
  // Remove script, style, nav, header, footer elements
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');

  // Extract title
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  const title = titleMatch ? decodeHTMLEntities(titleMatch[1]) : '';

  // Extract meta description
  const descMatch = html.match(/<meta\s+(?:name="description"\s+content="([^"]*)"| content="([^"]*)"\s+name="description")/i);
  const description = descMatch ? decodeHTMLEntities(descMatch[1] || descMatch[2] || '') : '';

  // Convert headings to text with markers
  text = text.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n## $1\n');

  // Convert p, div, br to newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/?(p|div|li|tr|blockquote)[^>]*>/gi, '\n');

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode entities
  text = decodeHTMLEntities(text);

  // Clean up whitespace
  text = text
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line.length > 0)
    .join('\n');

  // Limit to ~4000 chars
  if (text.length > 4000) {
    text = text.substring(0, 4000) + '…';
  }

  // Prepend title/description if available
  const parts: string[] = [];
  if (title) parts.push(`# ${title}`);
  if (description) parts.push(description);
  if (parts.length > 0) parts.push('');
  parts.push(text);

  return parts.join('\n').trim();
}

// ─── Batch Content Fetcher ──────────────────────────────────────

async function fetchContentsInBatches(
  bookmarks: Bookmark[],
  batchSize: number = 5,
): Promise<void> {
  for (let i = 0; i < bookmarks.length; i += batchSize) {
    const batch = bookmarks.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (b) => {
        b.content = await fetchPageContent(b.url) || undefined;
      }),
    );
    // Small delay between batches to be polite
    if (i + batchSize < bookmarks.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

// ─── Format bookmark for storage ────────────────────────────────

function formatBookmarkContent(bookmark: Bookmark): string {
  const parts: string[] = [];

  parts.push(`# ${bookmark.title}`);
  parts.push(`**URL:** ${bookmark.url}`);
  parts.push(`**Folder:** ${bookmark.folder}`);
  if (bookmark.addDate) {
    const date = new Date(bookmark.addDate * 1000);
    parts.push(`**Saved:** ${date.toISOString().split('T')[0]}`);
  }

  if (bookmark.content) {
    parts.push('');
    parts.push('---');
    parts.push('');
    parts.push(bookmark.content);
  }

  return parts.join('\n');
}

// ─── POST Handler ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const action = (formData.get('action') as string) || 'import';
    const fetchContent = formData.get('fetchContent') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No bookmarks file uploaded' }, { status: 400 });
    }

    // Validate file
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.html') && !fileName.endsWith('.htm')) {
      return NextResponse.json(
        { error: 'Please upload a bookmarks HTML file. Export from your browser: Chrome (chrome://bookmarks → ⋮ → Export), Firefox (Library → Import/Export → Export), Safari (File → Export Bookmarks).' },
        { status: 400 },
      );
    }

    // Read and parse
    const html = await file.text();

    // Quick validation — check for Netscape bookmark format markers
    if (!html.includes('NETSCAPE-Bookmark') && !html.includes('<DT>') && !html.includes('HREF=')) {
      return NextResponse.json(
        { error: 'This doesn\'t look like a browser bookmarks export. Look for "Export Bookmarks" in your browser settings.' },
        { status: 400 },
      );
    }

    const parsed = parseBookmarksHTML(html);

    if (parsed.all.length === 0) {
      return NextResponse.json(
        { error: 'No bookmarks found in the file. The file may be empty or in an unsupported format.' },
        { status: 404 },
      );
    }

    // Auto-install plugin if needed
    let [plugin] = await db
      .select()
      .from(schema.plugins)
      .where(eq(schema.plugins.slug, 'browser-bookmarks'))
      .limit(1);

    if (!plugin) {
      [plugin] = await db
        .insert(schema.plugins)
        .values({
          slug: 'browser-bookmarks',
          name: 'Browser Bookmarks',
          description: 'Import bookmarks from Chrome, Firefox, Safari, Edge, and more.',
          version: '1.0.0',
          type: 'extension',
          status: 'active',
          icon: 'Bookmark',
          category: 'import',
          author: 'MindStore',
          config: {},
          metadata: {},
        })
        .returning();
    }

    if (plugin.status === 'disabled') {
      return NextResponse.json(
        { error: 'Browser Bookmarks plugin is disabled. Enable it in the Plugins page.' },
        { status: 403 },
      );
    }

    // ─── Preview mode ─────────────────────────────────────────
    if (action === 'preview') {
      // Flatten folder tree for preview
      const flatFolders: { path: string; count: number }[] = [];
      const flattenFolders = (folder: BookmarkFolder) => {
        if (folder.bookmarks.length > 0) {
          flatFolders.push({ path: folder.path || 'Root', count: folder.bookmarks.length });
        }
        folder.children.forEach(flattenFolders);
      };
      flattenFolders(parsed.root);

      return NextResponse.json({
        stats: parsed.stats,
        folders: flatFolders.sort((a, b) => b.count - a.count).slice(0, 20),
        sampleBookmarks: parsed.all.slice(0, 10).map(b => ({
          title: b.title,
          url: b.url,
          folder: b.folder,
          addDate: b.addDate ? new Date(b.addDate * 1000).toISOString().split('T')[0] : null,
          domain: extractDomainTitle(b.url),
        })),
      });
    }

    // ─── Import mode ──────────────────────────────────────────

    // Optionally fetch content for each bookmark
    if (fetchContent) {
      await fetchContentsInBatches(parsed.all);
    }

    // Format all bookmarks as memory content
    const allChunks = parsed.all.map(b => ({
      content: formatBookmarkContent(b),
      sourceTitle: b.title,
    }));

    // Generate embeddings in batches
    let embeddings: number[][] | null = null;
    const MAX_EMBED_CHUNKS = 200;
    if (allChunks.length <= MAX_EMBED_CHUNKS) {
      try {
        // Batch embeddings in groups of 50 to avoid API limits
        const allEmbeddings: number[][] = [];
        for (let i = 0; i < allChunks.length; i += 50) {
          const batch = allChunks.slice(i, i + 50);
          const batchEmbeddings = await generateEmbeddings(batch.map(c => c.content));
          if (batchEmbeddings) {
            allEmbeddings.push(...batchEmbeddings);
          }
        }
        if (allEmbeddings.length === allChunks.length) {
          embeddings = allEmbeddings;
        }
      } catch (e) {
        console.error('Bookmarks embeddings failed (non-fatal):', e);
      }
    }

    // Insert into DB in batches
    let inserted = 0;
    const BATCH_SIZE = 20;

    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      const batch = allChunks.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (chunk, j) => {
        const idx = i + j;
        const embedding = embeddings?.[idx];
        const memId = crypto.randomUUID();

        if (embedding) {
          const embStr = `[${embedding.join(',')}]`;
          await db.execute(sql`
            INSERT INTO memories (id, user_id, content, embedding, source_type, source_title, created_at, imported_at)
            VALUES (${memId}, ${userId}::uuid, ${chunk.content}, ${embStr}::vector, 'bookmark', ${chunk.sourceTitle}, NOW(), NOW())
          `);
        } else {
          await db.execute(sql`
            INSERT INTO memories (id, user_id, content, source_type, source_title, created_at, imported_at)
            VALUES (${memId}, ${userId}::uuid, ${chunk.content}, 'bookmark', ${chunk.sourceTitle}, NOW(), NOW())
          `);
        }
        inserted++;
      });

      await Promise.all(batchPromises);
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
        'browser-bookmarks', 'Browser Bookmarks',
        inserted,
        '/app/explore?source=bookmark'
      );
    } catch (e) { /* non-fatal */ }

    return NextResponse.json({
      imported: {
        totalBookmarks: inserted,
        embedded: embeddings?.length || 0,
        withContent: fetchContent ? parsed.all.filter(b => b.content).length : 0,
        stats: parsed.stats,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Browser bookmarks import error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
