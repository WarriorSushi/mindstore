import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { getUserId } from '@/server/user';

/**
 * GET /api/v1/insights — auto-generated knowledge insights
 * 
 * Surfaces interesting patterns the user might not notice:
 * - Knowledge growth velocity (accelerating/decelerating)
 * - Topic concentration warnings (too narrow or diversifying)
 * - Stale areas (topics not updated in a long time)
 * - Import source balance
 * - Embedding coverage gaps
 * - Seasonal patterns
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const insights: Array<{
      id: string;
      type: 'growth' | 'diversity' | 'stale' | 'gap' | 'milestone' | 'tip';
      title: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
      actionUrl?: string;
      actionLabel?: string;
      data?: Record<string, unknown>;
    }> = [];

    // 1. Knowledge growth velocity
    const [thisWeek, lastWeek, twoWeeksAgo] = await Promise.all([
      db.execute(sql`
        SELECT COUNT(*)::int as c FROM memories
        WHERE user_id = ${userId}::uuid AND created_at >= NOW() - INTERVAL '7 days'
      `),
      db.execute(sql`
        SELECT COUNT(*)::int as c FROM memories
        WHERE user_id = ${userId}::uuid 
          AND created_at >= NOW() - INTERVAL '14 days'
          AND created_at < NOW() - INTERVAL '7 days'
      `),
      db.execute(sql`
        SELECT COUNT(*)::int as c FROM memories
        WHERE user_id = ${userId}::uuid 
          AND created_at >= NOW() - INTERVAL '21 days'
          AND created_at < NOW() - INTERVAL '14 days'
      `),
    ]);

    const thisWeekCount = (thisWeek as any[])[0]?.c || 0;
    const lastWeekCount = (lastWeek as any[])[0]?.c || 0;
    const twoWeeksAgoCount = (twoWeeksAgo as any[])[0]?.c || 0;

    if (thisWeekCount > lastWeekCount * 1.5 && lastWeekCount > 0) {
      insights.push({
        id: 'growth-surge',
        type: 'growth',
        title: 'Knowledge surge',
        description: `You added ${thisWeekCount} memories this week — ${Math.round((thisWeekCount / lastWeekCount - 1) * 100)}% more than last week. Great momentum.`,
        priority: 'low',
        data: { thisWeek: thisWeekCount, lastWeek: lastWeekCount },
      });
    } else if (thisWeekCount < lastWeekCount * 0.3 && lastWeekCount > 5) {
      insights.push({
        id: 'growth-slow',
        type: 'growth',
        title: 'Capture slowdown',
        description: `Only ${thisWeekCount} new memories this week vs ${lastWeekCount} last week. Consider doing a quick import or capture session.`,
        priority: 'medium',
        actionUrl: '/app/import',
        actionLabel: 'Import more',
      });
    }

    // 2. Source diversity
    const sourceBreakdown = await db.execute(sql`
      SELECT source_type, COUNT(*)::int as c
      FROM memories WHERE user_id = ${userId}::uuid
      GROUP BY source_type ORDER BY c DESC
    `);
    const sources = sourceBreakdown as any[];
    const totalMems = sources.reduce((s: number, r: any) => s + r.c, 0);

    if (sources.length > 0 && totalMems > 20) {
      const topSource = sources[0];
      const topPercent = Math.round((topSource.c / totalMems) * 100);
      
      if (topPercent > 80 && sources.length < 3) {
        insights.push({
          id: 'source-concentration',
          type: 'diversity',
          title: 'Single-source concentration',
          description: `${topPercent}% of your knowledge comes from ${topSource.source_type}. Try importing from other sources for richer connections.`,
          priority: 'medium',
          actionUrl: '/app/import',
          actionLabel: 'Add sources',
          data: { topSource: topSource.source_type, percent: topPercent },
        });
      }
      
      if (sources.length >= 4) {
        insights.push({
          id: 'source-diverse',
          type: 'diversity',
          title: 'Diverse knowledge base',
          description: `Your knowledge spans ${sources.length} different sources. This creates richer cross-domain connections.`,
          priority: 'low',
        });
      }
    }

    // 3. Embedding coverage
    const embeddingGap = await db.execute(sql`
      SELECT 
        COUNT(*)::int as total,
        COUNT(embedding)::int as embedded
      FROM memories WHERE user_id = ${userId}::uuid
    `);
    const embRow = (embeddingGap as any[])[0];
    const unembedded = (embRow?.total || 0) - (embRow?.embedded || 0);
    
    if (unembedded > 10) {
      insights.push({
        id: 'embedding-gap',
        type: 'gap',
        title: `${unembedded} memories not searchable`,
        description: `These memories don't have embeddings yet, so they won't appear in semantic search. Run a re-index to fix this.`,
        priority: 'high',
        actionUrl: '/app/settings',
        actionLabel: 'Re-index',
        data: { unembedded, total: embRow?.total },
      });
    }

    // 4. Milestones
    if (totalMems > 0) {
      const milestones = [100, 500, 1000, 2500, 5000, 10000];
      for (const m of milestones) {
        if (totalMems >= m && totalMems < m * 1.1) {
          insights.push({
            id: `milestone-${m}`,
            type: 'milestone',
            title: `${m.toLocaleString()} memories milestone!`,
            description: `Your knowledge base just crossed ${m.toLocaleString()} memories. That's a serious personal knowledge store.`,
            priority: 'low',
          });
          break;
        }
      }
    }

    // 5. Stale content detection
    if (totalMems > 50) {
      const oldestUntouched = await db.execute(sql`
        SELECT source_type, MAX(created_at) as latest
        FROM memories WHERE user_id = ${userId}::uuid
        GROUP BY source_type
        HAVING MAX(created_at) < NOW() - INTERVAL '30 days'
        ORDER BY latest ASC
        LIMIT 3
      `);
      
      for (const row of oldestUntouched as any[]) {
        const daysAgo = Math.floor((Date.now() - new Date(row.latest).getTime()) / 86400000);
        insights.push({
          id: `stale-${row.source_type}`,
          type: 'stale',
          title: `${row.source_type} hasn't been updated`,
          description: `No new ${row.source_type} content in ${daysAgo} days. Consider a fresh import.`,
          priority: 'low',
          actionUrl: '/app/import',
          actionLabel: 'Import',
        });
      }
    }

    // 6. Tips
    if (totalMems > 0 && totalMems < 50) {
      insights.push({
        id: 'tip-import-more',
        type: 'tip',
        title: 'Import more for better results',
        description: 'MindStore works best with 100+ memories. The more knowledge you import, the richer the connections and more useful the AI chat becomes.',
        priority: 'medium',
        actionUrl: '/app/import',
        actionLabel: 'Import',
      });
    }

    if (embRow?.total > 100 && !insights.find(i => i.id === 'embedding-gap')) {
      insights.push({
        id: 'tip-mcp',
        type: 'tip',
        title: 'Connect your AI tools',
        description: 'Your knowledge base is big enough to be useful. Connect MindStore to Claude, Cursor, or Copilot via MCP for instant context in any AI tool.',
        priority: 'medium',
        actionUrl: '/app/connect',
        actionLabel: 'Connect',
      });
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return NextResponse.json({ insights, count: insights.length });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ insights: [], count: 0, error: msg });
  }
}
