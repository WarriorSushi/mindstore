import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/v1/memories?search=&source=&limit=50&offset=0
 * List memories with optional filtering
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || 'default';
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const source = searchParams.get('source') || '';
    const limit = parseInt(searchParams.get('limit') || '200');
    const offset = parseInt(searchParams.get('offset') || '0');

    const conditions = [sql`user_id = ${userId}`];
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
    const userId = req.headers.get('x-user-id') || 'default';
    const apiKey = req.headers.get('x-openai-key') || process.env.OPENAI_API_KEY;
    const body = await req.json();
    const { content, sourceType, sourceId, sourceTitle, metadata } = body;

    if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 });

    // Generate embedding if API key available
    let embStr: string | null = null;
    if (apiKey) {
      try {
        const res = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model: 'text-embedding-3-small', input: content }),
        });
        if (res.ok) {
          const data = await res.json();
          const emb = data.data[0].embedding;
          embStr = `[${emb.join(',')}]`;
        }
      } catch { /* skip */ }
    }

    const id = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO memories (id, user_id, content, embedding, source_type, source_id, source_title, metadata, created_at, imported_at)
      VALUES (${id}, ${userId}, ${content}, ${embStr}::vector, ${sourceType || 'text'}, ${sourceId || null}, ${sourceTitle || null}, ${JSON.stringify(metadata || {})}::jsonb, NOW(), NOW())
    `);

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
    const userId = req.headers.get('x-user-id') || 'default';
    await db.execute(sql`DELETE FROM memories WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM tree_index WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM connections WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM contradictions WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM facts WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM profile WHERE user_id = ${userId}`);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
