/**
 * Readwise Importer — Portable logic module
 *
 * Extracted from the route for convergence with codex runtime.
 * Handles: Readwise API pagination, highlight grouping, dedup key generation.
 */

import { ensurePluginInstalled, getPluginConfig, savePluginConfig } from "./plugin-config";
import { importDocuments } from "@/server/import-service";

const SLUG = "readwise-importer";

// ─── Plugin lifecycle ─────────────────────────────────────────

interface ReadwisePluginConfig {
  readwiseToken?: string;
  lastSync?: string;
  totalImported?: number;
}

const CONFIG_DEFAULTS: ReadwisePluginConfig = {};

export async function ensureInstalled() {
  await ensurePluginInstalled(SLUG);
}

export async function getReadwiseConfig() {
  const config = await getPluginConfig<ReadwisePluginConfig>(SLUG, CONFIG_DEFAULTS);
  return {
    hasToken: !!config.readwiseToken,
    lastSync: config.lastSync || null,
    totalImported: config.totalImported || 0,
    instructions: [
      "Get your Readwise API token from readwise.io/access_token",
      "Paste it below and click Save",
      "Click Import to fetch all your highlights",
      "Supports: Books, Articles, Tweets, Podcasts, Supplementals",
    ],
    categories: ["books", "articles", "tweets", "podcasts", "supplementals"],
  };
}

