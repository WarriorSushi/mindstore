import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { generateEmbeddings } from '@/server/embeddings';
import { sql } from 'drizzle-orm';

/**
 * GET /api/v1/memories?search=&source=&limit=50&offset=0
 * List memories with optional filtering
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || '00000000-0000-0000-0000-000000000000';
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const source = searchParams.get('source') || '';
    const limit = parseInt(searchParams.get('limit') || '200');
    const offset = parseInt(searchParams.get('offset') || '0');

    const conditions = [sql`user_id = ${userId}::uuid`];
    if (source) conditions.push(sql`source_type = ${source}`);
    if (search) {
      conditions.push(sql`(content ILIKE ${'%' + search + '%'} OR source_title ILIKE ${'%' + search + '%'})`);
    }

    const where = sql.join(conditions, sql` AND `);

    const results = await db.execute(sql`
      SELECT id, content, source_type, source_id, source_title, metadata, created_at, imported_at
      FROM memories
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM memories WHERE ${where}`);
    const total = (countResult as any)[0]?.count || 0;

    return NextResponse.json({
      memories: (results as any[]).map(r => ({
        id: r.id,
        content: r.content,
        source: r.source_type,
        sourceId: r.source_id,
        sourceTitle: r.source_title || '',
        timestamp: r.created_at,
        importedAt: r.imported_at,
        metadata: r.metadata || {},
      })),
      total,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/v1/memories — create a single memory
 */
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || '00000000-0000-0000-0000-000000000000';
    const body = await req.json();
    const { content, sourceType, sourceId, sourceTitle, metadata } = body;

    if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 });

    // Generate embedding using available provider
    let embStr: string | null = null;
    try {
      const embeddings = await generateEmbeddings([content]);
      if (embeddings && embeddings.length > 0) {
        embStr = `[${embeddings[0].join(',')}]`;
      }
    } catch { /* skip */ }

    const id = crypto.randomUUID();
    const meta = JSON.stringify(metadata || {});

    if (embStr) {
      await db.execute(sql`
        INSERT INTO memories (id, user_id, content, embedding, source_type, source_id, source_title, metadata, created_at, imported_at)
        VALUES (${id}, ${userId}::uuid, ${content}, ${embStr}::vector, ${sourceType || 'text'}, ${sourceId || null}, ${sourceTitle || null}, ${meta}::jsonb, NOW(), NOW())
      `);
    } else {
      await db.execute(sql`
        INSERT INTO memories (id, user_id, content, source_type, source_id, source_title, metadata, created_at, imported_at)
        VALUES (${id}, ${userId}::uuid, ${content}, ${sourceType || 'text'}, ${sourceId || null}, ${sourceTitle || null}, ${meta}::jsonb, NOW(), NOW())
      `);
    }

    return NextResponse.json({ id });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/memories — clear all memories for user
 */
export async function DELETE(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || '00000000-0000-0000-0000-000000000000';
    await db.execute(sql`DELETE FROM memories WHERE user_id = ${userId}::uuid`);
    await db.execute(sql`DELETE FROM tree_index WHERE user_id = ${userId}::uuid`);
    await db.execute(sql`DELETE FROM connections WHERE user_id = ${userId}::uuid`);
    await db.execute(sql`DELETE FROM contradictions WHERE user_id = ${userId}::uuid`);
    await db.execute(sql`DELETE FROM facts WHERE user_id = ${userId}::uuid`);
    await db.execute(sql`DELETE FROM profile WHERE user_id = ${userId}::uuid`);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
