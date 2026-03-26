# The `.mind` Vision

MindStore's long-range vision includes a portable `.mind` file format.

In simple terms, the idea is:

- one file contains your knowledge
- that file can hold content, metadata, indices, and AI-ready structure
- the file can be moved, backed up, shared selectively, and eventually queried by compatible tools

The full working specification and idea dump currently lives in the repository root as `MIND_FILE_SPEC.md`.

## Why It Matters

Today, MindStore is still primarily a web app backed by PostgreSQL.

The `.mind` idea matters because it points toward a future where:

- users own a portable knowledge artifact
- search and AI context can travel with the file
- MindStore can become more than just one hosted app

## Current Status

This is a vision document, not the current production storage engine.

MindStore today still works through:

- the web app
- PostgreSQL
- APIs
- MCP
- the browser extension

The `.mind` format is best understood as the long-term portability and ownership direction for the product.
