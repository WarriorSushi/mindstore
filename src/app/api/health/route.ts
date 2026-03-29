import { NextResponse } from 'next/server';
import { dbHealthy } from '@/server/db';
import { getIdentityMode, isGoogleAuthConfigured, isSingleUserModeEnabled } from '@/server/identity';

/**
 * GET /api/health — production health check
 */
export async function GET() {
  const dbOk = await dbHealthy();
  const hasDbUrl = !!process.env.DATABASE_URL;

  const status = {
    status: dbOk ? 'healthy' : 'unhealthy',
    database: {
      configured: hasDbUrl,
      connected: dbOk,
    },
    providers: {
      openai: !!(process.env.OPENAI_API_KEY),
      gemini: !!(process.env.GEMINI_API_KEY),
      ollama: !!(process.env.OLLAMA_URL),
    },
    auth: {
      google: isGoogleAuthConfigured(),
      secret: !!(process.env.AUTH_SECRET),
      singleUserMode: isSingleUserModeEnabled(),
      identityMode: getIdentityMode(),
    },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(status, {
    status: dbOk ? 200 : 503,
  });
}
