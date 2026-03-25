import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/v1/memories/related?id=<memoryId>&limit=6
 * 
 * Finds semantically related memories using vector cosine similarity.
 * Falls back to source-based + recency if no embedding exists.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const memoryId = searchParams.get('id');
    const limit = Math.min(parseInt(searchParams.get('limit') || '6'), 20);
    const userId = await getUserId();

    if (!memoryId) {
      return NextResponse.json({ error: 'Missing memory id' }, { status: 400 });
    }

    // Get the source memory's embedding and metadata
    const [sourceMemory] = await db.execute(sql`
      SELECT id, embedding, source_type, source_title, content, created_at,
             vector_dims(embedding) as emb_dims
      FROM memories
      WHERE id = ${memoryId}::uuid AND user_id = ${userId}::uuid
      LIMIT 1
    `) as any[];

    if (!sourceMemory) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
    }

    let related: any[] = [];

    // Strategy 1: Vector similarity (if embedding exists)
    if (sourceMemory.embedding && sourceMemory.emb_dims) {
      const results = await db.execute(sql`
        SELECT 
          m.id,
          m.content,
          m.source_type as "sourceType",
          m.source_title as "sourceTitle",
          m.source_id as "sourceId",
          m.created_at as "timestamp",
          m.metadata,
          1 - (m.embedding <=> (SELECT embedding FROM memories WHERE id = ${memoryId}::uuid)) as similarity
        FROM memories m
        WHERE m.user_id = ${userId}::uuid
          AND m.id != ${memoryId}::uuid
          AND m.embedding IS NOT NULL
          AND vector_dims(m.embedding) = ${sourceMemory.emb_dims}
        ORDER BY m.embedding <=> (SELECT embedding FROM memories WHERE id = ${memoryId}::uuid)
        LIMIT ${limit}
      `);

      related = (results as any[])
        .filter(r => r.similarity > 0.3) // threshold for relevance
        .map(r => ({
          id: r.id,
          content: r.content,
          source: r.sourceType,
          sourceType: r.sourceType,
          sourceId: r.sourceId,
          sourceTitle: r.sourceTitle,
          timestamp: r.timestamp,
          metadata: r.metadata || {},
          similarity: Math.round(r.similarity * 100),
          method: 'vector',
        }));
    }

    // Strategy 2: Fallback — same source + recent (if vector didn't return enough)
    if (related.length < limit) {
      const existingIds = related.map(r => r.id);
      const excludeClause = existingIds.length > 0
        ? sql`AND m.id != ALL(${existingIds}::uuid[])`
        : sql``;

      const fallbackResults = await db.execute(sql`
        SELECT 
          m.id,
          m.content,
          m.source_type as "sourceType",
          m.source_title as "sourceTitle",
          m.source_id as "sourceId",
          m.created_at as "timestamp",
          m.metadata
        FROM memories m
        WHERE m.user_id = ${userId}::uuid
          AND m.id != ${memoryId}::uuid
          ${excludeClause}
          AND (
            m.source_type = ${sourceMemory.source_type}
            OR m.source_title = ${sourceMemory.source_title}
          )
        ORDER BY 
          CASE WHEN m.source_title = ${sourceMemory.source_title} THEN 0 ELSE 1 END,
          ABS(EXTRACT(EPOCH FROM (m.created_at - ${sourceMemory.created_at}::timestamptz)))
        LIMIT ${limit - related.length}
      `);

      const fallback = (fallbackResults as any[]).map(r => ({
        id: r.id,
        content: r.content,
        source: r.sourceType,
        sourceType: r.sourceType,
        sourceId: r.sourceId,
        sourceTitle: r.sourceTitle,
        timestamp: r.timestamp,
        metadata: r.metadata || {},
        similarity: null,
        method: 'source',
      }));

      related = [...related, ...fallback];
    }

    return NextResponse.json({
      memoryId,
      related: related.slice(0, limit),
      method: related[0]?.method || 'none',
      total: related.length,
    });
  } catch (error: unknown) {
    console.error('[related memories]', error);
    return NextResponse.json({ memoryId: null, related: [], method: 'error', total: 0 });
  }
}
