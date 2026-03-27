import { NextResponse } from 'next/server';
import { log } from './logger';

/**
 * Standardized API error response format.
 * Every error from MindStore APIs follows this shape.
 */
interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

/**
 * Create a standardized error response.
 */
export function apiError(
  message: string,
  status: number = 500,
  options?: { code?: string; details?: unknown; module?: string }
): NextResponse {
  const body: ApiError = { error: message };
  if (options?.code) body.code = options.code;
  if (options?.details && process.env.NODE_ENV !== 'production') {
    body.details = options.details;
  }

  if (status >= 500 && options?.module) {
    log.error(options.module, message, options?.details as Record<string, unknown>);
  }

  return NextResponse.json(body, { status });
}

/**
 * Common error responses
 */
export const errors = {
  badRequest: (msg: string, module?: string) => apiError(msg, 400, { code: 'BAD_REQUEST', module }),
  unauthorized: (msg = 'Authentication required') => apiError(msg, 401, { code: 'UNAUTHORIZED' }),
  forbidden: (msg = 'Access denied') => apiError(msg, 403, { code: 'FORBIDDEN' }),
  notFound: (msg = 'Resource not found') => apiError(msg, 404, { code: 'NOT_FOUND' }),
  conflict: (msg: string) => apiError(msg, 409, { code: 'CONFLICT' }),
  tooLarge: (msg = 'Request too large') => apiError(msg, 413, { code: 'TOO_LARGE' }),
  rateLimited: (msg = 'Too many requests') => apiError(msg, 429, { code: 'RATE_LIMITED' }),
  internal: (msg: string, module: string, details?: unknown) => 
    apiError(msg, 500, { code: 'INTERNAL_ERROR', module, details }),
  dbUnavailable: () => apiError('Database temporarily unavailable', 503, { code: 'DB_UNAVAILABLE' }),
};

/**
 * Wrap an async API handler with consistent error handling.
 * Catches all errors and returns standardized error responses.
 * 
 * Usage:
 * ```ts
 * export const GET = withErrorHandler('my-route', async (req) => {
 *   // your logic
 *   return NextResponse.json({ data: ... });
 * });
 * ```
 */
export function withErrorHandler(
  module: string,
  handler: (req: Request) => Promise<NextResponse>
): (req: Request) => Promise<NextResponse> {
  return async (req: Request) => {
    try {
      return await handler(req);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      
      // Check for specific error types
      if (message.includes('connection') || message.includes('ECONNREFUSED')) {
        return errors.dbUnavailable();
      }
      
      return errors.internal(message, module, 
        process.env.NODE_ENV !== 'production' ? { stack: error instanceof Error ? error.stack : undefined } : undefined
      );
    }
  };
}
