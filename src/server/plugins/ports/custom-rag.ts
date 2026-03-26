/**
 * Custom RAG Strategies — Portable Logic
 *
 * Swappable retrieval strategies:
 * - default: BM25 + Vector + Tree with RRF fusion
 * - hyde: Hypothetical Document Embeddings
 * - multi-query: Expand query into multiple perspectives
 * - reranking: AI reranks initial results by true relevance
 * - contextual-compression: Extract only relevant parts
 * - maximal: HyDE + Multi-Query + Reranking combined
 *
 * AI calls are injected via `callAI` parameter.
 * Retrieval is injected via `retrieve` + `generateEmbeddings` parameters.
 */

// ─── Types ──────────────────────────────────────────────────────

export type RAGStrategy =
  | 'default'
  | 'hyde'
  | 'multi-query'
  | 'reranking'
  | 'contextual-compression'
  | 'maximal';

export interface RAGConfig {
  activeStrategy: RAGStrategy;
  hydeModel?: string;
  rerankTopK?: number;
  compressionMaxTokens?: number;
  multiQueryCount?: number;
  enabledLayers: { bm25: boolean; vector: boolean; tree: boolean };
  rrfK: number;
  treeBoost: number;
}

export interface RetrievalResult {
  memoryId: string;
  content: string;
  sourceTitle: string;
  sourceType?: string;
  score: number;
  layers?: string[];
  createdAt?: string;
}

export interface StrategyInfo {
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  latency: string;
  accuracy: string;
}

// ─── Injected Dependencies ──────────────────────────────────────

export type CallAI = (
  systemPrompt: string,
  userPrompt: string,
) => Promise<string>;

export type RetrieveFn = (
  query: string,
  embedding: number[] | null,
  opts: { userId: string; limit: number },
) => Promise<RetrievalResult[]>;

export type EmbedFn = (
  texts: string[],
) => Promise<number[][] | null>;

// ─── Constants ──────────────────────────────────────────────────

export const DEFAULT_CONFIG: RAGConfig = {
  activeStrategy: 'default',
  rerankTopK: 20,
  compressionMaxTokens: 200,
  multiQueryCount: 3,
  enabledLayers: { bm25: true, vector: true, tree: true },
  rrfK: 60,
  treeBoost: 1.2,
};

export const STRATEGY_INFO: Record<RAGStrategy, StrategyInfo> = {
  default: {
    name: 'Triple-Layer Fusion (Default)',
    description:
      'BM25 full-text + vector similarity + tree navigation, fused with Reciprocal Rank Fusion.',
    pros: ['Fast', 'No extra API calls', 'Good keyword + semantic coverage'],
    cons: ['Can miss nuanced queries', 'No query understanding'],
    latency: '~200ms',
    accuracy: 'Good',
  },
  hyde: {
    name: 'HyDE (Hypothetical Document Embeddings)',
    description:
      'AI generates a hypothetical perfect answer, embeds that document for retrieval.',
    pros: [
      'Much better for abstract questions',
      'Bridges vocabulary gap',
      'Finds conceptually related content',
    ],
    cons: ['Extra AI call (~1-2s)', 'Depends on AI quality', 'Costs per query'],
    latency: '~1-3s',
    accuracy: 'Very Good',
  },
  'multi-query': {
    name: 'Multi-Query Expansion',
    description:
      'Expands query into 3 perspectives, searches each independently, merges results.',
    pros: ['Broader recall', 'Finds diverse results', 'Catches different phrasings'],
    cons: ['3x search cost', 'Slightly slower', 'May include less focused results'],
    latency: '~1-2s',
    accuracy: 'Good (broader)',
  },
  reranking: {
    name: 'AI Reranking',
    description:
      'Retrieves a larger set, then uses AI to rerank by true relevance.',
    pros: ['Highest precision', 'Best top-5 results', 'AI understands context'],
    cons: ['Extra AI call', 'Higher latency', 'Costs per query'],
    latency: '~2-4s',
    accuracy: 'Excellent',
  },
  'contextual-compression': {
    name: 'Contextual Compression',
    description:
      'After retrieval, AI extracts only directly relevant sentences from each result.',
    pros: [
      'Minimal noise in results',
      'Better for long documents',
      'Focused context for chat',
    ],
    cons: [
      'Extra AI call per result',
      'Can lose surrounding context',
      'Higher latency',
    ],
    latency: '~3-5s',
    accuracy: 'Good (focused)',
  },
  maximal: {
    name: 'Maximal (All Combined)',
    description:
      'HyDE + Multi-Query + Reranking. Maximum quality at the cost of speed.',
    pros: [
      'Best possible results',
      'Maximum recall + precision',
      'Worth it for important queries',
    ],
    cons: ['Slowest (5-10s)', 'Multiple AI calls', 'Highest cost'],
    latency: '~5-10s',
    accuracy: 'Maximum',
  },
};

// ─── Config Persistence ─────────────────────────────────────────

import { db, schema } from '@/server/db';
import { eq, sql } from 'drizzle-orm';

