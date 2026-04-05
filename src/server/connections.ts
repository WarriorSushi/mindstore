/**
 * Connection discovery — finds and stores surprising cross-memory connections.
 *
 * Samples memories with embeddings, identifies high-similarity pairs, scores
 * them by surprise (high similarity between semantically distant sources),
 * derives a bridge concept label, and upserts into the connections table.
 */

import { db, schema } from '@/server/db';
import { sql } from 'drizzle-orm';

const SOURCE_TYPE_LABEL: Record<string, string> = {
  chatgpt: 'ChatGPT',
  text: 'Notes',
  file: 'Files',
  url: 'Web',
  kindle: 'Books',
  youtube: 'YouTube',
  reddit: 'Reddit',
};

/**
 * Derive a short bridge concept label from two memory snippets.
 * Extracts the longest common meaningful n-gram or falls back to source label.
 */
function deriveBridgeConcept(a: string, b: string, aType: string, bType: string): string {
  // Extract capitalized words / key nouns from both texts
  const extractKeywords = (text: string) => {
    const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 4);
    const freq: Record<string, number> = {};
    for (const w of words) freq[w] = (freq[w] || 0) + 1;
    return Object.entries(freq).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([w]) => w);
  };

  const kA = new Set(extractKeywords(a));
  const kB = new Set(extractKeywords(b));
  const shared = [...kA].filter(w => kB.has(w));

  if (shared.length > 0) {
    const word = shared[0];
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  // Fall back to "X × Y" bridge label
  const lA = SOURCE_TYPE_LABEL[aType] || aType;
  const lB = SOURCE_TYPE_LABEL[bType] || bType;
  if (lA !== lB) return `${lA} × ${lB}`;
  return lA;
}

/**
 * Score how "surprising" a connection is.
 * High similarity between memories from *different* source types = high surprise.
 * Same-source connections are expected (lower surprise).
 */
function scoreSurprise(similarity: number, aType: string, bType: string): number {
  const crossSourceBonus = aType !== bType ? 0.3 : 0;
  // Surprise = how close they are despite being from different domains
  return Math.min(1, similarity * (1 + crossSourceBonus) - 0.4);
}

export interface DiscoveredConnection {
  memoryAId: string;
  memoryBId: string;
  similarity: number;
  surprise: number;
  bridgeConcept: string;
}

/**
 * Discover and store connections for a user.
 * Returns the number of new connections found.
 */
export async function buildConnections(userId: string): Promise<number> {
  // Sample memories that have embeddings
  const samples = await db.execute(sql`
    SELECT id, content, source_type, embedding
    FROM memories
    WHERE user_id = ${userId}::uuid
      AND embedding IS NOT NULL
    ORDER BY RANDOM()
    LIMIT 200
  `) as any[];

  if (samples.length < 2) return 0;

  // Find pairs with similarity > 0.72 using pgvector
  const ids = samples.map(m => m.id);
  const pairs = await db.execute(sql`
    SELECT
      a.id as a_id, a.content as a_content, a.source_type as a_type,
      b.id as b_id, b.content as b_content, b.source_type as b_type,
      1 - (a.embedding <=> b.embedding) as similarity
    FROM memories a
    JOIN memories b ON a.id < b.id
    WHERE a.user_id = ${userId}::uuid
      AND b.user_id = ${userId}::uuid
      AND a.embedding IS NOT NULL
      AND b.embedding IS NOT NULL
      AND 1 - (a.embedding <=> b.embedding) > 0.72
      AND a.id = ANY(${ids}::uuid[])
      AND b.id = ANY(${ids}::uuid[])
    ORDER BY similarity DESC
    LIMIT 500
  `) as any[];

  if (pairs.length === 0) return 0;

  // Score and pick top surprising ones
  const discovered: DiscoveredConnection[] = pairs.map(p => ({
    memoryAId: p.a_id,
    memoryBId: p.b_id,
    similarity: parseFloat(p.similarity),
    surprise: scoreSurprise(parseFloat(p.similarity), p.a_type, p.b_type),
    bridgeConcept: deriveBridgeConcept(
      (p.a_content || '').slice(0, 200),
      (p.b_content || '').slice(0, 200),
      p.a_type,
      p.b_type
    ),
  })).filter(c => c.surprise > 0);

  if (discovered.length === 0) return 0;

  // Upsert — on conflict (same pair) update the scores
  await db.execute(sql`
    INSERT INTO connections (id, user_id, memory_a_id, memory_b_id, similarity, surprise, bridge_concept, discovered_at)
    VALUES ${sql.raw(
      discovered.map(c =>
        `(gen_random_uuid(), '${userId}'::uuid, '${c.memoryAId}'::uuid, '${c.memoryBId}'::uuid, ${c.similarity}, ${c.surprise}, ${c.bridgeConcept ? `'${c.bridgeConcept.replace(/'/g, "''")}'` : 'NULL'}, now())`
      ).join(', ')
    )}
    ON CONFLICT DO NOTHING
  `);

  return discovered.length;
}

/**
 * Fetch pre-computed connections for a user, sorted by surprise (most surprising first).
 */
export async function getConnections(userId: string, limit = 100) {
  const rows = await db.execute(sql`
    SELECT
      c.id, c.memory_a_id, c.memory_b_id, c.similarity, c.surprise, c.bridge_concept,
      ma.content as a_content, ma.source_type as a_type, ma.source_title as a_title,
      mb.content as b_content, mb.source_type as b_type, mb.source_title as b_title
    FROM connections c
    JOIN memories ma ON c.memory_a_id = ma.id
    JOIN memories mb ON c.memory_b_id = mb.id
    WHERE c.user_id = ${userId}::uuid
    ORDER BY c.surprise DESC NULLS LAST
    LIMIT ${limit}
  `) as any[];

  return rows;
}
