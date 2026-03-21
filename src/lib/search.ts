import { db, type Memory } from './db';
import { generateEmbedding } from './openai';

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function semanticSearch(query: string, topK: number = 10): Promise<(Memory & { score: number })[]> {
  const queryEmbedding = await generateEmbedding(query);
  const allMemories = await db.memories.toArray();
  
  const scored = allMemories.map(m => ({
    ...m,
    score: cosineSimilarity(queryEmbedding, m.embedding),
  }));
  
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

export async function keywordSearch(query: string): Promise<Memory[]> {
  const lower = query.toLowerCase();
  const allMemories = await db.memories.toArray();
  return allMemories.filter(m => m.content.toLowerCase().includes(lower));
}
