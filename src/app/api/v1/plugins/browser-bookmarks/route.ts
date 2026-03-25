/**
 * Browser Bookmarks Importer — Plugin API Route (thin wrapper)
 *
 * POST /api/v1/plugins/browser-bookmarks
 *   Body: FormData with:
 *     - file: bookmarks HTML file (Netscape format — universal across Chrome, Firefox, Safari, Edge, Brave, Arc)
 *     - action: "preview" | "import" (default: "import")
 *     - fetchContent: "true" | "false" (default: "false") — optionally fetch full page content via readability
 *
 * Logic delegated to src/server/plugins/ports/browser-bookmarks.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/server/user';
import { db, schema } from '@/server/db';
import { eq, sql } from 'drizzle-orm';
import { generateEmbeddings } from '@/server/embeddings';
import { buildTreeIndex } from '@/server/retrieval';
import {
  parseBookmarksHTML,
  extractDomainTitle,
  extractReadableText,
  formatBookmarkContent,
  type Bookmark,
  type BookmarkFolder,
} from '@/server/plugins/ports/browser-bookmarks';

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
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) return null;
    const html = await res.text();
    return extractReadableText(html);
  } catch {
    return null;
  }
}

async function fetchContentsInBatches(bookmarks: Bookmark[], batchSize: number = 5): Promise<void> {
  for (let i = 0; i < bookmarks.length; i += batchSize) {
    const batch = bookmarks.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map(async (b) => { b.content = await fetchPageContent(b.url) || undefined; }),
    );
    if (i + batchSize < bookmarks.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
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

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.html') && !fileName.endsWith('.htm')) {
      return NextResponse.json(
        { error: 'Please upload a bookmarks HTML file. Export from your browser: Chrome (chrome://bookmarks → ⋮ → Export), Firefox (Library → Import/Export → Export), Safari (File → Export Bookmarks).' },
        { status: 400 },
      );
    }

    const html = await file.text();

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
    if (fetchContent) {
      await fetchContentsInBatches(parsed.all);
    }

    const allChunks = parsed.all.map(b => ({
      content: formatBookmarkContent(b),
      sourceTitle: b.title,
    }));

    // Generate embeddings in batches
    let embeddings: number[][] | null = null;
    const MAX_EMBED_CHUNKS = 200;
    if (allChunks.length <= MAX_EMBED_CHUNKS) {
      try {
        const allEmbeddings: number[][] = [];
        for (let i = 0; i < allChunks.length; i += 50) {
          const batch = allChunks.slice(i, i + 50);
          const batchEmbeddings = await generateEmbeddings(batch.map(c => c.content));
          if (batchEmbeddings) allEmbeddings.push(...batchEmbeddings);
        }
        if (allEmbeddings.length === allChunks.length) embeddings = allEmbeddings;
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
    try { await buildTreeIndex(userId); } catch (e) { console.error('Tree index build failed (non-fatal):', e); }

    // Send notification
    try {
      const { notifyImportComplete } = await import('@/server/notifications');
      await notifyImportComplete('browser-bookmarks', 'Browser Bookmarks', inserted, '/app/explore?source=bookmark');
    } catch { /* non-fatal */ }

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
