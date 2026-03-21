export function getApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('mindstore_api_key');
}

export function setApiKey(key: string) {
  localStorage.setItem('mindstore_api_key', key);
}

export function removeApiKey() {
  localStorage.removeItem('mindstore_api_key');
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No API key set');
  
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 8000) }),
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Embedding API error: ${res.status}`);
  }
  
  const data = await res.json();
  return data.data[0].embedding;
}

export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No API key set');
  
  const trimmed = texts.map(t => t.slice(0, 8000));
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: trimmed }),
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Embedding API error: ${res.status}`);
  }
  
  const data = await res.json();
  return data.data.sort((a: { index: number }, b: { index: number }) => a.index - b.index).map((d: { embedding: number[] }) => d.embedding);
}

export async function chatCompletion(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  onChunk: (chunk: string) => void,
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No API key set');
  
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Chat API error: ${res.status}`);
  }
  
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');
  
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        const content = json.choices?.[0]?.delta?.content;
        if (content) {
          full += content;
          onChunk(full);
        }
      } catch { /* skip */ }
    }
  }
  
  return full;
}

export async function testApiKey(key: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
