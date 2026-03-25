# 2026-03-25: Notion Importer Port

Codex upgraded Notion import from a markdown-file fallback into a real Notion export workflow.

## Included Changes

- new portable parser/chunker at `src/server/plugins/ports/notion-importer.ts`
- new API route at `src/app/api/v1/plugins/notion-importer/route.ts`
- plugin registry import-tab metadata for ZIP exports
- Import page preview/import flow for Notion export ZIPs with database stats

## Why It Matters

- codex now supports one of the most important mainstream knowledge imports in a form closer to frain's feature breadth
- users can preview Notion pages and database rows before import
- Notion is no longer treated as just a loose markdown cleanup step
