# MindStore Everywhere Build Notes

This page records the current architecture for the browser extension and the server endpoints that support it.

## Product Model

- The extension is a thin client.
- Capture normalization happens server-side.
- Auth is currently API-key based for hosted or shared deployments.
- Connection discovery comes from `GET /api/v1/extension/setup`.

## Main Components

- `extensions/mindstore-everywhere/content.js`
  Detects page content, selections, and supported AI conversation surfaces.
- `extensions/mindstore-everywhere/popup.js`
  Handles setup verification, capture submission, and lightweight query.
- `src/app/api/v1/extension/setup/route.ts`
  Returns deployment-aware setup metadata and auth status.
- `src/app/api/v1/extension/package/route.ts`
  Packages the extension for download and includes a deployment-aware setup JSON file.
- `src/server/extension.ts`
  Centralizes extension version and URL generation so routes do not drift.

## Current Direction

- Keep the popup focused on capture, query, and health checks.
- Keep server-side setup metadata as the source of truth for connection URLs.
- Improve site adapters and hosted auth ergonomics without turning the extension into a second application.

## Follow-Up Work

- More site adapters for structured conversation capture.
- Browser-native sign-in or token exchange for hosted deployments.
- Better packaging and publishing for Chrome and other browser stores.
