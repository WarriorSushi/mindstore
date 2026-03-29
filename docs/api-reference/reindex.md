# Reindex API

The reindex API manages embedding backfill for memories that were imported or created without vectors.

## Why it exists

MindStore can accept imports even when embeddings are skipped:

- the import was too large to embed inline
- no embedding provider was configured at import time
- a provider call failed transiently

Instead of silently leaving those memories half-indexed forever, MindStore now records an indexing job and exposes its status.

## Endpoints

### `GET /api/v1/reindex`

Returns the current embedding state for the authenticated user.

Response shape:

```json
{
  "total": 120,
  "withEmbeddings": 100,
  "withoutEmbeddings": 20,
  "needsReindex": true,
  "latestJob": {
    "id": "uuid",
    "status": "pending",
    "remainingCount": 20
  }
}
```

### `POST /api/v1/reindex`

Runs one embedding-backfill batch immediately by default.

Optional request body:

```json
{
  "batchSize": 50,
  "runNow": true
}
```

Set `"runNow": false` to only queue a backfill job without processing a batch immediately.

Possible outcomes:

- `pending`: more memories still need embeddings
- `completed`: all memories now have embeddings
- `blocked`: no embedding provider is configured yet
- `failed`: the provider call failed and should be retried

## Operator workflow

For private installs or VPS jobs, you can process queued indexing batches with:

```bash
npm run jobs:run-indexing
```

This is intended for scheduled or repeated execution, similar to the plugin-jobs runner.
