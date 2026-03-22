import { NextRequest, NextResponse } from 'next/server';
import { getServerApiKey } from '@/server/apikey';

/**
 * POST /api/v1/chat — streaming chat proxy to OpenAI
 * Body: { messages: [{role, content}] }
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = await getServerApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'No API key configured. Add one in Settings.' }, { status: 400 });
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages array required' }, { status: 400 });
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        stream: true,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json(
        { error: err.error?.message || 'Chat API failed' },
        { status: res.status }
      );
    }

    // Stream the response through
    return new NextResponse(res.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
