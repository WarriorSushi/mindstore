# 2026-03-30: Import and Indexing Durability

This slice makes MindStore honest about indexing state.

## What changed

- Added durable embedding-backfill jobs in `indexing_jobs`
- Reindex API now exposes latest backfill job status
- Imports and single-memory creation now queue backfill when vectors are skipped
- Added a dedicated indexing runner script: `npm run jobs:run-indexing`
- Updated Settings reindex UX to stop infinite-looping when backfill is blocked

## Why it matters

Before this slice, large imports or provider-missing imports could land without embeddings and stay that way until a user manually discovered the problem.

Now the app can:

- say that indexing is incomplete
- queue recovery work
- expose the latest backfill job
- let operators process that recovery work explicitly
