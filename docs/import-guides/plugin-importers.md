# Plugin Importers

MindStore's Import page now discovers active import plugins from the runtime.

## What This Means

- Built-in importers still have dedicated first-party flows.
- Additional import plugins can appear automatically as plugin tabs.
- When a plugin does not have a dedicated importer page yet, MindStore still shows its accepted file types, route surface, and plugin entry point.

## Why It Helps

This makes the product friendlier to open source growth. Contributors can add importer metadata and hook behavior first, then layer on richer UI without needing a hardcoded slot in the Import page.
