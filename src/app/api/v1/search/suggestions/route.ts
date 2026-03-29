import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { getUserId } from '@/server/user';

type SuggestionType = 'source' | 'tag' | 'type' | 'topic';

interface SearchSuggestionRow extends Record<string, unknown> {
  text: string | null;
  type: SuggestionType;
  count?: number | string | null;
}

interface PopularTopicRow extends Record<string, unknown> {
  text: string | null;
  type: string | null;
  count?: number | string | null;
}

interface SearchSuggestion {
  type: SuggestionType;
  text: string;
  count?: number;
  sourceType?: string | null;
}

function normalizeCount(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const numeric = typeof value === 'number' ? value : Number.parseInt(value, 10);
  return Number.isFinite(numeric) ? numeric : undefined;
}

/**
 * GET /api/v1/search/suggestions?q=partial
 * Returns search suggestions based on:
 * 1. User's existing source titles (fuzzy match)
 * 2. User's tags
 * 3. Popular topics from their data (frequent terms in source titles)
 * 4. Source type names
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || '';

    // If no query, return popular topics from user's data
    if (!q) {
      return NextResponse.json({ suggestions: await getPopularTopics(userId) });
    }

    if (q.length < 1) {
      return NextResponse.json({ suggestions: [] });
    }

    // Run multiple suggestion sources in parallel
    const [titleResults, tagResults, sourceTypeResults, topicResults] = await Promise.all([
      // 1. Source title matches
      db.execute(sql`
        SELECT DISTINCT source_title AS text, 'source' AS type,
          COUNT(*)::int AS count
        FROM memories
        WHERE user_id = ${userId}::uuid
          AND source_title IS NOT NULL
          AND source_title ILIKE ${'%' + q + '%'}
        GROUP BY source_title
        ORDER BY count DESC
        LIMIT 5
      `).catch(() => []),

      // 2. Tag name matches
      db.execute(sql`
        SELECT name AS text, 'tag' AS type
        FROM tags
        WHERE user_id = ${userId}::uuid
          AND name ILIKE ${'%' + q + '%'}
        ORDER BY name
        LIMIT 3
      `).catch(() => []),

      // 3. Source type matches
      db.execute(sql`
        SELECT DISTINCT source_type AS text, 'type' AS type,
          COUNT(*)::int AS count
        FROM memories
        WHERE user_id = ${userId}::uuid
          AND source_type ILIKE ${'%' + q + '%'}
        GROUP BY source_type
        ORDER BY count DESC
        LIMIT 3
      `).catch(() => []),

      // 4. Popular topics containing the query (from titles, deduplicated)
      db.execute(sql`
        SELECT source_title AS text, 'topic' AS type,
          COUNT(*)::int AS count
        FROM memories
        WHERE user_id = ${userId}::uuid
          AND source_title IS NOT NULL
          AND LENGTH(source_title) > 3
          AND lower(source_title) LIKE ${('%' + q.toLowerCase() + '%')}
        GROUP BY source_title
        ORDER BY count DESC
        LIMIT 4
      `).catch(() => []),
    ]);

    // Merge and deduplicate
    const seen = new Set<string>();
    const suggestions: SearchSuggestion[] = [];

    const addResult = (row: SearchSuggestionRow) => {
      const key = (row.text || '').toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        suggestions.push({
          type: row.type,
          text: row.text ?? '',
          count: normalizeCount(row.count),
        });
      }
    };

    // Prioritize: source titles > tags > source types > topics
    for (const row of titleResults as SearchSuggestionRow[]) addResult(row);
    for (const row of tagResults as SearchSuggestionRow[]) addResult(row);
    for (const row of sourceTypeResults as SearchSuggestionRow[]) addResult(row);
    for (const row of topicResults as SearchSuggestionRow[]) addResult(row);

    return NextResponse.json({ suggestions: suggestions.slice(0, 8) });
  } catch (error) {
    console.error('[search/suggestions]', error);
    return NextResponse.json({ suggestions: [] });
  }
}

/**
 * Get popular topics from user's data when no query is typed
 */
async function getPopularTopics(userId: string): Promise<SearchSuggestion[]> {
  try {
    const results = (await db.execute(sql`
      SELECT source_title AS text, source_type AS type,
        COUNT(*)::int AS count
      FROM memories
      WHERE user_id = ${userId}::uuid
        AND source_title IS NOT NULL
        AND LENGTH(source_title) > 3
      GROUP BY source_title, source_type
      ORDER BY count DESC
      LIMIT 6
    `)) as PopularTopicRow[];

    return results
      .filter((row): row is PopularTopicRow & { text: string } => typeof row.text === 'string' && row.text.length > 0)
      .map((row) => ({
      type: 'topic',
      text: row.text,
      sourceType: row.type,
      count: normalizeCount(row.count),
    }));
  } catch {
    return [];
  }
}
