import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, rateLimitHeaders, type RateLimitConfig, RATE_LIMITS } from './rate-limit';

/**
 * Extract a rate-limiting key from the request.
 * Uses: x-forwarded-for → x-real-ip → 'unknown'
 */
export function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

export { RATE_LIMITS };

/**
 * Apply rate limiting to an API route.
 * Returns a NextResponse with 429 if rate limited, or null if allowed.
 * 
 * Usage:
 * ```ts
 * const limited = applyRateLimit(req, 'chat', RATE_LIMITS.ai);
 * if (limited) return limited;
 * ```
 */
export function applyRateLimit(
  req: NextRequest,
  endpoint: string,
  config: RateLimitConfig = RATE_LIMITS.standard,
): NextResponse | null {
  const ip = getClientIp(req);
  const key = `${ip}:${endpoint}`;
  const result = checkRateLimit(key, config);

  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders(result),
          'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  return null;
}
