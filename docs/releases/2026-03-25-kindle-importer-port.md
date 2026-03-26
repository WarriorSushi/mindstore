# 2026-03-25: Kindle Importer Port

## What Changed

- extracted Kindle parsing, deduplication, grouping, preview, and import preparation into `src/server/plugins/ports/kindle-importer.ts`
- replaced the large route body with a thin wrapper at `/api/v1/plugins/kindle-importer`
- kept the existing Import page contract intact
- added unit coverage for parsing and deduplication behavior
- documented Kindle Importer as the importer reference port for convergence

## Why It Matters

This gives codex its first importer-style reference port from the frain feature line.

That matters because future import ports can now follow a clear model:

- parser logic extracted
- preview logic reusable
- route stays thin
- import persistence goes through codex primitives

## Remaining Gaps

- other importer routes still need the same extraction treatment
- importer-specific test fixtures can still be expanded
- deeper plugin-runtime importer generalization remains future work
