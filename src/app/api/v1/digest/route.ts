import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { getUserId } from '@/server/user';

/**
 * GET /api/v1/digest — daily knowledge digest
 * 
 * Summarizes what was added recently:
 * - Memories added today/this week
 * - Grouped by source
 * - Key topics (most frequent terms)
 * - Activity streak
 * 
 * Query: ?days=7 (default: 7, max: 30)
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const days = Math.min(parseInt(searchParams.get('days') || '7'), 30);

    // Get recent memories grouped by day and source
    const dailyBySource = await db.execute(sql`
      SELECT 
        DATE(created_at) as day,
        source_type,
        COUNT(*)::int as count,
        ARRAY_AGG(SUBSTRING(content, 1, 100) ORDER BY created_at DESC) as previews
      FROM memories
      WHERE user_id = ${userId}::uuid AND created_at >= NOW() - (${days}::int || ' days')::interval
      GROUP BY DATE(created_at), source_type
      ORDER BY day DESC, count DESC
    `);

    // Activity streak
    const streakResult = await db.execute(sql`
      WITH daily AS (
        SELECT DISTINCT DATE(created_at) as day
        FROM memories
        WHERE user_id = ${userId}::uuid
        ORDER BY day DESC
      ),
      streak AS (
        SELECT day, day - (ROW_NUMBER() OVER (ORDER BY day DESC))::int * INTERVAL '1 day' as grp
        FROM daily
      )
      SELECT COUNT(*) as streak_days
      FROM streak
      WHERE grp = (SELECT grp FROM streak LIMIT 1)
    `);
    const streak = (streakResult as any[])[0]?.streak_days || 0;

    // Total for the period
    const totalResult = await db.execute(sql`
      SELECT COUNT(*)::int as total
      FROM memories
      WHERE user_id = ${userId}::uuid AND created_at >= NOW() - (${days}::int || ' days')::interval
    `);
    const periodTotal = (totalResult as any[])[0]?.total || 0;

    // Top terms this period
    const recentContent = await db.execute(sql`
      SELECT content FROM memories
      WHERE user_id = ${userId}::uuid AND created_at >= NOW() - (${days}::int || ' days')::interval
      LIMIT 100
    `);

    const stopWords = new Set([
      'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'been',
      'will', 'they', 'were', 'said', 'which', 'their', 'would', 'there',
      'about', 'could', 'other', 'some', 'what', 'your', 'more', 'just',
    ]);
    const wordFreq = new Map<string, number>();
    for (const row of recentContent as any[]) {
      const words = (row.content || '').toLowerCase().split(/\s+/);
      for (const w of words) {
        const clean = w.replace(/[^a-z0-9]/g, '');
        if (clean.length >= 4 && !stopWords.has(clean)) {
          wordFreq.set(clean, (wordFreq.get(clean) || 0) + 1);
        }
      }
    }
    const topTerms = [...wordFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([term, count]) => ({ term, count }));

    // Group by day
    const byDay = new Map<string, Array<{ source: string; count: number; previews: string[] }>>();
    for (const row of dailyBySource as any[]) {
      const day = new Date(row.day).toISOString().slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push({
        source: row.source_type,
        count: row.count,
        previews: (row.previews || []).slice(0, 3),
      });
    }

    return NextResponse.json({
      period: {
        days,
        total: periodTotal,
        dailyAverage: days > 0 ? Math.round(periodTotal / days) : 0,
      },
      streak: {
        days: parseInt(String(streak)),
        label: streak >= 7 ? '🔥 On fire!' : streak >= 3 ? 'Building momentum' : streak >= 1 ? 'Active' : 'Start today',
      },
      daily: [...byDay.entries()].map(([day, sources]) => ({
        day,
        total: sources.reduce((s, src) => s + src.count, 0),
        sources,
      })),
      topTerms,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
