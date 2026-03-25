# Codex Worklog

This file is the durable engineering log for Codex work in `codex/*` branches.

## Session: 2026-03-25

### Branch

- `codex/local-dev`

### Scope

- Preserve and carry forward the initial client-side React lint fixes.
- Establish repository trust and contributor scaffolding.
- Add a real documentation surface under `/docs`.
- Introduce a config-driven plugin runtime foundation and a sample external plugin.
- Start turning MCP discovery into a runtime-driven surface instead of a hardcoded list.

### Changes Completed

- Fixed client-side React lint issues in:
  - `src/app/app/connect/page.tsx`
  - `src/components/KeyboardShortcuts.tsx`
  - `src/components/Onboarding.tsx`
- Added docs content structure under `docs/`.
- Added a docs web surface backed by markdown files in the repository.
- Added `mindstore.config.ts`.
- Added package scaffolding for:
  - `@mindstore/plugin-sdk`
  - `@mindstore/plugin-runtime`
  - `@mindstore/example-community-plugin`
- Added canonical plugin alias handling for legacy slugs.
- Updated plugin registry and MCP plumbing to begin using runtime-loaded plugin definitions.
- Added governance and trust files:
  - `LICENSE`
  - `SECURITY.md`
  - `CONTRIBUTING.md`
  - `CODE_OF_CONDUCT.md`
- Sanitized `PRODUCTION.md` and added credential-rotation guidance.
- Added API key generation, revocation, and bearer-token resolution for external clients.
- Added `POST /api/v1/capture` and `POST /api/v1/capture/query`.
- Added shared memory-ingest and capture-normalization helpers.
- Added a real `MindStore Everywhere` setup section in Settings.
- Added docs navigation ordering and sidebar search so the docs surface scales more cleanly.
- Expanded extension docs, API docs, examples, and release notes around browser capture.

### Decisions

- Documentation is treated as product surface, not cleanup.
- Community plugins will first target safe extension surfaces: MCP, settings, widgets, panels, and jobs.
- `mindstore.config.ts` is the source of truth for deployment mode and loaded plugins.
- Canonical slugs win, but legacy aliases remain resolvable for compatibility.

### Risks and Follow-Ups

- Full-repo lint still has a pre-existing backlog outside the codex-touched surfaces.
- The visible `origin/frain/*` refs still lag the VPS status updates.
- MCP is now more runtime-aware, but a full official SDK migration is still a follow-up.
- Browser capture now has an authenticated path, but richer extension UX and more adapters are still follow-up work.

### Verification

- `npm run lint:ci`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run test:e2e`
