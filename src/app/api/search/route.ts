import { NextRequest, NextResponse } from 'next/server';
import { searchMind, assembleContext } from '@/lib/search';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q');
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20');
  const sources = req.nextUrl.searchParams.get('sources')?.split(',');

  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter "q"' }, { status: 400 });
  }

  const results = await searchMind(query, { limit, sourceTypes: sources });

  return NextResponse.json({
    query,
    results: results.map(r => ({
      id: r.chunkId,
      documentId: r.documentId,
      content: r.content,
      score: r.score,
      source: r.source,
      title: r.title,
      sourceType: r.sourceType,
      createdAt: r.createdAt,
    })),
    total: results.length,
  });
}
