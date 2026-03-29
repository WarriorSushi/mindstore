import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { getUserId } from '@/server/user';

type FuzzySuggestionKind = 'title' | 'tag' | 'word';

interface SimilaritySuggestionRow extends Record<string, unknown> {
  term: string | null;
  sim: number | string | null;
  kind: Exclude<FuzzySuggestionKind, 'word'>;
}

interface DistanceSuggestionRow extends Record<string, unknown> {
  term: string | null;
  dist: number | string | null;
  kind: 'word';
}

interface RankedSuggestion {
  term: string;
  kind: FuzzySuggestionKind;
  score: number;
}

function toSuggestionScore(value: number | string | null | undefined, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number.parseFloat(value ?? '');
  return Number.isFinite(numeric) ? numeric : fallback;
}

/**
 * GET /api/v1/search/fuzzy?q=query
 * Returns "did you mean?" suggestions using trigram similarity
 * and Levenshtein distance from existing memory content.
 *
 * Queries distinct source titles and extracts frequent terms
 * from user's knowledge base, then finds closest matches to query.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || '';

    if (q.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    // Ensure pg_trgm extension is available (safe to call multiple times)
    try {
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    } catch {
      // Extension might already exist or we lack permissions — that's fine
    }

    // Strategy 1: Trigram similarity on source titles
    let titleSuggestions: SimilaritySuggestionRow[] = [];
    try {
      titleSuggestions = (await db.execute(sql`
        SELECT DISTINCT source_title AS term,
          similarity(source_title, ${q}) AS sim,
          'title' AS kind
        FROM memories
        WHERE user_id = ${userId}::uuid
          AND source_title IS NOT NULL
          AND LENGTH(source_title) > 2
          AND similarity(source_title, ${q}) > 0.15
        ORDER BY sim DESC
        LIMIT 5
      `)) as SimilaritySuggestionRow[];
    } catch {
      // pg_trgm may not be available — fallback to ILIKE
      titleSuggestions = (await db.execute(sql`
        SELECT DISTINCT source_title AS term, 0.3 AS sim, 'title' AS kind
        FROM memories
        WHERE user_id = ${userId}::uuid
          AND source_title IS NOT NULL
          AND source_title ILIKE ${'%' + q.slice(0, Math.max(3, q.length - 1)) + '%'}
        LIMIT 5
      `)) as SimilaritySuggestionRow[];
    }

    // Strategy 2: Trigram similarity on tag names
    let tagSuggestions: SimilaritySuggestionRow[] = [];
    try {
      tagSuggestions = (await db.execute(sql`
        SELECT name AS term,
          similarity(name, ${q}) AS sim,
          'tag' AS kind
        FROM tags
        WHERE user_id = ${userId}::uuid
          AND similarity(name, ${q}) > 0.15
        ORDER BY sim DESC
        LIMIT 3
      `)) as SimilaritySuggestionRow[];
    } catch {
      // tags table or pg_trgm not available
    }

    // Strategy 3: Extract frequent words from content and find close matches
    // We sample words from recent memories and compute Levenshtein distance
    let wordSuggestions: DistanceSuggestionRow[] = [];
    try {
      wordSuggestions = (await db.execute(sql`
        WITH words AS (
          SELECT DISTINCT unnest(
            string_to_array(
              regexp_replace(lower(source_title || ' ' || left(content, 500)), '[^a-z0-9 ]', ' ', 'g'),
              ' '
            )
          ) AS word
          FROM memories
          WHERE user_id = ${userId}::uuid
          LIMIT 500
        ),
        candidates AS (
          SELECT DISTINCT word
          FROM words
          WHERE length(word) > 3
            AND word != lower(${q})
            AND levenshtein(word, lower(${q})) <= GREATEST(2, length(${q}) / 3)
        )
        SELECT word AS term,
          levenshtein(word, lower(${q})) AS dist,
          'word' AS kind
        FROM candidates
        ORDER BY dist ASC, length(word) ASC
        LIMIT 5
      `)) as DistanceSuggestionRow[];
    } catch {
      // levenshtein requires fuzzystrmatch extension
      try {
        await db.execute(sql`CREATE EXTENSION IF NOT EXISTS fuzzystrmatch`);
        // Retry once after creating extension
        wordSuggestions = (await db.execute(sql`
          WITH words AS (
            SELECT DISTINCT unnest(
              string_to_array(
                regexp_replace(lower(source_title || ' ' || left(content, 500)), '[^a-z0-9 ]', ' ', 'g'),
                ' '
              )
            ) AS word
            FROM memories
            WHERE user_id = ${userId}::uuid
            LIMIT 500
          ),
          candidates AS (
            SELECT DISTINCT word
            FROM words
            WHERE length(word) > 3
              AND word != lower(${q})
              AND levenshtein(word, lower(${q})) <= GREATEST(2, length(${q}) / 3)
          )
          SELECT word AS term,
            levenshtein(word, lower(${q})) AS dist,
            'word' AS kind
          FROM candidates
          ORDER BY dist ASC, length(word) ASC
          LIMIT 5
        `)) as DistanceSuggestionRow[];
      } catch {
        // Give up on word suggestions
      }
    }

    // Merge and deduplicate
    const seen = new Set<string>();
    const suggestions: RankedSuggestion[] = [];

    const all: RankedSuggestion[] = [
      ...titleSuggestions
        .filter((row): row is SimilaritySuggestionRow & { term: string } => typeof row.term === 'string' && row.term.length > 0)
        .map((row) => ({ term: row.term, kind: row.kind, score: toSuggestionScore(row.sim, 0.3) })),
      ...tagSuggestions
        .filter((row): row is SimilaritySuggestionRow & { term: string } => typeof row.term === 'string' && row.term.length > 0)
        .map((row) => ({ term: row.term, kind: row.kind, score: toSuggestionScore(row.sim, 0.3) })),
      ...wordSuggestions
        .filter((row): row is DistanceSuggestionRow & { term: string } => typeof row.term === 'string' && row.term.length > 0)
        .map((row) => ({
          term: row.term,
          kind: row.kind,
          score: 1 / (1 + toSuggestionScore(row.dist, 1)),
        })),
    ];

    all.sort((a, b) => b.score - a.score);

    for (const item of all) {
      const key = item.term.toLowerCase();
      if (!seen.has(key) && key !== q.toLowerCase()) {
        seen.add(key);
        suggestions.push(item);
      }
    }

    return NextResponse.json({ suggestions: suggestions.slice(0, 6) });
  } catch (error) {
    console.error('[search/fuzzy]', error);
    return NextResponse.json({ suggestions: [] });
  }
}
