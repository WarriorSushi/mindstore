import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { buildConnections, getConnections } from '@/server/connections';

/**
 * GET /api/v1/fingerprint — generate knowledge graph data
 * Combines source/memory nodes with pre-computed connections from the connections table.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();

    // Get sources (grouped)
    const sourcesResult = await db.execute(sql`
      SELECT source_type as type, source_title as title, source_id as id, COUNT(*)::int as item_count
      FROM memories WHERE user_id = ${userId}::uuid
      GROUP BY source_type, source_title, source_id
      ORDER BY item_count DESC
    `);
    const sources = sourcesResult as any[];

    // Get a sample of memories
    const memoriesResult = await db.execute(sql`
      SELECT id, content, source_type, source_id, source_title, embedding
      FROM memories WHERE user_id = ${userId}::uuid
      ORDER BY RANDOM()
      LIMIT 150
    `);
    const memories = memoriesResult as any[];

    const nodes: Array<{ id: string; label: string; size: number; group: string }> = [];
    const edges: Array<{ id: string; source: string; target: string; weight: number; label?: string; surprise?: number }> = [];

    // Source nodes
    for (const source of sources) {
      nodes.push({
        id: `src-${source.id || source.title}`,
        label: source.title || 'Untitled',
        size: Math.max(10, source.item_count * 2),
        group: source.type,
      });
    }

    // Memory nodes
    const memoryIds = new Set<string>();
    for (const mem of memories) {
      nodes.push({
        id: `mem-${mem.id}`,
        label: mem.source_title || mem.content.slice(0, 30),
        size: 5,
        group: mem.source_type,
      });
      memoryIds.add(mem.id);

      edges.push({
        id: `e-${mem.id}-src`,
        source: `mem-${mem.id}`,
        target: `src-${mem.source_id || mem.source_title}`,
        weight: 1,
      });
    }

    // Pre-computed connections (richer — include surprise + bridgeConcept)
    const storedConnections = await getConnections(userId, 200);
    const usedConnectionIds = new Set<string>();

    for (const c of storedConnections) {
      const aId = `mem-${c.memory_a_id}`;
      const bId = `mem-${c.memory_b_id}`;
      const edgeId = `ec-${c.memory_a_id}-${c.memory_b_id}`;

      // Add memory nodes if not already in sample
      if (!memoryIds.has(c.memory_a_id)) {
        nodes.push({ id: aId, label: c.a_title || c.a_content?.slice(0, 30) || '', size: 5, group: c.a_type });
        memoryIds.add(c.memory_a_id);
        edges.push({ id: `e-${c.memory_a_id}-src`, source: aId, target: `src-${c.a_title}`, weight: 0.5 });
      }
      if (!memoryIds.has(c.memory_b_id)) {
        nodes.push({ id: bId, label: c.b_title || c.b_content?.slice(0, 30) || '', size: 5, group: c.b_type });
        memoryIds.add(c.memory_b_id);
        edges.push({ id: `e-${c.memory_b_id}-src`, source: bId, target: `src-${c.b_title}`, weight: 0.5 });
      }

      if (!usedConnectionIds.has(edgeId)) {
        edges.push({
          id: edgeId,
          source: aId,
          target: bId,
          weight: c.similarity || 0.5,
          label: c.bridge_concept || undefined,
          surprise: c.surprise || 0,
        });
        usedConnectionIds.add(edgeId);
      }
    }

    // Fallback: live cross-edges for similar memories if no stored connections yet
    if (storedConnections.length === 0) {
      const withEmb = memories.filter(m => m.embedding);
      if (withEmb.length >= 2) {
        const crossEdges = await db.execute(sql`
          SELECT a.id as a_id, b.id as b_id, 1 - (a.embedding <=> b.embedding) as similarity
          FROM memories a, memories b
          WHERE a.user_id = ${userId}::uuid AND b.user_id = ${userId}::uuid
            AND a.id < b.id
            AND a.embedding IS NOT NULL AND b.embedding IS NOT NULL
            AND 1 - (a.embedding <=> b.embedding) > 0.75
            AND a.id = ANY(${withEmb.map(m => m.id)}::uuid[])
            AND b.id = ANY(${withEmb.map(m => m.id)}::uuid[])
          ORDER BY similarity DESC
          LIMIT 200
        `);

        for (const r of crossEdges as any[]) {
          edges.push({
            id: `e-${r.a_id}-${r.b_id}`,
            source: `mem-${r.a_id}`,
            target: `mem-${r.b_id}`,
            weight: r.similarity,
          });
        }
      }
    }

    // Clusters
    const clusterColors: Record<string, string> = {
      chatgpt: '#10b981', text: '#0ea5e9', file: '#f59e0b', url: '#3b82f6',
      kindle: '#f97316', youtube: '#ef4444', reddit: '#f97316',
    };

    const clusters = sources.reduce((acc: any[], s: any) => {
      const existing = acc.find(c => c.name === s.type);
      if (existing) {
        existing.size += s.item_count;
      } else {
        acc.push({ name: s.type, size: s.item_count, color: clusterColors[s.type] || '#6b7280' });
      }
      return acc;
    }, []);

    // Top surprising connections for the UI panel
    const surprisingConnections = storedConnections
      .filter(c => c.surprise > 0.1)
      .slice(0, 10)
      .map(c => ({
        id: c.id,
        aSnippet: (c.a_content || '').slice(0, 80),
        bSnippet: (c.b_content || '').slice(0, 80),
        aType: c.a_type,
        bType: c.b_type,
        bridgeConcept: c.bridge_concept,
        surprise: c.surprise,
        similarity: c.similarity,
      }));

    return NextResponse.json({ nodes, edges, clusters, surprisingConnections, hasStoredConnections: storedConnections.length > 0 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/v1/fingerprint — trigger connection discovery (async, can be slow)
 */
export async function POST() {
  try {
    const userId = await getUserId();
    const count = await buildConnections(userId);
    return NextResponse.json({ ok: true, discovered: count });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
