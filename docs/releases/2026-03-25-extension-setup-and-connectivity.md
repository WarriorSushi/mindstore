# Release: Extension Setup and Connectivity

## Highlights

- Added a dedicated extension setup endpoint so the browser extension can verify server reachability and auth.
- Added a downloadable extension package endpoint for simpler install flows.
- Upgraded the browser extension popup with a real `Test connection` step.
- Reworked the Connect page to separate browser-extension setup from hosted and local MCP connection patterns.

## Why It Matters

MindStore Everywhere and remote MCP are now much easier to adopt. Users no longer need to guess whether the server URL is correct, whether an API key is being accepted, or which configuration shape to use for hosted versus local installs.
