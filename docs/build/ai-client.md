# Shared AI Client

MindStore now has a shared AI client at `src/server/ai-client.ts`.

## What It Handles

- loads provider settings from the database
- decrypts sensitive provider keys stored in the database
- resolves the active text-generation provider
- resolves the active transcription provider
- calls OpenAI-compatible, Gemini, and Ollama text models
- calls OpenAI Whisper and Gemini for audio transcription
- streams chat responses for OpenAI-compatible, Gemini, and Ollama providers

## Why It Exists

Before this module, AI-heavy plugins copied the same provider logic into each route.

That was risky for convergence because every new plugin port would duplicate:

- provider preference handling
- env fallback behavior
- model defaults
- request formatting
- error handling

## Current Users

- Flashcard Maker
- Voice-to-Memory
- Chat

## Next Users

- Contradiction Finder
- Blog Draft
- Resume Builder
- Conversation Prep
- Image-to-Memory

## Design Rule

Plugin routes and chat routes should not own provider-resolution logic anymore.

They should call:

- shared AI config helpers
- shared AI execution helpers
- plugin-specific business logic in `src/server/plugins/ports/*`
