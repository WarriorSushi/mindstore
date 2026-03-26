# Reddit Saved

The Reddit Saved importer turns Reddit exports into searchable memories.

## What It Does

- parses ZIP, CSV, and JSON Reddit export formats
- normalizes posts and comments into one portable item shape
- builds subreddit, score, date-range, and author previews
- preserves per-item chunking and subreddit metadata during import

## Codex Port Notes

- portable parsing, formatting, stats, and chunking logic lives in `src/server/plugins/ports/reddit-saved.ts`
- ZIP extraction stays in the route because it depends on `jszip`
- codex keeps the existing preview/import response shape used by the Import page
