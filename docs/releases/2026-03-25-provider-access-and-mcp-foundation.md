# Release: Provider Access and MCP Foundation

## Highlights

- Added a runtime requirements model so users can see what MindStore actually requires versus what is optional.
- Added a provider-access roadmap covering API keys, local runtimes, and future subscription-style provider auth.
- Surfaced that information in the Settings page and in build/user documentation.
- Refactored MCP server logic into a shared runtime layer and added an official MCP SDK server builder on top of the same definitions.

## Why It Matters

MindStore is now more honest and more future-ready at the same time. Users get a clearer answer to "what do I need to run this?" and the codebase gets a cleaner path from the current custom MCP route toward the official SDK without losing plugin-driven behavior.
