# Plugin Widgets and Jobs

MindStore plugins can now expose two runtime-backed product surfaces without editing core app code:

- Dashboard widgets for lightweight summaries and entry points.
- Jobs for manual or scheduled work that should be observable and repeatable.

## Widget Contract

Widget metadata lives in the plugin manifest under `ui.dashboardWidgets`.

Each widget should declare:

- `id`
- `title`
- `description`
- `size`
- `priority`
- optional `cta`

Runtime behavior lives in the plugin module under `dashboard.widgets`.

The runtime matches handlers to manifest entries by `id`. If a handler exists without a matching manifest entry, startup fails fast.

## Job Contract

Job metadata lives in the plugin manifest under `jobs`.

Each job should declare:

- `id`
- `name`
- `description`
- `trigger`
- optional `scheduleLabel`

Runtime behavior lives in the plugin module under `jobs`.

The runtime matches job handlers to manifest definitions by `id`.

## What Users See

- Active installed widgets are loaded through `/api/v1/plugins/runtime?action=dashboard`.
- Plugin detail pages show declared widgets and jobs even before installation.
- Manual job runs can be triggered from the Plugins page.
- Scheduled jobs can now be enabled or disabled from the Plugins page without editing config files.
- Scheduled jobs show their next run time plus the latest scheduled execution summary or error.
- Job run summaries are stored on the plugin record so the latest result is visible later.

## Scheduling Groundwork

MindStore now persists per-user schedules for plugin jobs that declare `trigger: "scheduled"`.

Current behavior:

- schedules are stored in `plugin_job_schedules`
- each schedule is keyed by `userId + pluginSlug + jobId`
- plugins can enable or disable automation from the product UI
- a shared runner executes due jobs through `POST /api/v1/plugin-jobs/run-due`
- the latest scheduled status, summary, and error are written back to the schedule row

Current limitation:

- interval control is intentionally simple for now and defaults to daily execution
- background execution is still an app-triggered foundation, not yet a full worker/cron service
- plugin run metadata still lives on the plugin record, while schedules are user-scoped

For self-hosted setups, a VPS can already execute due work through:

```bash
npm run jobs:run-due
```

## Community Plugin Example

`packages/example-community-plugin` now demonstrates:

- schema-backed settings
- an MCP tool and resource
- a dashboard widget
- a job surface that can grow into scheduled automation

This is the reference path for community authors who want to extend MindStore safely.
