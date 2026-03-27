import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { getUserId } from '@/server/user';

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
    const suggestions: Array<{ type: string; text: string; count?: number }> = [];

    const addResult = (r: any) => {
      const key = (r.text || '').toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        suggestions.push({
          type: r.type,
          text: r.text,
          count: r.count ? parseInt(r.count) : undefined,
        });
      }
    };

    // Prioritize: source titles > tags > source types > topics
    for (const r of titleResults as any[]) addResult(r);
    for (const r of tagResults as any[]) addResult({ ...r, text: r.text });
    for (const r of sourceTypeResults as any[]) addResult(r);
    for (const r of topicResults as any[]) addResult(r);

    return NextResponse.json({ suggestions: suggestions.slice(0, 8) });
  } catch (error) {
    console.error('[search/suggestions]', error);
    return NextResponse.json({ suggestions: [] });
  }
}

/**
 * Get popular topics from user's data when no query is typed
 */
async function getPopularTopics(userId: string) {
  try {
    const results = await db.execute(sql`
      SELECT source_title AS text, source_type AS type,
        COUNT(*)::int AS count
      FROM memories
      WHERE user_id = ${userId}::uuid
        AND source_title IS NOT NULL
        AND LENGTH(source_title) > 3
      GROUP BY source_title, source_type
      ORDER BY count DESC
      LIMIT 6
    `);

    return (results as any[]).map(r => ({
      type: 'topic',
      text: r.text,
      sourceType: r.type,
      count: r.count,
    }));
  } catch {
    return [];
  }
}
