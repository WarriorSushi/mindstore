import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware — security headers + request validation.
 * 
 * Rate limiting is done at the route level (not middleware) because
 * Vercel edge middleware has limited access to Node APIs.
 */
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const { pathname } = req.nextUrl;

  // === Security Headers ===
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-XSS-Protection', '0'); // Modern CSP replaces this
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');

  // === API-specific protections ===
  if (pathname.startsWith('/api/')) {
    // Enforce JSON content-type on POST/PATCH/PUT (except multipart for file uploads)
    const method = req.method;
    if (['POST', 'PATCH', 'PUT'].includes(method)) {
      const ct = req.headers.get('content-type') || '';
      if (!ct.includes('application/json') && !ct.includes('multipart/form-data') && !ct.includes('text/')) {
        // Allow requests with no content-type (some clients omit it for empty bodies)
        if (ct && ct !== '') {
          return NextResponse.json(
            { error: 'Unsupported Content-Type' },
            { status: 415, headers: Object.fromEntries(res.headers) }
          );
        }
      }
    }

    // Block requests with suspiciously large content-length (50MB max)
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Request too large. Maximum 50MB.' },
        { status: 413, headers: Object.fromEntries(res.headers) }
      );
    }

    // CORS for API routes
    const origin = req.headers.get('origin');
    if (origin) {
      res.headers.set('Access-Control-Allow-Origin', origin);
      res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
      res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');
      res.headers.set('Access-Control-Max-Age', '86400');
    }

    // Handle preflight
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: Object.fromEntries(res.headers) });
    }
  }

  return res;
}

export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
    // Match app routes (for security headers)
    '/app/:path*',
    // Match landing page
    '/',
  ],
};
