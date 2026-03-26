# Plugin Config (Shared Utility)

`plugin-config.ts` provides shared helpers that every port module uses for plugin lifecycle, configuration persistence, and response parsing.

## What It Does

- **ensurePluginInstalled** — auto-installs a plugin from its manifest on first use
- **assertPluginEnabled** — checks a plugin exists and isn't disabled (throws if disabled)
- **getPluginConfig / savePluginConfig / updatePluginConfig** — read/write/update plugin config from the database
- **createPluginScopedId** — generates unique IDs with a plugin prefix (e.g. `kindle_m1abc_x9y2z3`)
- **stripMarkdownFence** — removes ` ```json ` / ` ``` ` wrappers from LLM responses
- **parseJsonValue** — strips fences then JSON.parse (common pattern for AI-generated structured output)

## Location

`src/server/plugins/ports/plugin-config.ts`

## Usage Pattern

Every port module follows this pattern:

```ts
import { ensurePluginInstalled, getPluginConfig, savePluginConfig } from './plugin-config';

// At the start of each route handler:
await ensurePluginInstalled('my-plugin');

// Read config with type-safe fallback:
const config = await getPluginConfig('my-plugin', { apiKey: '', lastSync: null });

// Save updated config:
await savePluginConfig('my-plugin', { ...config, lastSync: new Date().toISOString() });
```

## Tests

`tests/unit/plugin-config.test.ts` — 12 tests covering ID generation, markdown fence stripping, and JSON parsing.
