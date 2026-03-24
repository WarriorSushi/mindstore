import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

/**
 * POST /api/v1/chat — streaming chat proxy
 * Supports OpenAI and Gemini as chat backends
 * Body: { messages: [{role, content}] }
 */
export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages array required' }, { status: 400 });
    }

    // Get configured keys
    const settings = await db.execute(
      sql`SELECT key, value FROM settings WHERE key IN ('openai_api_key', 'gemini_api_key')`
    );
    const config: Record<string, string> = {};
    for (const row of settings as any[]) {
      config[row.key] = row.value;
    }

    const openaiKey = config.openai_api_key || process.env.OPENAI_API_KEY;
    const geminiKey = config.gemini_api_key || process.env.GEMINI_API_KEY;

    // Try OpenAI first, then Gemini
    if (openaiKey) {
      return streamOpenAI(messages, openaiKey);
    } else if (geminiKey) {
      return streamGemini(messages, geminiKey);
    } else {
      return NextResponse.json({ error: 'No API key configured. Add an OpenAI or Gemini key in Settings.' }, { status: 400 });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function streamOpenAI(messages: any[], apiKey: string) {
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
      { error: err.error?.message || 'OpenAI chat failed' },
      { status: res.status }
    );
  }

  return new NextResponse(res.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

async function streamGemini(messages: any[], apiKey: string) {
  // Convert OpenAI-style messages to Gemini format
  const contents = messages
    .filter((m: any) => m.role !== 'system')
    .map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const systemMsg = messages.find((m: any) => m.role === 'system');
  const systemInstruction = systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction,
        generationConfig: { temperature: 0.7 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    return NextResponse.json(
      { error: err.error?.message || 'Gemini chat failed' },
      { status: res.status }
    );
  }

  // Transform Gemini SSE format to OpenAI-compatible SSE format
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  (async () => {
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                // Emit in OpenAI-compatible format
                const chunk = JSON.stringify({
                  choices: [{ delta: { content: text } }],
                });
                await writer.write(encoder.encode(`data: ${chunk}\n\n`));
              }
            } catch { /* skip bad JSON */ }
          }
        }
      }
      await writer.write(encoder.encode('data: [DONE]\n\n'));
    } finally {
      writer.close();
    }
  })();

  return new NextResponse(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
