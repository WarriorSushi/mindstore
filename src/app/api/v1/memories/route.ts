import { getUserId } from '@/server/user';
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
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const source = searchParams.get('source') || '';
    const limit = parseInt(searchParams.get('limit') || '200');
    const offset = parseInt(searchParams.get('offset') || '0');

    const sort = searchParams.get('sort') || 'newest';
    const pinnedOnly = searchParams.get('pinned') === 'true';

    const conditions = [sql`user_id = ${userId}::uuid`];
    if (source) conditions.push(sql`source_type = ${source}`);
    if (search) {
      conditions.push(sql`(content ILIKE ${'%' + search + '%'} OR source_title ILIKE ${'%' + search + '%'})`);
    }
    if (pinnedOnly) {
      conditions.push(sql`(metadata->>'pinned')::boolean = true`);
    }

    const where = sql.join(conditions, sql` AND `);

    // Dynamic sort order — pinned items always float to top (unless filtering pinned-only)
    const pp = pinnedOnly ? '' : 'COALESCE((metadata->>\'pinned\')::boolean, false) DESC,';
    const orderClause =
      sort === 'oldest' ? sql.raw(`ORDER BY ${pp} created_at ASC`) :
      sort === 'alpha-asc' ? sql.raw(`ORDER BY ${pp} LOWER(COALESCE(source_title, '')) ASC, created_at DESC`) :
      sort === 'alpha-desc' ? sql.raw(`ORDER BY ${pp} LOWER(COALESCE(source_title, '')) DESC, created_at DESC`) :
      sort === 'longest' ? sql.raw(`ORDER BY ${pp} LENGTH(content) DESC, created_at DESC`) :
      sort === 'shortest' ? sql.raw(`ORDER BY ${pp} LENGTH(content) ASC, created_at DESC`) :
      sql.raw(`ORDER BY ${pp} created_at DESC`);

    const results = await db.execute(sql`
      SELECT id, content, source_type, source_id, source_title, metadata, created_at, imported_at
      FROM memories
      WHERE ${where}
      ${orderClause}
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM memories WHERE ${where}`);
    const total = (countResult as any)[0]?.count || 0;

    return NextResponse.json({
      memories: (results as any[]).map(r => {
        const meta = r.metadata || {};
        return {
          id: r.id,
          content: r.content,
          source: r.source_type,
          sourceId: r.source_id,
          sourceTitle: r.source_title || '',
          timestamp: r.created_at,
          importedAt: r.imported_at,
          metadata: meta,
          pinned: meta.pinned === true,
        };
      }),
      total,
    });
  } catch (error: unknown) {
    console.error('[memories GET]', error);
    return NextResponse.json({ memories: [], total: 0, dbError: true });
  }
}

/**
 * POST /api/v1/memories — create a single memory
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
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
 * PATCH /api/v1/memories — update a memory's content (and optionally title)
 * Body: { id: string, content?: string, title?: string }
 * Re-generates embedding when content changes.
 */
export async function PATCH(req: NextRequest) {
  try {
    const userId = await getUserId();
    const body = await req.json();
    const { id, content, title, pinned } = body;

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    if (!content && title === undefined && pinned === undefined) return NextResponse.json({ error: 'content, title, or pinned required' }, { status: 400 });

    // Verify ownership
    const existing = await db.execute(
      sql`SELECT id, metadata FROM memories WHERE id = ${id}::uuid AND user_id = ${userId}::uuid`
    );
    if ((existing as any[]).length === 0) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
    }

    // Handle pin/unpin via metadata JSONB (no schema migration needed)
    if (pinned !== undefined && !content && title === undefined) {
      // Pin-only update: merge pinned flag into existing metadata
      const existingMeta = (existing as any[])[0]?.metadata || {};
      const updatedMeta = { ...existingMeta, pinned: !!pinned };
      if (!pinned) delete updatedMeta.pinned; // Remove flag when unpinning to keep metadata clean
      const metaStr = JSON.stringify(updatedMeta);
      await db.execute(sql`
        UPDATE memories SET metadata = ${metaStr}::jsonb
        WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
      `);
      return NextResponse.json({ ok: true, pinned: !!pinned });
    }

    // Update content (with re-embedding) and/or title
    if (content) {
      // Re-generate embedding for updated content
      let embStr: string | null = null;
      try {
        const embeddings = await generateEmbeddings([content]);
        if (embeddings && embeddings.length > 0) {
          embStr = `[${embeddings[0].join(',')}]`;
        }
      } catch { /* skip embedding — still update content */ }

      if (embStr && title !== undefined) {
        await db.execute(sql`
          UPDATE memories SET content = ${content}, embedding = ${embStr}::vector, source_title = ${title}
          WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
        `);
      } else if (embStr) {
        await db.execute(sql`
          UPDATE memories SET content = ${content}, embedding = ${embStr}::vector
          WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
        `);
      } else if (title !== undefined) {
        await db.execute(sql`
          UPDATE memories SET content = ${content}, source_title = ${title}
          WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
        `);
      } else {
        await db.execute(sql`
          UPDATE memories SET content = ${content}
          WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
        `);
      }
    } else if (title !== undefined) {
      await db.execute(sql`
        UPDATE memories SET source_title = ${title}
        WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
      `);
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[memories PATCH]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/memories — delete memories
 * ?id=UUID — delete single memory
 * ?source_id=xxx — delete by source_id (e.g. demo data)
 * no params — clear all memories for user
 */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const singleId = searchParams.get('id');
    const sourceId = searchParams.get('source_id');

    if (singleId) {
      // Delete a single memory by ID
      await db.execute(sql`DELETE FROM memories WHERE id = ${singleId}::uuid AND user_id = ${userId}::uuid`);
      return NextResponse.json({ ok: true });
    }

    if (sourceId) {
      // Delete by source_id (e.g. demo data cleanup)
      await db.execute(sql`DELETE FROM memories WHERE source_id = ${sourceId} AND user_id = ${userId}::uuid`);
      return NextResponse.json({ ok: true });
    }

    // Full wipe
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
