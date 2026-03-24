/**
 * Kindle Highlights Importer — Plugin API Route
 * 
 * POST /api/v1/plugins/kindle-importer
 *   Body: multipart form with a "My Clippings.txt" file
 *   Parses Kindle clippings format, groups by book, deduplicates
 *   Returns structured highlights ready for import
 * 
 * Kindle "My Clippings.txt" format:
 * ═══════════════════════════════════════
 * Book Title (Author Name)
 * - Your Highlight on page X | location Y-Z | Added on Day, Month DD, YYYY HH:MM:SS AM/PM
 * 
 * The actual highlighted text goes here.
 * It can span multiple lines.
 * ==========
 * 
 * Types: Highlight, Note, Bookmark
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/server/user';
import { db, schema } from '@/server/db';
import { eq, sql } from 'drizzle-orm';
import { generateEmbeddings } from '@/server/embeddings';
import { buildTreeIndex } from '@/server/retrieval';

// ─── Clipping Types ─────────────────────────────────────────────

interface KindleClipping {
  bookTitle: string;
  author: string;
  type: 'highlight' | 'note' | 'bookmark';
  page?: string;
  location?: string;
  date?: string;
  content: string;
}

interface BookGroup {
  title: string;
  author: string;
  highlights: KindleClipping[];
  noteCount: number;
}

// ─── Parser ─────────────────────────────────────────────────────

function parseClippings(text: string): KindleClipping[] {
  const clippings: KindleClipping[] = [];
  
  // Split by Kindle's separator: ==========
  const entries = text.split('==========').filter(e => e.trim());
  
  for (const entry of entries) {
    const lines = entry.trim().split('\n').filter(l => l.trim() !== '');
    if (lines.length < 2) continue;
    
    // Line 1: Book title (Author)
    const titleLine = lines[0].trim();
    let bookTitle = titleLine;
    let author = 'Unknown';
    
    // Extract author from parentheses: "Book Title (Author Name)"
    // Handle nested parens by finding the last set
    const authorMatch = titleLine.match(/\(([^)]+)\)\s*$/);
    if (authorMatch) {
      author = authorMatch[1].trim();
      bookTitle = titleLine.substring(0, titleLine.lastIndexOf('(')).trim();
    }
    
    // Remove BOM and other invisible chars
    bookTitle = bookTitle.replace(/^\uFEFF/, '').trim();
    
    // Line 2: Metadata — "- Your Highlight on page X | location Y-Z | Added on ..."
    const metaLine = lines[1].trim();
    
    let type: 'highlight' | 'note' | 'bookmark' = 'highlight';
    if (/your note/i.test(metaLine)) type = 'note';
    else if (/your bookmark/i.test(metaLine)) type = 'bookmark';
    
    const pageMatch = metaLine.match(/page\s+(\d+[-–]?\d*)/i);
    const locationMatch = metaLine.match(/location\s+(\d+[-–]?\d*)/i);
    const dateMatch = metaLine.match(/Added on\s+(.+)$/i);
    
    // Lines 3+: The actual content
    const content = lines.slice(2).join('\n').trim();
    
    // Skip bookmarks (no content) and empty highlights
    if (type === 'bookmark' || !content) continue;
    
    clippings.push({
      bookTitle,
      author,
      type,
      page: pageMatch?.[1],
      location: locationMatch?.[1],
      date: dateMatch?.[1]?.trim(),
      content,
    });
  }
  
  return clippings;
}

// ─── Deduplication ──────────────────────────────────────────────

function deduplicateClippings(clippings: KindleClipping[]): KindleClipping[] {
  // Kindle often stores overlapping highlights (when you extend a highlight, 
  // both the old and new versions are kept)
  const seen = new Map<string, KindleClipping>();
  
  for (const clip of clippings) {
    const key = `${clip.bookTitle}::${clip.content.substring(0, 100)}`;
    const existing = seen.get(key);
    
    if (!existing) {
      // Check if this is a substring of another highlight in the same book
      let isSubstring = false;
      for (const [, other] of seen) {
        if (other.bookTitle === clip.bookTitle) {
          if (other.content.includes(clip.content) && other.content !== clip.content) {
            isSubstring = true;
            break;
          }
          // Replace if this one is longer (superset)
          if (clip.content.includes(other.content) && clip.content !== other.content) {
            const otherKey = `${other.bookTitle}::${other.content.substring(0, 100)}`;
            seen.delete(otherKey);
          }
        }
      }
      if (!isSubstring) {
        seen.set(key, clip);
      }
    }
  }
  
  return Array.from(seen.values());
}

// ─── Group by Book ──────────────────────────────────────────────

function groupByBook(clippings: KindleClipping[]): BookGroup[] {
  const books = new Map<string, BookGroup>();
  
  for (const clip of clippings) {
    const key = clip.bookTitle;
    if (!books.has(key)) {
      books.set(key, {
        title: clip.bookTitle,
        author: clip.author,
        highlights: [],
        noteCount: 0,
      });
    }
    const book = books.get(key)!;
    book.highlights.push(clip);
    if (clip.type === 'note') book.noteCount++;
  }
  
  // Sort highlights within each book by location/page
  for (const book of books.values()) {
    book.highlights.sort((a, b) => {
      const locA = parseInt(a.location?.split(/[-–]/)[0] || '0');
      const locB = parseInt(b.location?.split(/[-–]/)[0] || '0');
      return locA - locB;
    });
  }
  
  return Array.from(books.values()).sort((a, b) => 
    b.highlights.length - a.highlights.length // books with most highlights first
  );
}

// ─── Format book content ────────────────────────────────────────

function formatBookContent(book: BookGroup): string {
  const parts: string[] = [];
  parts.push(`# ${book.title}`);
  parts.push(`**Author:** ${book.author}`);
  parts.push(`**Highlights:** ${book.highlights.length}`);
  if (book.noteCount > 0) parts.push(`**Notes:** ${book.noteCount}`);
  parts.push('');
  parts.push('---');
  parts.push('');
  
  for (const h of book.highlights) {
    const meta: string[] = [];
    if (h.page) meta.push(`p.${h.page}`);
    if (h.location) meta.push(`loc. ${h.location}`);
    
    if (h.type === 'note') {
      parts.push(`📝 **Note** ${meta.length ? `(${meta.join(', ')})` : ''}`);
    } else {
      parts.push(`💡 ${meta.length ? `(${meta.join(', ')})` : ''}`);
    }
    parts.push(`> ${h.content}`);
    parts.push('');
  }
  
  return parts.join('\n');
}

// ─── POST Handler ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    
    // Check if plugin is installed and active
    const [plugin] = await db
      .select()
      .from(schema.plugins)
      .where(eq(schema.plugins.slug, 'kindle-importer'))
      .limit(1);
    
    if (!plugin || plugin.status !== 'active') {
      return NextResponse.json(
        { error: 'Kindle Importer plugin is not installed or active' },
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
    if (shouldDedup) {
      clippings = deduplicateClippings(clippings);
    }
    const deduped = originalCount - clippings.length;
    
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
      const content = formatBookContent(book);
      
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
          content,
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
