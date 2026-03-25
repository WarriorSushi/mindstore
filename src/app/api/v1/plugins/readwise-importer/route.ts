import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

/**
 * Readwise Importer Plugin
 * 
 * Imports highlights from Readwise via their API.
 * Users need a Readwise API token from readwise.io/access_token
 * 
 * POST ?action=import      — Fetch and import all highlights via Readwise API
 * POST ?action=save-token  — Save Readwise API token
 * GET  ?action=config      — Get configuration and token status
 * GET  ?action=stats       — Get imported highlights stats
 */

const PLUGIN_SLUG = 'readwise-importer';
const READWISE_API_BASE = 'https://readwise.io/api/v2';

async function ensurePluginInstalled() {
  try {
    const existing = await db.execute(sql`SELECT id FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
    if ((existing as any[]).length === 0) {
      await db.execute(sql`
        INSERT INTO plugins (slug, name, description, type, status, icon, category)
        VALUES (
          ${PLUGIN_SLUG},
          'Readwise Highlights',
          'Import all your Readwise highlights — books, articles, tweets, podcasts.',
          'extension',
          'active',
          'Highlighter',
          'import'
        )
      `);
    }
  } catch {}
}

async function getPluginConfig(): Promise<Record<string, any>> {
  try {
    const rows = await db.execute(sql`SELECT config FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
    const row = (rows as any[])[0];
    if (!row?.config) return {};
    return typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
  } catch {
    return {};
  }
}

async function savePluginConfig(config: Record<string, any>) {
  await db.execute(sql`
    UPDATE plugins 
    SET config = ${JSON.stringify(config)}::jsonb, updated_at = NOW()
    WHERE slug = ${PLUGIN_SLUG}
  `);
}

// ─── Readwise API Client ────────────────────────────────────

interface ReadwiseBook {
  id: number;
  title: string;
  author: string;
  category: string; // books, articles, tweets, podcasts, supplementals
  source: string;
  cover_image_url?: string;
  num_highlights: number;
  last_highlight_at?: string;
  source_url?: string;
  asin?: string;
}

interface ReadwiseHighlight {
  id: number;
  text: string;
  note?: string;
  location?: number;
  location_type?: string;
  highlighted_at?: string;
  url?: string;
  color?: string;
  book_id: number;
  tags: { id: number; name: string }[];
}

async function fetchReadwiseBooks(token: string): Promise<ReadwiseBook[]> {
  const allBooks: ReadwiseBook[] = [];
  let nextUrl: string | null = `${READWISE_API_BASE}/books/?page_size=100`;

  while (nextUrl) {
    const response: Response = await fetch(nextUrl, {
      headers: { Authorization: `Token ${token}` },
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error('Invalid Readwise API token');
      throw new Error(`Readwise API error: ${response.status}`);
    }

    const data = await response.json();
    allBooks.push(...data.results);
    nextUrl = data.next as string | null;
  }

  return allBooks;
}

async function fetchReadwiseHighlights(token: string, updatedAfter?: string): Promise<ReadwiseHighlight[]> {
  const allHighlights: ReadwiseHighlight[] = [];
  let nextUrl: string | null = `${READWISE_API_BASE}/highlights/?page_size=100`;
  
  if (updatedAfter) {
    nextUrl += `&updated__gt=${updatedAfter}`;
  }

  while (nextUrl) {
    const response: Response = await fetch(nextUrl, {
      headers: { Authorization: `Token ${token}` },
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error('Invalid Readwise API token');
      throw new Error(`Readwise API error: ${response.status}`);
    }

    const data = await response.json();
    allHighlights.push(...data.results);
    nextUrl = data.next as string | null;

    // Safety limit
    if (allHighlights.length > 10000) break;
  }

  return allHighlights;
}

// ─── Route Handlers ──────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    await ensurePluginInstalled();

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'config';

    if (action === 'config') {
      const config = await getPluginConfig();
      const hasToken = !!config.readwiseToken;
      
      return NextResponse.json({
        hasToken,
        lastSync: config.lastSync || null,
        totalImported: config.totalImported || 0,
        instructions: [
          'Get your Readwise API token from readwise.io/access_token',
          'Paste it below and click Save',
          'Click Import to fetch all your highlights',
          'Supports: Books, Articles, Tweets, Podcasts, Supplementals',
        ],
        categories: ['books', 'articles', 'tweets', 'podcasts', 'supplementals'],
      });
    }

    if (action === 'stats') {
      let stats = { imported: 0, books: 0, articles: 0, tweets: 0, podcasts: 0, other: 0 };
      try {
        const rows = await db.execute(sql`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE metadata->>'readwiseCategory' = 'books') as books,
            COUNT(*) FILTER (WHERE metadata->>'readwiseCategory' = 'articles') as articles,
            COUNT(*) FILTER (WHERE metadata->>'readwiseCategory' = 'tweets') as tweets,
            COUNT(*) FILTER (WHERE metadata->>'readwiseCategory' = 'podcasts') as podcasts
          FROM memories 
          WHERE user_id = ${userId} AND source_type = 'readwise'
        `);
        const row = (rows as any[])[0];
        stats.imported = parseInt(row?.total || '0');
        stats.books = parseInt(row?.books || '0');
        stats.articles = parseInt(row?.articles || '0');
        stats.tweets = parseInt(row?.tweets || '0');
        stats.podcasts = parseInt(row?.podcasts || '0');
        stats.other = stats.imported - stats.books - stats.articles - stats.tweets - stats.podcasts;
      } catch {}
      return NextResponse.json(stats);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    await ensurePluginInstalled();

    const body = await req.json();
    const action = body.action;

    if (action === 'save-token') {
      const { token } = body;
      if (!token) {
        return NextResponse.json({ error: 'Token required' }, { status: 400 });
      }

      // Validate token by making a test request
      try {
        const res = await fetch(`${READWISE_API_BASE}/auth/`, {
          headers: { Authorization: `Token ${token}` },
        });
        if (!res.ok) {
          return NextResponse.json({ error: 'Invalid Readwise API token' }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: 'Could not validate token — check your internet connection' }, { status: 400 });
      }

      const config = await getPluginConfig();
      config.readwiseToken = token;
      await savePluginConfig(config);

      return NextResponse.json({ success: true });
    }

    if (action === 'import') {
      const config = await getPluginConfig();
      const token = body.token || config.readwiseToken;

      if (!token) {
        return NextResponse.json({ error: 'No Readwise API token configured. Add one first.' }, { status: 400 });
      }

      const { categories, dedup = true } = body;

      // Fetch books and highlights
      const books = await fetchReadwiseBooks(token);
      const bookMap = new Map(books.map(b => [b.id, b]));

      const highlights = await fetchReadwiseHighlights(token, config.lastSync);

      if (highlights.length === 0) {
        return NextResponse.json({
          success: true,
          imported: 0,
          message: config.lastSync ? 'No new highlights since last sync.' : 'No highlights found in your Readwise account.',
        });
      }

      // Filter by category if specified
      let filteredHighlights = highlights;
      if (categories && categories.length > 0) {
        filteredHighlights = highlights.filter(h => {
          const book = bookMap.get(h.book_id);
          return book && categories.includes(book.category);
        });
      }

      let imported = 0;
      let skipped = 0;

      // Group highlights by book
      const highlightsByBook = new Map<number, ReadwiseHighlight[]>();
      for (const h of filteredHighlights) {
        const existing = highlightsByBook.get(h.book_id) || [];
        existing.push(h);
        highlightsByBook.set(h.book_id, existing);
      }

      for (const [bookId, bookHighlights] of highlightsByBook) {
        const book = bookMap.get(bookId);
        if (!book) continue;

        for (const highlight of bookHighlights) {
          // Dedup check
          if (dedup) {
            try {
              const existing = await db.execute(sql`
                SELECT id FROM memories 
                WHERE user_id = ${userId} 
                AND source_type = 'readwise'
                AND metadata->>'readwiseHighlightId' = ${highlight.id.toString()}
                LIMIT 1
              `);
              if ((existing as any[]).length > 0) {
                skipped++;
                continue;
              }
            } catch {}
          }

          // Build content
          let content = highlight.text;
          if (highlight.note) {
            content += `\n\n**Note:** ${highlight.note}`;
          }
          content += `\n\n— ${book.title}`;
          if (book.author) content += ` by ${book.author}`;

          const title = `${book.title}: "${highlight.text.slice(0, 60)}${highlight.text.length > 60 ? '...' : ''}"`;

          const metadata: Record<string, any> = {
            readwiseHighlightId: highlight.id,
            readwiseBookId: book.id,
            readwiseCategory: book.category,
            bookTitle: book.title,
            bookAuthor: book.author,
            source: 'readwise',
            importedVia: 'readwise-importer-plugin',
          };

          if (highlight.location) metadata.location = highlight.location;
          if (highlight.color) metadata.color = highlight.color;
          if (highlight.tags?.length) metadata.tags = highlight.tags.map(t => t.name);
          if (book.source_url) metadata.sourceUrl = book.source_url;
          if (book.cover_image_url) metadata.coverImage = book.cover_image_url;

          try {
            await db.execute(sql`
              INSERT INTO memories (id, user_id, content, source_type, source_title, metadata, created_at, imported_at)
              VALUES (
                ${uuid()}, ${userId}, ${content}, 'readwise', ${title},
                ${JSON.stringify(metadata)}::jsonb,
                ${highlight.highlighted_at ? new Date(highlight.highlighted_at) : new Date()},
                NOW()
              )
            `);
            imported++;
          } catch {}
        }
      }

      // Update last sync time
      config.lastSync = new Date().toISOString();
      config.totalImported = (config.totalImported || 0) + imported;
      await savePluginConfig(config);

      return NextResponse.json({
        success: true,
        imported,
        skipped,
        totalHighlights: highlights.length,
        booksProcessed: highlightsByBook.size,
        categories: [...new Set(books.map(b => b.category))],
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
