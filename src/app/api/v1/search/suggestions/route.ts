import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { getUserId } from '@/server/user';

/**
 * GET /api/v1/search/suggestions?q=partial
 * Returns search suggestions based on:
 * 1. User's existing source titles
 * 2. User's tags
 * 3. Common query patterns
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || '';
    
    if (q.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    // Search in source titles (most useful suggestions)
    const titleSuggestions = await db.execute(sql`
      SELECT DISTINCT source_title as title
      FROM memories
      WHERE user_id = ${userId}::uuid
        AND source_title IS NOT NULL
        AND source_title ILIKE ${'%' + q + '%'}
      ORDER BY source_title
      LIMIT 5
    `);

    // Search in tags
    let tagSuggestions: any[] = [];
    try {
      tagSuggestions = await db.execute(sql`
        SELECT name FROM tags
        WHERE user_id = ${userId}::uuid
          AND name ILIKE ${'%' + q + '%'}
        ORDER BY name
        LIMIT 3
      `) as any[];
    } catch { /* tags table may not exist */ }

    const suggestions = [
      ...(titleSuggestions as any[]).map(r => ({ type: 'source', text: r.title })),
      ...tagSuggestions.map(r => ({ type: 'tag', text: `tag:${r.name}` })),
    ];

    return NextResponse.json({ suggestions: suggestions.slice(0, 8) });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
