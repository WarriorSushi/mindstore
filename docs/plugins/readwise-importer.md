# Readwise Highlights

Import all your Readwise highlights — books, articles, tweets, podcasts.

## What It Does

- Connects to Readwise API (readwise.io/access_token)
- Fetches all books and highlights with full pagination
- Supports incremental sync (only new highlights since last import)
- Filters by category (books, articles, tweets, podcasts, supplementals)
- Stores each highlight with book title, author, location, color, and tags
- Saves API token securely in plugin config

## How To Use It

1. Get your API token from readwise.io/access_token
2. Save the token in MindStore's Readwise settings
3. Click Import to fetch all highlights
4. Re-import anytime for incremental updates

## Port Architecture

- API client + formatting in `src/server/plugins/ports/readwise-importer.ts`
- Thin API route at `src/app/api/v1/plugins/readwise-importer/route.ts`
- Import storage via `import-service.ts`
- Test at `tests/unit/readwise-importer.test.ts`
