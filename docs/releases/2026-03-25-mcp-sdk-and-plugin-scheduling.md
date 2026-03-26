# 2026-03-25: MCP SDK Route and Plugin Scheduling Groundwork

## What Changed

- moved `POST /api/mcp` and `DELETE /api/mcp` onto the official MCP TypeScript SDK transport
- kept `GET /api/mcp` as a simple discovery endpoint for docs and diagnostics
- added persistent per-user plugin job schedules via `plugin_job_schedules`
- added schedule enable/disable support to the Plugins page
- added a due-job runner endpoint at `POST /api/v1/plugin-jobs/run-due`
- added a CLI runner at `npm run jobs:run-due` for VPS cron integration
- added unit coverage for scheduling helpers

## Why It Matters

MindStore now has a cleaner MCP foundation and a more credible automation path for plugins.

This closes two important gaps:

- MCP is less custom and closer to the official server model
- plugin jobs are no longer manual-only in product terms

## Remaining Gaps

- scheduled jobs still need a long-running worker or cron-backed execution story
- scheduling UI is intentionally simple and daily by default
- the MCP route is using JSON-response mode first, not full streaming/session behavior
