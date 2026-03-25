# Release: Capture Contract and MindStore Everywhere

## Highlights

- Added a dedicated capture API under `/api/v1/capture`.
- Added a lightweight query endpoint for extension-side search under `/api/v1/capture/query`.
- Moved import persistence into a shared server-side import service.
- Upgraded the browser extension with smarter source detection and a popup query flow.
- Expanded docs with capture, plugin runtime, deployment mode, MCP client, and extension guides.

## Why It Matters

This is the first real step toward "MindStore Everywhere" being a platform surface instead of a placeholder folder in the repo. Lightweight clients can now depend on a documented server contract instead of reverse-engineering the generic import API.
