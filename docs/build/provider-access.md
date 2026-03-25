# Provider Access

This page explains what a user actually needs to run MindStore and how provider authentication is expected to evolve.

## What A User Needs Today

### Required

- PostgreSQL 16+ with `pgvector` and `pg_trgm`

### Optional

- Vercel or any other host
- Google OAuth
- API keys for hosted AI providers

### Important Clarification

MindStore does **not** require Supabase specifically.

Supabase is one possible way to host PostgreSQL, but it is not the product requirement. A user can run MindStore with:

- self-hosted PostgreSQL
- Supabase
- Neon
- Railway
- Render
- a VPS with Postgres installed

MindStore also does **not** require Vercel specifically. Vercel is just one deployment option.

## What Works Without AI Credentials

Today, a user can still:

- import data
- browse memories
- use docs and MCP setup surfaces
- use keyword and metadata-driven exploration

without a paid hosted AI provider.

## What Needs AI Access

These features are strongest when a provider is configured:

- semantic embeddings
- RAG chat
- some analysis and generation plugins
- higher-quality cross-memory reasoning

## Supported Access Modes Today

- API keys for hosted providers such as Gemini, OpenAI, OpenRouter, and custom OpenAI-compatible endpoints
- Local runtime access through Ollama

## Planned Access Modes

MindStore should grow beyond API-key-only flows.

The planned direction is:

1. Keep API keys and local runtimes first-class because they are stable and easy to self-host.
2. Add encrypted auth profiles for providers that expose supported OAuth or device-login style flows.
3. Let provider adapters and plugins register their own auth flows instead of hardcoding all auth logic in core.

## Why Subscription Auth Matters

Many users already pay for AI plans and do not want to manage separate API billing just to use personal-memory features.

That means MindStore should support, where technically and contractually safe:

- account-based provider auth
- device code login
- OAuth-backed token exchange
- trusted local bridge adapters

## Current Recommendation

For now:

- Use Gemini if you want the simplest low-cost hosted option.
- Use Ollama if you want a local/private stack.
- Use OpenAI or OpenRouter if you want broader model choice and do not mind API billing.

## Next Technical Steps

- Standardize provider capability metadata in the app and docs
- Add encrypted auth-profile storage
- Add provider auth adapters for supported subscription-style flows
- Keep MCP and plugin runtime provider-aware so auth modes can evolve without rewriting the whole product
