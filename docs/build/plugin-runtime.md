# Plugin Runtime

MindStore's plugin runtime exists to make extension safe, documented, and predictable.

## Current Runtime Model

- `mindstore.config.ts` is the source of truth for loaded plugins and deployment mode.
- `@mindstore/plugin-sdk` defines manifests, hooks, MCP surfaces, settings, and UI metadata.
- `@mindstore/plugin-runtime` resolves canonical slugs, aliases, installation state, and active MCP bindings.
- Plugin config is now validated from manifest schema and can be edited from the product UI.
- Dashboard widgets and plugin jobs are now runtime-backed surfaces, not just manifest placeholders.

## Why This Exists

The original plugin list was useful for product planning, but community contribution needs more than a registry. Contributors need a documented contract, runtime resolution rules, and safe extension points.

## Safe First-Class Surfaces

- MCP tools
- MCP resources
- MCP prompts
- Settings schemas
- Widgets and panels
- Lifecycle hooks such as install, enable, disable, and import
- Manual job execution with persisted run summaries
- Runtime-discovered import tabs and importer metadata

## What Still Needs To Grow

- Scheduled/background job registration beyond manual runs
- Safer external package loading for true third-party plugins
- Richer widget layouts beyond the current generic card renderer
- Contract tests for plugin manifests and runtime bindings
