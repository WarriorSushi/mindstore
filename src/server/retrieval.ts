/**
 * TRIPLE-LAYER FUSION RETRIEVAL ENGINE
 * 
 * MindStore's core retrieval innovation. Combines three search strategies
 * and fuses results using Reciprocal Rank Fusion (RRF).
 * 
 * Layer 1: BM25 Full-Text Search (PostgreSQL tsvector + ts_rank_cd)
 *   - Exact keyword matching, phrase search
 *   - Great for: "find my notes about PostgreSQL"
 * 
 * Layer 2: Vector Similarity Search (pgvector cosine distance)
 *   - Semantic meaning matching via embeddings
 *   - Great for: "how do I feel about remote work" (no exact keywords needed)
 * 
 * Layer 3: Tree-Navigated Retrieval (PageIndex-inspired)
 *   - Navigate hierarchical knowledge structure
 *   - Find the right "section" of your mind first, then drill into memories
 *   - Great for: complex queries that need context about document structure
 * 
 * Fusion: Reciprocal Rank Fusion (RRF)
 *   score(d) = Σ 1/(k + rank_i(d)) for each layer where d appears
 *   k = 60 (standard constant)
 * 
 * This beats any single retrieval method. Period.
 */

import { db, schema } from './db';
import { sql, desc, eq, and, ilike } from 'drizzle-orm';

export interface RetrievalResult {
  memoryId: string;
  content: string;
  sourceType: string;
  sourceTitle: string | null;
  score: number;
  layers: {
    bm25?: { rank: number; score: number };
    vector?: { rank: number; score: number };
    tree?: { rank: number; score: number; path: string };
  };
  metadata: Record<string, unknown>;
  createdAt: Date | null;
}

interface RetrievalOptions {
  userId: string;
  limit?: number;
  sourceTypes?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  contentTypes?: string[];
}

const RRF_K = 60; // Standard RRF constant

/**
 * Main retrieval function — runs all three layers and fuses results
 */
export async function retrieve(
  query: string,
  queryEmbedding: number[] | null,
  options: RetrievalOptions
): Promise<RetrievalResult[]> {
  const { userId, limit = 20, sourceTypes, dateFrom, dateTo } = options;

  // Run all three layers in parallel
  const [bm25Results, vectorResults, treeResults] = await Promise.all([
    searchBM25(query, userId, limit * 2, sourceTypes, dateFrom, dateTo),
    queryEmbedding ? searchVector(queryEmbedding, userId, limit * 2, sourceTypes, dateFrom, dateTo) : [],
    queryEmbedding ? searchTree(queryEmbedding, userId, limit) : [],
  ]);

  // Fuse results using RRF
  return fuseResults(bm25Results, vectorResults, treeResults, limit);
}

/**
 * Layer 1: BM25 Full-Text Search
 * Uses PostgreSQL's built-in tsvector + ts_rank_cd for BM25-like ranking
 */
async function searchBM25(
  query: string,
  userId: string,
  limit: number,
  sourceTypes?: string[],
  dateFrom?: Date,
  dateTo?: Date,
): Promise<Array<{ memoryId: string; rank: number; score: number; content: string; sourceType: string; sourceTitle: string | null; metadata: any; createdAt: Date | null }>> {
  // Convert query to tsquery format
  // Use OR between terms for broader recall — RRF ranking will sort quality
  const tsQuery = query
    .split(/\s+/)
    .filter(w => w.length > 1)
    .map(w => w.replace(/[^\w]/g, ''))
    .filter(Boolean)
    .join(' | ');

  if (!tsQuery) return [];

  const conditions = [
    sql`m.user_id = ${userId}::uuid`,
    sql`to_tsvector('english', m.content) @@ to_tsquery('english', ${tsQuery})`,
  ];

  if (sourceTypes?.length) {
    conditions.push(sql`m.source_type = ANY(${sourceTypes})`);
  }
  if (dateFrom) {
    conditions.push(sql`m.created_at >= ${dateFrom}`);
  }
  if (dateTo) {
    conditions.push(sql`m.created_at <= ${dateTo}`);
  }

  const whereClause = sql.join(conditions, sql` AND `);

  const results = await db.execute(sql`
    SELECT 
      m.id as memory_id,
      m.content,
      m.source_type,
      m.source_title,
      m.metadata,
      m.created_at,
      ts_rank_cd(to_tsvector('english', m.content), to_tsquery('english', ${tsQuery})) as rank_score
    FROM memories m
    WHERE ${whereClause}
    ORDER BY rank_score DESC
    LIMIT ${limit}
  `);

  return (results as any[]).map((r, i) => ({
    memoryId: r.memory_id,
    rank: i + 1,
    score: r.rank_score,
    content: r.content,
    sourceType: r.source_type,
    sourceTitle: r.source_title,
    metadata: r.metadata || {},
    createdAt: r.created_at,
  }));
}

