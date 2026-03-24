import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

/**
 * POST /api/v1/chat — streaming chat proxy
 * Supports OpenAI, Gemini, and Ollama (local) as chat backends
 * Body: { messages: [{role, content}], model?: string }
 * Model selection: pass model name to override defaults (e.g. "gpt-4o", "gemini-2.0-flash", "llama3.2")
 */
export async function POST(req: NextRequest) {
  try {
    const { messages, model } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages array required' }, { status: 400 });
    }

    // Get configured keys and URLs
    const settings = await db.execute(
      sql`SELECT key, value FROM settings WHERE key IN ('openai_api_key', 'gemini_api_key', 'ollama_url', 'chat_provider', 'chat_model')`
    );
    const config: Record<string, string> = {};
    for (const row of settings as any[]) {
      config[row.key] = row.value;
    }

    const openaiKey = config.openai_api_key || process.env.OPENAI_API_KEY;
    const geminiKey = config.gemini_api_key || process.env.GEMINI_API_KEY;
    const ollamaUrl = config.ollama_url || process.env.OLLAMA_URL;
    
    // Model override: request body > saved setting > default
    const selectedModel = model || config.chat_model || undefined;

    // Respect explicit chat_provider preference if set
    const preferred = config.chat_provider;
    if (preferred === 'ollama' && ollamaUrl) {
      return streamOllama(messages, ollamaUrl, selectedModel);
    }
    if (preferred === 'openai' && openaiKey) {
      return streamOpenAI(messages, openaiKey, selectedModel);
    }
    if (preferred === 'gemini' && geminiKey) {
      return streamGemini(messages, geminiKey, selectedModel);
    }

    // Auto-detect: try OpenAI first, then Gemini, then Ollama
    if (openaiKey) {
      return streamOpenAI(messages, openaiKey, selectedModel);
    } else if (geminiKey) {
      return streamGemini(messages, geminiKey, selectedModel);
    } else if (ollamaUrl) {
      return streamOllama(messages, ollamaUrl, selectedModel);
    } else {
      return NextResponse.json({ error: 'No AI provider configured. Add an OpenAI key, Gemini key, or Ollama URL in Settings.' }, { status: 400 });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function streamOpenAI(messages: any[], apiKey: string, model?: string) {
  const useModel = model || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: useModel,
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

async function streamGemini(messages: any[], apiKey: string, model?: string) {
  // Convert OpenAI-style messages to Gemini format
  const contents = messages
    .filter((m: any) => m.role !== 'system')
    .map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const systemMsg = messages.find((m: any) => m.role === 'system');
  const systemInstruction = systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined;

  // Default to gemini-2.0-flash (good free tier), not flash-lite (quota issues)
  const useModel = model || 'gemini-2.0-flash';

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${useModel}:streamGenerateContent?alt=sse&key=${apiKey}`,
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

/**
 * Stream chat via Ollama (local LLM)
 * Ollama uses its own /api/chat endpoint with NDJSON streaming
 * We transform the output to OpenAI-compatible SSE format
 */
async function streamOllama(messages: any[], baseUrl: string, model?: string) {
  // Ollama expects messages in OpenAI-compatible format (role + content)
  // but uses its own /api/chat endpoint
  const ollamaMessages = messages.map((m: any) => ({
    role: m.role,
    content: m.content,
  }));

  const useModel = model || 'llama3.2';

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: useModel,
        messages: ollamaMessages,
        stream: true,
        options: {
          temperature: 0.7,
        },
      }),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Cannot connect to Ollama at ${baseUrl}. Is it running? Error: ${err.message}` },
      { status: 502 }
    );
  }

  if (!res.ok) {
    let errorMsg = 'Ollama chat failed';
    try {
      const err = await res.json();
      errorMsg = err.error || errorMsg;
    } catch { /* body may not be JSON */ }
    return NextResponse.json(
      { error: errorMsg },
      { status: res.status }
    );
  }

  // Transform Ollama NDJSON stream to OpenAI-compatible SSE format
  // Ollama streams: {"model":"...","message":{"role":"assistant","content":"token"},"done":false}
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
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const data = JSON.parse(trimmed);
            if (data.done) {
              // Stream complete
              continue;
            }
            const text = data.message?.content;
            if (text) {
              // Emit in OpenAI-compatible SSE format
              const chunk = JSON.stringify({
                choices: [{ delta: { content: text } }],
              });
              await writer.write(encoder.encode(`data: ${chunk}\n\n`));
            }
          } catch { /* skip malformed lines */ }
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