export async function getReadwiseStats(userId: string) {
  const { db } = await import("@/server/db");
  const { sql } = await import("drizzle-orm");

  let stats = { imported: 0, books: 0, articles: 0, tweets: 0, podcasts: 0 };
  try {
    const rows = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE metadata->>'readwiseCategory' = 'books') as books,
        COUNT(*) FILTER (WHERE metadata->>'readwiseCategory' = 'articles') as articles,
        COUNT(*) FILTER (WHERE metadata->>'readwiseCategory' = 'tweets') as tweets,
        COUNT(*) FILTER (WHERE metadata->>'readwiseCategory' = 'podcasts') as podcasts
      FROM memories WHERE user_id = ${userId} AND source_type = 'readwise'
    `);
    const row = (rows as Record<string, string>[])[0];
    stats.imported = parseInt(row?.total || "0");
    stats.books = parseInt(row?.books || "0");
    stats.articles = parseInt(row?.articles || "0");
    stats.tweets = parseInt(row?.tweets || "0");
    stats.podcasts = parseInt(row?.podcasts || "0");
  } catch {
    /* ignore */
  }
  return stats;
}

export async function saveToken(token: string) {
  const valid = await validateToken(token);
  if (!valid) throw new Error("Invalid Readwise API token");

  const config = await getPluginConfig<ReadwisePluginConfig>(SLUG, CONFIG_DEFAULTS);
  config.readwiseToken = token;
  await savePluginConfig(SLUG, config);
  return { success: true };
}

export async function runImport(
  userId: string,
  opts: { token?: string; categories?: string[] },
) {
  const config = await getPluginConfig<ReadwisePluginConfig>(SLUG, CONFIG_DEFAULTS);
  const token = (opts.token || config.readwiseToken) as string | undefined;
  if (!token) throw new Error("No Readwise API token configured. Add one first.");

  const result = await processImport({
    token,
    categories: opts.categories,
    updatedAfter: config.lastSync,
  });

  if (result.memories.length === 0) {
    return {
      success: true,
      imported: 0,
      message: config.lastSync
        ? "No new highlights since last sync."
        : "No highlights found in your Readwise account.",
    };
  }

  const documents = result.memories.map((m) => ({
    title: m.title,
    content: m.content,
    sourceType: "readwise" as const,
    sourceId: m.dedupKey,
    timestamp: m.createdAt,
    metadata: m.metadata,
  }));

  const importResult = await importDocuments({ userId, documents });

  // Update sync state
  const updatedConfig = await getPluginConfig<ReadwisePluginConfig>(SLUG, CONFIG_DEFAULTS);
  updatedConfig.lastSync = new Date().toISOString();
  updatedConfig.totalImported = (updatedConfig.totalImported || 0) + importResult.chunks;
  await savePluginConfig(SLUG, updatedConfig);

  return {
    success: true,
    imported: importResult.chunks,
    embedded: importResult.embedded,
    totalHighlights: result.memories.length,
    booksProcessed: result.booksProcessed,
    categories: result.categories,
  };
}

// ─── Types ────────────────────────────────────────────────────

export interface ReadwiseBook {
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

export interface ReadwiseHighlight {
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

export interface ReadwiseMemory {
  content: string;
  title: string;
  metadata: Record<string, any>;
  createdAt: Date;
  dedupKey: string;
}

export interface ReadwiseImportResult {
  memories: ReadwiseMemory[];
  booksProcessed: number;
  categories: string[];
}

// ─── Readwise API Client ─────────────────────────────────────

const READWISE_API_BASE = 'https://readwise.io/api/v2';

/**
 * Validate a Readwise API token.
 */
export async function validateToken(token: string): Promise<boolean> {
  const res = await fetch(`${READWISE_API_BASE}/auth/`, {
    headers: { Authorization: `Token ${token}` },
  });
  return res.ok;
}

/**
 * Fetch all books from Readwise with pagination.
 */
export async function fetchBooks(token: string): Promise<ReadwiseBook[]> {
  const allBooks: ReadwiseBook[] = [];
  let nextUrl: string | null = `${READWISE_API_BASE}/books/?page_size=100`;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
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

/**
 * Fetch highlights from Readwise with pagination, optionally filtered by date.
 */
export async function fetchHighlights(
  token: string,
  updatedAfter?: string,
  limit = 10000
): Promise<ReadwiseHighlight[]> {
  const allHighlights: ReadwiseHighlight[] = [];
  let nextUrl: string | null = `${READWISE_API_BASE}/highlights/?page_size=100`;

  if (updatedAfter) {
    nextUrl += `&updated__gt=${updatedAfter}`;
  }

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: { Authorization: `Token ${token}` },
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error('Invalid Readwise API token');
      throw new Error(`Readwise API error: ${response.status}`);
    }

    const data = await response.json();
    allHighlights.push(...data.results);
    nextUrl = data.next as string | null;

    if (allHighlights.length > limit) break;
  }

  return allHighlights;
}

// ─── Content Formatting ──────────────────────────────────────

/**
 * Format a single Readwise highlight into a memory-ready object.
 */
export function formatHighlightMemory(
  highlight: ReadwiseHighlight,
  book: ReadwiseBook
): ReadwiseMemory {
  // Build content
  let content = highlight.text;
  if (highlight.note) {
    content += `\n\n**Note:** ${highlight.note}`;
  }
  content += `\n\n— ${book.title}`;
  if (book.author) content += ` by ${book.author}`;

  // Build title
  const title = `${book.title}: "${highlight.text.slice(0, 60)}${highlight.text.length > 60 ? '...' : ''}"`;

  // Build metadata
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

  return {
    content,
    title,
    metadata,
    createdAt: highlight.highlighted_at ? new Date(highlight.highlighted_at) : new Date(),
    dedupKey: highlight.id.toString(),
  };
}

/**
 * Process a full Readwise import: fetch books + highlights, group by book,
 * optionally filter by category, and return formatted memories.
 */
export async function processImport(opts: {
  token: string;
  categories?: string[];
  updatedAfter?: string;
}): Promise<ReadwiseImportResult> {
  const { token, categories, updatedAfter } = opts;

  const books = await fetchBooks(token);
  const bookMap = new Map(books.map(b => [b.id, b]));
  const highlights = await fetchHighlights(token, updatedAfter);

  if (highlights.length === 0) {
    return { memories: [], booksProcessed: 0, categories: [] };
  }

  // Filter by category if specified
  let filtered = highlights;
  if (categories && categories.length > 0) {
    filtered = highlights.filter(h => {
      const book = bookMap.get(h.book_id);
      return book && categories.includes(book.category);
    });
  }

  // Group by book to track books processed
  const bookIds = new Set<number>();
  const memories: ReadwiseMemory[] = [];

  for (const highlight of filtered) {
    const book = bookMap.get(highlight.book_id);
    if (!book) continue;

    bookIds.add(book.id);
    memories.push(formatHighlightMemory(highlight, book));
  }

  return {
    memories,
    booksProcessed: bookIds.size,
    categories: [...new Set(books.map(b => b.category))],
  };
}
