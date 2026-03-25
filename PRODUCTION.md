# MindStore Production Setup Guide

## Quick Start (Vercel + External PostgreSQL)

### 1. Set Environment Variables in Vercel Dashboard

Go to your Vercel project → Settings → Environment Variables → Add these:

```
DATABASE_URL=postgres://<user>:<password>@<host>:5432/<database>?sslmode=require
AUTH_SECRET=<generate-a-new-secret>
```

If you ever used credentials that were previously committed to this repository, treat them as compromised and rotate them before deploying.

**Optional (for Google login):**
```
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
```

Get Google OAuth credentials at: https://console.cloud.google.com/apis/credentials
- Create OAuth 2.0 Client ID
- Authorized redirect URI: `https://mindstore-sandy.vercel.app/api/auth/callback/google`

**Optional (default AI provider — users can also set via Settings page):**
```
GEMINI_API_KEY=<your-gemini-key>
```
Get free at: https://aistudio.google.com/apikey

### 2. Redeploy

After setting env vars, trigger a redeploy:
- Go to Deployments tab → click ⋮ on latest → Redeploy

### 3. Verify

Visit: `https://mindstore-sandy.vercel.app/api/health`

You should see:
```json
{
  "status": "healthy",
  "database": { "configured": true, "connected": true },
  ...
}
```

### 4. Run Database Migration (if tables don't exist)

Tables should already exist. If not, run locally:
```bash
DATABASE_URL=postgres://<user>:<password>@<host>:5432/<database>?sslmode=require npm run migrate
```

## Architecture

- **Frontend:** Next.js on Vercel (Edge/Serverless)
- **Database:** PostgreSQL with pgvector + pg_trgm
- **AI Providers:** Gemini (free) / OpenAI / Ollama — configurable per-user via Settings
- **Auth:** NextAuth v5 with Google OAuth (optional — works without auth in single-user mode)
- **MCP:** `/api/mcp` endpoint for Claude Desktop, Cursor, etc.

## MCP Connection

Users can connect any MCP client with:
```json
{
  "mcpServers": {
    "mindstore": {
      "url": "https://mindstore-sandy.vercel.app/api/mcp"
    }
  }
}
```

## Health Check

`GET /api/health` returns status of database, providers, and auth config.
