# ADR 0001: Plugin Runtime And Docs First

## Status

Accepted

## Context

MindStore is growing from a product into a platform. The existing codebase has a strong product surface, but the plugin story is still mostly manifest-driven and the documentation surface is still thin.

## Decision

We will prioritize a real plugin runtime and a first-class documentation system before adding more surface area.

## Consequences

- Plugin contracts become stable and contributor-friendly.
- Docs become part of the product, not an afterthought.
- New features must explain themselves through user docs and builder docs.

