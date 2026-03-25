# Release: Plugin-Aware Ingestion

## Highlights

- Added runtime discovery for active plugin import tabs.
- Upgraded the Import page to render generic plugin importer panels from runtime metadata.
- Added transform-aware `onImport` and `onCapture` hook processing.
- Documented the ingestion hook contract for plugin authors.

## Why It Matters

MindStore ingestion is now more extensible in two dimensions at once: plugins can show up in the product import flow, and they can also modify import and capture batches before documents are indexed. This is an important step toward a real community importer ecosystem.
