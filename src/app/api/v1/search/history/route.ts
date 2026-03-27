import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { getUserId } from '@/server/user';

/**
 * GET /api/v1/search/history — recent searches
 * POST /api/v1/search/history — save a search query
 * DELETE /api/v1/search/history — clear search history
 * 
 * Auto-creates the search_history table if it doesn't exist.
 */

async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS search_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      query TEXT NOT NULL,
      result_count INT DEFAULT 0,
      searched_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Index for fast lookup
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_search_history_user 
    ON search_history (user_id, searched_at DESC)
  `).catch(() => {});
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    await ensureTable();

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const results = await db.execute(sql`
      SELECT query, result_count, searched_at,
        COUNT(*) OVER (PARTITION BY query) as times_searched
      FROM search_history
      WHERE user_id = ${userId}::uuid
      ORDER BY searched_at DESC
      LIMIT ${limit}
    `);

    // Deduplicate — show most recent of each unique query
    const seen = new Set<string>();
    const unique = (results as any[]).filter(r => {
      const q = r.query.toLowerCase();
      if (seen.has(q)) return false;
      seen.add(q);
      return true;
    });

    return NextResponse.json({ 
      searches: unique.map(r => ({
        query: r.query,
        resultCount: r.result_count,
        searchedAt: r.searched_at,
        timesSearched: parseInt(r.times_searched),
      })),
    });
  } catch (error: unknown) {
    return NextResponse.json({ searches: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    const body = await req.json();
    const { query, resultCount } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ error: 'query required' }, { status: 400 });
    }

    await ensureTable();

    await db.execute(sql`
      INSERT INTO search_history (user_id, query, result_count)
      VALUES (${userId}::uuid, ${query.trim()}, ${resultCount || 0})
    `);

    // Keep only last 200 searches per user
    await db.execute(sql`
      DELETE FROM search_history
      WHERE user_id = ${userId}::uuid
        AND id NOT IN (
          SELECT id FROM search_history
          WHERE user_id = ${userId}::uuid
          ORDER BY searched_at DESC
          LIMIT 200
        )
    `);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserId();
    await ensureTable();
    await db.execute(sql`DELETE FROM search_history WHERE user_id = ${userId}::uuid`);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false });
  }
}
