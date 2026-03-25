# Batch D: Export & Sync Ports — 2026-03-25

## Summary

Ported all 4 Export/Sync plugins from `frain/improve` to `codex/local-dev`:

- **anki-export** — Export flashcard decks as Anki-native TSV or universal CSV
- **markdown-blog-export** — Export memories as blog-ready markdown for Hugo, Jekyll, Astro, Next.js, or plain
- **notion-sync** — Push memories to Notion databases with rate-limited batching and dedup tracking
- **obsidian-sync** — Export vault with YAML frontmatter, wikilinks, backlinks, and configurable folder structure

## Files Added

### Port Logic (src/server/plugins/ports/)
- `anki-export.ts` — 303 lines: TSV/CSV generation, ZIP packaging, deck summaries
- `markdown-blog-export.ts` — 230 lines: 5 framework templates, frontmatter, slug generation
- `notion-sync.ts` — 397 lines: Notion API client, push with rate limiting, sync records
- `obsidian-sync.ts` — 347 lines: vault file map builder, wikilinks, folder structure

### Thin Routes (src/app/api/v1/plugins/)
- `anki-export/route.ts` — GET (decks/preview/config) + POST (export/export-csv)
- `markdown-blog-export/route.ts` — GET (config/preview) + POST (export)
- `notion-sync/route.ts` — GET (config/history/preview) + POST (validate/save-config/create-database/sync/disconnect)
- `obsidian-sync/route.ts` — GET (config/preview) + POST (save-config/export)

### Tests (tests/unit/)
- `anki-export.test.ts` — 12 tests: summaries, TSV/CSV generation, ZIP packaging, stats
- `markdown-blog-export.test.ts` — 15 tests: slugify, templates, file naming, frontmatter, content building
- `notion-sync.test.ts` — 10 tests: config defaults, source mapping, unsync filtering, sync records
- `obsidian-sync.test.ts` — 17 tests: slugify, folders, markdown gen, vault builder, dedup, preview

### Docs (docs/plugins/)
- `anki-export.md`, `markdown-blog-export.md`, `notion-sync.md`, `obsidian-sync.md`

## Test Results
54 tests, all passing.

## Remaining
- **Batch E (Advanced AI):** custom-rag, domain-embeddings, multi-language
