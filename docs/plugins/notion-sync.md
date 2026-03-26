# Notion Sync Plugin

Push MindStore memories to a Notion database. Two-way sync planned, currently push-only.

## Category
Sync / Export

## Capabilities
- Connect to Notion via integration token
- Auto-create a "MindStore Knowledge Base" database with typed properties
- Push memories as Notion pages with rich content blocks
- Rate-limited batched sync (3 concurrent, 400ms between bursts)
- Track synced memory IDs to avoid duplicates
- Filter by source type
- Sync history with success/partial/failed status
- Preview unsynced memories before pushing

## API

### GET `/api/v1/plugins/notion-sync`

| Action    | Description                              |
|-----------|------------------------------------------|
| `config`  | Connection status, database info, stats  |
| `history` | Last 20 sync records                     |
| `preview` | Unsynced memories count + sample          |

### POST `/api/v1/plugins/notion-sync`

| Action            | Body                                | Description                         |
|-------------------|-------------------------------------|-------------------------------------|
| `validate`        | `token`                             | Validate Notion API token           |
| `save-config`     | `token`, `databaseId`, `autoSync`, etc. | Save sync settings              |
| `create-database` | —                                   | Create MindStore DB in Notion       |
| `sync`            | —                                   | Push unsynced memories (batch of 50) |
| `disconnect`      | —                                   | Remove Notion connection            |

## Notion Database Schema

| Property     | Type         | Description              |
|--------------|--------------|--------------------------|
| Title        | title        | Memory title             |
| Source       | select       | ChatGPT, Kindle, URL, etc. |
| Tags         | multi_select | Memory tags              |
| Created      | date         | Original creation date   |
| Word Count   | number       | Content word count       |
| MindStore ID | rich_text    | Deduplication key        |

## Requirements
- Notion integration token (Settings → Integrations → New integration)
- Integration must have access to at least one page (for database creation)
