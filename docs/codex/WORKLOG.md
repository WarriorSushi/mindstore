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
- Ship the first serious `MindStore Everywhere` capture and query surface.
- Raise the branch-specific quality bar with lint, unit tests, docs smoke tests, and typecheck.

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
- Added `GET` and `POST /api/v1/capture/query` plus `POST /api/v1/capture`.
- Added shared import, memory-ingest, and capture-normalization helpers so thin clients do not talk directly to import internals.
- Added API key generation, revocation, and bearer-token resolution for browser extension and external client auth.
- Added a real `MindStore Everywhere` setup section in Settings with API key management and doc links.
- Upgraded the browser extension popup with smarter source detection, richer capture modes, and lightweight query flow.
- Expanded docs with:
  - browser extension guide
  - capture API reference
  - plugin authoring and plugin runtime notes
  - deployment modes
  - MCP client setup
  - release note for capture and extension work
- Tightened settings-page typing so the codex lint ratchet stays green.

### Decisions

- Documentation is treated as product surface, not cleanup.
- Community plugins will first target safe extension surfaces: MCP, settings, widgets, panels, and jobs.
- `mindstore.config.ts` is the source of truth for deployment mode and loaded plugins.
- Canonical slugs win, but legacy aliases remain resolvable for compatibility.
- Capture clients are normalized server-side; browser extensions and future lightweight clients should stay thin.
- Backward compatibility matters for payload shapes during active parallel development, so capture routes accept both top-level and nested payload forms.

### Risks and Follow-Ups

- The visible `origin/frain/*` refs still lag the VPS status updates.
- MCP is now more runtime-aware, but a full official SDK migration is still a follow-up.
- Browser capture now has an authenticated path, but richer extension UX, stronger hosted auth ergonomics, and more robust site adapters are still follow-up work.
- Next.js/Turbopack still emits a tracing warning for the docs filesystem loader in `src/lib/docs.ts`; builds succeed, but the loader should be revisited for cleaner static tracing.

### Verification

- `npm run lint:ci`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run test:e2e`
