# Resume Builder

`Resume Builder` turns professional memories into editable resume sections.

## What It Does

- Searches work, project, skills, and education memories for relevant experience.
- Generates template-based resume sections.
- Supports editing, section visibility, reordering, and AI refinement.
- Keeps multiple saved resumes per user.

## API

- `GET /api/v1/plugins/resume-builder?action=list|get|templates`
- `POST /api/v1/plugins/resume-builder?action=generate|update|refine|add-section|reorder|delete`

## Convergence Notes

- Uses codex shared AI client and plugin-config persistence.
- Keeps template behavior while moving business logic into a dedicated port module.

