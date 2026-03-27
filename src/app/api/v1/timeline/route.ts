import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { getUserId } from '@/server/user';

/**
 * GET /api/v1/timeline — knowledge timeline
 * 
 * Returns a chronological view of knowledge growth:
 * - Daily/weekly/monthly aggregations
 * - Source distribution over time
 * - Key milestones and streaks
 * 
 * Query: ?granularity=day|week|month (default: day)
 *        ?range=30|90|365|all (default: 90)
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const granularity = searchParams.get('granularity') || 'day';
    const range = searchParams.get('range') || '90';

    // Build date truncation SQL
    const dateTrunc = granularity === 'month' ? 'month' 
      : granularity === 'week' ? 'week' 
      : 'day';

    const rangeInterval = range === 'all' ? '100 years' 
      : range === '365' ? '365 days'
      : range === '90' ? '90 days'
      : '30 days';

    // Get aggregated timeline data
    const timeline = await db.execute(sql`
      SELECT 
        DATE_TRUNC(${dateTrunc}, created_at) as period,
        source_type,
        COUNT(*)::int as count,
        SUM(LENGTH(content))::int as total_chars,
        MIN(created_at) as first_at,
        MAX(created_at) as last_at
      FROM memories
      WHERE user_id = ${userId}::uuid 
        AND created_at >= NOW() - ${rangeInterval}::interval
      GROUP BY period, source_type
      ORDER BY period ASC, count DESC
    `);

    // Build period map
    const periodMap = new Map<string, {
      period: string;
      total: number;
      totalChars: number;
      sources: Array<{ type: string; count: number }>;
    }>();

    for (const row of timeline as any[]) {
      const periodKey = new Date(row.period).toISOString().slice(0, 10);
      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, {
          period: periodKey,
          total: 0,
          totalChars: 0,
          sources: [],
        });
      }
      const entry = periodMap.get(periodKey)!;
      entry.total += row.count;
      entry.totalChars += row.total_chars || 0;
      entry.sources.push({ type: row.source_type, count: row.count });
    }

    // Calculate cumulative totals
    let cumulative = 0;
    const periods = [...periodMap.values()].map(p => {
      cumulative += p.total;
      return { ...p, cumulative };
    });

    // Find milestones (100, 500, 1000, etc.)
    const milestones: Array<{ count: number; period: string }> = [];
    const thresholds = [100, 500, 1000, 2500, 5000, 10000];
    let lastCum = 0;
    for (const p of periods) {
      for (const t of thresholds) {
        if (lastCum < t && p.cumulative >= t) {
          milestones.push({ count: t, period: p.period });
        }
      }
      lastCum = p.cumulative;
    }

    // Overall stats
    const totalResult = await db.execute(sql`
      SELECT 
        COUNT(*)::int as total,
        COUNT(DISTINCT source_type) as source_count,
        MIN(created_at) as first_memory,
        MAX(created_at) as last_memory
      FROM memories WHERE user_id = ${userId}::uuid
    `);
    const stats = (totalResult as any[])[0] || {};
    
    const firstMemory = stats.first_memory ? new Date(stats.first_memory) : null;
    const lastMemory = stats.last_memory ? new Date(stats.last_memory) : null;
    const totalDays = firstMemory && lastMemory 
      ? Math.max(1, Math.ceil((lastMemory.getTime() - firstMemory.getTime()) / 86400000))
      : 0;

    return NextResponse.json({
      timeline: periods,
      milestones,
      stats: {
        totalMemories: stats.total || 0,
        totalSources: stats.source_count || 0,
        firstMemory: stats.first_memory,
        lastMemory: stats.last_memory,
        totalDays,
        avgPerDay: totalDays > 0 ? Math.round((stats.total || 0) / totalDays * 10) / 10 : 0,
      },
      granularity,
      range,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ timeline: [], stats: {}, error: msg });
  }
}
