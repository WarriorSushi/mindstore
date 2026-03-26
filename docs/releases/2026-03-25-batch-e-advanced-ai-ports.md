# Batch E: Advanced AI Ports — 2026-03-25

## Summary

Ported all 3 Advanced AI plugins from `frain/improve` to `codex/local-dev`:

- **custom-rag** — 6 swappable retrieval strategies (Default, HyDE, Multi-Query, Reranking, Contextual Compression, Maximal)
- **domain-embeddings** — Domain detection (code, medical, legal, scientific, financial) with optimized model recommendations
- **multi-language** — Script detection, heuristic + AI language detection, translation, cross-language search

## Files Added

### Port Logic (src/server/plugins/ports/)
- `custom-rag.ts` — 453 lines: HyDE, multi-query, reranking, compression, maximal strategies
- `domain-embeddings.ts` — 299 lines: 6 domain profiles, keyword detection, model recommendations
- `multi-language.ts` — 240 lines: Unicode script analysis, heuristic + AI detection, translation

### Thin Routes (src/app/api/v1/plugins/)
- `custom-rag/route.ts` — GET (config/stats/benchmark) + POST (save-config/test-query)
- `domain-embeddings/route.ts` — GET (config/stats/detect/models) + POST (save-config/tag-domain/batch-detect)
- `multi-language/route.ts` — GET (stats/check/detect/translate/search) + POST (tag/batch-tag/translate/save-config)

### Tests (tests/unit/)
- `custom-rag.test.ts` — 9 tests: config, strategy info, HyDE, multi-query, reranking, compression
- `domain-embeddings.test.ts` — 14 tests: profiles, detection (code/medical/legal/financial/scientific), model filtering
- `multi-language.test.ts` — 19 tests: script detection (6 scripts), heuristic detect, language API

### Docs (docs/plugins/)
- `custom-rag.md`, `domain-embeddings.md`, `multi-language.md`

## Test Results
42 tests, all passing.

## 🎉 ALL BATCHES COMPLETE

With Batch E done, all plugins have been ported from `frain/improve` to `codex/local-dev`:

| Batch | Category | Plugins | Tests |
|-------|----------|---------|-------|
| A (Analysis) | Analysis | contradiction-finder, writing-style, knowledge-gaps, topic-evolution, sentiment-timeline | ~25 |
| B (Actions) | Actions | flashcard-maker, mind-map-generator, learning-paths, conversation-prep, blog-draft, newsletter-writer, resume-builder | ~30 |
| B.5 (Imports) | Import | kindle-importer, obsidian-importer, notion-importer, browser-bookmarks, reddit-saved, youtube-transcript, voice-to-memory, pdf-epub-parser | ~25 |
| C (Imports) | Import | twitter, telegram, pocket, readwise, spotify, image-to-memory | 32 |
| D (Export/Sync) | Export | anki-export, markdown-blog-export, notion-sync, obsidian-sync | 54 |
| E (Advanced AI) | AI | custom-rag, domain-embeddings, multi-language | 42 |
