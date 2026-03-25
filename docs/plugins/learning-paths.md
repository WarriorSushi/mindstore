# Learning Paths

`Learning Paths` designs structured curricula based on what you already know.

## What It Does

- Suggests topics worth learning next.
- Builds multi-step plans with concepts, practice, projects, and milestones.
- Tracks completion and notes at the node level.
- Links path nodes back to related memories when possible.

## API

- `GET /api/v1/plugins/learning-paths?action=list|get|suggestions`
- `POST /api/v1/plugins/learning-paths` with `action=generate|update-progress|add-note|delete`

## Convergence Notes

- Uses codex retrieval and shared AI config instead of route-local provider logic.
- Preserves the feature model from frain while matching codex runtime conventions.

