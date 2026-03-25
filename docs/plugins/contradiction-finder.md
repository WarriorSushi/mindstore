# Contradiction Finder

Contradiction Finder scans your memories for conflicting beliefs, outdated claims, and internal tension.

## What It Does

- finds candidate memory pairs with similar embeddings
- uses AI to verify whether a contradiction is real
- falls back to keyword-based heuristics when no AI provider is configured
- stores confirmed contradictions for review in the Insights experience

## How To Use It

1. Open `/app/insights`.
2. Go to the contradictions section.
3. Run a deep scan.
4. Review the conflicts it finds.
5. Dismiss them or resolve them by keeping one side.

## Why This Port Matters

Contradiction Finder is the first analysis-heavy convergence reference on codex.

It shows how codex analysis ports should work:

- reusable server logic in `src/server/plugins/ports/*`
- thin API route
- shared AI client for provider resolution
- existing UI workflow preserved
