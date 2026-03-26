# Knowledge Gaps Analyzer

Knowledge Gaps Analyzer looks at your embedded memories as a topic map and highlights where your coverage is thin, stale, isolated, or missing useful bridges.

## What It Does

- clusters your memories into topics
- scores each topic by density and coherence
- flags sparse coverage, stale areas, isolated islands, and one-source blind spots
- suggests where a missing bridge may exist between related topics
- can ask your configured AI provider for adjacent topics to explore next

## How To Use It

1. Open `/app/gaps`.
2. Review the topic coverage cards to see where your knowledge is deep versus thin.
3. Read the detected gaps list to understand what is missing.
4. Generate learning suggestions if you have an AI provider configured.

## Requirements

- Knowledge Gaps works best when your memories already have embeddings.
- The core gap analysis does not require an AI provider.
- AI-backed learning suggestions are optional and only used when you ask for them.

## What Gets Stored

- no separate plugin-owned data table is required for the main analysis
- the plugin reads your existing memories and embeddings
- plugin installation metadata is stored in the plugins table

## Why This Port Matters

Knowledge Gaps is the first codex analysis port that depends on reusable embedding math and topic clustering.

It also establishes `shared-vectors.ts` as a codex-side foundation for the remaining analysis ports that need:

- embedding parsing
- cosine similarity
- k-means clustering
- topic labeling and keyword extraction
