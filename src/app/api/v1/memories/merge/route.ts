import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { getUserId } from '@/server/user';
import { generateEmbeddings } from '@/server/embeddings';

/**
 * POST /api/v1/memories/merge — merge two memories into one
 * 
 * Combines content of two memories, keeps the first one's metadata,
 * re-embeds the merged content, and deletes the second memory.
 * 
 * Body: { primaryId: string, secondaryId: string, separator?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    const body = await req.json();
    const { primaryId, secondaryId, separator = '\n\n---\n\n' } = body;

    if (!primaryId || !secondaryId) {
      return NextResponse.json({ error: 'primaryId and secondaryId required' }, { status: 400 });
    }

    if (primaryId === secondaryId) {
      return NextResponse.json({ error: 'Cannot merge a memory with itself' }, { status: 400 });
    }

    // Fetch both memories
    const [primaryRes, secondaryRes] = await Promise.all([
      db.execute(sql`
        SELECT id, content, source_type, source_title, metadata, created_at
        FROM memories WHERE id = ${primaryId}::uuid AND user_id = ${userId}::uuid
      `),
      db.execute(sql`
        SELECT id, content, source_type, source_title, metadata, created_at
        FROM memories WHERE id = ${secondaryId}::uuid AND user_id = ${userId}::uuid
      `),
    ]);

    const primary = (primaryRes as any[])[0];
    const secondary = (secondaryRes as any[])[0];

    if (!primary) return NextResponse.json({ error: 'Primary memory not found' }, { status: 404 });
    if (!secondary) return NextResponse.json({ error: 'Secondary memory not found' }, { status: 404 });

    // Merge content
    const mergedContent = `${primary.content}${separator}${secondary.content}`;

    // Merge metadata
    const primaryMeta = primary.metadata || {};
    const secondaryMeta = secondary.metadata || {};
    const mergedMeta = {
      ...primaryMeta,
      merged: true,
      mergedFrom: secondaryId,
      mergedAt: new Date().toISOString(),
      originalSources: [
        { id: primaryId, title: primary.source_title, type: primary.source_type },
        { id: secondaryId, title: secondary.source_title, type: secondary.source_type },
      ],
    };

    // Re-embed the merged content
    let embStr: string | null = null;
    try {
      const embeddings = await generateEmbeddings([mergedContent]);
      if (embeddings && embeddings.length > 0) {
        embStr = `[${embeddings[0].join(',')}]`;
      }
    } catch { /* non-fatal */ }

    // Update primary memory
    const metaStr = JSON.stringify(mergedMeta);
    if (embStr) {
      await db.execute(sql`
        UPDATE memories 
        SET content = ${mergedContent}, embedding = ${embStr}::vector, metadata = ${metaStr}::jsonb
        WHERE id = ${primaryId}::uuid AND user_id = ${userId}::uuid
      `);
    } else {
      await db.execute(sql`
        UPDATE memories 
        SET content = ${mergedContent}, metadata = ${metaStr}::jsonb
        WHERE id = ${primaryId}::uuid AND user_id = ${userId}::uuid
      `);
    }

    // Delete secondary memory
    await db.execute(sql`
      DELETE FROM memories WHERE id = ${secondaryId}::uuid AND user_id = ${userId}::uuid
    `);

    // Move tags from secondary to primary
    try {
      await db.execute(sql`
        INSERT INTO memory_tags (memory_id, tag_id)
        SELECT ${primaryId}::uuid, tag_id FROM memory_tags WHERE memory_id = ${secondaryId}::uuid
        ON CONFLICT DO NOTHING
      `);
      await db.execute(sql`
        DELETE FROM memory_tags WHERE memory_id = ${secondaryId}::uuid
      `);
    } catch { /* tags tables may not exist */ }

    return NextResponse.json({
      ok: true,
      mergedId: primaryId,
      deletedId: secondaryId,
      contentLength: mergedContent.length,
      reembedded: !!embStr,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
