import { NextRequest, NextResponse } from 'next/server';
import { getServerApiKey, getEmbeddingsServer } from '@/server/apikey';

/**
 * POST /api/v1/embed — generate embeddings server-side
 * Body: { texts: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = await getServerApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'No API key configured. Add one in Settings.' }, { status: 400 });
    }

    const { texts } = await req.json();
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ error: 'texts array required' }, { status: 400 });
    }

    const embeddings = await getEmbeddingsServer(texts, apiKey);
    return NextResponse.json({ embeddings });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
