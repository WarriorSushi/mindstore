# Topic Evolution Timeline

Topic Evolution shows how your interests and knowledge changed over time by clustering memories into topics and then tracking those topics across weeks, months, or quarters.

## What It Does

- groups embedded memories into recurring topics
- builds a timeline of topic activity
- marks peak periods, first appearance, and last appearance
- detects rising, declining, dormant, resurgent, and steady interests
- lets you switch between weekly, monthly, and quarterly views

## How To Use It

1. Open `/app/evolution`.
2. Choose a time granularity.
3. Review the timeline chart to see when topics surged or faded.
4. Use the shift cards and topic list to understand what changed in your attention over time.

## Requirements

- Topic Evolution works best when you already have embedded memories across a meaningful time range.
- It does not require an external AI provider.

## What Gets Stored

- no separate topic-history table is required
- the plugin reads your existing memories and embeddings
- plugin installation metadata is stored in the plugins table

## Why This Port Matters

Topic Evolution is the second codex analysis port built on top of `shared-vectors.ts`.

That matters because it proves the shared clustering layer can support more than one feature and is now a reusable base for:

- Mind Map
- Sentiment Timeline
- other clustering-heavy analysis ports
