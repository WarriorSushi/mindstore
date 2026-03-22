import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || '00000000-0000-0000-0000-000000000000';

    const memoriesCount = await db.execute(sql`SELECT COUNT(*)::int as count FROM memories WHERE user_id = ${userId}::uuid`);
    const sourcesBreakdown = await db.execute(sql`SELECT source_type, COUNT(*)::int as count FROM memories WHERE user_id = ${userId}::uuid GROUP BY source_type ORDER BY count DESC`);
    const treeNodes = await db.execute(sql`SELECT COUNT(*)::int as count FROM tree_index WHERE user_id = ${userId}::uuid`);
    const profileCount = await db.execute(sql`SELECT COUNT(*)::int as count FROM profile WHERE user_id = ${userId}::uuid`);
    const factsCount = await db.execute(sql`SELECT COUNT(*)::int as count FROM facts WHERE user_id = ${userId}::uuid`);
    const recentActivity = await db.execute(sql`SELECT COUNT(*)::int as count FROM memories WHERE user_id = ${userId}::uuid AND imported_at > NOW() - INTERVAL '7 days'`);

    return NextResponse.json({
      memories: (memoriesCount as any)[0]?.count || 0,
      sources: sourcesBreakdown,
      treeNodes: (treeNodes as any)[0]?.count || 0,
      profileItems: (profileCount as any)[0]?.count || 0,
      facts: (factsCount as any)[0]?.count || 0,
      recentImports: (recentActivity as any)[0]?.count || 0,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
