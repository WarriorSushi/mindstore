/**
 * Kindle Highlights Importer — Portable logic module
 * 
 * Extracted from the route for convergence with codex runtime.
 * Handles: parsing My Clippings.txt, deduplication, grouping by book, formatting.
 */

// ─── Types ────────────────────────────────────────────────────

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

export interface KindleParseResult {
  books: BookGroup[];
  totalHighlights: number;
  totalBooks: number;
  duplicatesRemoved: number;
}

// ─── Parser ───────────────────────────────────────────────────

export function parseClippings(text: string): KindleClipping[] {
  const clippings: KindleClipping[] = [];
  const entries = text.split('==========').filter(e => e.trim());

  for (const entry of entries) {
    const lines = entry.trim().split('\n').filter(l => l.trim() !== '');
    if (lines.length < 2) continue;

    const titleLine = lines[0]!.trim();
    let bookTitle = titleLine;
    let author = 'Unknown';

    const authorMatch = titleLine.match(/\(([^)]+)\)\s*$/);
    if (authorMatch) {
      author = authorMatch[1]!.trim();
      bookTitle = titleLine.substring(0, titleLine.lastIndexOf('(')).trim();
    }

    bookTitle = bookTitle.replace(/^\uFEFF/, '').trim();

    const metaLine = lines[1]!.trim();
    let type: 'highlight' | 'note' | 'bookmark' = 'highlight';
    if (/your note/i.test(metaLine)) type = 'note';
    else if (/your bookmark/i.test(metaLine)) type = 'bookmark';

    const pageMatch = metaLine.match(/page\s+(\d+[-–]?\d*)/i);
    const locationMatch = metaLine.match(/location\s+(\d+[-–]?\d*)/i);
    const dateMatch = metaLine.match(/Added on\s+(.+)$/i);

    const content = lines.slice(2).join('\n').trim();
    if (type === 'bookmark' || !content) continue;

    clippings.push({
      bookTitle, author, type,
      page: pageMatch?.[1],
      location: locationMatch?.[1],
      date: dateMatch?.[1]?.trim(),
      content,
    });
  }

  return clippings;
}

// ─── Deduplication ────────────────────────────────────────────

export function deduplicateClippings(clippings: KindleClipping[]): { deduplicated: KindleClipping[]; removedCount: number } {
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

  const deduplicated = Array.from(seen.values());
  return { deduplicated, removedCount: clippings.length - deduplicated.length };
}

// ─── Group by Book ────────────────────────────────────────────

export function groupByBook(clippings: KindleClipping[]): BookGroup[] {
  const books = new Map<string, BookGroup>();

  for (const clip of clippings) {
    if (!books.has(clip.bookTitle)) {
      books.set(clip.bookTitle, {
        title: clip.bookTitle,
        author: clip.author,
        highlights: [],
        noteCount: 0,
      });
    }
    const book = books.get(clip.bookTitle)!;
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

  return Array.from(books.values()).sort((a, b) =>
    b.highlights.length - a.highlights.length
  );
}

// ─── Format Book Content ──────────────────────────────────────

export function formatBookContent(book: BookGroup): string {
  const parts: string[] = [];
  parts.push(`# ${book.title}`);
  parts.push(`**Author:** ${book.author}`);
  parts.push(`**Highlights:** ${book.highlights.length}`);
  if (book.noteCount > 0) parts.push(`**Notes:** ${book.noteCount}`);
  parts.push('', '---', '');

  for (const h of book.highlights) {
    const meta: string[] = [];
    if (h.page) meta.push(`p.${h.page}`);
    if (h.location) meta.push(`loc. ${h.location}`);

    if (h.type === 'note') {
      parts.push(`📝 **Note** ${meta.length ? `(${meta.join(', ')})` : ''}`);
    } else {
      parts.push(`💡 ${meta.length ? `(${meta.join(', ')})` : ''}`);
    }
    parts.push(`> ${h.content}`, '');
  }

  return parts.join('\n');
}

// ─── Full Parse Pipeline ──────────────────────────────────────

export function parseKindleFile(text: string): KindleParseResult {
  const raw = parseClippings(text);
  const { deduplicated, removedCount } = deduplicateClippings(raw);
  const books = groupByBook(deduplicated);

  return {
    books,
    totalHighlights: deduplicated.length,
    totalBooks: books.length,
    duplicatesRemoved: removedCount,
  };
}
