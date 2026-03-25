# Twitter/X Bookmarks

Import your Twitter/X bookmarks and tweets into MindStore.

## What It Does

- Parses Twitter data archive exports (bookmarks.js, tweets.js)
- Handles Twitter's JS module format (`window.YTD.bookmark.part0 = [...]`)
- Supports manual tweet entry
- Extracts author info, hashtags, URLs, and engagement metrics
- Filters out empty bookmark-only entries
- Stores tweets as searchable memories with full metadata

## How To Use It

1. Go to twitter.com → Settings → Your Account → Download an archive
2. Wait for Twitter to prepare your data (24-48 hours)
3. Download and unzip the archive
4. Find `data/bookmarks.js` or `data/tweets.js`
5. Upload the file in MindStore's import tab

## Port Architecture

- Parsing logic in `src/server/plugins/ports/twitter-importer.ts`
- Thin API route at `src/app/api/v1/plugins/twitter-importer/route.ts`
- Import storage via `import-service.ts` (embeddings + chunking)
- Test at `tests/unit/twitter-importer.test.ts`
