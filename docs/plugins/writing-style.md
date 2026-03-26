# Writing Style Analyzer

Writing Style Analyzer turns your stored memories into a readable profile of how you write.

## What It Does

- measures readability with Flesch-Kincaid grade level and reading-ease scores
- tracks tone distribution across formal, casual, technical, conversational, and neutral writing
- highlights recurring words, bigrams, and trigrams
- surfaces question, exclamation, hedging, and confidence patterns
- compares style across source types and shows month-by-month evolution

## How To Use It

1. Open `/app/writing`.
2. Run the analyzer on your eligible memories.
3. Review your complexity score, tone mix, and recurring phrases.
4. Use the source table and evolution chart to see how your writing changes over time.

## Requirements

- Writing Style Analyzer works best when you already have a meaningful set of text memories in MindStore.
- It does not require an external AI provider for the core analysis engine.
- Longer memories produce better readability and phrase-level signals than very short notes.

## What Gets Stored

- per-memory writing-style metrics in each memory's `metadata`
- aggregate profile data generated on demand from those stored metrics
- plugin installation metadata in the plugins table

## Why This Port Matters

Writing Style Analyzer is the first large pure-analysis port in the codex convergence program.

It matters because it proves codex can absorb a rich frain feature without depending on provider calls, while still preserving:

- a dedicated user-facing page
- a reusable server-side analysis engine
- thin route wiring
- codex tests and documentation
