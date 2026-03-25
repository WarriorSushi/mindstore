/**
 * Mind Map Generator Plugin — Route (thin wrapper)
 *
 * GET /api/v1/plugins/mind-map-generator
 *   ?maxTopics=12    — max number of top-level topics (default 12)
 *   ?maxDepth=3      — max tree depth (default 3)
 *
 * Logic delegated to src/server/plugins/ports/mind-map-generator.ts
 */

import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/server/db';
import { sql, eq } from 'drizzle-orm';
import {
  generateMindMap,
  type MindMapMemory,
} from '@/server/plugins/ports/mind-map-generator';

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const maxTopics = Math.min(parseInt(searchParams.get('maxTopics') || '12'), 20);
    const maxDepth = Math.min(parseInt(searchParams.get('maxDepth') || '3'), 4);

    await autoInstallPlugin();

    // ─── Fetch all memories with embeddings ────────────────────
    const memoriesResult = await db.execute(sql`
      SELECT id, content, source_type, source_title, embedding, created_at, metadata
      FROM memories
      WHERE user_id = ${userId}::uuid AND embedding IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 500
    `);

    const memories: MindMapMemory[] = (memoriesResult as any[]).map(m => ({
      id: m.id,
      content: m.content,
      sourceType: m.source_type,
      sourceTitle: m.source_title || 'Untitled',
      embedding: parseEmbedding(m.embedding),
      createdAt: m.created_at,
      pinned: !!(m.metadata && (m.metadata as any).pinned),
    })).filter(m => m.embedding && m.embedding.length > 0);

    if (memories.length === 0) {
      return NextResponse.json({
        tree: { id: 'root', label: 'Your Mind', children: [], memoryCount: 0 },
        connections: [],
        stats: { totalMemories: 0, topicCount: 0, subTopicCount: 0, maxDepth: 0, avgTopicSize: 0, largestTopic: '', largestTopicSize: 0, connectionCount: 0 },
      });
    }

    // ─── Delegate to port ─────────────────────────────────────
    const result = generateMindMap(memories, maxTopics, maxDepth);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Mind map generation error:', msg);
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
    const existing = await db.select().from(schema.plugins).where(eq(schema.plugins.slug, 'mind-map-generator')).limit(1);
    if (existing.length === 0) {
      await db.insert(schema.plugins).values({
        slug: 'mind-map-generator',
        name: 'Mind Map Generator',
        version: '1.0.0',
        type: 'extension',
        status: 'active',
        config: {},
      });
    }
  } catch {
    // Plugin already exists or table not ready
  }
}
