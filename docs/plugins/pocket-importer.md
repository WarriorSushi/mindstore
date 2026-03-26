# Pocket / Instapaper

Import saved articles from Pocket or Instapaper.

## What It Does

- Parses Pocket HTML bookmark exports (ril_export.html)
- Parses Instapaper CSV exports
- Extracts URLs, titles, tags, folders, timestamps, and descriptions
- Handles quoted CSV fields with commas and escaped quotes
- Stores articles with full metadata for retrieval

## How To Use It

### Pocket
1. Go to getpocket.com/export
2. Click "Export" to download as HTML
3. Upload the ril_export.html file

### Instapaper
1. Go to instapaper.com → Settings
2. Click "Export" under Data
3. Upload the CSV file

## Port Architecture

- Parsing logic in `src/server/plugins/ports/pocket-importer.ts`
- Thin API route at `src/app/api/v1/plugins/pocket-importer/route.ts`
- Import storage via `import-service.ts`
- Test at `tests/unit/pocket-importer.test.ts`
