# Newsletter Writer

`Newsletter Writer` curates recent knowledge into a multi-section digest.

## What It Does

- Suggests possible newsletter angles from recent memories.
- Generates structured sections like intro, topic deep-dives, highlights, and quicklinks.
- Stores newsletters for later editing and export.
- Supports section-level refinement and updates.

## API

- `GET /api/v1/plugins/newsletter-writer?action=newsletters`
- `GET /api/v1/plugins/newsletter-writer?action=newsletter&id=<id>`
- `GET /api/v1/plugins/newsletter-writer?action=suggest&days=<n>`
- `POST /api/v1/plugins/newsletter-writer` with `action=generate|update|refine|delete`

## Convergence Notes

- Ported to codex with shared AI config and canonical plugin config persistence.
- Preserves the frain feature shape while adopting codex runtime patterns.

