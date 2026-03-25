# PDF And EPUB Parser

The PDF and EPUB parser turns uploaded long-form documents into structure-aware memories.

## What It Does

- parses PDF text and uses heading heuristics to recover sections
- parses EPUB chapter HTML and converts it to readable text
- keeps section boundaries when building import chunks
- returns a document preview with section stats before import

## Codex Port Notes

- portable structure logic lives in `src/server/plugins/ports/pdf-epub-parser.ts`
- binary parsing stays in the route because it depends on `pdf-parse` and `epub2`
- import now goes through the shared import service while preserving smart chunks
