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
- Job run summaries are stored on the plugin record so the latest result is visible later.

## Community Plugin Example

`packages/example-community-plugin` now demonstrates:

- schema-backed settings
- an MCP tool and resource
- a dashboard widget
- a manual job

This is the reference path for community authors who want to extend MindStore safely.
