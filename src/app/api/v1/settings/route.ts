import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { getEmbeddingConfig } from '@/server/embeddings';

/**
 * GET /api/v1/settings — get current settings
 */
export async function GET() {
  try {
    const settings = await db.execute(
      sql`SELECT key, value FROM settings WHERE key IN ('openai_api_key', 'gemini_api_key', 'ollama_url', 'embedding_provider', 'chat_provider')`
    );

    const config: Record<string, string> = {};
    for (const row of settings as any[]) {
      config[row.key] = row.value;
    }

    const embConfig = await getEmbeddingConfig();

    return NextResponse.json({
      // Legacy compat — now includes Ollama as a valid AI provider
      hasApiKey: !!(config.openai_api_key || config.gemini_api_key || config.ollama_url || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.OLLAMA_URL),
      apiKeyPreview: config.openai_api_key ? `sk-...${config.openai_api_key.slice(-4)}` : null,
      source: config.openai_api_key ? 'database' : (process.env.OPENAI_API_KEY ? 'environment' : null),
      // New multi-provider
      providers: {
        openai: {
          configured: !!(config.openai_api_key || process.env.OPENAI_API_KEY),
          preview: config.openai_api_key ? `sk-...${config.openai_api_key.slice(-4)}` : (process.env.OPENAI_API_KEY ? 'env' : null),
        },
        gemini: {
          configured: !!(config.gemini_api_key || process.env.GEMINI_API_KEY),
          preview: config.gemini_api_key ? `...${config.gemini_api_key.slice(-4)}` : (process.env.GEMINI_API_KEY ? 'env' : null),
        },
        ollama: {
          configured: !!(config.ollama_url || process.env.OLLAMA_URL),
          url: config.ollama_url || process.env.OLLAMA_URL || null,
        },
      },
      embeddingProvider: embConfig?.provider || null,
    });
  } catch (error: unknown) {
    console.error('[settings GET]', error);
    // Return a safe fallback when DB is unavailable — check env vars only
    return NextResponse.json({
      hasApiKey: !!(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.OLLAMA_URL),
      apiKeyPreview: null,
      source: null,
      providers: {
        openai: { configured: !!process.env.OPENAI_API_KEY, preview: process.env.OPENAI_API_KEY ? 'env' : null },
        gemini: { configured: !!process.env.GEMINI_API_KEY, preview: process.env.GEMINI_API_KEY ? 'env' : null },
        ollama: { configured: !!process.env.OLLAMA_URL, url: process.env.OLLAMA_URL || null },
      },
      embeddingProvider: null,
      dbError: true,
    });
  }
}

/**
 * POST /api/v1/settings — store settings
 * Body: { apiKey, geminiKey, ollamaUrl, embeddingProvider, action }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Legacy: remove all keys
    if (body.action === 'remove') {
      await db.execute(sql`DELETE FROM settings WHERE key IN ('openai_api_key', 'gemini_api_key', 'ollama_url', 'embedding_provider')`);
      return NextResponse.json({ ok: true, message: 'All keys removed' });
    }

    // Save OpenAI key
    if (body.apiKey) {
      const key = body.apiKey.trim();
      // Test it
      const testRes = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!testRes.ok) {
        return NextResponse.json({ error: 'Invalid OpenAI API key' }, { status: 400 });
      }
      await upsertSetting('openai_api_key', key);
    }

    // Save Gemini key
    if (body.geminiKey) {
      const key = body.geminiKey.trim();
      // Test it
      const testRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
      );
      if (!testRes.ok) {
        return NextResponse.json({ error: 'Invalid Gemini API key' }, { status: 400 });
      }
      await upsertSetting('gemini_api_key', key);
    }

    // Save Ollama URL
    if (body.ollamaUrl) {
      await upsertSetting('ollama_url', body.ollamaUrl.trim());
    }

    // Save preferred embedding provider
    if (body.embeddingProvider) {
      await upsertSetting('embedding_provider', body.embeddingProvider);
    }

    return NextResponse.json({ ok: true, message: 'Settings saved' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function upsertSetting(key: string, value: string) {
  await db.execute(sql`
    INSERT INTO settings (key, value, updated_at) VALUES (${key}, ${value}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()
  `);
}
