# Mind Map Generator

Mind Map Generator clusters embedded memories into a topic tree.

## What It Does

- Groups memories into topic clusters with embedding similarity.
- Creates sub-topics for larger clusters.
- Returns cross-topic connections so the UI can render a richer topology view.

## Route

- `GET /api/v1/plugins/mind-map-generator?maxTopics=12&maxDepth=3`

## Notes

- The codex port keeps the existing `/app/mindmap` page and moves the clustering logic into `src/server/plugins/ports/mind-map-generator.ts`.
- It reuses the shared vector helper instead of carrying yet another copy of clustering code.
