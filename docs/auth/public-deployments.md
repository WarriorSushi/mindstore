# Public Deployment Auth Guide

If your MindStore instance is available on a public URL, do **not** leave it in shared single-user mode.

## Required env vars

- `DATABASE_URL`
- `AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ALLOW_SINGLE_USER_MODE=false`

## Why this matters

MindStore uses one Postgres database for all users. Isolation comes from authenticated `user_id` scoping, not from one database per person.

If `ALLOW_SINGLE_USER_MODE=true` on a public deployment, unauthenticated visitors can fall back to the same default workspace. That mode is only acceptable for:

- local development
- personal self-hosted installs
- temporary demos on a private URL

## Recommended production setup

1. Use a hosted Postgres database such as Supabase, Neon, Railway, or RDS.
2. Add the Google OAuth env vars in Vercel.
3. Set `ALLOW_SINGLE_USER_MODE=false`.
4. Redeploy.
5. Confirm `/api/health` reports:
   - `auth.google=true`
   - `auth.singleUserMode=false`
   - `auth.identityMode="google-oauth"`

## Supabase note

Supabase is only the database in the current architecture. You do **not** need Supabase Auth unless MindStore later migrates its identity layer there.
