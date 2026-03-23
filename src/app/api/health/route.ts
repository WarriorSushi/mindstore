import { NextResponse } from 'next/server';
import { dbHealthy } from '@/server/db';

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
      google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      secret: !!(process.env.AUTH_SECRET),
    },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(status, {
    status: dbOk ? 200 : 503,
  });
}
