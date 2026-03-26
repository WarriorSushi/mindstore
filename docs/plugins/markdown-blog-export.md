# Markdown Blog Export Plugin

Export your MindStore memories as blog-ready markdown for Hugo, Jekyll, Astro, Next.js, or plain markdown.

## Category
Export

## Capabilities
- Export memories as framework-specific markdown with proper frontmatter
- 5 templates: Hugo, Jekyll, Astro, Next.js (MDX), Plain Markdown
- YAML frontmatter with framework-specific fields (layout, pubDate, slug, etc.)
- Date-prefix, folder-based, or kebab-case file naming
- Group by source type option
- Automatic ZIP packaging with README
- Astro content collection config included

## API

### GET `/api/v1/plugins/markdown-blog-export`

| Action    | Params                          | Description                    |
|-----------|---------------------------------|--------------------------------|
| `config`  | —                               | Templates + memory source stats |
| `preview` | `template`, `sourceType` (opt)  | Preview first 5 exports        |

### POST `/api/v1/plugins/markdown-blog-export`

| Action   | Body                                                              | Description              |
|----------|-------------------------------------------------------------------|--------------------------|
| `export` | `templateId`, `sourceTypes[]`, `author`, `draft`, `includeMetadata`, `groupBySource` | Generate ZIP (base64)    |

## Templates

| Template | Framework | File Naming       | Extension | Special Features             |
|----------|-----------|-------------------|-----------|------------------------------|
| hugo     | Hugo      | folder/index.md   | .md       | Bundles, taxonomies, slug    |
| jekyll   | Jekyll    | YYYY-MM-DD-slug   | .md       | layout: post, categories     |
| astro    | Astro     | kebab-case        | .md       | Content collections, pubDate |
| nextjs   | Next.js   | kebab-case        | .mdx      | MDX, component imports       |
| plain    | Any       | kebab-case        | .md       | Minimal, universal           |

## Dependencies
- Uses `jszip` for ZIP packaging
