# MCP Server

MindStore exposes its agent-facing surfaces through MCP so external AI clients can search, inspect, and reuse a user's stored knowledge.

## Current Architecture

- Core tool, resource, and prompt definitions live in `src/server/mcp/runtime.ts`.
- Plugin-provided MCP tools, resources, and prompts are resolved from the shared plugin runtime.
- `src/app/api/mcp/route.ts` now uses the official MCP TypeScript SDK transport for `POST` and `DELETE` requests.
- `GET /api/mcp` remains a simple discovery response for humans, diagnostics, and docs-friendly inspection.

## Why The Route Changed

The earlier route implemented MCP by manually switching on JSON-RPC method names. That was workable for early iteration, but it pushed protocol details into app code and made future MCP features harder to adopt.

The current route moves request handling onto `WebStandardStreamableHTTPServerTransport` from `@modelcontextprotocol/sdk` in JSON-response mode. That gives MindStore:

- protocol handling from the official SDK
- a cleaner path to future Streamable HTTP support
- one shared registration layer for core and plugin MCP surfaces

## Current Tradeoffs

- The route is stateless for now.
- JSON responses are enabled first; richer SSE/stream resumability is a later phase.
- Discovery still has a custom `GET` response because it is useful for humans and docs.

## Follow-Up Work

- support richer Streamable HTTP session modes when MindStore needs notifications or long-lived streams
- add contract tests around MCP tool/resource/prompt discovery
- deepen provider-auth and client-auth stories for hosted deployments
