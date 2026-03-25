# Obsidian Vault Sync Plugin

Export your MindStore knowledge base as an Obsidian-compatible vault with YAML frontmatter, wikilinks, backlinks, and configurable folder structure.

## Category
Sync / Export

## Capabilities
- Export memories as Obsidian-compatible markdown files
- YAML frontmatter with source, tags, word count, and MindStore ID
- Wikilink generation from memory connections (`[[slug|Title]]`)
- Backlink section for related memories
- Configurable folder structure: flat, by-source, by-date, by-topic
- Filter by source type
- Auto-generated `.obsidian` config files
- Vault README with export stats
- Export history tracking

## API

### GET `/api/v1/plugins/obsidian-sync`

| Action    | Description                                |
|-----------|--------------------------------------------|
| `config`  | Current sync configuration                 |
| `preview` | Export preview (source breakdown, folders)  |

### POST `/api/v1/plugins/obsidian-sync`

| Action        | Body                                          | Description              |
|---------------|-----------------------------------------------|--------------------------|
| `save-config` | `vaultName`, `folderStructure`, `includeTags`, etc. | Save sync settings   |
| `export`      | —                                             | Generate vault ZIP        |

## Configuration Options

| Setting           | Default     | Options                              |
|-------------------|-------------|--------------------------------------|
| `vaultName`       | "MindStore" | Any string                           |
| `folderStructure` | "by-source" | flat, by-source, by-date, by-topic   |
| `includeMetadata` | true        | Include word count, domain, etc.     |
| `includeTags`     | true        | Add tags to frontmatter              |
| `includeBacklinks`| true        | Add "Related" section                |
| `includeWikilinks`| true        | Use `[[slug|Title]]` format          |
| `frontmatterStyle`| "yaml"      | yaml, none                           |
| `filterBySource`  | []          | Array of source types to include     |

## Folder Structure

| Mode       | Example Path                        |
|------------|-------------------------------------|
| flat       | `MindStore/memory-title.md`         |
| by-source  | `MindStore/Kindle/book-notes.md`    |
| by-date    | `MindStore/2024/2024-03/entry.md`   |
| by-topic   | `MindStore/topic/entry.md`          |

## Dependencies
- Uses `jszip` for vault ZIP packaging
- Requires `connections` table for backlink/wikilink generation
