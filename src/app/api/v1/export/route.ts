import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/v1/export — export all user data
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();

    const memories = await db.execute(sql`
      SELECT id, content, source_type, source_id, source_title, metadata, created_at, imported_at
      FROM memories WHERE user_id = ${userId}::uuid
      ORDER BY created_at
    `);

    return NextResponse.json({
      memories: (memories as any[]).map(r => ({
        id: r.id,
        content: r.content,
        source: r.source_type,
        sourceId: r.source_id,
        sourceTitle: r.source_title,
        timestamp: r.created_at,
        importedAt: r.imported_at,
        metadata: r.metadata || {},
      })),
      exportedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
