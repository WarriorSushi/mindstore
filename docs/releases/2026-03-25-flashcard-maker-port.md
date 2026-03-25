# 2026-03-25: Flashcard Maker Port

## What Changed

- ported Flashcard Maker from the active `frain` feature line into `codex/local-dev`
- added `flashcard_decks` persistence for per-user deck storage
- extracted Flashcard Maker logic into `src/server/plugins/ports/flashcard-maker.ts`
- added a codex-compatible route at `GET/POST /api/v1/plugins/flashcard-maker`
- added the `/app/flashcards` page plus navigation and command-palette entry points
- added unit tests for SM-2 logic and generated-card normalization
- added user docs and convergence notes so future ports have a concrete reference

## Why It Matters

This is the first serious feature port from `frain` into the codex branch.

That matters because it proves the convergence strategy is real:

- keep the useful product workflow
- move logic into reusable server modules
- adapt the wiring to codex runtime, docs, and testing expectations

## Remaining Gaps

- Flashcard Maker still talks to provider settings directly instead of a shared model-execution service
- review scheduling is user-driven inside the page; deeper automation can build on the newer plugin-job groundwork later
- local Playwright e2e is currently blocked by a dev-server startup timeout, so this slice is verified by build, lint, typecheck, and unit tests first
