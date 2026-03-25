# Notion Importer

The enhanced Notion importer reads full Notion export ZIPs instead of treating Notion as loose markdown files.

## What It Does

- parses markdown pages and nested page hierarchies from a Notion export ZIP
- parses CSV database exports into searchable database-row memories
- removes Notion UUID filename noise
- preserves page-level smart chunks during import

## Codex Port Notes

- portable parsing and chunking logic lives in `src/server/plugins/ports/notion-importer.ts`
- ZIP extraction stays in the route at `src/app/api/v1/plugins/notion-importer/route.ts`
- the Import page now uses the richer ZIP preview/import flow instead of the old markdown-only fallback
