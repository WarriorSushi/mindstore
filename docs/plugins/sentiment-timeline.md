# Sentiment Timeline

Sentiment Timeline shows the emotional arc of your stored knowledge.

## What It Does

- Scores memories as positive, negative, mixed, or neutral.
- Falls back to a built-in lexicon analyzer when no AI provider is configured.
- Builds daily mood heatmaps, monthly trend summaries, and source-level mood breakdowns.

## Routes

- `GET /api/v1/plugins/sentiment-timeline?action=results`
- `GET /api/v1/plugins/sentiment-timeline?action=summary`
- `GET /api/v1/plugins/sentiment-timeline?action=analyze`

## Notes

- Results are cached onto memory metadata so repeated page loads do not re-run analysis.
- The codex port keeps the feature page while moving the analysis logic into `src/server/plugins/ports/sentiment-timeline.ts`.
