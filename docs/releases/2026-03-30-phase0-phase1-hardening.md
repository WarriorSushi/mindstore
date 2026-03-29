# 2026-03-30: Phase 0 + Phase 1 Hardening

This release focused on trust, setup truth, and identity consistency rather than new feature breadth.

## What Changed

- Fixed install and deployment docs drift:
  - `npm run migrate` is now the canonical migration command throughout the docs.
  - Public deployment guidance now clearly distinguishes single-user mode from multi-user mode.
- Added operator checklists:
  - `docs/deploy/checklist.md`
  - `docs/getting-started/first-run-checklist.md`
- Added a shared identity config module so the default user and auth-mode checks come from one place.
- Removed request-time schema creation from the main API offenders by moving these tables into the migration:
  - `search_history`
  - `chat_conversations`
  - `memory_reviews`
  - `tags`
  - `memory_tags`
  - `notifications`
  - `image_analyses`
- Fixed the notifications user mismatch so the API no longer writes to a different hardcoded default user than the rest of the app.
- Added Supabase transaction-pooler compatibility for `postgres.js` by disabling prepared statements automatically for pooler URLs.

## Operational Outcome

- The migration was run successfully against the configured Supabase database.
- The app can now use a Supabase transaction-pooler `DATABASE_URL` without the common prepared-statement failure mode.

## What This Does Not Solve Yet

- A public deployment still needs real OAuth configured and `ALLOW_SINGLE_USER_MODE=false` before it behaves like a proper multi-user SaaS.
- Chat provider logic still needs to converge fully onto the shared AI client.
- Large imports still need a more durable asynchronous indexing path.
