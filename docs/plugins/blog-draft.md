# Blog Draft Generator

`Blog Draft Generator` turns retrieved memories into editable long-form drafts.

## What It Does

- Suggests blog topics from your existing knowledge.
- Retrieves relevant memories for a topic before writing.
- Generates a structured markdown draft with outline metadata.
- Supports refinement, saving, and export to `.md` or `.html`.

## API

- `GET /api/v1/plugins/blog-draft?action=drafts`
- `GET /api/v1/plugins/blog-draft?action=draft&id=<id>`
- `GET /api/v1/plugins/blog-draft?action=topics`
- `POST /api/v1/plugins/blog-draft` with `action=generate|save|refine|delete|export`

## Convergence Notes

- Ported into codex runtime as server logic plus a thin route wrapper.
- Uses shared `src/server/ai-client.ts` instead of per-route provider code.
- Uses canonical slug `blog-draft` instead of legacy slug drift.

