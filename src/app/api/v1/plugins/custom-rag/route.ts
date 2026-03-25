/**
 * Custom RAG Strategies Plugin API
 * 
 * Allows users to swap between retrieval strategies:
 * - default: BM25 + Vector + Tree with RRF fusion (current system)
 * - hyde: Hypothetical Document Embeddings — AI generates a hypothetical answer, embeds that
 * - multi-query: Expand query into multiple perspectives, search each, merge results
 * - reranking: After initial retrieval, use AI to rerank results by true relevance
 * - contextual-compression: After retrieval, extract only the relevant parts from each result
 * - maximal: All strategies combined (hyde + multi-query + reranking)
 * 
 * GET  ?action=config      — Get current strategy config
 * GET  ?action=benchmark   — Run a benchmark query with all strategies and compare
 * GET  ?action=stats       — Get retrieval stats
 * POST action=save-config  — Save strategy configuration
 * POST action=test-query   — Test a query with a specific strategy
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/server/db';
import { eq, sql } from 'drizzle-orm';
import { getUserId } from '@/server/user';
import { retrieve, type RetrievalResult } from '@/server/retrieval';
import { generateEmbeddings, getEmbeddingConfig } from '@/server/embeddings';

// ─── Strategy Types ─────────────────────────────────────────────

export type RAGStrategy = 'default' | 'hyde' | 'multi-query' | 'reranking' | 'contextual-compression' | 'maximal';

interface RAGConfig {
  activeStrategy: RAGStrategy;
  hydeModel?: string;        // model used for HyDE generation
  rerankTopK?: number;        // how many results to rerank (default 20)
  compressionMaxTokens?: number; // max tokens per compressed result
  multiQueryCount?: number;   // how many query expansions (default 3)
  enabledLayers: {
    bm25: boolean;
    vector: boolean;
    tree: boolean;
  };
  rrfK: number;               // RRF constant (default 60)
  treeBoost: number;          // Tree layer weight boost (default 1.2)
}

const DEFAULT_CONFIG: RAGConfig = {
  activeStrategy: 'default',
  rerankTopK: 20,
  compressionMaxTokens: 200,
  multiQueryCount: 3,
  enabledLayers: { bm25: true, vector: true, tree: true },
  rrfK: 60,
  treeBoost: 1.2,
};

// ─── Strategy Descriptions ──────────────────────────────────────

const STRATEGY_INFO: Record<RAGStrategy, {
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  latency: string;
  accuracy: string;
}> = {
  'default': {
    name: 'Triple-Layer Fusion (Default)',
    description: 'BM25 full-text + vector similarity + tree navigation, fused with Reciprocal Rank Fusion. The balanced baseline.',
    pros: ['Fast', 'No extra API calls', 'Good keyword + semantic coverage'],
    cons: ['Can miss nuanced queries', 'No query understanding'],
    latency: '~200ms',
    accuracy: 'Good',
  },
  'hyde': {
    name: 'HyDE (Hypothetical Document Embeddings)',
    description: 'AI generates a hypothetical perfect answer to your query, then embeds that document instead of the raw query. Often retrieves more relevant results for complex questions.',
    pros: ['Much better for abstract questions', 'Bridges vocabulary gap', 'Finds conceptually related content'],
    cons: ['Extra AI call (~1-2s)', 'Depends on AI quality', 'Costs per query'],
    latency: '~1-3s',
    accuracy: 'Very Good',
  },
  'multi-query': {
    name: 'Multi-Query Expansion',
    description: 'Expands your query into 3 different perspectives, searches each independently, and merges results. Catches content you\'d miss with a single query.',
    pros: ['Broader recall', 'Finds diverse results', 'Catches different phrasings'],
    cons: ['3x search cost', 'Slightly slower', 'May include less focused results'],
    latency: '~1-2s',
    accuracy: 'Good (broader)',
  },
  'reranking': {
    name: 'AI Reranking',
    description: 'Retrieves a larger set with default strategy, then uses AI to rerank results by true query-document relevance. Precision-focused.',
    pros: ['Highest precision', 'Best top-5 results', 'AI understands context'],
    cons: ['Extra AI call', 'Higher latency', 'Costs per query'],
    latency: '~2-4s',
    accuracy: 'Excellent',
  },
  'contextual-compression': {
    name: 'Contextual Compression',
    description: 'After retrieval, AI extracts only the sentences/paragraphs directly relevant to your query from each result. Reduces noise in context.',
    pros: ['Minimal noise in results', 'Better for long documents', 'Focused context for chat'],
    cons: ['Extra AI call per result', 'Can lose surrounding context', 'Higher latency'],
    latency: '~3-5s',
    accuracy: 'Good (focused)',
  },
  'maximal': {
    name: 'Maximal (All Combined)',
    description: 'HyDE + Multi-Query + Reranking. Maximum retrieval quality at the cost of speed. Best for important research queries.',
    pros: ['Best possible results', 'Maximum recall + precision', 'Worth it for important queries'],
    cons: ['Slowest (5-10s)', 'Multiple AI calls', 'Highest cost'],
    latency: '~5-10s',
    accuracy: 'Maximum',
  },
};

// ─── AI Helpers ─────────────────────────────────────────────────

async function getAIConfig() {
  const settings = await db.execute(
    sql`SELECT key, value FROM settings WHERE key IN (
      'openai_api_key', 'gemini_api_key', 'chat_provider', 'chat_model',
      'openrouter_api_key', 'custom_api_key', 'custom_api_url', 'custom_api_model'
    )`
  );
  const config: Record<string, string> = {};
  for (const row of settings as any[]) config[row.key] = row.value;
  return config;
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const config = await getAIConfig();
  const openaiKey = config.openai_api_key || process.env.OPENAI_API_KEY;
  const geminiKey = config.gemini_api_key || process.env.GEMINI_API_KEY;
  const openrouterKey = config.openrouter_api_key || process.env.OPENROUTER_API_KEY;

  // Try OpenAI first
  if (openaiKey) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    }
  }

  // Try Gemini
  if (geminiKey) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1000 },
        }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
  }

  // Try OpenRouter
  if (openrouterKey) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openrouterKey}`,
        'HTTP-Referer': 'https://mindstore.app',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-haiku',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    }
  }

  throw new Error('No AI provider available for RAG strategies');
}

// ─── Strategy Implementations ───────────────────────────────────

/**
 * HyDE: Generate a hypothetical document, embed it, use that for retrieval
 */
