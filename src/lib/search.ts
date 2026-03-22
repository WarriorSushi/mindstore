// Search utilities — server-side search is now handled by /api/v1/search
// This file only exports the RAG prompt builder for client-side use

export function buildRAGPrompt(
  query: string,
  relevantMemories: Array<{ content: string; sourceTitle: string; sourceType: string; score: number; createdAt: string }>
): { role: string; content: string }[] {
  const context = relevantMemories
    .map((m, i) => `[${i + 1}] Source: "${m.sourceTitle}" (${m.sourceType}, ${new Date(m.createdAt).toLocaleDateString()})\n${m.content}`)
    .join('\n\n---\n\n');

  return [
    {
      role: 'system',
      content: `You are MindStore, a personal knowledge assistant. You answer questions based ONLY on the user's own knowledge stored in their personal database. 

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
