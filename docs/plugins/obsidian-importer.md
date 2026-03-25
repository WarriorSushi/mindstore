# Obsidian Importer

The Obsidian Importer turns a zipped vault into linked MindStore memories.

## What It Does

- parses markdown notes with YAML frontmatter
- extracts tags, aliases, wikilinks, headings, and dates
- analyzes link graphs and backlinks
- chunks large notes while preserving note-level metadata
- creates memory-to-memory connections from resolved wikilinks

## Codex Port Notes

- pure note parsing and vault analysis now live in `src/server/plugins/ports/obsidian-importer.ts`
- ZIP extraction and connection writes remain in the route because they depend on storage and archive I/O
- this codex port keeps the existing preview contract used by the Import page
