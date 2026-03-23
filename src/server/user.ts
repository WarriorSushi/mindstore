import { auth } from '@/server/auth';
import { headers } from 'next/headers';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Get the current user ID from NextAuth session or fallback to default.
 * 
 * Priority:
 * 1. NextAuth JWT session (if Google OAuth configured)
 * 2. x-user-id header (for API clients / MCP)
 * 3. Default UUID (single-user / self-hosted mode)
 */
export async function getUserId(): Promise<string> {
  try {
    const session = await auth();
    if ((session as any)?.userId) {
      return (session as any).userId;
    }
  } catch {
    // Auth not configured (no GOOGLE_CLIENT_ID) — fall through
  }

  try {
    const hdrs = await headers();
    const headerUserId = hdrs.get('x-user-id');
    if (headerUserId) return headerUserId;
  } catch {
    // headers() not available in some contexts
  }

  return DEFAULT_USER_ID;
}
