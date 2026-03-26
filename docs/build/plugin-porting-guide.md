# Plugin Porting Guide

This guide is for moving route-based plugins from the `frain/*` branches into the runtime-first architecture on `codex/*`.

The goal is not to delete feature work. The goal is to preserve the feature logic while adapting the wiring to MindStore's newer SDK, runtime, docs, and testing model.

## The Rule Of Thumb

Port the **logic**. Adapt the **wiring**.

In practical terms:

- parsing logic is usually portable
- retrieval and AI orchestration logic is usually portable
- page UI is often portable with light API-call updates
- direct route wiring usually needs adaptation
- plugin store wiring, runtime surfaces, and docs should follow the codex model

## The Target Shape

A fully ported plugin should fit this shape:

1. Manifest metadata lives in the plugin definition.
2. Settings schema lives in the manifest.
3. Optional widgets, jobs, MCP tools, and hooks are declared in the plugin package.
4. Heavy logic lives in reusable server-side helpers, not inside the route body.
5. API routes are thin wrappers around shared logic.
6. User docs and builder docs land with the feature.
7. At least one test covers the new logic or contract.

## Recommended Porting Steps

### 1. Inventory the frain plugin

For each plugin, identify:

- route file
- UI page
- data model or tables it expects
- provider/API requirements
- whether it is import, analysis, action, export, or AI enhancement
- whether it should expose MCP, widget, job, or import-hook surfaces

### 2. Extract logic from the route

If the frain route contains:

- parsing
- prompt construction
- retrieval orchestration
- result normalization
- export formatting

move that logic into a server module first.

Suggested location:

- `src/server/plugins/ports/<plugin-slug>.ts`

The route should become a thin adapter.

### 3. Make the manifest real

Add or refine the plugin manifest so it declares:

- `slug`
- `name`
- `description`
- `category`
- `capabilities`
- `ui.settingsSchema`
- `ui.dashboardWidgets` if relevant
- `jobs` if the plugin can refresh, sync, or analyze on a schedule

### 4. Decide which runtime surfaces matter

Not every plugin needs every surface.

Common mappings:

- importer plugin:
  - import tab
  - optional `onImport` or `onCapture` hook
- analysis plugin:
  - page
  - widget
  - optional scheduled refresh job
- action plugin:
  - page
  - optional MCP prompt/tool
- sync/export plugin:
  - page
  - scheduled job if periodic sync makes sense

### 5. Keep the UI page when it adds value

The `frain` pages are not the enemy. Most of them are useful.

Keep the page when:

- it offers a real workflow
- it is meaningfully interactive
- it is easier to use than a generic runtime panel

Adapt only the API calls and any assumptions about plugin install state.

### 6. Add docs and tests with the port

Every port should update:

- user docs if the plugin is user-facing
- builder docs if the runtime contract changed
- worklog/release notes for later traceability

Minimum testing expectation:

- one unit test for extracted logic or runtime contract
- one smoke path through the route when practical

## Suggested File Layout

For a typical port:

```text
src/server/plugins/ports/<slug>.ts
src/app/api/v1/plugins/<slug>/route.ts
src/app/app/<page>/page.tsx
docs/plugins/<slug>.md            (optional)
tests/unit/<slug>.test.ts
```

## Example Conversion Pattern

### Before

- `src/app/api/v1/plugins/flashcard-maker/route.ts`
  - fetches memories
  - builds prompt
  - calls model
  - parses output
  - stores result

### After

- `src/server/plugins/ports/flashcard-maker.ts`
  - `generateFlashcards(...)`
  - `listFlashcardDecks(...)`
  - `saveFlashcardDeck(...)`
- `src/app/api/v1/plugins/flashcard-maker/route.ts`
  - validates request
  - calls shared helper
  - formats response
- plugin manifest
  - settings schema
  - optional MCP prompt/tool
  - optional refresh job
- `src/app/app/flashcards/page.tsx`
  - keeps the UI
  - points at the codex-compatible route contract

## Which Frain Plugins To Port First

Use these as the first exemplars:

1. `kindle-importer`
Reason: simple importer, file-based, low conflict, good template for import ports.

2. `flashcard-maker`
Reason: high user value, AI-powered, good test of action-plugin runtime conventions.

3. `voice-to-memory`
Reason: good stress test for capture, media ingestion, provider handling, and scheduled follow-up work.

## Current Porting Status

**ALL 35 PLUGINS PORTED** — as of 2026-03-26, every plugin has:
- ✅ Port module in `src/server/plugins/ports/<slug>.ts`
- ✅ Thin route wrapper in `src/app/api/v1/plugins/<slug>/route.ts`
- ✅ Unit tests in `tests/unit/<slug>.test.ts`
- ✅ Plugin docs in `docs/plugins/<slug>.md`

**Test coverage:** 336 tests across 44 test files, all passing (includes shared utility coverage).

### Reference Ports

- `kindle-importer` (45-line route): importer reference — file parsing, dedup, preview-first UX
- `flashcard-maker` (131-line route): action-plugin reference — AI-backed, persistent state, review algo
- `voice-to-memory` (137-line route): media-plugin reference — audio capture, transcription, provider resolution

### Porting Complete (by batch)

- **Batch A (Core):** flashcard-maker, voice-to-memory, kindle-importer, pdf-epub-parser, youtube-transcript, reddit-saved, browser-bookmarks, notion-importer, obsidian-importer
- **Batch B (Analysis/Action):** mind-map-generator, learning-paths, knowledge-gaps, contradiction-finder, writing-style, sentiment-timeline, topic-evolution, conversation-prep, newsletter-writer, blog-draft, resume-builder
- **Batch C (Imports):** twitter-importer, telegram-importer, pocket-importer, readwise-importer, spotify-importer, image-to-memory
- **Batch D (Export/Sync):** anki-export, markdown-blog-export, notion-sync, obsidian-sync
- **Batch E (Advanced AI):** custom-rag, domain-embeddings, multi-language

## Copyability Assessment

### Usually directly portable

- parsers
- formatters
- prompt builders
- result post-processing
- isolated page components

### Usually portable with adaptation

- API routes
- settings flows
- sidebar integration
- plugin store behavior

### Usually needs deeper work

- OAuth-heavy sync flows
- long-running background analysis
- provider-auth assumptions tied to the older branch model
- schema changes that overlap with new codex runtime/state assumptions

## Current Convergence Principle

The codex branch is the base.

That means:

- plugin runtime, docs, tests, MCP, and scheduling conventions should come from codex
- feature logic and UI can come from frain
- when in doubt, preserve product value but normalize it into codex's architecture
