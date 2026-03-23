/**
 * OpenAI client — thin wrapper that calls server-side API routes.
 * No API keys or direct OpenAI calls from the browser.
 */

/** Check if an API key is configured server-side */
export async function checkApiKey(): Promise<{ hasApiKey: boolean; apiKeyPreview: string | null }> {
  try {
    const res = await fetch('/api/v1/settings');
    if (!res.ok) return { hasApiKey: false, apiKeyPreview: null };
    return res.json();
  } catch {
    return { hasApiKey: false, apiKeyPreview: null };
  }
}

/** Save an API key (sent to server, stored in DB) */
export async function saveApiKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/v1/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error };
  return { ok: true };
}

/** Remove the API key from server */
export async function removeApiKey(): Promise<void> {
  await fetch('/api/v1/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'remove' }),
  });
}

/** Stream chat via server-side proxy */
export async function* streamChat(
  messages: { role: string; content: string }[]
): AsyncGenerator<string> {
  const res = await fetch('/api/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Chat API failed');
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const json = JSON.parse(line.slice(6));
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // skip
        }
      }
    }
  }
}