/**
 * Layer 2: Vector Similarity Search
 * Uses pgvector cosine distance for semantic search
 */
async function searchVector(
  queryEmbedding: number[],
  userId: string,
  limit: number,
  sourceTypes?: string[],
  dateFrom?: Date,
  dateTo?: Date,
): Promise<Array<{ memoryId: string; rank: number; score: number; content: string; sourceType: string; sourceTitle: string | null; metadata: any; createdAt: Date | null }>> {
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  const conditions = [
    sql`m.user_id = ${userId}::uuid`,
    sql`m.embedding IS NOT NULL`,
  ];

  if (sourceTypes?.length) {
    conditions.push(sql`m.source_type = ANY(${sourceTypes})`);
  }
  if (dateFrom) {
    conditions.push(sql`m.created_at >= ${dateFrom}`);
  }
  if (dateTo) {
    conditions.push(sql`m.created_at <= ${dateTo}`);
  }

  const whereClause = sql.join(conditions, sql` AND `);

  const results = await db.execute(sql`
    SELECT 
      m.id as memory_id,
      m.content,
      m.source_type,
      m.source_title,
      m.metadata,
      m.created_at,
      1 - (m.embedding <=> ${embeddingStr}::vector) as similarity
    FROM memories m
    WHERE ${whereClause}
    ORDER BY m.embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `);

  return (results as any[]).map((r, i) => ({
    memoryId: r.memory_id,
    rank: i + 1,
    score: r.similarity,
    content: r.content,
    sourceType: r.source_type,
    sourceTitle: r.source_title,
    metadata: r.metadata || {},
    createdAt: r.created_at,
  }));
}

/**
 * Layer 3: Tree-Navigated Retrieval (PageIndex-inspired)
 * Navigate hierarchical knowledge structure to find relevant sections,
 * then return memories from those sections
 */
async function searchTree(
  queryEmbedding: number[],
  userId: string,
  limit: number,
): Promise<Array<{ memoryId: string; rank: number; score: number; content: string; sourceType: string; sourceTitle: string | null; metadata: any; createdAt: Date | null; treePath: string }>> {
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  // Step 1: Find the most relevant tree nodes (sections)
  const treeNodes = await db.execute(sql`
    SELECT 
      t.id,
      t.title,
      t.summary,
      t.memory_ids,
      t.level,
      1 - (t.embedding <=> ${embeddingStr}::vector) as similarity
    FROM tree_index t
    WHERE t.user_id = ${userId}::uuid AND t.embedding IS NOT NULL
    ORDER BY t.embedding <=> ${embeddingStr}::vector
    LIMIT 5
  `);

  if (!treeNodes?.length) return [];

  // Step 2: Get memories from those tree nodes
  const allMemoryIds = (treeNodes as any[])
    .flatMap(n => n.memory_ids || [])
    .slice(0, limit * 2);

  if (!allMemoryIds.length) return [];

  const results = await db.execute(sql`
    SELECT 
      m.id as memory_id,
      m.content,
      m.source_type,
      m.source_title,
      m.metadata,
      m.created_at,
      m.tree_path,
      1 - (m.embedding <=> ${embeddingStr}::vector) as similarity
    FROM memories m
    WHERE m.id = ANY(${allMemoryIds}::uuid[])
    ORDER BY m.embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `);

  return (results as any[]).map((r, i) => ({
    memoryId: r.memory_id,
    rank: i + 1,
    score: r.similarity,
    content: r.content,
    sourceType: r.source_type,
    sourceTitle: r.source_title,
    metadata: r.metadata || {},
    createdAt: r.created_at,
    treePath: r.tree_path || '',
  }));
}

/**
 * Reciprocal Rank Fusion (RRF)
 * Combines results from all three layers into a single ranked list
 * 
 * RRF score = Σ 1/(k + rank_i) for each layer
 * k = 60 (standard)
 */
