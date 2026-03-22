import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/server/db';
import { retrieve } from '@/server/retrieval';
import { sql } from 'drizzle-orm';

// Embedding helper
async function getEmbedding(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  });
  if (!res.ok) throw new Error('Embedding failed');
  const data = await res.json();
  return data.data[0].embedding;
}

/**
 * GET /api/v1/search?q=query&limit=10&source=chatgpt
 * Triple-layer fusion search
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');
    const sourceType = searchParams.get('source');
    const apiKey = req.headers.get('x-openai-key') || process.env.OPENAI_API_KEY;
    const userId = req.headers.get('x-user-id') || 'default';

    if (!query) return NextResponse.json({ error: 'Missing query parameter ?q=' }, { status: 400 });

    // Get embedding for the query
    let embedding: number[] | null = null;
    if (apiKey) {
      try { embedding = await getEmbedding(query, apiKey); } catch { /* fallback to BM25 only */ }
    }

    const results = await retrieve(query, embedding, {
      userId,
      limit,
      sourceTypes: sourceType ? [sourceType] : undefined,
    });

    return NextResponse.json({
      query,
      results,
      totalResults: results.length,
      layers: {
        bm25: results.filter(r => r.layers.bm25).length,
        vector: results.filter(r => r.layers.vector).length,
        tree: results.filter(r => r.layers.tree).length,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
