# 2026-03-25: Action Parity Batch On Codex

MindStore's full action-plugin batch is now live on `codex/local-dev`.

## Included

- Blog Draft Generator
- Conversation Prep
- Newsletter Writer
- Resume Builder
- Learning Paths

## What Landed

- Shared plugin-config helpers for manifest-backed install/bootstrap and plugin config persistence.
- Thin codex API routes for all five action plugins.
- Dedicated app pages at:
  - `/app/blog`
  - `/app/conversation`
  - `/app/newsletter`
  - `/app/resume`
  - `/app/paths`
- Updated plugin registry metadata, sidebar/command-palette discoverability, plugin docs, and lint coverage.
- New unit coverage for action-plugin helpers.

## Why It Matters

This completes Action Parity Batch B in the convergence program. Codex now holds the full analysis batch and the full action batch, which shifts the remaining convergence focus to import parity, export/sync parity, and advanced AI/media features.

## Verification

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test`
- `npm run build`

`npm run test:e2e` timed out during this session and should be re-run on the committed branch.

