import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();

    const memoriesCount = await db.execute(sql`SELECT COUNT(*)::int as count FROM memories WHERE user_id = ${userId}::uuid`);
    const sourcesBreakdown = await db.execute(sql`
      SELECT source_type as type, COUNT(*)::int as count 
      FROM memories WHERE user_id = ${userId}::uuid 
      GROUP BY source_type ORDER BY count DESC
    `);
    const topSources = await db.execute(sql`
      SELECT source_type as type, source_title as title, source_id as id, COUNT(*)::int as item_count
      FROM memories WHERE user_id = ${userId}::uuid
      GROUP BY source_type, source_title, source_id
      ORDER BY item_count DESC
      LIMIT 10
    `);

    // Recent memories — last 5 added
    const recentMemories = await db.execute(sql`
      SELECT id, content, source_type, source_title, created_at
      FROM memories WHERE user_id = ${userId}::uuid
      ORDER BY created_at DESC
      LIMIT 5
    `);

    // Pinned memories
    const pinnedMemories = await db.execute(sql`
      SELECT id, content, source_type, source_title, created_at
      FROM memories WHERE user_id = ${userId}::uuid AND (metadata->>'pinned')::boolean = true
      ORDER BY created_at DESC
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
      recentMemories: (recentMemories as any[]).map(r => ({
        id: r.id,
        content: r.content?.slice(0, 120) || '',
        sourceType: r.source_type,
        sourceTitle: r.source_title || 'Untitled',
        createdAt: r.created_at,
      })),
      pinnedMemories: (pinnedMemories as any[]).map(r => ({
        id: r.id,
        content: r.content?.slice(0, 120) || '',
        sourceType: r.source_type,
        sourceTitle: r.source_title || 'Untitled',
        createdAt: r.created_at,
      })),
      pinnedCount: (pinnedMemories as any[]).length,
    });
  } catch (error: unknown) {
    console.error('[stats]', error);
    // Return empty stats when DB is unavailable — don't crash the frontend
    return NextResponse.json({
      totalMemories: 0,
      totalSources: 0,
      byType: { chatgpt: 0, text: 0, file: 0, url: 0 },
      topSources: [],
      dbError: true,
    });
  }
}
