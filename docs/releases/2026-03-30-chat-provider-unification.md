# 2026-03-30 — Chat Provider Unification

## What changed

- Moved chat provider/model resolution onto the shared `src/server/ai-client.ts`.
- Added decryption of encrypted AI provider keys inside the shared AI client.
- Added shared streaming helpers for:
  - OpenAI-compatible providers
  - Gemini
  - Ollama
- Simplified `/api/v1/chat` into a thin wrapper around the shared AI client.
- Added unit coverage for encrypted setting decoding and request-scoped model overrides.

## Why it matters

Before this slice, chat had a hidden “special case” implementation while plugins used the shared AI client. That meant chat could work with encrypted DB-stored keys even when the shared client could not. Now both paths share the same provider truth, which reduces divergence and makes future provider fixes apply everywhere.
