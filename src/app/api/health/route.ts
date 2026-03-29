import { NextResponse } from 'next/server';
import { dbHealthy } from '@/server/db';
import { getIdentityMode, isGoogleAuthConfigured, isSingleUserModeEnabled } from '@/server/identity';
import { getDatabaseConnectionDiagnostics } from '@/server/postgres-client';

/**
 * GET /api/health — production health check
 */
export async function GET() {
  const dbOk = await dbHealthy();
  const dbDiagnostics = getDatabaseConnectionDiagnostics(process.env.DATABASE_URL);

  const status = {
    status: dbOk ? 'healthy' : 'unhealthy',
    database: {
      configured: dbDiagnostics.configured,
      connected: dbOk,
      connection: dbDiagnostics,
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
