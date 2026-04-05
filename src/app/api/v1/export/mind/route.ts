import { getUserId } from '@/server/user';
import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/v1/export/mind — export user knowledge as a .mind file
 *
 * Phase 1: JSON-serialized .mind format (binary phase planned for Phase 2).
 * Includes: memories + embeddings, connections, profile, fingerprint manifest.
 * Compatible with POST /api/v1/import for round-trip restore.
 */
export async function GET() {
  try {
    const userId = await getUserId();

    const [memoriesRes, connectionsRes, profileRes, factsRes] = await Promise.allSettled([
      db.execute(sql`
        SELECT id, content, source_type, source_id, source_title, metadata, created_at, imported_at,
               encode(embedding::bytea, 'base64') as embedding_b64,
               embedding IS NOT NULL as has_embedding
        FROM memories
        WHERE user_id = ${userId}::uuid
        ORDER BY created_at
      `),
      db.execute(sql`
        SELECT c.id, c.memory_a_id, c.memory_b_id, c.similarity, c.surprise, c.bridge_concept, c.discovered_at,
               ma.content as a_snippet, mb.content as b_snippet
        FROM connections c
        JOIN memories ma ON c.memory_a_id = ma.id
        JOIN memories mb ON c.memory_b_id = mb.id
        WHERE c.user_id = ${userId}::uuid
        ORDER BY c.surprise DESC NULLS LAST
      `).catch(() => []),
      db.execute(sql`
        SELECT key, value, category, confidence FROM profile WHERE user_id = ${userId}::uuid
      `).catch(() => []),
      db.execute(sql`
        SELECT fact, category, entities, learned_at FROM facts WHERE user_id = ${userId}::uuid
      `).catch(() => []),
    ]);

    const memories = memoriesRes.status === 'fulfilled' ? (memoriesRes.value as any[]) : [];
    const connections = connectionsRes.status === 'fulfilled' ? (connectionsRes.value as any[]) : [];
    const profile = profileRes.status === 'fulfilled' ? (profileRes.value as any[]) : [];
    const facts = factsRes.status === 'fulfilled' ? (factsRes.value as any[]) : [];

    const withEmbeddings = memories.filter(m => m.has_embedding).length;
    const sourceTypes = [...new Set(memories.map((m: any) => m.source_type))];

    const mindFile = {
      // ── Manifest ─────────────────────────────────────────────────────────
      _format: '.mind',
      _version: '0.1.0-phase1',
      _spec: 'https://mindstore.org/mind-file-spec',
      _note: 'Phase 1: JSON serialization. Binary format with HNSW index planned for Phase 2.',
      exportedAt: new Date().toISOString(),

      // ── Fingerprint header ────────────────────────────────────────────────
      fingerprint: {
        totalMemories: memories.length,
        withEmbeddings,
        embeddingCoverage: memories.length > 0 ? Math.round(withEmbeddings / memories.length * 100) : 0,
        sourceTypes,
        totalConnections: connections.length,
        profileEntries: profile.length,
        facts: facts.length,
      },

      // ── Knowledge graph ───────────────────────────────────────────────────
      connections: connections.map((c: any) => ({
        id: c.id,
        memoryAId: c.memory_a_id,
        memoryBId: c.memory_b_id,
        similarity: c.similarity,
        surprise: c.surprise,
        bridgeConcept: c.bridge_concept,
        discoveredAt: c.discovered_at,
      })),

      // ── Knowledge profile ─────────────────────────────────────────────────
      profile: profile.map((p: any) => ({
        key: p.key,
        value: p.value,
        category: p.category,
        confidence: p.confidence,
      })),

      // ── Extracted facts ───────────────────────────────────────────────────
      facts: facts.map((f: any) => ({
        fact: f.fact,
        category: f.category,
        entities: f.entities,
        learnedAt: f.learned_at,
      })),

      // ── Memories with embeddings ──────────────────────────────────────────
      memories: memories.map((m: any) => ({
        id: m.id,
        content: m.content,
        source: m.source_type,
        sourceId: m.source_id,
        sourceTitle: m.source_title,
        metadata: m.metadata || {},
        createdAt: m.created_at,
        importedAt: m.imported_at,
        // Embedding stored as base64 for portability; null if not yet indexed
        embedding: m.embedding_b64 ? m.embedding_b64.replace(/\s/g, '') : null,
      })),
    };

    const filename = `mindstore-${new Date().toISOString().split('T')[0]}.mind`;

    return new NextResponse(JSON.stringify(mindFile, null, 2), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Mind-Version': '0.1.0-phase1',
        'X-Mind-Memories': String(memories.length),
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
