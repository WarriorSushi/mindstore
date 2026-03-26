# ADR 0002: Provider Access and Runtime Roadmap

## Status

Accepted

## Context

MindStore needs to work for:

- self-hosted single-user installs
- hosted/shared deployments
- users who prefer API keys
- users who prefer local models
- users who want subscription-style provider login instead of API billing

At the same time, the product roadmap also requires:

- a standards-compliant MCP layer
- runtime-driven plugin extensibility
- real background job execution
- a stronger browser-extension surface

## Decision

MindStore will treat provider access as a capability layer instead of assuming API keys are the only valid path.

The roadmap is:

1. Make runtime requirements and provider access modes explicit in product surfaces and documentation.
2. Keep API keys and local runtimes fully supported while introducing a provider-auth abstraction.
3. Move MCP toward the official TypeScript SDK and register tools/resources/prompts from the plugin runtime.
4. Add job scheduling and execution infrastructure so plugin jobs become real automations.
5. Keep improving MindStore Everywhere as the thin capture/query client for the ecosystem.

## Consequences

### Positive

- Clearer onboarding
- Better path for self-hosters and hosted users
- Future subscription-auth support without another architecture reset
- Cleaner bridge between plugins, MCP, jobs, and provider auth

### Tradeoffs

- More up-front platform work before shipping every possible first-party plugin
- Some subscription-style auth flows remain provider-specific and cannot be promised until the provider path is well understood and supportable