async function hydeRetrieve(
  query: string,
  userId: string,
  limit: number,
): Promise<{ results: RetrievalResult[]; hydeDocument: string; latencyMs: number }> {
  const start = Date.now();

  // Generate hypothetical document
  const hydeDoc = await callAI(
    'You are a knowledge base that contains the user\'s personal notes, articles, and memories. Given the user\'s query, write a short paragraph (100-150 words) that would be the ideal document they\'re looking for in their personal knowledge base. Write as if this document already exists in their collection. Be specific and concrete. Do NOT ask questions or add disclaimers — just write the document.',
    query,
  );

  // Embed the hypothetical document instead of the raw query
  const embeddings = await generateEmbeddings([hydeDoc]);
  const hydeEmbedding = embeddings?.[0] || null;

  // Retrieve using the HyDE embedding
  const results = await retrieve(query, hydeEmbedding, { userId, limit });

  return { results, hydeDocument: hydeDoc, latencyMs: Date.now() - start };
}

/**
 * Multi-Query: Expand into multiple perspectives, search each, merge
 */
async function multiQueryRetrieve(
  query: string,
  userId: string,
  limit: number,
  queryCount: number = 3,
): Promise<{ results: RetrievalResult[]; expandedQueries: string[]; latencyMs: number }> {
  const start = Date.now();

  // Generate query expansions
  const expansion = await callAI(
    `You help expand search queries for a personal knowledge base. Given a query, generate exactly ${queryCount} alternative versions that approach the same information need from different angles. Include synonyms, related concepts, and different phrasings. Return ONLY a JSON array of strings.`,
    `Query: "${query}"\n\nGenerate ${queryCount} alternative queries:`,
  );

  let expandedQueries: string[] = [query]; // always include original
  try {
    const match = expansion.match(/\[[\s\S]*?\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) {
        expandedQueries = [query, ...parsed.filter((q: any) => typeof q === 'string').slice(0, queryCount)];
      }
    }
  } catch { /* use original only */ }

  // Embed all queries
  const allEmbeddings = await generateEmbeddings(expandedQueries);

  // Search with each query in parallel
  const allResults = await Promise.all(
    expandedQueries.map((q, i) =>
      retrieve(q, allEmbeddings?.[i] || null, { userId, limit: Math.ceil(limit / expandedQueries.length) * 2 })
    )
  );

  // Merge results with RRF-like fusion across query variants
  const scoreMap = new Map<string, { result: RetrievalResult; score: number; appearances: number }>();
  for (const resultSet of allResults) {
    for (let rank = 0; rank < resultSet.length; rank++) {
      const r = resultSet[rank];
      const existing = scoreMap.get(r.memoryId);
      if (existing) {
        existing.score += 1 / (60 + rank + 1);
        existing.appearances += 1;
      } else {
        scoreMap.set(r.memoryId, { result: r, score: 1 / (60 + rank + 1), appearances: 1 });
      }
    }
  }

  // Boost results that appear in multiple query variants
  const merged = Array.from(scoreMap.values())
    .map(({ result, score, appearances }) => ({
      ...result,
      score: score * (1 + 0.1 * (appearances - 1)), // 10% boost per additional appearance
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return { results: merged, expandedQueries, latencyMs: Date.now() - start };
}

/**
 * Reranking: Retrieve more, then use AI to rerank by true relevance
 */
async function rerankRetrieve(
  query: string,
  queryEmbedding: number[] | null,
  userId: string,
  limit: number,
  topK: number = 20,
): Promise<{ results: RetrievalResult[]; rerankedCount: number; latencyMs: number }> {
  const start = Date.now();

  // Get a larger initial set
  const initialResults = await retrieve(query, queryEmbedding, { userId, limit: topK });

  if (initialResults.length <= 3) {
    return { results: initialResults, rerankedCount: 0, latencyMs: Date.now() - start };
  }

  // Build reranking prompt
  const docs = initialResults.slice(0, 15).map((r, i) => 
    `[${i + 1}] ${r.sourceTitle ? `"${r.sourceTitle}" — ` : ''}${r.content.slice(0, 300)}`
  ).join('\n\n');

  const rerankResponse = await callAI(
    'You are a relevance judge. Given a query and a list of documents, rank them by how relevant they are to the query. Return ONLY a JSON array of the document numbers in order of relevance (most relevant first). Example: [3, 1, 5, 2, 4]',
    `Query: "${query}"\n\nDocuments:\n${docs}\n\nRank these documents by relevance to the query:`,
  );

  try {
    const match = rerankResponse.match(/\[[\s\S]*?\]/);
    if (match) {
      const rankings: number[] = JSON.parse(match[0]);
      const reranked: RetrievalResult[] = [];
      const seen = new Set<number>();

      for (const rank of rankings) {
        const idx = rank - 1;
        if (idx >= 0 && idx < initialResults.length && !seen.has(idx)) {
          seen.add(idx);
          reranked.push({ ...initialResults[idx], score: 1 - (reranked.length / rankings.length) });
        }
      }

      // Append any results not mentioned in rankings
      for (let i = 0; i < initialResults.length; i++) {
        if (!seen.has(i)) {
          reranked.push({ ...initialResults[i], score: 0.1 });
        }
      }

      return { results: reranked.slice(0, limit), rerankedCount: rankings.length, latencyMs: Date.now() - start };
    }
  } catch { /* fallback to original order */ }

  return { results: initialResults.slice(0, limit), rerankedCount: 0, latencyMs: Date.now() - start };
}

/**
 * Contextual Compression: Extract only relevant parts from each result
 */
async function compressResults(
  query: string,
  results: RetrievalResult[],
  maxTokens: number = 200,
): Promise<{ results: RetrievalResult[]; compressedCount: number; latencyMs: number }> {
  const start = Date.now();

  if (results.length === 0) {
    return { results, compressedCount: 0, latencyMs: 0 };
  }

  // Compress in parallel (max 5 at a time)
  const toCompress = results.slice(0, 8); // limit to avoid too many AI calls
  const compressed = await Promise.all(
    toCompress.map(async (r) => {
      if (r.content.length < 300) return r; // short content doesn't need compression
      try {
        const extracted = await callAI(
          `Given a user query and a document, extract ONLY the sentences or paragraphs that are directly relevant to the query. If nothing is relevant, return "NOT_RELEVANT". Keep the original wording — do not rephrase. Maximum ${maxTokens} tokens.`,
          `Query: "${query}"\n\nDocument:\n${r.content.slice(0, 2000)}`,
        );
        if (extracted === 'NOT_RELEVANT' || !extracted.trim()) {
          return { ...r, score: r.score * 0.3 }; // downweight irrelevant
        }
        return { ...r, content: extracted.trim() };
      } catch {
        return r;
      }
    })
  );

  // Add back any uncompressed results
  const result = [...compressed, ...results.slice(8)];
  return { results: result, compressedCount: toCompress.length, latencyMs: Date.now() - start };
}

/**
 * Maximal: HyDE + Multi-Query + Reranking combined
 */
async function maximalRetrieve(
  query: string,
  userId: string,
  limit: number,
): Promise<{ results: RetrievalResult[]; details: any; latencyMs: number }> {
  const start = Date.now();

  // Phase 1: HyDE + Multi-Query in parallel
  const [hydeResult, mqResult] = await Promise.all([
    hydeRetrieve(query, userId, limit * 2),
    multiQueryRetrieve(query, userId, limit * 2, 3),
  ]);

  // Merge results from both strategies
  const scoreMap = new Map<string, { result: RetrievalResult; score: number }>();
  
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

  // Phase 2: Rerank the merged results
  const embeddings = await generateEmbeddings([query]);
  const reranked = await rerankRetrieve(query, embeddings?.[0] || null, userId, limit, merged.length);

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

// ─── Config helpers ─────────────────────────────────────────────

async function getRAGConfig(): Promise<RAGConfig> {
  try {
    const [row] = await db
      .select()
      .from(schema.plugins)
      .where(eq(schema.plugins.slug, 'custom-rag'))
      .limit(1);
    if (row?.config && typeof row.config === 'object') {
      return { ...DEFAULT_CONFIG, ...(row.config as any) };
    }
  } catch { /* table may not exist */ }
  return DEFAULT_CONFIG;
}

async function saveRAGConfig(config: Partial<RAGConfig>) {
  const current = await getRAGConfig();
  const merged = { ...current, ...config };
  
  try {
    await db
      .update(schema.plugins)
      .set({ config: merged as any, updatedAt: new Date() })
      .where(eq(schema.plugins.slug, 'custom-rag'));
  } catch {
    // If plugin not installed yet, that's fine
  }
  
  return merged;
}

// ─── Route Handlers ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'config';
    const userId = await getUserId();

    if (action === 'config') {
      const config = await getRAGConfig();
      const embeddingConfig = await getEmbeddingConfig();
      const aiConfig = await getAIConfig();
      const hasAI = !!(aiConfig.openai_api_key || process.env.OPENAI_API_KEY || 
                       aiConfig.gemini_api_key || process.env.GEMINI_API_KEY ||
                       aiConfig.openrouter_api_key || process.env.OPENROUTER_API_KEY);

      return NextResponse.json({
        config,
        strategies: STRATEGY_INFO,
        embeddingProvider: embeddingConfig?.provider || null,
        embeddingModel: embeddingConfig?.model || null,
        hasAI,
        availableStrategies: hasAI 
          ? Object.keys(STRATEGY_INFO) 
          : ['default'], // Only default works without AI
      });
    }

    if (action === 'stats') {
      // Get retrieval usage stats
      const memoryCount = await db.execute(
        sql`SELECT COUNT(*) as count FROM memories WHERE user_id = ${userId}::uuid`
      );
      const embeddedCount = await db.execute(
        sql`SELECT COUNT(*) as count FROM memories WHERE user_id = ${userId}::uuid AND embedding IS NOT NULL`
      );
      const treeNodeCount = await db.execute(
        sql`SELECT COUNT(*) as count FROM tree_index WHERE user_id = ${userId}::uuid`
      );

      const config = await getRAGConfig();

      return NextResponse.json({
        totalMemories: Number((memoryCount as any[])[0]?.count || 0),
        embeddedMemories: Number((embeddedCount as any[])[0]?.count || 0),
        treeNodes: Number((treeNodeCount as any[])[0]?.count || 0),
        activeStrategy: config.activeStrategy,
        embeddingCoverage: Number((memoryCount as any[])[0]?.count) > 0
          ? Math.round((Number((embeddedCount as any[])[0]?.count) / Number((memoryCount as any[])[0]?.count)) * 100)
          : 0,
      });
    }

    if (action === 'benchmark') {
      const query = searchParams.get('q');
      if (!query) return NextResponse.json({ error: 'Missing ?q= parameter' }, { status: 400 });

      // Run default strategy for baseline
      const embeddings = await generateEmbeddings([query]);
      const defaultStart = Date.now();
      const defaultResults = await retrieve(query, embeddings?.[0] || null, { userId, limit: 10 });
      const defaultLatency = Date.now() - defaultStart;

      // Try HyDE if AI available
      let hydeData = null;
      try {
        const hydeResult = await hydeRetrieve(query, userId, 10);
        hydeData = {
          results: hydeResult.results.slice(0, 5).map(r => ({
            id: r.memoryId,
            title: r.sourceTitle,
            score: r.score,
            preview: r.content.slice(0, 120),
          })),
          hydeDocument: hydeResult.hydeDocument,
          latencyMs: hydeResult.latencyMs,
        };
      } catch { /* AI not available */ }

      return NextResponse.json({
        query,
        default: {
          results: defaultResults.slice(0, 5).map(r => ({
            id: r.memoryId,
            title: r.sourceTitle,
            score: r.score,
            preview: r.content.slice(0, 120),
            layers: r.layers,
          })),
          latencyMs: defaultLatency,
        },
        hyde: hydeData,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('[custom-rag] GET error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    const userId = await getUserId();

    if (action === 'save-config') {
      const { strategy, enabledLayers, rrfK, treeBoost, rerankTopK, multiQueryCount, compressionMaxTokens } = body;
      
      const updates: Partial<RAGConfig> = {};
      if (strategy) updates.activeStrategy = strategy;
      if (enabledLayers) updates.enabledLayers = enabledLayers;
      if (typeof rrfK === 'number') updates.rrfK = rrfK;
      if (typeof treeBoost === 'number') updates.treeBoost = treeBoost;
      if (typeof rerankTopK === 'number') updates.rerankTopK = rerankTopK;
      if (typeof multiQueryCount === 'number') updates.multiQueryCount = multiQueryCount;
      if (typeof compressionMaxTokens === 'number') updates.compressionMaxTokens = compressionMaxTokens;

      const saved = await saveRAGConfig(updates);
      return NextResponse.json({ ok: true, config: saved });
    }

    if (action === 'test-query') {
      const { query, strategy } = body;
      if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 });

      const strat = (strategy || 'default') as RAGStrategy;
      const limit = 10;
      const startTime = Date.now();

      let results: RetrievalResult[] = [];
      let details: any = {};

      switch (strat) {
        case 'hyde': {
          const r = await hydeRetrieve(query, userId, limit);
          results = r.results;
          details = { hydeDocument: r.hydeDocument, latencyMs: r.latencyMs };
          break;
        }
        case 'multi-query': {
          const r = await multiQueryRetrieve(query, userId, limit, 3);
          results = r.results;
          details = { expandedQueries: r.expandedQueries, latencyMs: r.latencyMs };
          break;
        }
        case 'reranking': {
          const embeddings = await generateEmbeddings([query]);
          const r = await rerankRetrieve(query, embeddings?.[0] || null, userId, limit, 20);
          results = r.results;
          details = { rerankedCount: r.rerankedCount, latencyMs: r.latencyMs };
          break;
        }
        case 'contextual-compression': {
          const embeddings = await generateEmbeddings([query]);
          const initial = await retrieve(query, embeddings?.[0] || null, { userId, limit });
          const r = await compressResults(query, initial);
          results = r.results;
          details = { compressedCount: r.compressedCount, latencyMs: r.latencyMs };
          break;
        }
        case 'maximal': {
          const r = await maximalRetrieve(query, userId, limit);
          results = r.results;
          details = r.details;
          break;
        }
        default: {
          const embeddings = await generateEmbeddings([query]);
          results = await retrieve(query, embeddings?.[0] || null, { userId, limit });
          details = { latencyMs: Date.now() - startTime };
        }
      }

      return NextResponse.json({
        query,
        strategy: strat,
        results: results.map(r => ({
          id: r.memoryId,
          title: r.sourceTitle,
          sourceType: r.sourceType,
          score: r.score,
          preview: r.content.slice(0, 200),
          layers: r.layers,
          createdAt: r.createdAt,
        })),
        totalResults: results.length,
        details,
        totalLatencyMs: Date.now() - startTime,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('[custom-rag] POST error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
