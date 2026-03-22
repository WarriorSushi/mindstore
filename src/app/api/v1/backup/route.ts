import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

/**
 * POST /api/v1/backup — restore from backup JSON
 */
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || '00000000-0000-0000-0000-000000000000';
    const body = await req.json();
    const { memories } = body;

    if (!memories?.length) {
      return NextResponse.json({ error: 'No memories in backup' }, { status: 400 });
    }

    let imported = 0;
    for (const m of memories) {
      await db.execute(sql`
        INSERT INTO memories (id, user_id, content, source_type, source_id, source_title, metadata, created_at, imported_at)
        VALUES (
          ${m.id || crypto.randomUUID()},
          ${userId},
          ${m.content},
          ${m.source || m.sourceType || 'text'},
          ${m.sourceId || null},
          ${m.sourceTitle || null},
          ${JSON.stringify(m.metadata || {})}::jsonb,
          ${m.timestamp ? new Date(m.timestamp) : new Date()},
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content
      `);
      imported++;
    }

    return NextResponse.json({ imported });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
