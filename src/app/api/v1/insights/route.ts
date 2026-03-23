import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/v1/insights — consolidation data (connections, contradictions, forgetting, metabolism)
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || '00000000-0000-0000-0000-000000000000';

    // Get memories with embeddings for analysis
    const memories = await db.execute(sql`
      SELECT id, content, source_type, source_id, source_title, metadata, created_at, imported_at, embedding
      FROM memories
      WHERE user_id = ${userId}::uuid AND embedding IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 200
    `);

    const allMemories = await db.execute(sql`
      SELECT id, content, source_type, source_id, source_title, metadata, created_at, imported_at
      FROM memories
      WHERE user_id = ${userId}::uuid
      ORDER BY created_at DESC
    `);

    const mems = (allMemories as any[]).map(r => ({
      id: r.id,
      content: r.content,
      source: r.source_type,
      sourceId: r.source_id,
      sourceTitle: r.source_title || '',
      timestamp: r.created_at,
      importedAt: r.imported_at,
      metadata: r.metadata || {},
    }));

    const withEmb = (memories as any[]).map(r => ({
      ...r,
      embedding: r.embedding ? (typeof r.embedding === 'string' ? JSON.parse(r.embedding) : r.embedding) : null,
    })).filter(r => r.embedding);

    // === Cross-connections ===
    // Try vector-based first (cosine similarity), fallback to text-based (trigram)
    let connections: any[] = [];
    
    const hasEmbeddings = withEmb.length >= 2;
    
    if (hasEmbeddings) {
      // Vector-based cross-connections
      const connectionResults = await db.execute(sql`
        SELECT 
          a.id as a_id, a.content as a_content, a.source_type as a_source, a.source_title as a_title,
          b.id as b_id, b.content as b_content, b.source_type as b_source, b.source_title as b_title,
          1 - (a.embedding <=> b.embedding) as similarity
        FROM memories a, memories b
        WHERE a.user_id = ${userId}::uuid AND b.user_id = ${userId}::uuid
          AND a.id < b.id
          AND a.embedding IS NOT NULL AND b.embedding IS NOT NULL
          AND vector_dims(a.embedding) = vector_dims(b.embedding)
          AND a.source_title != b.source_title
          AND 1 - (a.embedding <=> b.embedding) BETWEEN 0.65 AND 0.95
        ORDER BY 1 - (a.embedding <=> b.embedding) DESC
        LIMIT 15
      `);

      connections = (connectionResults as any[]).map(r => {
        const bridgeConcept = extractBridgeConcept(r.a_content, r.b_content);
        const sourceDistance = r.a_source !== r.b_source ? 0.8 : 0.3;
        return {
          memoryA: { id: r.a_id, content: r.a_content, source: r.a_source, sourceTitle: r.a_title },
          memoryB: { id: r.b_id, content: r.b_content, source: r.b_source, sourceTitle: r.b_title },
          similarity: r.similarity,
          bridgeConcept,
          surprise: r.similarity * sourceDistance,
        };
      }).sort((a: any, b: any) => b.surprise - a.surprise);
    } else {
      // Text-based fallback: trigram similarity (pg_trgm)
      const trigramResults = await db.execute(sql`
        SELECT 
          a.id as a_id, a.content as a_content, a.source_type as a_source, a.source_title as a_title,
          b.id as b_id, b.content as b_content, b.source_type as b_source, b.source_title as b_title,
          similarity(a.content, b.content) as sim
        FROM memories a, memories b
        WHERE a.user_id = ${userId}::uuid AND b.user_id = ${userId}::uuid
          AND a.id < b.id
          AND a.source_title != b.source_title
          AND similarity(a.content, b.content) > 0.15
        ORDER BY similarity(a.content, b.content) DESC
        LIMIT 15
      `);

      connections = (trigramResults as any[]).map(r => {
        const bridgeConcept = extractBridgeConcept(r.a_content, r.b_content);
        const sourceDistance = r.a_source !== r.b_source ? 0.8 : 0.3;
        return {
          memoryA: { id: r.a_id, content: r.a_content, source: r.a_source, sourceTitle: r.a_title },
          memoryB: { id: r.b_id, content: r.b_content, source: r.b_source, sourceTitle: r.b_title },
          similarity: r.sim,
          bridgeConcept,
          surprise: r.sim * sourceDistance,
        };
      }).sort((a: any, b: any) => b.surprise - a.surprise);
    }

    // === Contradictions ===
    const contradictionSignals = [
      ['always', 'never'], ['best', 'worst'], ['love', 'hate'],
      ['agree', 'disagree'], ['should', 'should not'],
      ['important', 'unimportant'], ['easy', 'difficult'],
    ];

    const contradictions: any[] = [];
    
    // Find potential contradictions — use embeddings if available, else trigram similarity
    let highSimPairs: any[];
    
    if (hasEmbeddings) {
      const highSimResults = await db.execute(sql`
        SELECT 
          a.id as a_id, a.content as a_content, a.source_type as a_source, a.source_title as a_title,
          b.id as b_id, b.content as b_content, b.source_type as b_source, b.source_title as b_title
        FROM memories a, memories b
        WHERE a.user_id = ${userId}::uuid AND b.user_id = ${userId}::uuid
          AND a.id < b.id
          AND a.embedding IS NOT NULL AND b.embedding IS NOT NULL
          AND vector_dims(a.embedding) = vector_dims(b.embedding)
          AND 1 - (a.embedding <=> b.embedding) > 0.7
        ORDER BY 1 - (a.embedding <=> b.embedding) DESC
        LIMIT 100
      `);
      highSimPairs = highSimResults as any[];
    } else {
      const trigramSimResults = await db.execute(sql`
        SELECT 
          a.id as a_id, a.content as a_content, a.source_type as a_source, a.source_title as a_title,
          b.id as b_id, b.content as b_content, b.source_type as b_source, b.source_title as b_title
        FROM memories a, memories b
        WHERE a.user_id = ${userId}::uuid AND b.user_id = ${userId}::uuid
          AND a.id < b.id
          AND similarity(a.content, b.content) > 0.1
        ORDER BY similarity(a.content, b.content) DESC
        LIMIT 100
      `);
      highSimPairs = trigramSimResults as any[];
    }

    for (const r of highSimPairs) {
      const aLower = r.a_content.toLowerCase();
      const bLower = r.b_content.toLowerCase();
      for (const [pos, neg] of contradictionSignals) {
        if ((aLower.includes(pos) && bLower.includes(neg)) || (aLower.includes(neg) && bLower.includes(pos))) {
          contradictions.push({
            memoryA: { id: r.a_id, content: r.a_content, source: r.a_source, sourceTitle: r.a_title },
            memoryB: { id: r.b_id, content: r.b_content, source: r.b_source, sourceTitle: r.b_title },
            topic: extractBridgeConcept(r.a_content, r.b_content),
            description: `Potential contradiction: one mentions "${pos}" while the other mentions "${neg}"`,
          });
          break;
        }
      }
    }

    // === Forgetting risks (Ebbinghaus curve) ===
    const now = Date.now();
    const forgetting = mems
      .map(m => {
        const daysSinceImport = (now - new Date(m.importedAt).getTime()) / (24 * 60 * 60 * 1000);
        const stability = 7;
        const retention = Math.exp(-daysSinceImport / stability);
        const urgency = 1 - retention;
        return { ...m, urgency };
      })
      .filter(m => m.urgency > 0.5)
      .sort((a, b) => b.urgency - a.urgency)
      .slice(0, 15);

    // === Metabolism score ===
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const recentCount = mems.filter(m => new Date(m.importedAt) > weekAgo).length;
    const totalCount = mems.length;

    const sourcesResult = await db.execute(sql`
      SELECT COUNT(DISTINCT source_title)::int as count FROM memories WHERE user_id = ${userId}::uuid
    `);
    const sourceCount = (sourcesResult as any)[0]?.count || 0;

    const intakeScore = Math.min(recentCount / 10, 3);
    const connectionScore = Math.min(connections.length / 3, 3);
    const volumeScore = Math.min(totalCount / 50, 2);
    const diversityScore = Math.min(sourceCount / 3, 2);
    const score = Math.round((intakeScore + connectionScore + volumeScore + diversityScore) * 10) / 10;

    let verdict = '';
    if (score >= 8) verdict = 'Your mind is on fire. Knowledge flowing fast and connecting well.';
    else if (score >= 5) verdict = 'Solid knowledge metabolism. Keep feeding your mind.';
    else if (score >= 3) verdict = 'Your mind could use more fuel. Try importing more sources.';
    else verdict = 'Dormant. Time to wake up your knowledge base.';

    // === Mind diff (last 7 days) ===
    const recentMems = mems.filter(m => new Date(m.importedAt) > weekAgo);
    const topicCounts: Record<string, number> = {};
    for (const m of recentMems) {
      const topic = m.sourceTitle || m.content.slice(0, 50);
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    }

    return NextResponse.json({
      connections,
      contradictions,
      forgetting,
      metabolism: {
        score: Math.min(score, 10),
        intake: recentCount,
        connections: connections.length,
        searchFrequency: 0,
        verdict,
      },
      mindDiff: {
        newMemories: recentMems.length,
        topNewTopics: Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t),
        growthRate: recentMems.length / 7,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function extractBridgeConcept(textA: string, textB: string): string {
  const stopWords = new Set(['the', 'a', 'an', 'is', 'it', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but', 'not', 'with', 'this', 'that', 'from', 'by', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'i', 'you', 'he', 'she', 'we', 'they', 'my', 'your', 'his', 'her', 'our', 'their', 'me', 'him', 'us', 'them']);
  const wordsA = new Set(textA.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !stopWords.has(w)));
  const wordsB = new Set(textB.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !stopWords.has(w)));
  const common = [...wordsA].filter(w => wordsB.has(w));
  return common.slice(0, 3).join(', ') || 'related concepts';
}
