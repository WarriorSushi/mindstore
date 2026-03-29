# Quickstart

This quickstart is optimized for first value, not maximum configuration.

## Install

1. Clone the repo.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Set `DATABASE_URL` to a PostgreSQL database with `pgvector` enabled.
5. If you are using Supabase on Vercel, prefer the transaction pooler URI.
6. Optionally add one AI provider so semantic search and chat work on day one.
7. Run `npm run migrate`.
8. Start the app with `npm run dev`.

## Public Deployment Warning

- If you are deploying a public instance, do not rely on the single-user fallback.
- Configure Google OAuth and set `ALLOW_SINGLE_USER_MODE=false`.
- A public instance without auth behaves like a shared workspace.

## First Success

The fastest path to value is:

1. Import one source.
2. Search for a term you know is inside it.
3. Open Chat and ask for a summary using those memories.
4. Connect an MCP client after the first import works.

## What Good Looks Like

- You can see at least one imported source in the UI.
- Search returns relevant memories.
- Chat can cite your content.
- MCP exposes the same knowledge to external clients.

## Canonical Commands

```bash
npm install
npm run migrate
npm run dev
```
