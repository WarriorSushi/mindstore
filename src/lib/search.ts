/**
 * Hybrid search engine for MindStore
 * Combines vector similarity, full-text search, and temporal relevance
 */

import { getDb, searchChunksFTS } from './db';
import { embedQuery, cosineSimilarity, EmbeddingProvider } from './embeddings';

export interface SearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  score: number;
  source: 'vector' | 'fts' | 'hybrid';
  title?: string;
  sourceType?: string;
  createdAt?: string;
}

export interface SearchOptions {
  limit?: number;
  sourceTypes?: string[];
  dateFrom?: string;
  dateTo?: string;
  hybridWeight?: number; // 0 = pure FTS, 1 = pure vector
}

/**
 * Hybrid search combining vector similarity and full-text search
 */
export async function searchMind(
  query: string,
  options: SearchOptions = {},
  embeddingProvider: EmbeddingProvider = 'openai'
): Promise<SearchResult[]> {
  const {
    limit = 20,
    sourceTypes,
    dateFrom,
    dateTo,
    hybridWeight = 0.7, // favor vector search by default
  } = options;

  const db = getDb();

  // Run both searches in parallel
  const [vectorResults, ftsResults] = await Promise.all([
    searchVector(query, limit * 2, embeddingProvider),
    searchFTS(query, limit * 2),
  ]);

  // Merge and score
  const resultMap = new Map<string, SearchResult>();

  // Add vector results
  for (const result of vectorResults) {
    resultMap.set(result.chunkId, {
      ...result,
      score: result.score * hybridWeight,
      source: 'vector',
    });
  }

  // Merge FTS results
  for (const result of ftsResults) {
    const existing = resultMap.get(result.chunkId);
    if (existing) {
      existing.score += result.score * (1 - hybridWeight);
      existing.source = 'hybrid';
    } else {
      resultMap.set(result.chunkId, {
        ...result,
        score: result.score * (1 - hybridWeight),
        source: 'fts',
      });
    }
  }

  // Filter by source types
  let results = Array.from(resultMap.values());
  if (sourceTypes && sourceTypes.length > 0) {
    results = results.filter(r => r.sourceType && sourceTypes.includes(r.sourceType));
  }

  // Filter by date range
  if (dateFrom || dateTo) {
    results = results.filter(r => {
      if (!r.createdAt) return true;
      if (dateFrom && r.createdAt < dateFrom) return false;
      if (dateTo && r.createdAt > dateTo) return false;
      return true;
    });
  }

  // Sort by score and limit
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Vector similarity search
 */
async function searchVector(
  query: string,
  limit: number,
  provider: EmbeddingProvider
): Promise<SearchResult[]> {
  const db = getDb();
  const queryEmbedding = await embedQuery(query, provider);

  // Get all chunks with embeddings
  const chunks = db.prepare(`
    SELECT c.id, c.content, c.document_id, c.embedding, d.title, d.source_type, d.created_at
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE c.embedding IS NOT NULL
  `).all() as Array<{
    id: string; content: string; document_id: string; embedding: string;
    title: string; source_type: string; created_at: string;
  }>;

  // Score each chunk
  const scored = chunks.map(chunk => {
    const embedding = JSON.parse(chunk.embedding) as number[];
    const similarity = cosineSimilarity(queryEmbedding, embedding);
    return {
      chunkId: chunk.id,
      documentId: chunk.document_id,
      content: chunk.content,
      score: similarity,
      source: 'vector' as const,
      title: chunk.title,
      sourceType: chunk.source_type,
      createdAt: chunk.created_at,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Full-text search using SQLite FTS5
 */
function searchFTS(query: string, limit: number): SearchResult[] {
  const db = getDb();
  
  // Escape FTS5 special characters
  const safeQuery = query.replace(/['"(){}[\]^~*?:\\/-]/g, ' ').trim();
  if (!safeQuery) return [];

  try {
    const results = db.prepare(`
      SELECT c.id, c.content, c.document_id, d.title, d.source_type, d.created_at,
             -chunks_fts.rank as relevance
      FROM chunks_fts
      JOIN chunks c ON c.rowid = chunks_fts.rowid
      JOIN documents d ON d.id = c.document_id
      WHERE chunks_fts MATCH ?
      ORDER BY chunks_fts.rank
      LIMIT ?
    `).all(safeQuery, limit) as Array<{
      id: string; content: string; document_id: string;
      title: string; source_type: string; created_at: string;
      relevance: number;
    }>;

    // Normalize FTS scores to 0-1 range
    const maxRelevance = results.length > 0 ? Math.max(...results.map(r => r.relevance)) : 1;

    return results.map(r => ({
      chunkId: r.id,
      documentId: r.document_id,
      content: r.content,
      score: maxRelevance > 0 ? r.relevance / maxRelevance : 0,
      source: 'fts' as const,
      title: r.title,
      sourceType: r.source_type,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

/**
 * Get context assembled from search results
 * Builds a coherent context string from the top results
 */
export async function assembleContext(
  query: string,
  maxTokens = 4000,
  provider: EmbeddingProvider = 'openai'
): Promise<string> {
  const results = await searchMind(query, { limit: 10 }, provider);
  
  if (results.length === 0) {
    return 'No relevant context found in MindStore.';
  }

  let context = '';
  let tokenCount = 0;

  for (const result of results) {
    const chunk = `[${result.sourceType || 'unknown'}] ${result.title || 'Untitled'}:\n${result.content}\n\n`;
    const chunkTokens = Math.ceil(chunk.length / 4);
    
    if (tokenCount + chunkTokens > maxTokens) break;
    
    context += chunk;
    tokenCount += chunkTokens;
  }

  return context.trim();
}
