# 2026-03-25: Knowledge Gaps Port

## What Changed

- added `src/server/plugins/ports/shared-vectors.ts` for reusable embedding parsing, similarity, clustering, and topic-label helpers
- ported Knowledge Gaps into `src/server/plugins/ports/knowledge-gaps.ts`
- added a thin `GET /api/v1/plugins/knowledge-gaps` route
- added the codex-side `/app/gaps` page
- added unit coverage for density classification, bridge-gap detection, and isolated-topic detection

## Why It Matters

This port moves codex beyond single-feature convergence and starts building shared analysis infrastructure.

That matters because the same vector helper layer can support:

- topic-evolution
- mind-map-generator
- sentiment and clustering-heavy analysis

## Remaining Gaps

- the fetched `origin/frain/improve` ref still does not expose frain's claimed `ports/*` files, so codex is still reconstructing some ports from visible route implementations
- Topic Evolution, Sentiment Timeline, and Mind Map Generator still need to land on top of the new shared vector layer
- the current page is a focused codex UI, not the full frain visualization surface yet
