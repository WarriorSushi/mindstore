import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { generateEmbeddings, getEmbeddingConfig } from '@/server/embeddings';
import { getUserId } from '@/server/user';
import { buildTreeIndex } from '@/server/retrieval';

/**
 * POST /api/v1/reindex — generate embeddings for memories that don't have them
 * 
 * This is the "I imported first, configured AI later" fix.
 * Processes memories in batches to avoid timeout.
 * Body: { batchSize?: number } (default 50, max 100)
 * Returns: { processed, remaining, provider }
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    const config = await getEmbeddingConfig();
    
    if (!config) {
      return NextResponse.json({ error: 'No embedding provider configured. Add an API key in Settings.' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(body.batchSize || 50, 100);

    // Find memories without embeddings
    const noEmbedding = await db.execute(sql`
      SELECT id, content
      FROM memories
      WHERE user_id = ${userId}::uuid AND embedding IS NULL
      ORDER BY created_at DESC
      LIMIT ${batchSize}
    `);

    const mems = noEmbedding as any[];
    if (mems.length === 0) {
      // All memories have embeddings — rebuild tree index for good measure
      try { await buildTreeIndex(userId); } catch { /* non-fatal */ }
      return NextResponse.json({ processed: 0, remaining: 0, message: 'All memories already have embeddings' });
    }

    // Generate embeddings
    const texts = mems.map(m => m.content);
    const embeddings = await generateEmbeddings(texts);

    if (!embeddings || embeddings.length !== mems.length) {
      return NextResponse.json({ error: 'Embedding generation failed' }, { status: 500 });
    }

    // Update memories with embeddings
    let updated = 0;
    for (let i = 0; i < mems.length; i++) {
      const embStr = `[${embeddings[i].join(',')}]`;
      await db.execute(sql`
        UPDATE memories SET embedding = ${embStr}::vector WHERE id = ${mems[i].id}::uuid
      `);
      updated++;
    }

    // Count remaining
    const countResult = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM memories
      WHERE user_id = ${userId}::uuid AND embedding IS NULL
    `);
    const remaining = (countResult as any)[0]?.count || 0;

    // If done, rebuild tree index
    if (remaining === 0) {
      try { await buildTreeIndex(userId); } catch { /* non-fatal */ }
    }

    return NextResponse.json({
      processed: updated,
      remaining,
      provider: config.provider,
      message: remaining > 0 ? `Processed ${updated} memories. ${remaining} remaining — call again to continue.` : `Done! All ${updated} memories now have embeddings.`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * GET /api/v1/reindex — check embedding status
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    
    const result = await db.execute(sql`
      SELECT 
        COUNT(*)::int as total,
        COUNT(embedding)::int as with_embeddings,
        COUNT(*) - COUNT(embedding) as without_embeddings
      FROM memories
      WHERE user_id = ${userId}::uuid
    `);

    const row = (result as any)[0] || {};
    return NextResponse.json({
      total: row.total || 0,
      withEmbeddings: row.with_embeddings || 0,
      withoutEmbeddings: row.without_embeddings || 0,
      needsReindex: (row.without_embeddings || 0) > 0,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