function fuseResults(
  bm25: Array<{ memoryId: string; rank: number; score: number; content: string; sourceType: string; sourceTitle: string | null; metadata: any; createdAt: Date | null }>,
  vector: Array<{ memoryId: string; rank: number; score: number; content: string; sourceType: string; sourceTitle: string | null; metadata: any; createdAt: Date | null }>,
  tree: Array<{ memoryId: string; rank: number; score: number; content: string; sourceType: string; sourceTitle: string | null; metadata: any; createdAt: Date | null; treePath?: string }>,
  limit: number,
): RetrievalResult[] {
  const fusedMap = new Map<string, RetrievalResult>();

  // Process BM25 results
  for (const r of bm25) {
    const existing = fusedMap.get(r.memoryId) || createEmptyResult(r);
    existing.score += 1 / (RRF_K + r.rank);
    existing.layers.bm25 = { rank: r.rank, score: r.score };
    fusedMap.set(r.memoryId, existing);
  }

  // Process Vector results
  for (const r of vector) {
    const existing = fusedMap.get(r.memoryId) || createEmptyResult(r);
    existing.score += 1 / (RRF_K + r.rank);
    existing.layers.vector = { rank: r.rank, score: r.score };
    fusedMap.set(r.memoryId, existing);
  }

  // Process Tree results (weighted higher — structural relevance is premium)
  for (const r of tree) {
    const existing = fusedMap.get(r.memoryId) || createEmptyResult(r);
    existing.score += 1.2 / (RRF_K + r.rank); // 20% weight boost for tree results
    existing.layers.tree = { rank: r.rank, score: r.score, path: (r as any).treePath || '' };
    fusedMap.set(r.memoryId, existing);
  }

  return Array.from(fusedMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function createEmptyResult(r: { memoryId: string; content: string; sourceType: string; sourceTitle: string | null; metadata: any; createdAt: Date | null }): RetrievalResult {
  return {
    memoryId: r.memoryId,
    content: r.content,
    sourceType: r.sourceType,
    sourceTitle: r.sourceTitle,
    score: 0,
    layers: {},
    metadata: r.metadata,
    createdAt: r.createdAt,
  };
}

/**
 * Build/update the tree index for a user's knowledge
 * This is the "indexing" phase — called after import
 * 
 * Groups memories by source, then by topic clusters,
 * creating a navigable hierarchy
 */
export async function buildTreeIndex(userId: string): Promise<void> {
  // Get all memories for this user
  const allMemories = await db.execute(sql`
    SELECT id, content, source_type, source_title, embedding, tree_path
    FROM memories
    WHERE user_id = ${userId} AND embedding IS NOT NULL
    ORDER BY source_type, created_at
  `);

  if (!allMemories?.length) return;

  // Group by source type (Level 1 nodes)
  const bySource = new Map<string, any[]>();
  for (const mem of allMemories as any[]) {
    const key = mem.source_type;
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key)!.push(mem);
  }

  // Clear existing tree for this user
  await db.execute(sql`DELETE FROM tree_index WHERE user_id = ${userId}`);

  // Create tree nodes
  for (const [sourceType, memories] of bySource) {
    // Level 1: Source type node
    const sourceNodeId = crypto.randomUUID();
    
    // Average embedding for this source cluster
    const avgEmbedding = averageEmbeddings(
      memories.filter((m: any) => m.embedding).map((m: any) => JSON.parse(m.embedding))
    );

    await db.execute(sql`
      INSERT INTO tree_index (id, user_id, title, summary, level, memory_ids, embedding)
      VALUES (
        ${sourceNodeId}, ${userId}, ${sourceType},
        ${`${memories.length} memories from ${sourceType}`},
        1,
        ${memories.map((m: any) => m.id)}::uuid[],
        ${avgEmbedding ? `[${avgEmbedding.join(',')}]` : null}::vector
      )
    `);

    // Level 2: Group by source_title within each source type
    const byTitle = new Map<string, any[]>();
    for (const mem of memories) {
      const title = mem.source_title || 'Untitled';
      if (!byTitle.has(title)) byTitle.set(title, []);
      byTitle.get(title)!.push(mem);
    }

    for (const [title, titleMemories] of byTitle) {
      if (titleMemories.length < 2) continue; // skip tiny groups
      
      const titleAvgEmb = averageEmbeddings(
        titleMemories.filter((m: any) => m.embedding).map((m: any) => JSON.parse(m.embedding))
      );

      await db.execute(sql`
        INSERT INTO tree_index (id, user_id, title, summary, level, parent_id, memory_ids, embedding)
        VALUES (
          ${crypto.randomUUID()}, ${userId}, ${title},
          ${`${titleMemories.length} memories about "${title}"`},
          2, ${sourceNodeId},
          ${titleMemories.map((m: any) => m.id)}::uuid[],
          ${titleAvgEmb ? `[${titleAvgEmb.join(',')}]` : null}::vector
        )
      `);
    }
  }
}

function averageEmbeddings(embeddings: number[][]): number[] | null {
  if (!embeddings.length) return null;
  const dim = embeddings[0].length;
  const avg = new Array(dim).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      avg[i] += emb[i];
    }
  }
  for (let i = 0; i < dim; i++) {
    avg[i] /= embeddings.length;
  }
  return avg;
}
