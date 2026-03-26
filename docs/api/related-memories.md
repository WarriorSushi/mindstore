# Related Memories API

Find semantically related memories using vector cosine similarity, with source-based fallback.

## Endpoint

```
GET /api/v1/memories/related?id=<memoryId>&limit=6
```

## Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | UUID | required | Source memory ID |
| `limit` | number | 6 | Max related memories (1-20) |

## Response

```json
{
  "memoryId": "uuid",
  "related": [
    {
      "id": "uuid",
      "content": "...",
      "sourceType": "chatgpt",
      "sourceTitle": "...",
      "timestamp": "2026-03-25T...",
      "similarity": 85,
      "method": "vector"
    }
  ],
  "method": "vector",
  "total": 5
}
```

## Strategy

1. **Vector similarity** — Uses pgvector cosine distance if the source memory has an embedding. Filters results below 0.3 similarity threshold.
2. **Source-based fallback** — If vector results are insufficient, falls back to same-source and same-title matching ordered by temporal proximity.

## Usage

The Memory Drawer component (`MemoryDrawer`) automatically calls this endpoint when a memory is opened, showing related memories with similarity scores.

```typescript
// Open a memory in the drawer from anywhere
import { openMemoryDrawer } from '@/components/MemoryDrawer';

openMemoryDrawer({ id, content, source, sourceTitle, timestamp });
```
