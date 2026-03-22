import { NextRequest, NextResponse } from 'next/server';
import { generateEmbeddings, getEmbeddingConfig } from '@/server/embeddings';

/**
 * POST /api/v1/embed — generate embeddings server-side
 * Uses whatever provider is configured (OpenAI, Gemini, or Ollama)
 * Body: { texts: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const config = await getEmbeddingConfig();
    if (!config) {
      return NextResponse.json({ error: 'No embedding provider configured. Add an API key in Settings.' }, { status: 400 });
    }

    const { texts } = await req.json();
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ error: 'texts array required' }, { status: 400 });
    }

    const embeddings = await generateEmbeddings(texts);
    return NextResponse.json({ embeddings, provider: config.provider });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
