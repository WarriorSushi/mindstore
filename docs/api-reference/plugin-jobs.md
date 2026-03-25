# Plugin Job APIs

MindStore exposes two scheduling-oriented job surfaces today.

## `POST /api/v1/plugins`

Use the plugin action API to run jobs immediately or toggle simple schedules.

### Run a job now

Request body:

```json
{
  "slug": "community-hello",
  "action": "run-job",
  "jobId": "refresh"
}
```

Response:

```json
{
  "message": "Community Hello job completed",
  "jobId": "refresh",
  "result": {
    "status": "success",
    "summary": "Refreshed plugin data"
  }
}
```

### Enable or disable a scheduled job

Request body:

```json
{
  "slug": "writing-style-analyzer",
  "action": "configure-job-schedule",
  "jobId": "refresh-profile",
  "enabled": true,
  "intervalMinutes": 1440
}
```

Response:

```json
{
  "message": "Writing Style Analyzer schedule enabled",
  "jobId": "refresh-profile",
  "schedule": {
    "jobId": "refresh-profile",
    "pluginSlug": "writing-style-analyzer",
    "enabled": true,
    "intervalMinutes": 1440,
    "nextRunAt": "2026-03-26T10:00:00.000Z"
  }
}
```

## `POST /api/v1/plugin-jobs/run-due`

Runs due scheduled jobs through the shared plugin runtime.

Request body:

```json
{
  "limit": 10
}
```

Response:

```json
{
  "ok": true,
  "processed": 1,
  "results": [
    {
      "jobId": "refresh-profile",
      "pluginSlug": "writing-style-analyzer",
      "status": "success",
      "summary": "Updated writing profile",
      "details": [],
      "nextRunAt": "2026-03-26T10:00:00.000Z"
    }
  ]
}
```

## Current Constraints

- Scheduling is currently interval-based groundwork, not a full cron system.
- Scheduled execution is user-scoped, while plugin installation records are still global by slug.
- The current UI enables or disables daily automation; richer schedule editing is a later phase.

## Running Due Jobs From A VPS

MindStore now includes a CLI runner:

```bash
npm run jobs:run-due
```

Optional limit:

```bash
npm run jobs:run-due -- 25
```

This is the intended bridge for self-hosted cron or VPS task schedulers until a dedicated worker service lands.