export async function getRAGConfig(): Promise<RAGConfig> {
  try {
    const [row] = await db
      .select()
      .from(schema.plugins)
      .where(eq(schema.plugins.slug, 'custom-rag'))
      .limit(1);
    if (row?.config && typeof row.config === 'object')
      return { ...DEFAULT_CONFIG, ...(row.config as any) };
  } catch {}
  return DEFAULT_CONFIG;
}

export async function saveRAGConfig(
  updates: Partial<RAGConfig>,
): Promise<RAGConfig> {
  const current = await getRAGConfig();
  const merged = { ...current, ...updates };
  try {
    await db
      .update(schema.plugins)
      .set({ config: merged as any, updatedAt: new Date() })
      .where(eq(schema.plugins.slug, 'custom-rag'));
  } catch {}
  return merged;
}

export async function getRAGStats(userId: string) {
  const memoryCount = await db.execute(
    sql`SELECT COUNT(*) as count FROM memories WHERE user_id = ${userId}::uuid`,
  );
  const embeddedCount = await db.execute(
    sql`SELECT COUNT(*) as count FROM memories WHERE user_id = ${userId}::uuid AND embedding IS NOT NULL`,
  );
  const treeNodeCount = await db.execute(
    sql`SELECT COUNT(*) as count FROM tree_index WHERE user_id = ${userId}::uuid`,
  );
  const config = await getRAGConfig();
  const total = Number((memoryCount as any[])[0]?.count || 0);
  const embedded = Number((embeddedCount as any[])[0]?.count || 0);
  return {
    totalMemories: total,
    embeddedMemories: embedded,
    treeNodes: Number((treeNodeCount as any[])[0]?.count || 0),
    activeStrategy: config.activeStrategy,
    embeddingCoverage: total > 0 ? Math.round((embedded / total) * 100) : 0,
  };
}

// ─── Strategy Implementations ───────────────────────────────────

/** HyDE: Generate hypothetical doc → embed → retrieve */
export async function hydeRetrieve(
  query: string,
  userId: string,
  limit: number,
  deps: { callAI: CallAI; embed: EmbedFn; retrieve: RetrieveFn },
): Promise<{
  results: RetrievalResult[];
  hydeDocument: string;
  latencyMs: number;
}> {
  const start = Date.now();

  const hydeDoc = await deps.callAI(
    'You are a knowledge base that contains the user\'s personal notes. Given the query, write a short paragraph (100-150 words) that would be the ideal document. Be specific and concrete. Do NOT add disclaimers.',
    query,
  );

  const embeddings = await deps.embed([hydeDoc]);
  const hydeEmbedding = embeddings?.[0] || null;
  const results = await deps.retrieve(query, hydeEmbedding, { userId, limit });

  return { results, hydeDocument: hydeDoc, latencyMs: Date.now() - start };
}

