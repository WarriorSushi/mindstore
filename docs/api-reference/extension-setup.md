# Extension Setup API

The browser extension uses two helper endpoints so install and verification are easier for end users.

## `GET /api/v1/extension/setup`

Returns the URLs and capability metadata that the extension should use for the current deployment.

### Behavior

- Accepts optional `Authorization: Bearer <mindstore-api-key>`.
- Returns `401` if a bearer token is provided but invalid.
- Returns deployment-aware URLs for capture, query, docs, package download, and MCP.

### Example Response

```json
{
  "ok": true,
  "product": {
    "name": "MindStore",
    "extensionName": "MindStore Everywhere",
    "extensionVersion": "0.1.0"
  },
  "connection": {
    "baseUrl": "https://your-mindstore.example.com",
    "captureUrl": "https://your-mindstore.example.com/api/v1/capture",
    "queryUrl": "https://your-mindstore.example.com/api/v1/capture/query",
    "setupUrl": "https://your-mindstore.example.com/api/v1/extension/setup",
    "mcpUrl": "https://your-mindstore.example.com/api/mcp",
    "docsUrl": "https://your-mindstore.example.com/docs/getting-started/mindstore-everywhere",
    "downloadUrl": "https://your-mindstore.example.com/api/v1/extension/package"
  },
  "auth": {
    "apiKeysSupported": true,
    "apiKeyProvided": false,
    "authenticated": false,
    "mode": "optional"
  },
  "capabilities": {
    "capture": true,
    "query": true,
    "mcp": true
  }
}
```

## `GET /api/v1/extension/package`

Builds and returns a ZIP package of `extensions/mindstore-everywhere` plus a deployment-aware setup file.

### Included Files

- `manifest.json`
- `popup.html`
- `popup.css`
- `popup.js`
- `content.js`
- `README.md`
- `mindstore-everywhere.setup.json`

## Why These Endpoints Exist

They let the extension stay thin. The browser popup does not need to hardcode deployment-specific URLs or assume every user is on localhost.
