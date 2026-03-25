/**
 * Topic Evolution Timeline Plugin — Route (thin wrapper)
 *
 * GET /api/v1/plugins/topic-evolution
 *   ?granularity=month  — month (default), week, or quarter
 *   ?maxTopics=10       — max topics to track (default 10)
 *
 * Logic delegated to src/server/plugins/ports/topic-evolution.ts
 */

import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/server/db';
import { sql, eq } from 'drizzle-orm';
import {
  analyzeTopicEvolution,
  type TopicEvolutionMemory,
} from '@/server/plugins/ports/topic-evolution';

const PLUGIN_SLUG = 'topic-evolution';

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const granularity = (searchParams.get('granularity') || 'month') as 'week' | 'month' | 'quarter';
    const maxTopics = Math.min(parseInt(searchParams.get('maxTopics') || '10'), 16);

    await autoInstallPlugin();

    // ─── Fetch all memories with embeddings + timestamps ──────
    const memoriesResult = await db.execute(sql`
      SELECT id, content, source_type, source_title, embedding, created_at, metadata
      FROM memories
      WHERE user_id = ${userId}::uuid AND embedding IS NOT NULL
      ORDER BY created_at ASC
    `);

    const memories: TopicEvolutionMemory[] = (memoriesResult as any[]).map(m => ({
      id: m.id,
      content: m.content,
      sourceType: m.source_type,
      sourceTitle: m.source_title || 'Untitled',
      embedding: parseEmbedding(m.embedding),
      createdAt: m.created_at ? new Date(m.created_at).toISOString() : new Date().toISOString(),
    })).filter(m => m.embedding.length > 0);

    // ─── Delegate to port ─────────────────────────────────────
    const result = analyzeTopicEvolution(memories, granularity, maxTopics);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Topic evolution error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

function parseEmbedding(raw: unknown): number[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const cleaned = raw.replace(/^\[|\]$/g, '');
      return cleaned.split(',').map(Number);
    } catch { return []; }
  }
  return [];
}

async function autoInstallPlugin() {
  try {
    const existing = await db.select().from(schema.plugins).where(eq(schema.plugins.slug, PLUGIN_SLUG)).limit(1);
    if (existing.length === 0) {
      await db.insert(schema.plugins).values({
        slug: PLUGIN_SLUG,
        name: 'Topic Evolution Timeline',
        description: 'Shows how your interests changed over time. Visual timeline of knowledge evolution with trend detection.',
        version: '1.0.0',
        type: 'extension',
        status: 'active',
        icon: 'TrendingUp',
        category: 'analysis',
        config: {},
      });
    }
  } catch {
    // Already exists or table not ready
  }
}
