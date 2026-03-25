# Browser Extension Example

This example shows the minimum data flow for a browser or automation client:

1. Create an API key in MindStore Settings.
2. Collect page text or a conversation transcript.
3. Send that payload to `POST /api/v1/capture`.
4. Query back through `POST /api/v1/capture/query`.

## Minimal Capture Payload

```json
{
  "capture": {
    "title": "Article title",
    "url": "https://example.com/article",
    "captureMode": "smart",
    "sourceApp": "web",
    "selection": "Key paragraph here",
    "pageText": "Longer page text here"
  }
}
```

## Minimal Query Payload

```json
{
  "query": "What did I save about this topic?",
  "limit": 5
}
```

## Why This Example Matters

It demonstrates the intended external-client contract for MindStore: a small authenticated API for capture and recall, rather than direct access to internal app routes.
