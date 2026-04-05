import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { getUserId } from '@/server/user';
import { getTextGenerationConfig, callTextPrompt } from '@/server/ai-client';

/**
 * GET /api/v1/diff?from=YYYY-MM-DD&to=YYYY-MM-DD&baseFrom=YYYY-MM-DD&baseTo=YYYY-MM-DD
 *
 * Mind Diff — compares topic distribution between two time windows.
 * Returns topic counts for both windows + AI synthesis of what changed.
 *
 * Window A = base period (older snapshot)
 * Window B = compare period (newer snapshot)
 *
 * Defaults: B = last 30 days, A = 30 days before that
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);

    const now = new Date();

    // Window B (comparison / "now") — last 30 days by default
    const toDate = searchParams.get('to')
      ? new Date(searchParams.get('to')!)
      : now;
    const fromDate = searchParams.get('from')
      ? new Date(searchParams.get('from')!)
      : new Date(now.getTime() - 30 * 86400000);

    // Window A (baseline / "before") — 30 days before B by default
    const baseWindowMs = toDate.getTime() - fromDate.getTime();
    const baseToDate = searchParams.get('baseTo')
      ? new Date(searchParams.get('baseTo')!)
      : fromDate;
    const baseFromDate = searchParams.get('baseFrom')
      ? new Date(searchParams.get('baseFrom')!)
      : new Date(baseToDate.getTime() - baseWindowMs);

    // Get top words per window via simple term frequency
    // We bucket by source_type and count, giving a coarse topic proxy
    const [windowA, windowB] = await Promise.all([
      db.execute(sql`
        SELECT
          source_type,
          COUNT(*)::int as count,
          STRING_AGG(SUBSTRING(content FROM 1 FOR 200), ' ' ORDER BY created_at) as sample_text
        FROM memories
        WHERE user_id = ${userId}::uuid
          AND created_at >= ${baseFromDate.toISOString()}::timestamptz
          AND created_at < ${baseToDate.toISOString()}::timestamptz
        GROUP BY source_type
        ORDER BY count DESC
        LIMIT 20
      `),
      db.execute(sql`
        SELECT
          source_type,
          COUNT(*)::int as count,
          STRING_AGG(SUBSTRING(content FROM 1 FOR 200), ' ' ORDER BY created_at) as sample_text
        FROM memories
        WHERE user_id = ${userId}::uuid
          AND created_at >= ${fromDate.toISOString()}::timestamptz
          AND created_at < ${toDate.toISOString()}::timestamptz
        GROUP BY source_type
        ORDER BY count DESC
        LIMIT 20
      `),
    ]);

    // Total counts
    const totalA = (windowA as any[]).reduce((sum, r) => sum + r.count, 0);
    const totalB = (windowB as any[]).reduce((sum, r) => sum + r.count, 0);

    // Build source-level comparison
    const sourceMap = new Map<string, { countA: number; countB: number }>();
    for (const row of windowA as any[]) {
      sourceMap.set(row.source_type, { countA: row.count, countB: 0 });
    }
    for (const row of windowB as any[]) {
      const existing = sourceMap.get(row.source_type);
      if (existing) {
        existing.countB = row.count;
      } else {
        sourceMap.set(row.source_type, { countA: 0, countB: row.count });
      }
    }

    const sourceComparison = Array.from(sourceMap.entries())
      .map(([source, { countA, countB }]) => {
        const shareA = totalA > 0 ? countA / totalA : 0;
        const shareB = totalB > 0 ? countB / totalB : 0;
        const shareShift = shareB - shareA;
        return {
          source,
          countA,
          countB,
          shareA: Math.round(shareA * 100),
          shareB: Math.round(shareB * 100),
          shareShift: Math.round(shareShift * 100),
          trend: shareShift > 0.05 ? 'rising' : shareShift < -0.05 ? 'declining' : 'steady',
        };
      })
      .sort((a, b) => Math.abs(b.shareShift) - Math.abs(a.shareShift));

    // Get recent keywords per window for AI synthesis
    const [keywordsA, keywordsB] = await Promise.all([
      db.execute(sql`
        SELECT content
        FROM memories
        WHERE user_id = ${userId}::uuid
          AND created_at >= ${baseFromDate.toISOString()}::timestamptz
          AND created_at < ${baseToDate.toISOString()}::timestamptz
        ORDER BY created_at DESC
        LIMIT 30
      `),
      db.execute(sql`
        SELECT content
        FROM memories
        WHERE user_id = ${userId}::uuid
          AND created_at >= ${fromDate.toISOString()}::timestamptz
          AND created_at < ${toDate.toISOString()}::timestamptz
        ORDER BY created_at DESC
        LIMIT 30
      `),
    ]);

    // Attempt AI synthesis
    let synthesis: string | null = null;
    const config = await getTextGenerationConfig();
    if (config && totalA > 0 && totalB > 0) {
      const sampleA = (keywordsA as any[])
        .slice(0, 10)
        .map((r) => r.content?.slice(0, 200))
        .filter(Boolean)
        .join('\n---\n');
      const sampleB = (keywordsB as any[])
        .slice(0, 10)
        .map((r) => r.content?.slice(0, 200))
        .filter(Boolean)
        .join('\n---\n');

      const sourceChanges = sourceComparison
        .filter((s) => s.trend !== 'steady')
        .slice(0, 5)
        .map((s) => `${s.source}: ${s.countA}→${s.countB} memories (${s.shareShift > 0 ? '+' : ''}${s.shareShift}pp)`)
        .join('\n');

      try {
        synthesis = await callTextPrompt(
          config,
          `You are analyzing how someone's knowledge focus has shifted between two time periods.

Period A (${baseFromDate.toISOString().slice(0, 10)} to ${baseToDate.toISOString().slice(0, 10)}):
${totalA} memories. Sample content:
${sampleA || '(no data)'}

Period B (${fromDate.toISOString().slice(0, 10)} to ${toDate.toISOString().slice(0, 10)}):
${totalB} memories. Sample content:
${sampleB || '(no data)'}

Source shifts:
${sourceChanges || '(no significant source shifts)'}

Write a 2-3 sentence "Knowledge Diff" — a thoughtful, specific observation about how this person's intellectual focus has shifted between the two periods. What are they exploring more? What seems to have faded? Make it personal and insightful, like a smart friend reflecting on their journey. Be concrete about topics if you can infer them from the content.`,
          undefined,
          { temperature: 0.7, maxTokens: 200 },
        );
      } catch {
        // Synthesis is optional — don't fail the whole request
      }
    }

    return NextResponse.json({
      periodA: {
        from: baseFromDate.toISOString().slice(0, 10),
        to: baseToDate.toISOString().slice(0, 10),
        total: totalA,
      },
      periodB: {
        from: fromDate.toISOString().slice(0, 10),
        to: toDate.toISOString().slice(0, 10),
        total: totalB,
      },
      sourceComparison,
      synthesis,
      hasData: totalA > 0 || totalB > 0,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
