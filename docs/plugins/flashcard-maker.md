# Flashcard Maker

Flashcard Maker turns your stored knowledge into spaced-repetition decks you can review inside MindStore.

## What It Does

- creates decks from your imported memories
- uses your configured AI provider to draft question-and-answer cards
- stores decks per user inside MindStore
- runs review sessions with an SM-2 style spaced-repetition schedule

## How To Use It

1. Open `/app/flashcards`.
2. Create a deck.
3. Generate cards from a topic or from matching memories.
4. Save the cards you want to keep.
5. Review due cards over time and grade your recall from `0` to `5`.

## Requirements

- Flashcard Maker works best when MindStore already has useful memories to pull from.
- AI card generation requires a configured provider such as Gemini, OpenAI-compatible APIs, OpenRouter, or Ollama.
- Reviewing saved cards does not require an API call.

## What Gets Stored

- deck name, description, and color
- generated cards and their source references
- SM-2 review state for each card
- per-user deck ownership

## Why This Port Matters

Flashcard Maker is the first major `frain` feature ported into the codex runtime-first architecture.

It is the reference example for future action-style plugin ports because it combines:

- a dedicated product page
- AI-backed generation
- persistent plugin-owned data
- reusable server logic
- codex docs and tests
