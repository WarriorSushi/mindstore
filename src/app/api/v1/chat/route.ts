import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { decrypt } from '@/server/encryption';
import { applyRateLimit, RATE_LIMITS } from '@/server/api-rate-limit';

/**
 * POST /api/v1/chat — streaming chat proxy
 * 
 * Supports:
 *  - OpenAI (direct)
 *  - Google Gemini (native API)
 *  - Ollama (local)
 *  - OpenRouter (200+ models via one key)
 *  - Any OpenAI-compatible API (Groq, Together, Fireworks, Mistral, DeepSeek, etc.)
 * 
 * Body: { messages: [{role, content}], model?: string }
 */
export async function POST(req: NextRequest) {
  const limited = applyRateLimit(req, 'chat', RATE_LIMITS.ai);
  if (limited) return limited;

  try {
    const { messages, model } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages array required' }, { status: 400 });
    }
    if (messages.length > 100) {
      return NextResponse.json({ error: 'Too many messages (max 100)' }, { status: 400 });
    }
    // Validate individual messages
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return NextResponse.json({ error: 'Each message needs role and content' }, { status: 400 });
      }
      if (typeof msg.content === 'string' && msg.content.length > 100_000) {
        return NextResponse.json({ error: 'Message content too long (max 100K chars)' }, { status: 400 });
      }
    }

    // Get all configured settings
    const settings = await db.execute(
      sql`SELECT key, value FROM settings WHERE key IN (
        'openai_api_key', 'gemini_api_key', 'ollama_url',
        'openrouter_api_key', 'custom_api_key', 'custom_api_url', 'custom_api_model',
        'chat_provider', 'chat_model'
      )`
    );
    const config: Record<string, string> = {};
    for (const row of settings as any[]) {
      // Decrypt API keys stored encrypted at rest
      config[row.key] = row.key.includes('api_key') ? decrypt(row.value) : row.value;
    }

    const openaiKey = config.openai_api_key || process.env.OPENAI_API_KEY;
    const geminiKey = config.gemini_api_key || process.env.GEMINI_API_KEY;
    const ollamaUrl = config.ollama_url || process.env.OLLAMA_URL;
    const openrouterKey = config.openrouter_api_key || process.env.OPENROUTER_API_KEY;
    const customKey = config.custom_api_key;
    const customUrl = config.custom_api_url;
    const customModel = config.custom_api_model;
    
    // Model override: request body > saved setting > default
    const selectedModel = model || config.chat_model || undefined;

    // Respect explicit chat_provider preference
    const preferred = config.chat_provider;
    
    if (preferred === 'openrouter' && openrouterKey) {
      return streamOpenAICompatible(messages, openrouterKey, 'https://openrouter.ai/api/v1/chat/completions', selectedModel || 'anthropic/claude-3.5-haiku', { 'HTTP-Referer': 'https://mindstore.app', 'X-Title': 'MindStore' });
    }
    if (preferred === 'custom' && customKey && customUrl) {
      return streamOpenAICompatible(messages, customKey, customUrl, selectedModel || customModel || 'default');
    }
    if (preferred === 'ollama' && ollamaUrl) {
      return streamOllama(messages, ollamaUrl, selectedModel);
    }
    if (preferred === 'openai' && openaiKey) {
      return streamOpenAICompatible(messages, openaiKey, 'https://api.openai.com/v1/chat/completions', selectedModel || 'gpt-4o-mini');
    }
    if (preferred === 'gemini' && geminiKey) {
      return streamGemini(messages, geminiKey, selectedModel);
    }

    // Auto-detect fallback chain: OpenAI → Gemini → OpenRouter → Custom → Ollama
    if (openaiKey) {
      return streamOpenAICompatible(messages, openaiKey, 'https://api.openai.com/v1/chat/completions', selectedModel || 'gpt-4o-mini');
    } else if (geminiKey) {
      return streamGemini(messages, geminiKey, selectedModel);
    } else if (openrouterKey) {
      return streamOpenAICompatible(messages, openrouterKey, 'https://openrouter.ai/api/v1/chat/completions', selectedModel || 'anthropic/claude-3.5-haiku', { 'HTTP-Referer': 'https://mindstore.app', 'X-Title': 'MindStore' });
    } else if (customKey && customUrl) {
      return streamOpenAICompatible(messages, customKey, customUrl, selectedModel || customModel || 'default');
    } else if (ollamaUrl) {
      return streamOllama(messages, ollamaUrl, selectedModel);
    } else {
      return NextResponse.json({ error: 'No AI provider configured. Add an API key in Settings.' }, { status: 400 });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Universal OpenAI-compatible streaming
 * Works with: OpenAI, OpenRouter, Groq, Together, Fireworks, Mistral, DeepSeek, etc.
 */
async function streamOpenAICompatible(
  messages: any[],
  apiKey: string,
  endpoint: string,
  model: string,
  extraHeaders?: Record<string, string>,
) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    let errorMsg = `Chat failed (${res.status})`;
    try {
      const err = await res.json();
      errorMsg = err.error?.message || err.error || errorMsg;
    } catch { /* body may not be JSON */ }
    return NextResponse.json({ error: errorMsg }, { status: res.status });
  }

  return new NextResponse(res.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

/**
 * Google Gemini (native API — not OpenAI-compatible)
 */
async function streamGemini(messages: any[], apiKey: string, model?: string) {
  const contents = messages
    .filter((m: any) => m.role !== 'system')
    .map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const systemMsg = messages.find((m: any) => m.role === 'system');
  const systemInstruction = systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined;

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
    let errorMsg = 'Gemini chat failed';
    try {
      const err = await res.json();
      errorMsg = err.error?.message || errorMsg;
    } catch {}
    return NextResponse.json({ error: errorMsg }, { status: res.status });
  }

  // Transform Gemini SSE to OpenAI-compatible SSE
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
 * Ollama (local LLM — NDJSON streaming, not SSE)
 */
async function streamOllama(messages: any[], baseUrl: string, model?: string) {
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
        options: { temperature: 0.7 },
      }),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Cannot connect to Ollama at ${baseUrl}. Is it running? Error: ${err.message}` },
      { status: 502 },
    );
  }

  if (!res.ok) {
    let errorMsg = 'Ollama chat failed';
    try {
      const err = await res.json();
      errorMsg = err.error || errorMsg;
    } catch {}
    return NextResponse.json({ error: errorMsg }, { status: res.status });
  }

  // Transform Ollama NDJSON to OpenAI-compatible SSE
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
            if (data.done) continue;
            const text = data.message?.content;
            if (text) {
              const chunk = JSON.stringify({
                choices: [{ delta: { content: text } }],
              });
              await writer.write(encoder.encode(`data: ${chunk}\n\n`));
            }
          } catch { /* skip malformed */ }
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
