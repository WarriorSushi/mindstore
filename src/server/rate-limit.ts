/**
 * Rate limiter — sliding window counter using in-memory Map.
 * Good enough for single-instance deployments (Vercel serverless uses per-invocation isolation,
 * so this effectively rate-limits per edge location which is fine).
 * 
 * For multi-instance production, swap to Redis-based rate limiting.
 */

const windows = new Map<string, { count: number; resetAt: number }>();

// Cleanup stale entries periodically
let lastCleanup = Date.now();
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return; // cleanup max once per minute
  lastCleanup = now;
  for (const [key, val] of windows) {
    if (val.resetAt < now) windows.delete(key);
  }
}

export interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

/** Default tiers */
export const RATE_LIMITS = {
  /** Standard API calls (search, memories, etc.) */
  standard: { limit: 120, windowSeconds: 60 } as RateLimitConfig,
  /** Write operations (import, capture) */
  write: { limit: 30, windowSeconds: 60 } as RateLimitConfig,
  /** AI operations (chat, embeddings) — more expensive */
  ai: { limit: 20, windowSeconds: 60 } as RateLimitConfig,
  /** Auth-related (login attempts) */
  auth: { limit: 10, windowSeconds: 300 } as RateLimitConfig,
} as const;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

/**
 * Check and consume a rate limit token.
 * @param key Unique key (e.g. `ip:1.2.3.4:chat` or `user:uuid:import`)
 * @param config Rate limit config
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  cleanup();
  
  const now = Date.now();
  const existing = windows.get(key);
  
  if (!existing || existing.resetAt < now) {
    // New window
    windows.set(key, { count: 1, resetAt: now + config.windowSeconds * 1000 });
    return { allowed: true, limit: config.limit, remaining: config.limit - 1, resetAt: now + config.windowSeconds * 1000 };
  }
  
  if (existing.count >= config.limit) {
    return { allowed: false, limit: config.limit, remaining: 0, resetAt: existing.resetAt };
  }
  
  existing.count++;
  return { allowed: true, limit: config.limit, remaining: config.limit - existing.count, resetAt: existing.resetAt };
}

/**
 * Get rate limit headers for a response.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
}
