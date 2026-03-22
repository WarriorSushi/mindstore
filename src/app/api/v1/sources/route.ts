import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/v1/sources — list sources (grouped from memories)
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || 'default';

    const results = await db.execute(sql`
      SELECT 
        source_type as type,
        source_title as title,
        source_id as id,
        COUNT(*)::int as item_count,
        MAX(imported_at) as imported_at
      FROM memories
      WHERE user_id = ${userId}
      GROUP BY source_type, source_title, source_id
      ORDER BY item_count DESC
    `);

    const sources = (results as any[]).map(r => ({
      id: r.id || r.title,
      type: r.type,
      title: r.title || 'Untitled',
      itemCount: r.item_count,
      importedAt: r.imported_at,
      metadata: {},
    }));

    return NextResponse.json({ sources });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