/** Multi-Query: expand → search each → RRF merge */
export async function multiQueryRetrieve(
  query: string,
  userId: string,
  limit: number,
  queryCount: number,
  deps: { callAI: CallAI; embed: EmbedFn; retrieve: RetrieveFn },
): Promise<{
  results: RetrievalResult[];
  expandedQueries: string[];
  latencyMs: number;
}> {
  const start = Date.now();

  const expansion = await deps.callAI(
    `Generate exactly ${queryCount} alternative search queries for a personal knowledge base. Return ONLY a JSON array of strings.`,
    `Query: "${query}"\n\nGenerate ${queryCount} alternatives:`,
  );

  let expandedQueries: string[] = [query];
  try {
    const match = expansion.match(/\[[\s\S]*?\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) {
        expandedQueries = [
          query,
          ...parsed
            .filter((q: any) => typeof q === 'string')
            .slice(0, queryCount),
        ];
      }
    }
  } catch {
    /* use original only */
  }

  const allEmbeddings = await deps.embed(expandedQueries);

  const allResults = await Promise.all(
    expandedQueries.map((q, i) =>
      deps.retrieve(q, allEmbeddings?.[i] || null, {
        userId,
        limit: Math.ceil(limit / expandedQueries.length) * 2,
      }),
    ),
  );

  // RRF merge
  const scoreMap = new Map<
    string,
    { result: RetrievalResult; score: number; appearances: number }
  >();
  for (const resultSet of allResults) {
    for (let rank = 0; rank < resultSet.length; rank++) {
      const r = resultSet[rank];
      const existing = scoreMap.get(r.memoryId);
      if (existing) {
        existing.score += 1 / (60 + rank + 1);
        existing.appearances += 1;
      } else {
        scoreMap.set(r.memoryId, {
          result: r,
          score: 1 / (60 + rank + 1),
          appearances: 1,
        });
      }
    }
  }

  const merged = Array.from(scoreMap.values())
    .map(({ result, score, appearances }) => ({
      ...result,
      score: score * (1 + 0.1 * (appearances - 1)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return { results: merged, expandedQueries, latencyMs: Date.now() - start };
}

/** Reranking: get N results → AI reranks by relevance */
export async function rerankRetrieve(
  query: string,
  queryEmbedding: number[] | null,
  userId: string,
  limit: number,
  topK: number,
  deps: { callAI: CallAI; retrieve: RetrieveFn },
): Promise<{
  results: RetrievalResult[];
  rerankedCount: number;
  latencyMs: number;
}> {
  const start = Date.now();
  const initialResults = await deps.retrieve(query, queryEmbedding, {
    userId,
    limit: topK,
  });

  if (initialResults.length <= 3) {
    return {
      results: initialResults,
      rerankedCount: 0,
      latencyMs: Date.now() - start,
    };
  }

  const docs = initialResults
    .slice(0, 15)
    .map(
      (r, i) =>
        `[${i + 1}] ${r.sourceTitle ? `"${r.sourceTitle}" — ` : ''}${r.content.slice(0, 300)}`,
    )
    .join('\n\n');

  const response = await deps.callAI(
    'Rank these documents by relevance. Return ONLY a JSON array of document numbers in order of relevance (most relevant first).',
    `Query: "${query}"\n\nDocuments:\n${docs}`,
  );

  try {
    const match = response.match(/\[[\s\S]*?\]/);
    if (match) {
      const rankings: number[] = JSON.parse(match[0]);
      const reranked: RetrievalResult[] = [];
      const seen = new Set<number>();

      for (const rank of rankings) {
        const idx = rank - 1;
        if (idx >= 0 && idx < initialResults.length && !seen.has(idx)) {
          seen.add(idx);
          reranked.push({
            ...initialResults[idx],
            score: 1 - reranked.length / rankings.length,
          });
        }
      }

      for (let i = 0; i < initialResults.length; i++) {
        if (!seen.has(i))
          reranked.push({ ...initialResults[i], score: 0.1 });
      }

      return {
        results: reranked.slice(0, limit),
        rerankedCount: rankings.length,
        latencyMs: Date.now() - start,
      };
    }
  } catch {
    /* fallback */
  }

  return {
    results: initialResults.slice(0, limit),
    rerankedCount: 0,
    latencyMs: Date.now() - start,
  };
}

/** Contextual Compression: extract only relevant parts from each result */
export async function compressResults(
  query: string,
  results: RetrievalResult[],
  maxTokens: number,
  deps: { callAI: CallAI },
): Promise<{
  results: RetrievalResult[];
  compressedCount: number;
  latencyMs: number;
}> {
  const start = Date.now();
  if (results.length === 0) return { results, compressedCount: 0, latencyMs: 0 };

  const toCompress = results.slice(0, 8);
  const compressed = await Promise.all(
    toCompress.map(async (r) => {
      if (r.content.length < 300) return r;
      try {
        const extracted = await deps.callAI(
          `Extract ONLY sentences directly relevant to the query. If nothing is relevant, return "NOT_RELEVANT". Max ${maxTokens} tokens.`,
          `Query: "${query}"\n\nDocument:\n${r.content.slice(0, 2000)}`,
        );
        if (extracted === 'NOT_RELEVANT' || !extracted.trim()) {
          return { ...r, score: r.score * 0.3 };
        }
        return { ...r, content: extracted.trim() };
      } catch {
        return r;
      }
    }),
  );

  return {
    results: [...compressed, ...results.slice(8)],
    compressedCount: toCompress.length,
    latencyMs: Date.now() - start,
  };
}

/** Maximal: HyDE + Multi-Query + Reranking */
export async function maximalRetrieve(
  query: string,
  userId: string,
  limit: number,
  deps: { callAI: CallAI; embed: EmbedFn; retrieve: RetrieveFn },
): Promise<{
  results: RetrievalResult[];
  details: Record<string, unknown>;
  latencyMs: number;
}> {
  const start = Date.now();

  const [hydeResult, mqResult] = await Promise.all([
    hydeRetrieve(query, userId, limit * 2, deps),
    multiQueryRetrieve(query, userId, limit * 2, 3, deps),
  ]);

  // Merge
  const scoreMap = new Map<
    string,
    { result: RetrievalResult; score: number }
  >();

  for (let i = 0; i < hydeResult.results.length; i++) {
    const r = hydeResult.results[i];
    scoreMap.set(r.memoryId, { result: r, score: 1 / (60 + i + 1) });
  }

  for (let i = 0; i < mqResult.results.length; i++) {
    const r = mqResult.results[i];
    const existing = scoreMap.get(r.memoryId);
    if (existing) {
      existing.score += 1 / (60 + i + 1);
    } else {
      scoreMap.set(r.memoryId, { result: r, score: 1 / (60 + i + 1) });
    }
  }

  const merged = Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit * 2)
    .map(({ result, score }) => ({ ...result, score }));

  // Rerank
  const embeddings = await deps.embed([query]);
  const reranked = await rerankRetrieve(
    query,
    embeddings?.[0] || null,
    userId,
    limit,
    merged.length,
    deps,
  );

  return {
    results: reranked.results,
    details: {
      hydeDocument: hydeResult.hydeDocument,
      expandedQueries: mqResult.expandedQueries,
      rerankedCount: reranked.rerankedCount,
      hydeLatency: hydeResult.latencyMs,
      multiQueryLatency: mqResult.latencyMs,
      rerankLatency: reranked.latencyMs,
    },
    latencyMs: Date.now() - start,
  };
}
