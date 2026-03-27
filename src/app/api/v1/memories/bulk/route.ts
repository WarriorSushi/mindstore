import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { getUserId } from '@/server/user';
import { applyRateLimit, RATE_LIMITS } from '@/server/api-rate-limit';

/**
 * POST /api/v1/memories/bulk — bulk operations on memories
 * 
 * Supported actions:
 * - delete: Delete multiple memories by IDs
 * - tag: Add a tag to multiple memories
 * - untag: Remove a tag from multiple memories
 * - pin: Pin multiple memories
 * - unpin: Unpin multiple memories
 * - export: Export selected memories as JSON
 * 
 * Body: { action: string, ids: string[], tagId?: string, tagName?: string }
 */
export async function POST(req: NextRequest) {
  const limited = applyRateLimit(req, 'bulk', RATE_LIMITS.write);
  if (limited) return limited;

  try {
    const userId = await getUserId();
    const body = await req.json();
    const { action, ids, tagId, tagName } = body;

    if (!action || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'action and ids[] required' }, { status: 400 });
    }

    if (ids.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 items per bulk operation' }, { status: 400 });
    }

    // Validate all IDs belong to this user
    const validCheck = await db.execute(sql`
      SELECT COUNT(*)::int as c FROM memories
      WHERE user_id = ${userId}::uuid AND id = ANY(${ids}::uuid[])
    `);
    const validCount = (validCheck as any[])[0]?.c || 0;
    if (validCount !== ids.length) {
      return NextResponse.json({ 
        error: `Only ${validCount} of ${ids.length} IDs are valid for your account` 
      }, { status: 400 });
    }

    switch (action) {
      case 'delete': {
        await db.execute(sql`
          DELETE FROM memories
          WHERE user_id = ${userId}::uuid AND id = ANY(${ids}::uuid[])
        `);
        // Also clean up related data
        try {
          await db.execute(sql`DELETE FROM memory_tags WHERE memory_id = ANY(${ids}::uuid[])`);
        } catch { /* table may not exist */ }
        return NextResponse.json({ ok: true, deleted: ids.length });
      }

      case 'tag': {
        if (!tagId && !tagName) {
          return NextResponse.json({ error: 'tagId or tagName required' }, { status: 400 });
        }
        
        let resolvedTagId = tagId;
        
        // Create tag if only name provided
        if (!resolvedTagId && tagName) {
          const existing = await db.execute(sql`
            SELECT id FROM tags WHERE user_id = ${userId}::uuid AND LOWER(name) = LOWER(${tagName})
          `);
          if ((existing as any[]).length > 0) {
            resolvedTagId = (existing as any[])[0].id;
          } else {
            const newId = crypto.randomUUID();
            await db.execute(sql`
              INSERT INTO tags (id, user_id, name, color) VALUES (${newId}, ${userId}::uuid, ${tagName}, 'teal')
            `);
            resolvedTagId = newId;
          }
        }

        // Add tag to all memories (skip existing)
        let tagged = 0;
        for (const memId of ids) {
          try {
            await db.execute(sql`
              INSERT INTO memory_tags (memory_id, tag_id) VALUES (${memId}::uuid, ${resolvedTagId}::uuid)
              ON CONFLICT DO NOTHING
            `);
            tagged++;
          } catch { /* skip individual failures */ }
        }
        return NextResponse.json({ ok: true, tagged, tagId: resolvedTagId });
      }

      case 'untag': {
        if (!tagId) {
          return NextResponse.json({ error: 'tagId required for untag' }, { status: 400 });
        }
        await db.execute(sql`
          DELETE FROM memory_tags
          WHERE tag_id = ${tagId}::uuid AND memory_id = ANY(${ids}::uuid[])
        `);
        return NextResponse.json({ ok: true, untagged: ids.length });
      }

      case 'pin': {
        for (const id of ids) {
          const existing = await db.execute(sql`
            SELECT metadata FROM memories WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
          `);
          const meta = (existing as any[])[0]?.metadata || {};
          const updated = JSON.stringify({ ...meta, pinned: true });
          await db.execute(sql`
            UPDATE memories SET metadata = ${updated}::jsonb WHERE id = ${id}::uuid
          `);
        }
        return NextResponse.json({ ok: true, pinned: ids.length });
      }

      case 'unpin': {
        for (const id of ids) {
          const existing = await db.execute(sql`
            SELECT metadata FROM memories WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
          `);
          const meta = (existing as any[])[0]?.metadata || {};
          delete meta.pinned;
          const updated = JSON.stringify(meta);
          await db.execute(sql`
            UPDATE memories SET metadata = ${updated}::jsonb WHERE id = ${id}::uuid
          `);
        }
        return NextResponse.json({ ok: true, unpinned: ids.length });
      }

      case 'export': {
        const memories = await db.execute(sql`
          SELECT id, content, source_type, source_id, source_title, metadata, created_at
          FROM memories
          WHERE user_id = ${userId}::uuid AND id = ANY(${ids}::uuid[])
          ORDER BY created_at
        `);
        return NextResponse.json({
          memories: (memories as any[]).map(r => ({
            id: r.id,
            content: r.content,
            source: r.source_type,
            sourceTitle: r.source_title,
            timestamp: r.created_at,
            metadata: r.metadata || {},
          })),
          count: (memories as any[]).length,
        });
      }

      default:
        return NextResponse.json({ 
          error: `Unknown action "${action}". Supported: delete, tag, untag, pin, unpin, export` 
        }, { status: 400 });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
