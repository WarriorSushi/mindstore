# Anki Deck Export Plugin

Export your MindStore flashcards as Anki-compatible files for spaced repetition study.

## Category
Export

## Capabilities
- Export flashcard decks as Anki-native TSV (tab-separated) files
- Export as universal CSV (works with Quizlet, Brainscape, etc.)
- Single-deck export returns a single file; multi-deck returns a ZIP
- Preview cards before exporting
- Include/exclude SM2 metadata (ease factor, interval, repetitions)

## API

### GET `/api/v1/plugins/anki-export`

| Action    | Params              | Description                         |
|-----------|---------------------|-------------------------------------|
| `decks`   | —                   | List available decks with stats     |
| `preview` | `deckId` (required) | Preview first 20 cards in a deck    |
| `config`  | —                   | Export configuration and stats      |

### POST `/api/v1/plugins/anki-export`

| Action       | Body                                          | Description                      |
|--------------|-----------------------------------------------|----------------------------------|
| `export`     | `deckIds[]`, `format` (tsv/csv), `includeMetadata` | Generate export file (base64)    |
| `export-csv` | `deckIds[]`, `includeMetadata`                | Quick CSV export                 |

## Export Formats

- **TSV (Anki Import)** — Recommended. Includes `# separator:tab`, `# deck:`, `# notetype:Basic` headers. Import directly via Anki → File → Import.
- **CSV (Universal)** — Standard CSV. Works with Anki, Quizlet, Brainscape, and other tools.

## Dependencies
- Requires the **Flashcard Maker** plugin to have created decks
- Uses `jszip` for multi-deck ZIP packaging
