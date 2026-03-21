/**
 * Embedding generation for MindStore
 * Uses OpenAI embeddings API or falls back to simple TF-IDF-like approach
 */

export type EmbeddingProvider = 'openai' | 'local';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Generate embeddings for text chunks
 */
export async function generateEmbeddings(
  texts: string[],
  provider: EmbeddingProvider = 'openai'
): Promise<number[][]> {
  if (provider === 'openai') {
    return generateOpenAIEmbeddings(texts);
  }
  return texts.map(t => generateLocalEmbedding(t));
}

/**
 * Generate embeddings using OpenAI API
 */
async function generateOpenAIEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('No OPENAI_API_KEY set, falling back to local embeddings');
    return texts.map(t => generateLocalEmbedding(t));
  }

  // Batch in groups of 100 (API limit)
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100);
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: batch,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI embedding error:', error);
      // Fallback to local
      return texts.map(t => generateLocalEmbedding(t));
    }

    const data = await response.json();
    for (const item of data.data) {
      results.push(item.embedding);
    }
  }

  return results;
}

/**
 * Simple local embedding using bag-of-words with hashing trick
 * Not as good as OpenAI but works offline and is free
 */
function generateLocalEmbedding(text: string): number[] {
  const dimensions = 384; // smaller for local
  const embedding = new Array(dimensions).fill(0);
  
  // Tokenize and normalize
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);

  for (const word of words) {
    // Hash word to dimension index
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dimensions;
    embedding[idx] += 1;
  }

  // L2 normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < dimensions; i++) {
      embedding[i] /= magnitude;
    }
  }

  return embedding;
}

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Generate a single embedding for a query
 */
export async function embedQuery(query: string, provider: EmbeddingProvider = 'openai'): Promise<number[]> {
  const [embedding] = await generateEmbeddings([query], provider);
  return embedding;
}
