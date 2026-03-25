# Plugin Authoring

MindStore plugins should feel approachable for open source contributors, not only core maintainers.

## A Good Plugin Package Should Include

- A canonical slug
- Manifest metadata
- Capabilities
- Settings schema when configuration is required
- MCP surfaces when the plugin needs to talk to external AI clients
- Lifecycle hooks only where they add real value

## Authoring Principles

- Prefer small, composable plugins over giant kitchen-sink packages.
- Keep manifests explicit and stable.
- Use canonical slugs and aliases only for compatibility.
- Start with safe surfaces before asking for broader runtime power.

## Example Shape

Look at `packages/example-community-plugin` for the first sample external plugin package.

If you are adapting existing route-based MindStore features into the runtime-first model, use the [plugin porting guide](../build/plugin-porting-guide.md).

## Recommended Next Docs

- Add a step-by-step plugin tutorial.
- Add manifest validation examples.
- Keep [widget and job docs](./widgets-and-jobs.md) in sync as the runtime grows.
