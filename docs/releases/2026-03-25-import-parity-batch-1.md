# 2026-03-25: Import Parity Batch 1

Codex moved the first broad import-parity slice onto the runtime-first branch.

## Included Ports

- YouTube Transcript
- PDF And EPUB Parser
- Browser Bookmarks
- Reddit Saved
- Obsidian Importer

## Why This Matters

- the existing import UI keeps working
- importer logic now lives in reusable `src/server/plugins/ports/*` modules instead of only in routes
- preview and import contracts stay stable while codex architecture catches up with frain breadth
- preserved chunk boundaries now flow through the shared import service
