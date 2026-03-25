# Capture API

The capture API is the public server contract for browser extensions, bookmarklets, and future mobile clients.

## `POST /api/v1/capture`

Use this endpoint to save a normalized browser capture into MindStore.

### Request Body

```json
{
  "capture": {
    "title": "Interesting Page",
    "url": "https://example.com/post",
    "sourceApp": "web",
    "captureMode": "smart",
    "selection": "Highlighted text from the page",
    "pageText": "Fallback cleaned page text",
    "metadata": {
      "extensionVersion": "0.1.0"
    }
  }
}
```

### Response

```json
{
  "imported": {
    "documents": 1,
    "chunks": 1,
    "embedded": 1,
    "embeddingsSkipped": false
  },
  "captures": [
    {
      "title": "Interesting Page",
      "sourceType": "url",
      "captureMode": "selection",
      "sourceApp": "web",
      "url": "https://example.com/post"
    }
  ],
  "hooksTriggered": 0
}
```

### Notes

- `capture`, `captures`, a flat body, or a raw array are all accepted.
- `sourceApp` becomes the canonical `sourceType` for supported chat surfaces such as `chatgpt`, `claude`, and `openclaw`.
- Capture metadata is stored in memory `metadata` so plugins and MCP tools can inspect it later.
- Active plugins can observe capture events through the runtime `onCapture` hook.

## Authentication

- Browser and external clients can use `Authorization: Bearer msk_...`.
- API keys are created through `POST /api/v1/api-keys`.
- Single-user self-hosted mode can still fall back to the default local user.

## `GET /api/v1/capture/query`

Use query-string input for simple clients:

```text
/api/v1/capture/query?q=embeddings&limit=5
```

## `POST /api/v1/capture/query`

Use this endpoint when a lightweight client needs quick search results without consuming the full app search surface.

### Request Body

```json
{
  "query": "embeddings",
  "limit": 5
}
```

### Response

```json
{
  "query": "embeddings",
  "results": [
    {
      "id": "memory-id",
      "title": "Interesting Page",
      "sourceType": "url",
      "excerpt": "Short preview text…",
      "url": "https://example.com/post",
      "score": 0.0214
    }
  ]
}
```

## Common Errors

- `400` when no capture content is available or no query is provided
- `500` when import, embedding, or retrieval fails
