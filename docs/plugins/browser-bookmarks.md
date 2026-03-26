# Browser Bookmarks

The Browser Bookmarks importer reads exported Netscape bookmark HTML from Chrome, Firefox, Safari, Arc, Edge, and similar browsers.

## What It Does

- parses bookmark folders and URLs from exported HTML
- builds preview stats and sample bookmark rows
- optionally fetches readable page content for each bookmark
- stores each bookmark as a searchable memory with folder metadata

## Codex Port Notes

- parsing and formatting logic lives in `src/server/plugins/ports/browser-bookmarks.ts`
- network fetching remains injected by the route so the port stays framework-free
- bookmark entries are imported as preserved single documents instead of being re-split generically
