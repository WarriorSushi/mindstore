# Notification System

MindStore includes a built-in notification system for surfacing activity from plugins, imports, analysis, and milestones.

## Overview

Notifications appear in the notification bell in the sidebar header and mobile header. They support:

- **Unread badges** with counts
- **Color-coded types** (teal, sky, emerald, amber, red)
- **Deep links** to relevant pages
- **Plugin attribution** showing which plugin generated the notification
- **Milestone tracking** for memory count achievements

## Notification Types

| Type | Description | Default Color |
|------|-------------|---------------|
| `import_complete` | Import finished | teal |
| `analysis_ready` | Analysis results available | sky |
| `review_due` | Flashcards or items due for review | amber |
| `plugin_event` | Generic plugin activity | teal |
| `system` | App updates, tips, onboarding | zinc |
| `export_ready` | Export file ready for download | emerald |
| `connection_found` | New knowledge connection discovered | sky |
| `milestone` | Memory count milestone reached | amber |

## API

### `GET /api/v1/notifications`

Query params:
- `limit` — max items (default 20, max 100)
- `offset` — pagination offset
- `unread` — if `"true"`, only unread notifications

### `POST /api/v1/notifications`

Create a notification or perform actions:

```json
{ "type": "import_complete", "title": "45 items imported", "body": "...", "href": "/app/explore" }
```

Special actions:
- `{ "action": "mark-read", "id": "..." }` — mark one as read
- `{ "action": "mark-all-read" }` — mark all as read
- `{ "action": "clear-read" }` — delete all read notifications
- `{ "action": "delete", "id": "..." }` — delete one

## Server Helpers

Use `src/server/notifications.ts` for server-side notification creation:

```typescript
import { notifyImportComplete, notifyAnalysisReady, notifyMilestone } from '@/server/notifications';

await notifyImportComplete('kindle-importer', 'Kindle', 45);
await notifyAnalysisReady('contradiction-finder', 'Found 3 contradictions');
await notifyMilestone('1,000 memories!', 'Your knowledge base keeps growing.');
```

All notification helpers are non-throwing — they never break the main flow.

## UI Components

- **NotificationCenter** — Bell icon + dropdown panel in sidebar/header
- **QuickCapture** — ⌘⇧N modal for fast note/URL capture
- **MemoryDrawer** — Slide-in detail panel for any memory (with related memories)
