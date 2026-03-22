import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || 'default';

    const memoriesCount = await db.execute(sql`SELECT COUNT(*)::int as count FROM memories WHERE user_id = ${userId}`);
    const sourcesBreakdown = await db.execute(sql`
      SELECT source_type as type, COUNT(*)::int as count 
      FROM memories WHERE user_id = ${userId} 
      GROUP BY source_type ORDER BY count DESC
    `);
    const topSources = await db.execute(sql`
      SELECT source_type as type, source_title as title, source_id as id, COUNT(*)::int as item_count
      FROM memories WHERE user_id = ${userId}
      GROUP BY source_type, source_title, source_id
      ORDER BY item_count DESC
      LIMIT 10
    `);

    const totalMemories = (memoriesCount as any)[0]?.count || 0;
    const byType: Record<string, number> = { chatgpt: 0, text: 0, file: 0, url: 0 };
    for (const row of sourcesBreakdown as any[]) {
      byType[row.type] = row.count;
    }

    const totalSources = (topSources as any[]).length;

    return NextResponse.json({
      totalMemories,
      totalSources,
      byType,
      topSources: (topSources as any[]).map(r => ({
        id: r.id || r.title,
        type: r.type,
        title: r.title || 'Untitled',
        itemCount: r.item_count,
      })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
