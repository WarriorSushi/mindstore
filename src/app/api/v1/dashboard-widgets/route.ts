/**
 * Dashboard Widgets API
 *
 * Aggregates lightweight summaries from installed plugins for the home page.
 * Each widget query is independent and non-blocking — if one fails, others still load.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/server/user';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

interface Widget {
  id: string;
  type: string;
  title: string;
  icon: string;
  color: string;
  href: string;
  data: Record<string, any>;
}

// ─── Widget Fetchers ────────────────────────────────────────────

async function getFlashcardWidget(userId: string): Promise<Widget | null> {
  try {
    const rows = await db.execute(sql`
      SELECT 
        COUNT(*)::int AS total_cards,
        COUNT(CASE WHEN (metadata->>'nextReview') IS NOT NULL 
          AND (metadata->>'nextReview')::timestamp <= NOW() 
          THEN 1 END)::int AS due_cards,
        COUNT(CASE WHEN (metadata->>'repetitions')::int >= 3 THEN 1 END)::int AS mastered
      FROM memories 
      WHERE user_id = ${userId}::uuid 
        AND metadata->>'flashcard' = 'true'
    `);
    const r = (rows as any[])[0];
    if (!r || r.total_cards === 0) return null;

    return {
      id: 'flashcards',
      type: 'action',
      title: 'Flashcards',
      icon: 'Layers',
      color: 'teal',
      href: '/app/flashcards',
      data: {
        totalCards: r.total_cards,
        dueCards: r.due_cards,
        mastered: r.mastered,
        masteryRate: r.total_cards > 0 ? Math.round((r.mastered / r.total_cards) * 100) : 0,
      },
    };
  } catch { return null; }
}

async function getKnowledgeSourcesWidget(userId: string): Promise<Widget | null> {
  try {
    const rows = await db.execute(sql`
      SELECT source_type AS type, COUNT(*)::int AS count
      FROM memories 
      WHERE user_id = ${userId}::uuid
      GROUP BY source_type
      ORDER BY count DESC
      LIMIT 8
    `);
    const sources = (rows as any[]).filter(r => r.count > 0);
    if (sources.length <= 1) return null;

    return {
      id: 'sources-diversity',
      type: 'insight',
      title: 'Knowledge Sources',
      icon: 'Database',
      color: 'sky',
      href: '/app/explore',
      data: {
        sourceCount: sources.length,
        sources: sources.map(s => ({ type: s.type || 'text', count: s.count })),
      },
    };
  } catch { return null; }
}

async function getEmbeddingCoverageWidget(userId: string): Promise<Widget | null> {
  try {
    const rows = await db.execute(sql`
      SELECT 
        COUNT(*)::int AS total,
        COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END)::int AS embedded
      FROM memories 
      WHERE user_id = ${userId}::uuid
    `);
    const r = (rows as any[])[0];
    if (!r || r.total === 0) return null;
    
    const coverage = Math.round((r.embedded / r.total) * 100);
    // Only show if there's something interesting (not 0% or 100%)
    if (coverage === 100 && r.total < 5) return null;

    return {
      id: 'embedding-coverage',
      type: 'system',
      title: 'Search Coverage',
      icon: 'Zap',
      color: coverage >= 90 ? 'emerald' : coverage >= 50 ? 'amber' : 'red',
      href: '/app/settings',
      data: {
        total: r.total,
        embedded: r.embedded,
        coverage,
        unembedded: r.total - r.embedded,
      },
    };
  } catch { return null; }
}

async function getRecentGrowthWidget(userId: string): Promise<Widget | null> {
  try {
    // Compare this week vs last week
    const rows = await db.execute(sql`
      SELECT
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END)::int AS this_week,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '14 days' 
          AND created_at < NOW() - INTERVAL '7 days' THEN 1 END)::int AS last_week,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END)::int AS today
      FROM memories 
      WHERE user_id = ${userId}::uuid
        AND created_at >= NOW() - INTERVAL '14 days'
    `);
    const r = (rows as any[])[0];
    if (!r || (r.this_week === 0 && r.last_week === 0)) return null;

    const trend = r.last_week > 0
      ? Math.round(((r.this_week - r.last_week) / r.last_week) * 100)
      : r.this_week > 0 ? 100 : 0;

    return {
      id: 'growth',
      type: 'insight',
      title: 'Knowledge Growth',
      icon: 'TrendingUp',
      color: trend >= 0 ? 'emerald' : 'amber',
      href: '/app/explore',
      data: {
        thisWeek: r.this_week,
        lastWeek: r.last_week,
        today: r.today,
        trend,
      },
    };
  } catch { return null; }
}

async function getContentDepthWidget(userId: string): Promise<Widget | null> {
  try {
    const rows = await db.execute(sql`
      SELECT
        ROUND(AVG(LENGTH(content)))::int AS avg_length,
        MAX(LENGTH(content))::int AS max_length,
        COUNT(CASE WHEN LENGTH(content) > 2000 THEN 1 END)::int AS deep_count,
        COUNT(CASE WHEN LENGTH(content) < 100 THEN 1 END)::int AS shallow_count,
        COUNT(*)::int AS total
      FROM memories 
      WHERE user_id = ${userId}::uuid
    `);
    const r = (rows as any[])[0];
    if (!r || r.total < 10) return null;

    const avgWords = Math.round((r.avg_length || 0) / 5.5);
    const deepPct = Math.round((r.deep_count / r.total) * 100);

    return {
      id: 'content-depth',
      type: 'insight',
      title: 'Content Depth',
      icon: 'BookOpen',
      color: 'sky',
      href: '/app/explore',
      data: {
        avgWords,
        deepCount: r.deep_count,
        shallowCount: r.shallow_count,
        deepPct,
        total: r.total,
      },
    };
  } catch { return null; }
}

async function getOldestNewestWidget(userId: string): Promise<Widget | null> {
  try {
    const rows = await db.execute(sql`
      SELECT
        MIN(created_at) AS oldest,
        MAX(created_at) AS newest,
        COUNT(*)::int AS total
      FROM memories 
      WHERE user_id = ${userId}::uuid
    `);
    const r = (rows as any[])[0];
    if (!r || r.total < 5 || !r.oldest || !r.newest) return null;

    const oldest = new Date(r.oldest);
    const newest = new Date(r.newest);
    const spanDays = Math.ceil((newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24));
    
    if (spanDays < 2) return null;

    return {
      id: 'time-span',
      type: 'insight',
      title: 'Knowledge Timeline',
      icon: 'Clock',
      color: 'teal',
      href: '/app/evolution',
      data: {
        oldestDate: oldest.toISOString(),
        newestDate: newest.toISOString(),
        spanDays,
        spanLabel: spanDays > 365 
          ? `${Math.round(spanDays / 365 * 10) / 10} years`
          : spanDays > 30
            ? `${Math.round(spanDays / 30)} months`
            : `${spanDays} days`,
        total: r.total,
      },
    };
  } catch { return null; }
}

async function getConnectionsWidget(userId: string): Promise<Widget | null> {
  try {
    const rows = await db.execute(sql`
      SELECT COUNT(*)::int AS total_connections
      FROM connections 
      WHERE user_id = ${userId}::uuid
    `);
    const r = (rows as any[])[0];
    if (!r || r.total_connections < 3) return null;

    return {
      id: 'connections',
      type: 'insight',
      title: 'Connections Found',
      icon: 'Network',
      color: 'teal',
      href: '/app/insights',
      data: {
        totalConnections: r.total_connections,
      },
    };
  } catch { return null; }
}

async function getContradictionsWidget(userId: string): Promise<Widget | null> {
  try {
    const rows = await db.execute(sql`
      SELECT 
        COUNT(*)::int AS total,
        COUNT(CASE WHEN status = 'unresolved' OR status IS NULL THEN 1 END)::int AS unresolved
      FROM contradictions 
      WHERE user_id = ${userId}::uuid
    `);
    const r = (rows as any[])[0];
    if (!r || r.total === 0) return null;

    return {
      id: 'contradictions',
      type: 'insight',
      title: 'Contradictions',
      icon: 'AlertTriangle',
      color: r.unresolved > 0 ? 'amber' : 'emerald',
      href: '/app/insights',
      data: {
        total: r.total,
        unresolved: r.unresolved,
        resolved: r.total - r.unresolved,
      },
    };
  } catch { return null; }
}

// ─── GET Handler ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();

    // Run all widget fetchers concurrently — each is independent
    const results = await Promise.allSettled([
      getFlashcardWidget(userId),
      getRecentGrowthWidget(userId),
      getEmbeddingCoverageWidget(userId),
      getKnowledgeSourcesWidget(userId),
      getContentDepthWidget(userId),
      getOldestNewestWidget(userId),
      getConnectionsWidget(userId),
      getContradictionsWidget(userId),
    ]);

    const widgets: Widget[] = results
      .filter((r): r is PromiseFulfilledResult<Widget | null> => r.status === 'fulfilled')
      .map(r => r.value)
      .filter((w): w is Widget => w !== null);

    return NextResponse.json({ widgets });
  } catch (error: unknown) {
    console.error('[dashboard-widgets]', error);
    return NextResponse.json({ widgets: [] });
  }
}
