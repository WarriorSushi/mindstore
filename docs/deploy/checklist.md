# Deployment Checklist

Use this checklist before calling a MindStore deployment production-ready.

## Required

- `DATABASE_URL` points to PostgreSQL with `pgvector` and `pg_trgm`.
- If you are using Supabase on Vercel, `DATABASE_URL` uses the transaction pooler URI.
- `npm run migrate` has been run against that database.
- At least one AI provider is configured if you expect semantic search or chat to work.
- `AUTH_SECRET` is set for any deployment that uses session auth.

## Public Multi-User Deployments

- Google OAuth is configured with `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- `ALLOW_SINGLE_USER_MODE=false` is set so anonymous traffic does not fall back to the shared default user.
- You have verified that a signed-in user only sees their own memories, chats, and notifications.

## Private / Single-User Deployments

- You are intentionally allowing the default user fallback.
- The app is behind your own access controls if it is reachable from the public internet.

## Verification

- `/api/health` returns a healthy database connection.
- First import succeeds.
- Search returns imported content.
- Chat can answer against imported content.
- `/api/mcp` is reachable from an MCP client.

## Recommended Before Announcing

- `npm run build`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e`
