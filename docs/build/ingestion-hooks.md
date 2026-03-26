# Ingestion Hooks

MindStore now lets active plugins participate in ingestion in two places:

- `onImport` for manual imports through `/api/v1/import`
- `onCapture` for lightweight client capture through `/api/v1/capture`

## Supported Transform Shape

Plugins can return hook data with any of these fields:

- `documents`
- `appendDocuments`
- `metadataPatch`

`documents` replaces the current batch.

`appendDocuments` adds more documents to the batch.

`metadataPatch` is merged onto every document in the batch after other transforms are applied.

## Why This Exists

This keeps import and capture thin while still letting plugins:

- normalize source-specific payloads
- add enrichment metadata
- duplicate a single input into multiple derived documents
- prepare future language or source adapters without editing core routes

## Runtime Import Tabs

Import tabs are also exposed through the shared runtime via `/api/v1/plugins/runtime?action=imports`.

The Import page uses that contract to discover active plugin importers and render a generic panel even when a custom importer page does not exist yet.
