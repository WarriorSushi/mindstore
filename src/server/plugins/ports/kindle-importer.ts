/**
 * Kindle Highlights Importer — Ported Plugin Logic
 *
 * Extracted from: src/app/api/v1/plugins/kindle-importer/route.ts
 *
 * Pure parsing + formatting logic. No HTTP, no NextRequest/NextResponse.
 * The route becomes a thin adapter that calls these functions.
 *
 * Kindle "My Clippings.txt" format:
 * ═══════════════════════════════════════
 * Book Title (Author Name)
 * - Your Highlight on page X | location Y-Z | Added on Day, Month DD, YYYY HH:MM:SS AM/PM
 *
 * The actual highlighted text goes here.
 * ==========
 */

// ─── Types ──────────────────────────────────────────────────────

export interface KindleClipping {
  bookTitle: string;
  author: string;
  type: 'highlight' | 'note' | 'bookmark';
  page?: string;
  location?: string;
  date?: string;
  content: string;
}

export interface BookGroup {
  title: string;
  author: string;
  highlights: KindleClipping[];
  noteCount: number;
}

export interface BookPreview {
  title: string;
  author: string;
  highlightCount: number;
  noteCount: number;
  preview: {
    content: string;
    type: string;
    page?: string;
    location?: string;
  }[];
}

export interface ParseResult {
  clippings: KindleClipping[];
  books: BookGroup[];
  originalCount: number;
  deduplicatedCount: number;
}

export interface ImportChunk {
  content: string;
  sourceTitle: string;
}

// ─── Validation ─────────────────────────────────────────────────

/**
 * Quick check: does this text look like a Kindle clippings file?
 */
export function isKindleClippings(text: string): boolean {
  return text.includes('==========');
}

// ─── Parser ─────────────────────────────────────────────────────

/**
 * Parse raw "My Clippings.txt" content into structured clippings.
 * Handles BOM, nested parentheses in titles, multi-line highlights.
 */
export function parseClippings(text: string): KindleClipping[] {
  const clippings: KindleClipping[] = [];

  const entries = text.split('==========').filter((e) => e.trim());

  for (const entry of entries) {
    const lines = entry
      .trim()
      .split('\n')
      .filter((l) => l.trim() !== '');
    if (lines.length < 2) continue;

    // Line 1: "Book Title (Author Name)"
    const titleLine = lines[0].trim();
    let bookTitle = titleLine;
    let author = 'Unknown';

    const authorMatch = titleLine.match(/\(([^)]+)\)\s*$/);
    if (authorMatch) {
      author = authorMatch[1].trim();
      bookTitle = titleLine.substring(0, titleLine.lastIndexOf('(')).trim();
    }

    // Strip BOM
    bookTitle = bookTitle.replace(/^\uFEFF/, '').trim();

    // Line 2: Metadata
    const metaLine = lines[1].trim();

    let type: 'highlight' | 'note' | 'bookmark' = 'highlight';
    if (/your note/i.test(metaLine)) type = 'note';
    else if (/your bookmark/i.test(metaLine)) type = 'bookmark';

    const pageMatch = metaLine.match(/page\s+(\d+[-–]?\d*)/i);
    const locationMatch = metaLine.match(/location\s+(\d+[-–]?\d*)/i);
    const dateMatch = metaLine.match(/Added on\s+(.+)$/i);

    // Lines 3+: Content
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

/**
 * Deduplicate clippings: Kindle stores both old and new versions when
 * you extend a highlight. Keep the longer (superset) version.
 */
export function deduplicateClippings(clippings: KindleClipping[]): KindleClipping[] {
  const seen = new Map<string, KindleClipping>();

  for (const clip of clippings) {
    const key = `${clip.bookTitle}::${clip.content.substring(0, 100)}`;
    const existing = seen.get(key);

    if (!existing) {
      let isSubstring = false;
      for (const [, other] of seen) {
        if (other.bookTitle === clip.bookTitle) {
          if (other.content.includes(clip.content) && other.content !== clip.content) {
            isSubstring = true;
            break;
          }
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

/**
 * Group clippings by book, sorted by location within each book.
 * Books sorted by highlight count (most first).
 */
export function groupByBook(clippings: KindleClipping[]): BookGroup[] {
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

  for (const book of books.values()) {
    book.highlights.sort((a, b) => {
      const locA = parseInt(a.location?.split(/[-–]/)[0] || '0');
      const locB = parseInt(b.location?.split(/[-–]/)[0] || '0');
      return locA - locB;
    });
  }

  return Array.from(books.values()).sort(
    (a, b) => b.highlights.length - a.highlights.length,
  );
}

// ─── Formatting ─────────────────────────────────────────────────

/**
 * Format a single book's highlights as a Markdown document.
 */
export function formatBookContent(book: BookGroup): string {
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

// ─── Chunking ───────────────────────────────────────────────────

/**
 * Build import-ready chunks from book groups.
 * Large books (>15 highlights) are split into ~10-highlight chunks.
 */
export function buildImportChunks(books: BookGroup[]): ImportChunk[] {
  const chunks: ImportChunk[] = [];

  for (const book of books) {
    if (book.highlights.length > 15) {
      const CHUNK_SIZE = 10;
      for (let i = 0; i < book.highlights.length; i += CHUNK_SIZE) {
        const slice = book.highlights.slice(i, i + CHUNK_SIZE);
        const chunkBook: BookGroup = {
          ...book,
          highlights: slice,
          noteCount: slice.filter((h) => h.type === 'note').length,
        };
        chunks.push({
          content: formatBookContent(chunkBook),
          sourceTitle: `${book.title} (Part ${Math.floor(i / CHUNK_SIZE) + 1})`,
        });
      }
    } else {
      chunks.push({
        content: formatBookContent(book),
        sourceTitle: book.title,
      });
    }
  }

  return chunks;
}

// ─── Preview ────────────────────────────────────────────────────

/**
 * Build a preview response (before import).
 */
export function buildPreview(books: BookGroup[], totalHighlights: number, deduped: number): {
  books: BookPreview[];
  totalHighlights: number;
  totalBooks: number;
  duplicatesRemoved: number;
} {
  return {
    books: books.map((b) => ({
      title: b.title,
      author: b.author,
      highlightCount: b.highlights.length,
      noteCount: b.noteCount,
      preview: b.highlights.slice(0, 3).map((h) => ({
        content: h.content.substring(0, 200),
        type: h.type,
        page: h.page,
        location: h.location,
      })),
    })),
    totalHighlights,
    totalBooks: books.length,
    duplicatesRemoved: deduped,
  };
}

// ─── Full pipeline ──────────────────────────────────────────────

/**
 * Parse, deduplicate, and group — the full processing pipeline.
 */
export function processKindleFile(text: string, deduplicate = true): ParseResult {
  let clippings = parseClippings(text);
  const originalCount = clippings.length;

  if (deduplicate) {
    clippings = deduplicateClippings(clippings);
  }

  const books = groupByBook(clippings);

  return {
    clippings,
    books,
    originalCount,
    deduplicatedCount: originalCount - clippings.length,
  };
}
