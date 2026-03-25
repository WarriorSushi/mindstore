# 2026-03-25: Shared AI Client and Voice-to-Memory Port

## What Changed

- added a shared AI client at `src/server/ai-client.ts`
- refactored Flashcard Maker onto that shared AI client
- ported Voice-to-Memory from the active `frain` line into `codex/local-dev`
- added `voice_recordings` persistence
- added a reusable `src/server/plugins/ports/voice-to-memory.ts` module
- added `/api/v1/plugins/voice-to-memory`
- added `/app/voice` plus navigation and command-palette entry points
- added unit coverage for AI config resolution and voice-title generation

## Why It Matters

This closes two important convergence gaps at once:

- AI-heavy plugins now have a shared provider-resolution layer
- audio/transcription features now have a codex-native reference port

That makes future ports easier because the next AI plugins can reuse both:

- the shared AI client
- the Voice-to-Memory media workflow pattern

## Remaining Gaps

- several existing AI-heavy routes still need migration onto the shared AI client
- Voice-to-Memory stores transcript-first metadata today rather than retaining raw audio assets
- richer playback, uploads beyond browser recording, and deeper background processing are still follow-up work
