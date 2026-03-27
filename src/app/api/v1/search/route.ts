import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/server/db';
import { retrieve } from '@/server/retrieval';
import { generateEmbeddings } from '@/server/embeddings';
import { sql } from 'drizzle-orm';
import { applyRateLimit, RATE_LIMITS } from '@/server/api-rate-limit';

/**
 * GET /api/v1/search?q=query&limit=10&source=chatgpt
 * Triple-layer fusion search
 */
export async function GET(req: NextRequest) {
  const limited = applyRateLimit(req, 'search', RATE_LIMITS.standard);
  if (limited) return limited;

  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');
    const sourceType = searchParams.get('source');
    const userId = await getUserId();

    if (!query) return NextResponse.json({ error: 'Missing query parameter ?q=' }, { status: 400 });
    if (query.length > 2000) return NextResponse.json({ error: 'Query too long (max 2000 chars)' }, { status: 400 });

    // Get embedding for the query using available provider
    let embedding: number[] | null = null;
    try {
      const embeddings = await generateEmbeddings([query]);
      if (embeddings && embeddings.length > 0) {
        embedding = embeddings[0];
      }
    } catch { /* fallback to BM25 only */ }

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
    console.error('[search]', error);
    return NextResponse.json({ query: '', results: [], totalResults: 0, layers: { bm25: 0, vector: 0, tree: 0 }, dbError: true });
  }
}
