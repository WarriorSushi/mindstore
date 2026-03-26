# Conversation Prep

`Conversation Prep` creates briefing packets for people, companies, projects, or topics.

## What It Does

- Builds multi-query retrieval around a subject.
- Generates structured briefing sections from your knowledge.
- Stores reusable briefings for later reference.
- Supports follow-up questions against the saved briefing context.

## API

- `GET /api/v1/plugins/conversation-prep?action=history`
- `GET /api/v1/plugins/conversation-prep?action=briefing&id=<id>`
- `POST /api/v1/plugins/conversation-prep` with `action=prepare|follow-up|delete`

## Convergence Notes

- Uses codex shared AI config and retrieval pipeline.
- Keeps the user-facing briefing flow while moving logic into a reusable port module.

