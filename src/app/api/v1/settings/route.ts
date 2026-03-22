import { NextRequest, NextResponse } from 'next/server';
import { getServerApiKey, setServerApiKey, removeServerApiKey, testApiKeyServer } from '@/server/apikey';

/**
 * GET /api/v1/settings — get current settings (API key masked)
 */
export async function GET() {
  try {
    const key = await getServerApiKey();
    return NextResponse.json({
      hasApiKey: !!key,
      apiKeyPreview: key ? `sk-...${key.slice(-4)}` : null,
      source: key ? (process.env.OPENAI_API_KEY ? 'environment' : 'database') : null,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/v1/settings — store API key
 * Body: { apiKey: string } or { action: "remove" }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.action === 'remove') {
      await removeServerApiKey();
      return NextResponse.json({ ok: true, message: 'API key removed' });
    }

    const { apiKey } = body;
    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json({ error: 'apiKey required' }, { status: 400 });
    }

    // Validate the key
    const valid = await testApiKeyServer(apiKey.trim());
    if (!valid) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 400 });
    }

    await setServerApiKey(apiKey.trim());
    return NextResponse.json({
      ok: true,
      message: 'API key saved',
      apiKeyPreview: `sk-...${apiKey.trim().slice(-4)}`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
