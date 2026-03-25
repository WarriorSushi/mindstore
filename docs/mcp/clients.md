# MCP Client Setup

MindStore becomes most useful when the same memory layer is available across multiple AI clients.

## HTTP Endpoint

Use your deployed MindStore URL plus `/api/mcp`.

Example:

```text
https://your-mindstore.example.com/api/mcp
```

## Client Types To Support

- Claude Desktop
- Cursor
- VS Code
- OpenClaw

## What To Verify

1. The client can connect successfully.
2. `tools/list` returns MindStore tools.
3. `resources/list` returns core resources plus any plugin-provided resources.
4. Searches from the client match what you can find in the MindStore app.

## Expected Direction

MindStore's MCP surface is moving toward plugin-driven discovery, which means installed plugins can extend tools, resources, and prompts without hardcoding every capability into the core server.
