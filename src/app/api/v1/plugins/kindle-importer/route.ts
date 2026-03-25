/**
 * Kindle Highlights Importer — Route (thin wrapper)
 *
 * POST /api/v1/plugins/kindle-importer
 *   Body: multipart form with a "My Clippings.txt" file
 *   Parses Kindle clippings format, groups by book, deduplicates
 *   Returns structured highlights ready for import
 *
 * Logic delegated to src/server/plugins/ports/kindle-importer.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/server/user';
import { db, schema } from '@/server/db';
import { eq, sql } from 'drizzle-orm';
import { generateEmbeddings } from '@/server/embeddings';
import { buildTreeIndex } from '@/server/retrieval';
import {
  parseClippings,
  deduplicateClippings,
  groupByBook,
  formatBookContent,
  type BookGroup,
} from '@/server/plugins/ports/kindle-importer';

// ─── POST Handler ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();

    // Check if plugin is installed — auto-install if not
    let [plugin] = await db
      .select()
      .from(schema.plugins)
      .where(eq(schema.plugins.slug, 'kindle-importer'))
      .limit(1);

    if (!plugin) {
      // Auto-install on first use (built-in plugin)
      [plugin] = await db
        .insert(schema.plugins)
        .values({
          slug: 'kindle-importer',
          name: 'Kindle Highlights',
          description: 'Import your Kindle highlights and notes.',
          version: '1.0.0',
          type: 'extension',
          status: 'active',
          icon: 'BookOpen',
          category: 'import',
          author: 'MindStore',
          config: { dedup: true },
          metadata: {},
        })
        .returning();
    }

    if (plugin.status === 'disabled') {
      return NextResponse.json(
        { error: 'Kindle Importer plugin is disabled. Enable it in the Plugins page.' },
        { status: 403 }
      );
    }

    const pluginConfig = (plugin.config || {}) as Record<string, unknown>;
    const shouldDedup = pluginConfig.dedup !== false; // default: true

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const text = await file.text();

    if (!text.includes('==========')) {
      return NextResponse.json(
        { error: 'This doesn\'t look like a Kindle clippings file. Expected "My Clippings.txt" from your Kindle.' },
        { status: 400 }
      );
    }

    // Parse clippings
    let clippings = parseClippings(text);

    if (clippings.length === 0) {
      return NextResponse.json(
        { error: 'No highlights or notes found in the file.' },
        { status: 400 }
      );
    }

    // Deduplicate if enabled
    const originalCount = clippings.length;
    let deduped = 0;
    if (shouldDedup) {
      const result = deduplicateClippings(clippings);
      clippings = result.deduplicated;
      deduped = result.removedCount;
    }

    // Group by book
    const books = groupByBook(clippings);

    // Check for the "preview" action — returns parsed data without importing
    const action = formData.get('action') as string;
    if (action === 'preview') {
      return NextResponse.json({
        books: books.map(b => ({
          title: b.title,
          author: b.author,
          highlightCount: b.highlights.length,
          noteCount: b.noteCount,
          preview: b.highlights.slice(0, 3).map(h => ({
            content: h.content.substring(0, 200),
            type: h.type,
            page: h.page,
            location: h.location,
          })),
        })),
        totalHighlights: clippings.length,
        totalBooks: books.length,
        duplicatesRemoved: deduped,
      });
    }

    // Import: create one memory per book with all its highlights
    const allChunks: { content: string; sourceTitle: string }[] = [];

    for (const book of books) {
      // For books with many highlights, chunk by groups of ~10 highlights
      if (book.highlights.length > 15) {
        const CHUNK_SIZE = 10;
        for (let i = 0; i < book.highlights.length; i += CHUNK_SIZE) {
          const slice = book.highlights.slice(i, i + CHUNK_SIZE);
          const chunkBook: BookGroup = {
            ...book,
            highlights: slice,
            noteCount: slice.filter(h => h.type === 'note').length,
          };
          const partLabel = `${book.title} (Part ${Math.floor(i / CHUNK_SIZE) + 1})`;
          allChunks.push({
            content: formatBookContent(chunkBook),
            sourceTitle: partLabel,
          });
        }
      } else {
        allChunks.push({
          content: formatBookContent(book),
          sourceTitle: book.title,
        });
      }
    }

    // Generate embeddings
    let embeddings: number[][] | null = null;
    const MAX_EMBED_CHUNKS = 100;
    if (allChunks.length <= MAX_EMBED_CHUNKS) {
      try {
        embeddings = await generateEmbeddings(allChunks.map(c => c.content));
      } catch (e) {
        console.error('Kindle embeddings failed (non-fatal):', e);
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
          VALUES (${memId}, ${userId}::uuid, ${chunk.content}, ${embStr}::vector, 'kindle', ${chunk.sourceTitle}, NOW(), NOW())
        `);
      } else {
        await db.execute(sql`
          INSERT INTO memories (id, user_id, content, source_type, source_title, created_at, imported_at)
          VALUES (${memId}, ${userId}::uuid, ${chunk.content}, 'kindle', ${chunk.sourceTitle}, NOW(), NOW())
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
        'kindle-importer', 'Kindle Highlights',
        clippings.length,
        '/app/explore?source=kindle'
      );
    } catch (e) { /* non-fatal */ }

    return NextResponse.json({
      imported: {
        books: books.length,
        highlights: clippings.length,
        chunks: allChunks.length,
        duplicatesRemoved: deduped,
        embedded: embeddings?.length || 0,
        bookDetails: books.map(b => ({
          title: b.title,
          author: b.author,
          highlights: b.highlights.length,
        })),
      },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Kindle import error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
