import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

const TAG_COLORS = ['teal', 'sky', 'emerald', 'amber', 'red', 'blue', 'orange', 'zinc'] as const;

/**
 * Ensure tags tables exist (auto-migrate)
 */
async function ensureTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      color TEXT DEFAULT 'teal',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_user_name ON tags(user_id, name)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS memory_tags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
      tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_tags_unique ON memory_tags(memory_id, tag_id)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_memory_tags_memory ON memory_tags(memory_id)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_memory_tags_tag ON memory_tags(tag_id)
  `);
}

/**
 * GET /api/v1/tags — list all tags with memory counts
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    await ensureTables();

    const { searchParams } = new URL(req.url);
    const memoryId = searchParams.get('memoryId');

    if (memoryId) {
      // Get tags for a specific memory
      const result = await db.execute(sql`
        SELECT t.id, t.name, t.color, t.created_at
        FROM tags t
        JOIN memory_tags mt ON mt.tag_id = t.id
        WHERE mt.memory_id = ${memoryId}::uuid AND t.user_id = ${userId}::uuid
        ORDER BY t.name ASC
      `);
      return NextResponse.json({ tags: result as any[] });
    }

    // List all tags with counts
    const result = await db.execute(sql`
      SELECT t.id, t.name, t.color, t.created_at,
             COUNT(mt.id)::int AS memory_count
      FROM tags t
      LEFT JOIN memory_tags mt ON mt.tag_id = t.id
      WHERE t.user_id = ${userId}::uuid
      GROUP BY t.id, t.name, t.color, t.created_at
      ORDER BY t.name ASC
    `);

    return NextResponse.json({ tags: result as any[] });
  } catch (err: any) {
    console.error('[tags] GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/v1/tags
 * Body: { name, color? } — create new tag
 * Body: { action: "assign", tagId, memoryIds } — assign tag to memories
 * Body: { action: "unassign", tagId, memoryIds } — remove tag from memories
 * Body: { action: "rename", tagId, name } — rename a tag
 * Body: { action: "recolor", tagId, color } — change tag color
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    await ensureTables();
    const body = await req.json();

    // ── Assign tag to memories ──
    if (body.action === 'assign') {
      const { tagId, memoryIds } = body;
      if (!tagId || !memoryIds?.length) {
        return NextResponse.json({ error: 'tagId and memoryIds required' }, { status: 400 });
      }

      // Verify tag belongs to user
      const tagCheck = await db.execute(sql`
        SELECT id FROM tags WHERE id = ${tagId}::uuid AND user_id = ${userId}::uuid
      `) as any[];
      if (tagCheck.length === 0) {
        return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
      }

      let assigned = 0;
      for (const memoryId of memoryIds) {
        try {
          await db.execute(sql`
            INSERT INTO memory_tags (memory_id, tag_id)
            VALUES (${memoryId}::uuid, ${tagId}::uuid)
            ON CONFLICT (memory_id, tag_id) DO NOTHING
          `);
          assigned++;
        } catch { /* skip invalid memory IDs */ }
      }

      return NextResponse.json({ ok: true, assigned });
    }

    // ── Unassign tag from memories ──
    if (body.action === 'unassign') {
      const { tagId, memoryIds } = body;
      if (!tagId || !memoryIds?.length) {
        return NextResponse.json({ error: 'tagId and memoryIds required' }, { status: 400 });
      }

      await db.execute(sql`
        DELETE FROM memory_tags
        WHERE tag_id = ${tagId}::uuid
        AND memory_id = ANY(${memoryIds}::uuid[])
      `);

      return NextResponse.json({ ok: true });
    }

    // ── Rename tag ──
    if (body.action === 'rename') {
      const { tagId, name } = body;
      if (!tagId || !name?.trim()) {
        return NextResponse.json({ error: 'tagId and name required' }, { status: 400 });
      }

      const existing = await db.execute(sql`
        SELECT id FROM tags WHERE user_id = ${userId}::uuid AND LOWER(name) = LOWER(${name.trim()}) AND id != ${tagId}::uuid
      `) as any[];
      if (existing.length > 0) {
        return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 409 });
      }

      await db.execute(sql`
        UPDATE tags SET name = ${name.trim()} WHERE id = ${tagId}::uuid AND user_id = ${userId}::uuid
      `);

      return NextResponse.json({ ok: true });
    }

    // ── Recolor tag ──
    if (body.action === 'recolor') {
      const { tagId, color } = body;
      if (!tagId || !color) {
        return NextResponse.json({ error: 'tagId and color required' }, { status: 400 });
      }
      if (!TAG_COLORS.includes(color)) {
        return NextResponse.json({ error: `Invalid color. Must be one of: ${TAG_COLORS.join(', ')}` }, { status: 400 });
      }

      await db.execute(sql`
        UPDATE tags SET color = ${color} WHERE id = ${tagId}::uuid AND user_id = ${userId}::uuid
      `);

      return NextResponse.json({ ok: true });
    }

    // ── Create new tag ──
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: 'Tag name required' }, { status: 400 });
    }
    if (name.length > 50) {
      return NextResponse.json({ error: 'Tag name too long (max 50 chars)' }, { status: 400 });
    }

    const color = TAG_COLORS.includes(body.color) ? body.color : 'teal';

    // Check for duplicate (return existing tag if found)
    const existing = await db.execute(sql`
      SELECT id, name, color FROM tags
      WHERE user_id = ${userId}::uuid AND LOWER(name) = LOWER(${name})
    `) as any[];
    if (existing.length > 0) {
      return NextResponse.json({ tag: existing[0], existed: true });
    }

    const result = await db.execute(sql`
      INSERT INTO tags (user_id, name, color)
      VALUES (${userId}::uuid, ${name}, ${color})
      RETURNING id, name, color, created_at
    `) as any[];

    return NextResponse.json({ tag: result[0], ok: true });
  } catch (err: any) {
    console.error('[tags] POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/tags?id=<tagId>
 */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserId();
    await ensureTables();

    const { searchParams } = new URL(req.url);
    const tagId = searchParams.get('id');
    if (!tagId) {
      return NextResponse.json({ error: 'Tag id required' }, { status: 400 });
    }

    // Delete tag (cascade deletes memory_tags rows)
    await db.execute(sql`
      DELETE FROM tags WHERE id = ${tagId}::uuid AND user_id = ${userId}::uuid
    `);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[tags] DELETE error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
