# Branch Convergence Program

Date: March 25, 2026

This document turns codex/frain convergence into an explicit program instead of a sequence of isolated ports.

> Update on March 29, 2026:
> `main` now contains the live production hotfix plus the public feature superset that had previously outpaced `origin/codex/local-dev`.
> `codex/local-dev` has been fast-forwarded onto `main`, so codex is re-anchored to the current public mainline again.
> The remaining convergence task is no longer “port codex up to main”; it is “keep codex and frain rebased on main so divergence stops reopening.”

## Current State

### Codex Strengths

- plugin SDK and runtime
- official MCP SDK transport groundwork
- docs system and architecture records
- governance, licensing, contribution flow, CI, tests
- browser extension and capture APIs
- plugin jobs, scheduling groundwork, runtime widgets/settings
- shared AI client
- codex-native ports of Flashcard Maker and Voice-to-Memory

### Frain Strengths

- broad feature surface across analysis, action, export, and AI plugins
- many dedicated workflow pages already implemented
- plugin-store/product breadth
- grouped sidebar and stronger recent UX polish
- more end-user-visible “rooms” already built

### Convergence Rule

`codex/local-dev` is the destination architecture.

`frain/improve` is the feature reservoir plus UX-polish line.

That means:

- codex absorbs feature logic and selected UI from frain
- frain avoids creating new backend/runtime patterns that codex would later have to undo
- both branches should trend toward the same product capabilities, even before they become the same git shape

## What Is Already Converged

- product context docs such as `IMPROVEMENTS.md` and `MIND_FILE_SPEC.md`
- Flashcard Maker as the first full reference port
- Voice-to-Memory as the second full reference port
- shared AI client direction
- “codex is the base” working agreement
- the full analysis batch on codex:
  - contradiction-finder
  - writing-style
  - knowledge-gaps
  - topic-evolution
  - sentiment-timeline
  - mind-map-generator
- the full action batch on codex:
  - blog-draft
  - conversation-prep
  - newsletter-writer
  - resume-builder
  - learning-paths

## What Still Exists Only On Frain

### Analysis

- no major analysis plugin remains frain-only

### AI / Media / Retrieval

- Image-to-Memory
- Custom RAG
- Multi-Language Support
- Domain-Specific Embeddings

### Export / Sync

- Anki Export
- Markdown Blog Export
- Notion Sync
- Obsidian Sync

### Import Expansion

- Twitter Importer
- Telegram Importer
- Pocket Importer
- Spotify Importer
- Readwise Importer
- richer Notion importer

### UX Layer

- grouped sidebar/navigation patterns
- broader command-palette integration
- several polished dedicated app pages

## Convergence Goal

The goal is not to keep two permanent first-class branches alive forever.

The goal is:

1. codex becomes feature-complete enough to subsume frain
2. frain’s remaining unique logic gets extracted and ported
3. branch divergence stops growing
4. one branch becomes the real future line

## Program Structure

### Phase 1: Foundation Lock

Status: mostly complete

Definition:

- codex owns runtime, docs, testing, MCP, extension, governance
- frain stops inventing parallel architecture
- shared AI client exists
- first two convergence ports are complete

Exit criteria:

- no new plugin route on frain should introduce a new independent provider-resolution pattern
- no new major core architecture work starts on frain without codex alignment

### Phase 2: Portable Logic Extraction

Primary owner: frain

Definition:

- frain extracts business logic from route-heavy plugins into reusable modules
- route files become thinner on frain too
- codex gets cleaner inputs for future ports

Target outputs:

- `src/server/plugins/ports/<slug>.ts` on frain for remaining major plugins
- extracted prompt builders
- extracted parser utilities
- extracted result-normalization helpers

Priority extraction order:

1. contradiction-finder
2. kindle-importer
3. writing-style
4. image-to-memory
5. newsletter-writer
6. resume-builder

### Phase 3: Capability Parity On Codex

Primary owner: codex

Definition:

- codex ports the highest-value frain features in themed batches
- each batch lands with docs, tests, and runtime-safe wiring

Batch A: Analysis parity

- contradiction-finder
- writing-style
- knowledge-gaps
- topic-evolution
- sentiment-timeline

Status: complete on codex

Batch B: Action parity

- blog-draft
- newsletter-writer
- resume-builder
- conversation-prep
- learning-paths

Status: complete on codex

Batch C: Import parity

- kindle-importer
- youtube-transcript
- pdf-epub-parser
- browser-bookmarks
- obsidian-importer
- reddit-saved
- notion-importer
- twitter-importer
- telegram-importer
- pocket-importer
- spotify-importer
- readwise-importer

Status: in progress on codex

Batch D: Export/sync parity

- anki-export
- markdown-blog-export
- notion-sync
- obsidian-sync

Batch E: Advanced AI parity

- image-to-memory
- multi-language
- custom-rag
- domain-embeddings

### Phase 4: UX Reconciliation

Shared ownership

Definition:

- codex keeps its architecture
- frain’s strongest UX/navigation work is ported without throwing away codex docs/runtime/test shape

Scope:

- grouped sidebar
- command palette improvements
- best page-level visual treatments
- dashboard surface cleanup

### Phase 5: Branch Collapse

Definition:

- frain no longer carries meaningful product capability that codex does not
- active development consolidates on one branch

Exit options:

1. freeze frain and continue only on codex
2. make frain a short-lived rebase line on top of codex
3. open a final controlled merge/reconciliation PR once differences are small enough

Recommended option:

- freeze frain as a source/reference branch after parity is reached
- continue on codex only

## Operational Rules

### Codex Owns

- plugin runtime
- shared AI client
- MCP integration
- scheduling/job semantics
- docs information architecture
- test and CI expectations
- branch-convergence tracking

### Frain Owns

- UX polish
- design improvements
- logic extraction from existing feature routes
- bug fixes on current live experiences
- preparing portable modules and test cases for codex ports

### Both Must Avoid

- large rewrites of the same shared file at the same time
- duplicating provider logic
- duplicating storage schema patterns without alignment
- changing plugin slugs or page paths casually

## Similarity Metric

The branches should be considered “effectively the same” when all of these are true:

1. every major frain-only user-facing capability exists on codex
2. codex still retains its docs/runtime/test/governance advantages
3. frain no longer contains unique business logic that codex lacks
4. remaining differences are mostly cosmetic or in-progress polish

## Immediate Next Program Moves

### Codex

1. move into Batch C import parity
2. start on richer importer coverage from frain's portable modules
3. keep using codex runtime/docs/tests as the destination shape

### Frain

1. keep extracting portable logic modules
2. prepare contradiction-finder and kindle-importer in clean portable form
3. continue UX polish and bug fixes only

## Success Condition

Success is not “two giant branches with similar ambitions.”

Success is:

- one strong architecture
- one strong feature set
- one contributor story
- one product that inherits the best of both lines
