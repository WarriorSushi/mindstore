import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/server/db';
import { retrieve } from '@/server/retrieval';
import { getServerApiKey, getEmbeddingsServer } from '@/server/apikey';
import { sql } from 'drizzle-orm';

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
    const userId = req.headers.get('x-user-id') || 'default';

    if (!query) return NextResponse.json({ error: 'Missing query parameter ?q=' }, { status: 400 });

    // Get API key server-side
    const apiKey = await getServerApiKey();

    // Get embedding for the query
    let embedding: number[] | null = null;
    if (apiKey) {
      try {
        const embeddings = await getEmbeddingsServer([query], apiKey);
        embedding = embeddings[0];
      } catch { /* fallback to BM25 only */ }
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
