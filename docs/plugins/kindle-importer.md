# Kindle Highlights

Kindle Highlights imports your `My Clippings.txt` export into MindStore.

## What It Does

- parses Kindle clippings
- skips bookmarks
- deduplicates overlapping highlights
- groups highlights by book
- lets you preview before importing
- stores imported books as searchable memories

## How To Use It

1. Open `/app/import`.
2. Choose the `Kindle` tab.
3. Upload `My Clippings.txt`.
4. Review the preview.
5. Import the highlights into MindStore.

## Why This Port Matters

Kindle Importer is the first importer-style convergence reference on codex.

It shows how a frain route-based importer should be adapted:

- parsing logic in `src/server/plugins/ports/*`
- thin API route
- existing UI flow preserved
- import storage routed through codex import primitives
