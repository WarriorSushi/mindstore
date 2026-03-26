# 2026-03-25: Topic Evolution Port

## What Changed

- ported Topic Evolution into `src/server/plugins/ports/topic-evolution.ts`
- added a thin `GET /api/v1/plugins/topic-evolution` route
- added the codex-side `/app/evolution` page
- reused the new shared vector/clustering helper instead of duplicating embedding math again
- added unit coverage for period building and shift detection

## Why It Matters

This confirms the new shared vector layer is not a one-off abstraction for Knowledge Gaps.

It now powers multiple codex analysis ports and makes later convergence work simpler for:

- mind-map-generator
- sentiment-timeline
- any later feature that needs topic clustering over embedded memories

## Remaining Gaps

- the codex page is a focused version of the evolution UI, not the full frain visualization surface yet
- Sentiment Timeline and Mind Map Generator are the next natural ports to reuse this shared foundation
