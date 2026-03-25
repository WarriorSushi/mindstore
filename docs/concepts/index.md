# Concepts

MindStore is easiest to understand as a system with four layers.

## The Four Layers

- Import: bring in conversations, notes, documents, bookmarks, and future plugin sources.
- Index: chunk, normalize, and store memory with search-friendly metadata.
- Retrieve: combine keyword, semantic, and structural retrieval to find the right context.
- Expose: make the same knowledge available in the UI, API, and MCP clients.

## Core Ideas

- A memory is a searchable unit of knowledge.
- A source is the original container that memories came from.
- A plugin is a modular extension that adds import, analysis, action, export, or AI behavior.
- MCP is the bridge that lets other AI tools use MindStore as a memory backend.
- `.mind` is the long-range file-format vision for a portable, AI-native personal knowledge container. See [The `.mind` Vision](./mind-file.md).
