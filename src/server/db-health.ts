/**
 * Database health monitor.
 * 
 * Caches connection status for a few seconds to avoid hammering
 * the DB with health checks on every request.
 */

import { db } from './db';
import { sql } from 'drizzle-orm';

let lastCheck = 0;
let lastResult = true;
const CHECK_INTERVAL = 5000; // 5 seconds

/**
 * Quick DB health check with caching.
 * Returns true if the database is reachable.
 */
export async function isDbHealthy(): Promise<boolean> {
  const now = Date.now();
  if (now - lastCheck < CHECK_INTERVAL) {
    return lastResult;
  }
  
  try {
    await db.execute(sql`SELECT 1`);
    lastCheck = now;
    lastResult = true;
    return true;
  } catch {
    lastCheck = now;
    lastResult = false;
    return false;
  }
}

/**
 * Wrapper for API route handlers that gracefully handles DB failures.
 * Returns a 503 Service Unavailable instead of a 500 crash.
 */
export function withDbCheck<T extends (...args: any[]) => Promise<Response>>(
  handler: T
): T {
  return (async (...args: any[]) => {
    const healthy = await isDbHealthy();
    if (!healthy) {
      return Response.json(
        { error: 'Database temporarily unavailable. Please try again in a moment.' },
        { status: 503 }
      );
    }
    return handler(...args);
  }) as T;
}
