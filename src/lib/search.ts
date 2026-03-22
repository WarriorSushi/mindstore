import type { Memory } from './db';

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function searchMemories(
  queryEmbedding: number[],
  memories: Memory[],
  topK = 10
): (Memory & { score: number })[] {
  const scored = memories
    .filter(m => m.embedding && m.embedding.length > 0)
    .map(m => ({
      ...m,
      score: cosineSimilarity(queryEmbedding, m.embedding),
    }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}

export function buildRAGPrompt(
  query: string,
  relevantMemories: (Memory & { score: number })[]
): { role: string; content: string }[] {
  const context = relevantMemories
    .map((m, i) => `[${i + 1}] Source: "${m.sourceTitle}" (${m.source}, ${m.timestamp.toLocaleDateString()})\n${m.content}`)
    .join('\n\n---\n\n');

  return [
    {
      role: 'system',
      content: `You are Mindstore, a personal knowledge assistant. You answer questions based ONLY on the user's own knowledge stored in their personal database. 

When answering:
- Synthesize information across multiple sources when relevant
- Always cite your sources using [1], [2], etc.
- If the knowledge base doesn't contain relevant information, say so honestly
- Be concise but thorough
- Highlight connections between different pieces of knowledge the user might not have noticed`,
    },
    {
      role: 'user',
      content: `Here is relevant context from my personal knowledge base:\n\n${context}\n\n---\n\nMy question: ${query}`,
    },
  ];
}
