# Batch C Import Ports — 2026-03-25

Ported all 6 Batch C import plugins from `frain/improve` to `codex/local-dev`.

## Plugins Ported

| Plugin | Category | Port Logic | Route | Test | Doc |
|--------|----------|-----------|-------|------|-----|
| twitter-importer | Import | ✅ | ✅ | ✅ (4 tests) | ✅ |
| telegram-importer | Import | ✅ | ✅ | ✅ (6 tests) | ✅ |
| pocket-importer | Import | ✅ | ✅ | ✅ (5 tests) | ✅ |
| readwise-importer | Import | ✅ | ✅ | ✅ (2 tests) | ✅ |
| spotify-importer | Import | ✅ | ✅ | ✅ (5 tests) | ✅ |
| image-to-memory | AI/Import | ✅ | ✅ | ✅ (10 tests) | ✅ |

## Architecture

All ports follow the codex pattern:
- **Port logic** in `src/server/plugins/ports/<slug>.ts` — pure parsing, formatting, API clients
- **Thin route** in `src/app/api/v1/plugins/<slug>/route.ts` — auth, plugin install, delegates to port
- **Import service** — routes use `importDocuments()` from `import-service.ts` for storage + embeddings
- **Registry** — all plugins already declared in `src/server/plugins/registry.ts`

## Bug Fix

Fixed Twitter importer `tweetId` extraction: bookmark format uses `tweetId` field but the parser only checked `id_str` and `id`. Added `tweetId` fallback in both parsing paths.

## Test Results

32 tests passed across 6 test files. All pure unit tests — no DB or network required.

## What's Next

- **Batch D (Export/Sync):** anki-export, markdown-blog-export, notion-sync, obsidian-sync
- **Batch E (Advanced AI):** custom-rag, domain-embeddings, multi-language
