# MCP Client Setup

MindStore becomes most useful when the same memory layer is available across multiple AI clients.

## HTTP Endpoint

Use your deployed MindStore URL plus `/api/mcp`.

Example:

```text
https://your-mindstore.example.com/api/mcp
```

## Hosted vs Local

- Hosted or shared deployment:
  Use an API key from `/app/settings` and pass it as `Authorization: Bearer <mindstore-api-key>` when your MCP host supports custom headers.
- Local single-user deployment:
  You can usually connect directly without an API key.

## Recommended Surfaces

- MindStore Everywhere browser extension
- Cursor
- VS Code
- OpenClaw
- Other remote MCP-compatible hosts

## Example Hosted Config

```json
{
  "mcpServers": {
    "mindstore": {
      "url": "https://your-mindstore.example.com/api/mcp",
      "headers": {
        "Authorization": "Bearer <mindstore-api-key>"
      }
    }
  }
}
```

## Example Local Single-User Config

```json
{
  "mcpServers": {
    "mindstore": {
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

## What To Verify

1. The client can connect successfully.
2. `tools/list` returns MindStore tools plus plugin-provided tools when plugins are active.
3. `resources/list` returns core resources plus any plugin-provided resources.
4. `prompts/list` returns plugin-provided prompts when installed.
5. Searches from the client match what you can find in the MindStore app.

## Expected Direction

MindStore's MCP surface is moving toward plugin-driven discovery, which means installed plugins can extend tools, resources, and prompts without hardcoding every capability into the core server.
