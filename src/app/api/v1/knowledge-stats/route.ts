import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/v1/knowledge-stats
 * Comprehensive knowledge base analytics for the Stats page
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();

    // Run all queries in parallel for speed
    const [
      totalResult,
      sourceBreakdown,
      monthlyGrowth,
      wordStats,
      embeddingCoverage,
      dateRange,
      topSources,
      weeklyActivity,
      contentDepth,
    ] = await Promise.all([
      // Total memory count
      db.execute(sql`SELECT COUNT(*)::int as count FROM memories WHERE user_id = ${userId}::uuid`),

      // Source type breakdown
      db.execute(sql`
        SELECT source_type as type, COUNT(*)::int as count
        FROM memories WHERE user_id = ${userId}::uuid
        GROUP BY source_type ORDER BY count DESC
      `),

      // Monthly growth — memories per month for up to 12 months
      db.execute(sql`
        SELECT
          to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
          COUNT(*)::int AS count
        FROM memories
        WHERE user_id = ${userId}::uuid
          AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY month
        ORDER BY month ASC
      `),

      // Word count statistics
      db.execute(sql`
        SELECT
          COALESCE(AVG(array_length(string_to_array(content, ' '), 1)), 0)::int AS avg_words,
          COALESCE(MIN(array_length(string_to_array(content, ' '), 1)), 0)::int AS min_words,
          COALESCE(MAX(array_length(string_to_array(content, ' '), 1)), 0)::int AS max_words,
          COALESCE(SUM(array_length(string_to_array(content, ' '), 1)), 0)::bigint AS total_words,
          COALESCE(AVG(LENGTH(content)), 0)::int AS avg_chars
        FROM memories WHERE user_id = ${userId}::uuid
      `),

      // Embedding coverage
      db.execute(sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END)::int AS with_embedding
        FROM memories WHERE user_id = ${userId}::uuid
      `),

      // Date range of knowledge
      db.execute(sql`
        SELECT
          MIN(created_at) AS earliest,
          MAX(created_at) AS latest
        FROM memories WHERE user_id = ${userId}::uuid
      `),

      // Top sources by item count (top 15)
      db.execute(sql`
        SELECT source_type as type, source_title as title, COUNT(*)::int as count
        FROM memories WHERE user_id = ${userId}::uuid
        GROUP BY source_type, source_title
        ORDER BY count DESC
        LIMIT 15
      `),

      // Weekly activity — last 8 weeks
      db.execute(sql`
        SELECT
          date_trunc('week', created_at)::date AS week,
          COUNT(*)::int AS count
        FROM memories
        WHERE user_id = ${userId}::uuid
          AND created_at >= NOW() - INTERVAL '8 weeks'
        GROUP BY week
        ORDER BY week ASC
      `),

      // Content depth distribution — bucketed by word count
      db.execute(sql`
        SELECT
          CASE
            WHEN array_length(string_to_array(content, ' '), 1) < 50 THEN 'brief'
            WHEN array_length(string_to_array(content, ' '), 1) < 200 THEN 'medium'
            WHEN array_length(string_to_array(content, ' '), 1) < 500 THEN 'detailed'
            WHEN array_length(string_to_array(content, ' '), 1) < 1000 THEN 'deep'
            ELSE 'extensive'
          END AS depth,
          COUNT(*)::int AS count
        FROM memories WHERE user_id = ${userId}::uuid
        GROUP BY depth
      `),
    ]);

    const total = (totalResult as any)[0]?.count || 0;
    const ws = (wordStats as any)[0] || {};
    const ec = (embeddingCoverage as any)[0] || {};
    const dr = (dateRange as any)[0] || {};

    // Fill in monthly growth with zero months
    const monthlyMap = new Map<string, number>();
    for (const row of monthlyGrowth as any[]) {
      monthlyMap.set(row.month, row.count);
    }
    const filledMonths: Array<{ month: string; count: number; cumulative: number }> = [];
    const now = new Date();
    let cumulative = 0;
    // Estimate memories before our tracking window
    const trackedTotal = Array.from(monthlyMap.values()).reduce((s, c) => s + c, 0);
    cumulative = Math.max(0, total - trackedTotal);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const count = monthlyMap.get(key) || 0;
      cumulative += count;
      filledMonths.push({ month: key, count, cumulative });
    }

    // Content depth distribution
    const depthMap: Record<string, number> = { brief: 0, medium: 0, detailed: 0, deep: 0, extensive: 0 };
    for (const row of contentDepth as any[]) {
      depthMap[row.depth] = row.count;
    }

    // Source diversity score (0-100) — based on Shannon entropy normalized to max entropy
    const sourceTypes = (sourceBreakdown as any[]);
    let diversityScore = 0;
    if (sourceTypes.length > 1 && total > 0) {
      const maxEntropy = Math.log2(sourceTypes.length);
      let entropy = 0;
      for (const s of sourceTypes) {
        const p = s.count / total;
        if (p > 0) entropy -= p * Math.log2(p);
      }
      diversityScore = maxEntropy > 0 ? Math.round((entropy / maxEntropy) * 100) : 0;
    } else if (sourceTypes.length === 1) {
      diversityScore = 0;
    }

    return NextResponse.json({
      total,
      sources: sourceTypes.map((s: any) => ({ type: s.type, count: s.count })),
      monthlyGrowth: filledMonths,
      words: {
        total: Number(ws.total_words) || 0,
        avg: ws.avg_words || 0,
        min: ws.min_words || 0,
        max: ws.max_words || 0,
        avgChars: ws.avg_chars || 0,
      },
      embeddings: {
        total: ec.total || 0,
        covered: ec.with_embedding || 0,
        percentage: ec.total > 0 ? Math.round((ec.with_embedding / ec.total) * 100) : 0,
      },
      dateRange: {
        earliest: dr.earliest,
        latest: dr.latest,
      },
      topSources: (topSources as any[]).map((s: any) => ({
        type: s.type,
        title: s.title || 'Untitled',
        count: s.count,
      })),
      weeklyActivity: (weeklyActivity as any[]).map((w: any) => ({
        week: w.week,
        count: w.count,
      })),
      contentDepth: depthMap,
      diversityScore,
    });
  } catch (error: unknown) {
    console.error('[knowledge-stats]', error);
    return NextResponse.json({
      total: 0,
      sources: [],
      monthlyGrowth: [],
      words: { total: 0, avg: 0, min: 0, max: 0, avgChars: 0 },
      embeddings: { total: 0, covered: 0, percentage: 0 },
      dateRange: { earliest: null, latest: null },
      topSources: [],
      weeklyActivity: [],
      contentDepth: { brief: 0, medium: 0, detailed: 0, deep: 0, extensive: 0 },
      diversityScore: 0,
      dbError: true,
    });
  }
}
