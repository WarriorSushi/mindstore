import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { getUserId } from '@/server/user';

/**
 * Knowledge review — surfaces memories you should revisit.
 * 
 * GET /api/v1/review — get memories due for review
 * POST /api/v1/review — mark a memory as reviewed (pushes next review forward)
 * 
 * Uses a simplified spaced repetition schedule:
 * First review: 1 day after creation
 * Second: 3 days after first review
 * Third: 7 days
 * Fourth: 14 days
 * Fifth+: 30 days
 * 
 * Auto-creates the memory_reviews table.
 */

async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS memory_reviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
      review_count INT DEFAULT 0,
      next_review_at TIMESTAMPTZ NOT NULL,
      last_reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, memory_id)
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_memory_reviews_due 
    ON memory_reviews (user_id, next_review_at)
  `).catch(() => {});
}

const INTERVALS = [1, 3, 7, 14, 30]; // days

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

    await ensureTable();

    // Get memories due for review
    const due = await db.execute(sql`
      SELECT r.id as review_id, r.review_count, r.next_review_at, r.last_reviewed_at,
        m.id as memory_id, m.content, m.source_type, m.source_title, m.created_at
      FROM memory_reviews r
      JOIN memories m ON m.id = r.memory_id
      WHERE r.user_id = ${userId}::uuid AND r.next_review_at <= NOW()
      ORDER BY r.next_review_at ASC
      LIMIT ${limit}
    `);

    // Count total due
    const countRes = await db.execute(sql`
      SELECT COUNT(*)::int as c FROM memory_reviews
      WHERE user_id = ${userId}::uuid AND next_review_at <= NOW()
    `);
    const totalDue = (countRes as any[])[0]?.c || 0;

    // Count total tracked
    const trackedRes = await db.execute(sql`
      SELECT COUNT(*)::int as c FROM memory_reviews WHERE user_id = ${userId}::uuid
    `);
    const totalTracked = (trackedRes as any[])[0]?.c || 0;

    return NextResponse.json({
      due: (due as any[]).map(r => ({
        reviewId: r.review_id,
        memoryId: r.memory_id,
        content: r.content,
        source: r.source_type,
        title: r.source_title,
        reviewCount: r.review_count,
        nextReview: r.next_review_at,
        lastReviewed: r.last_reviewed_at,
        createdAt: r.created_at,
      })),
      totalDue,
      totalTracked,
    });
  } catch (error: unknown) {
    return NextResponse.json({ due: [], totalDue: 0, totalTracked: 0 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    const body = await req.json();
    const { memoryId, action } = body;

    if (!memoryId) {
      return NextResponse.json({ error: 'memoryId required' }, { status: 400 });
    }

    await ensureTable();

    if (action === 'add') {
      // Add a memory to the review queue
      const nextReview = new Date(Date.now() + 86400000).toISOString(); // 1 day from now
      await db.execute(sql`
        INSERT INTO memory_reviews (user_id, memory_id, next_review_at)
        VALUES (${userId}::uuid, ${memoryId}::uuid, ${nextReview}::timestamptz)
        ON CONFLICT (user_id, memory_id) DO NOTHING
      `);
      return NextResponse.json({ ok: true, nextReview });
    }

    if (action === 'remove') {
      await db.execute(sql`
        DELETE FROM memory_reviews
        WHERE user_id = ${userId}::uuid AND memory_id = ${memoryId}::uuid
      `);
      return NextResponse.json({ ok: true });
    }

    // Default: mark as reviewed, push next review forward
    const existing = await db.execute(sql`
      SELECT review_count FROM memory_reviews
      WHERE user_id = ${userId}::uuid AND memory_id = ${memoryId}::uuid
    `);
    
    const current = (existing as any[])[0];
    if (!current) {
      return NextResponse.json({ error: 'Memory not in review queue' }, { status: 404 });
    }

    const newCount = current.review_count + 1;
    const intervalDays = INTERVALS[Math.min(newCount, INTERVALS.length - 1)];
    const nextReview = new Date(Date.now() + intervalDays * 86400000).toISOString();

    await db.execute(sql`
      UPDATE memory_reviews
      SET review_count = ${newCount}, 
          next_review_at = ${nextReview}::timestamptz,
          last_reviewed_at = NOW()
      WHERE user_id = ${userId}::uuid AND memory_id = ${memoryId}::uuid
    `);

    return NextResponse.json({ 
      ok: true, 
      reviewCount: newCount,
      nextReview,
      intervalDays,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
