import { db } from './db';
import { sql } from 'drizzle-orm';

/**
 * Get the OpenAI API key from DB settings table, falling back to env var.
 */
export async function getServerApiKey(): Promise<string | null> {
  // 1. Check env var first (highest priority)
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }

  // 2. Check DB settings table
  try {
    const result = await db.execute(
      sql`SELECT value FROM settings WHERE key = 'openai_api_key' LIMIT 1`
    );
    const row = (result as any[])[0];
    if (row?.value) return row.value;
  } catch {
    // Table might not exist yet
  }

  return null;
}

/**
 * Store the OpenAI API key in the DB settings table.
 */
export async function setServerApiKey(apiKey: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO settings (id, key, value, updated_at)
    VALUES (gen_random_uuid(), 'openai_api_key', ${apiKey}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${apiKey}, updated_at = NOW()
  `);
}

/**
 * Remove the API key from DB settings.
 */
export async function removeServerApiKey(): Promise<void> {
  await db.execute(sql`DELETE FROM settings WHERE key = 'openai_api_key'`);
}

/**
 * Check if an API key is valid by calling OpenAI models endpoint.
 */
export async function testApiKeyServer(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get embeddings server-side.
 */
export async function getEmbeddingsServer(
  texts: string[],
  apiKey: string
): Promise<number[][]> {
  const batchSize = 100;
  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: batch }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Embedding API failed');
    }
    const data = await res.json();
    all.push(
      ...data.data
        .sort((a: any, b: any) => a.index - b.index)
        .map((d: any) => d.embedding)
    );
  }
  return all;
}
