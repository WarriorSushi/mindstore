/**
 * Obsidian Vault Sync (Export) — Portable Logic
 *
 * Converts MindStore memories into Obsidian-compatible markdown files
 * with YAML frontmatter, wikilinks, backlinks, and folder structure.
 *
 * Pure logic: no HTTP, no DB, no ZIP library.
 * Caller provides memories + connections → gets back file map.
 */

// ─── Types ──────────────────────────────────────────────────────

export interface ObsidianSyncConfig {
  vaultName: string;
  folderStructure: 'flat' | 'by-source' | 'by-date' | 'by-topic';
  includeMetadata: boolean;
  includeTags: boolean;
  includeBacklinks: boolean;
  includeWikilinks: boolean;
  frontmatterStyle: 'yaml' | 'none';
  filterBySource?: string[];
  lastExportAt?: string;
  lastImportAt?: string;
  exportCount?: number;
  importCount?: number;
  exportedMemoryIds?: string[];
  syncHistory?: SyncRecord[];
}

export interface SyncRecord {
  id: string;
  timestamp: string;
  direction: 'export' | 'import';
  count: number;
  status: 'success' | 'partial' | 'failed';
}

export interface MemoryForExport {
  id: number | string;
  content: string;
  sourceType: string;
  sourceTitle: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface ConnectionForExport {
  memoryAId: number | string;
  memoryBId: number | string;
}

// ─── Default Config ─────────────────────────────────────────────

export function defaultSyncConfig(): ObsidianSyncConfig {
  return {
    vaultName: 'MindStore',
    folderStructure: 'by-source',
    includeMetadata: true,
    includeTags: true,
    includeBacklinks: true,
    includeWikilinks: true,
    frontmatterStyle: 'yaml',
    exportedMemoryIds: [],
    syncHistory: [],
  };
}

// ─── Helpers ────────────────────────────────────────────────────

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 100)
      .replace(/(^-|-$)/g, '') || 'untitled'
  );
}

const SOURCE_FOLDER_MAP: Record<string, string> = {
  chatgpt: 'ChatGPT',
  file: 'Files',
  url: 'URLs',
  text: 'Notes',
  kindle: 'Kindle',
  youtube: 'YouTube',
  reddit: 'Reddit',
  obsidian: 'Obsidian',
  document: 'Documents',
  audio: 'Audio',
  image: 'Images',
};

/** Compute the folder path for a memory based on folder structure setting */
export function getMemoryFolder(
  memory: MemoryForExport,
  structure: ObsidianSyncConfig['folderStructure'],
): string {
  switch (structure) {
    case 'by-source':
      return SOURCE_FOLDER_MAP[memory.sourceType || 'text'] || 'Other';
    case 'by-date': {
      const date = new Date(memory.createdAt);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${year}/${year}-${month}`;
    }
    case 'flat':
    default:
      return '';
  }
}

// ─── Markdown Generation ────────────────────────────────────────

/** Convert a memory into Obsidian-compatible markdown */
export function memoryToMarkdown(
  memory: MemoryForExport,
  config: ObsidianSyncConfig,
  allMemories: MemoryForExport[],
  connections: ConnectionForExport[],
): string {
  const parts: string[] = [];

  // YAML frontmatter
  if (config.frontmatterStyle === 'yaml') {
    const title =
      memory.sourceTitle ||
      memory.content
        .split('\n')[0]
        .replace(/^#+\s*/, '')
        .substring(0, 80) ||
      'Untitled';
    const tags = (memory.metadata?.tags as string[]) || [];
    const sourceType = memory.sourceType || 'text';

    parts.push('---');
    parts.push(`title: "${title.replace(/"/g, '\\"')}"`);
    parts.push(`source: ${sourceType}`);
    if (memory.sourceTitle)
      parts.push(
        `source_title: "${memory.sourceTitle.replace(/"/g, '\\"')}"`,
      );
    parts.push(`created: ${memory.createdAt.toISOString()}`);
    parts.push(`mindstore_id: ${memory.id}`);

    if (config.includeTags && tags.length > 0) {
      parts.push('tags:');
      for (const tag of tags) parts.push(`  - ${tag}`);
    }

    if (config.includeMetadata) {
      const wordCount = memory.content
        .split(/\s+/)
        .filter(Boolean).length;
      parts.push(`word_count: ${wordCount}`);
      if (memory.metadata?.pinned) parts.push('pinned: true');
      if (memory.metadata?.language)
        parts.push(`language: ${memory.metadata.language}`);
      if (memory.metadata?.domain)
        parts.push(`domain: ${memory.metadata.domain}`);
    }

    parts.push('---');
    parts.push('');
  }

  // Content
  parts.push(memory.content);

  // Related section
  if (config.includeBacklinks || config.includeWikilinks) {
    const relatedIds = connections
      .filter(
        (c) =>
          c.memoryAId === memory.id || c.memoryBId === memory.id,
      )
      .map((c) =>
        c.memoryAId === memory.id ? c.memoryBId : c.memoryAId,
      );

    if (relatedIds.length > 0) {
      parts.push('');
      parts.push('---');
      parts.push('## Related');

      for (const relId of relatedIds.slice(0, 10)) {
        const related = allMemories.find((m) => m.id === relId);
        if (related) {
          const relTitle =
            related.sourceTitle ||
            related.content.split('\n')[0].substring(0, 60) ||
            'Untitled';
          if (config.includeWikilinks) {
            parts.push(`- [[${slugify(relTitle)}|${relTitle}]]`);
          } else {
            parts.push(`- ${relTitle}`);
          }
        }
      }
    }
  }

  return parts.join('\n');
}

// ─── Vault Builder ──────────────────────────────────────────────

/**
 * Build the full vault file map from memories.
 * Returns a Map of relative paths → markdown content.
 * Does NOT create ZIP — caller handles that.
 */
export function buildVaultFileMap(
  memories: MemoryForExport[],
  connections: ConnectionForExport[],
  config: ObsidianSyncConfig,
): Map<string, string> {
  const files = new Map<string, string>();
  const usedNames = new Set<string>();
  const vaultName = config.vaultName || 'MindStore';

  for (const memory of memories) {
    const folder = getMemoryFolder(memory, config.folderStructure);
    const title =
      memory.sourceTitle ||
      memory.content
        .split('\n')[0]
        .replace(/^#+\s*/, '')
        .substring(0, 80) ||
      'Untitled';
    let filename = slugify(title);

    // Unique filenames
    let counter = 1;
    let fullPath = folder
      ? `${vaultName}/${folder}/${filename}.md`
      : `${vaultName}/${filename}.md`;
    while (usedNames.has(fullPath)) {
      filename = `${slugify(title)}-${counter++}`;
      fullPath = folder
        ? `${vaultName}/${folder}/${filename}.md`
        : `${vaultName}/${filename}.md`;
    }
    usedNames.add(fullPath);

    const markdown = memoryToMarkdown(
      memory,
      config,
      memories,
      connections,
    );
    files.set(fullPath, markdown);
  }

  // Obsidian config files
  files.set(
    `${vaultName}/.obsidian/app.json`,
    JSON.stringify({ showViewHeader: true, alwaysUpdateLinks: true }, null, 2),
  );
  files.set(
    `${vaultName}/.obsidian/appearance.json`,
    JSON.stringify({ baseFontSize: 16, theme: 'obsidian' }, null, 2),
  );

  // README
  files.set(
    `${vaultName}/README.md`,
    `# ${vaultName} Vault

Exported from MindStore on ${new Date().toISOString().split('T')[0]}.

## Stats
- **Memories exported:** ${memories.length}
- **Folder structure:** ${config.folderStructure}
- **Frontmatter:** ${config.frontmatterStyle === 'yaml' ? 'YAML' : 'None'}
- **Tags included:** ${config.includeTags ? 'Yes' : 'No'}
- **Wikilinks:** ${config.includeWikilinks ? 'Yes' : 'No'}

## How to Use
1. Extract this ZIP to your Obsidian vaults directory
2. Open Obsidian → "Open folder as vault" → select the \`${vaultName}\` folder
3. Your MindStore knowledge is now searchable in Obsidian!
`,
  );

  return files;
}

/**
 * Build a preview of the export (source breakdown, folders, word count).
 */
export function buildExportPreview(
  memories: MemoryForExport[],
  config: ObsidianSyncConfig,
): {
  totalMemories: number;
  filteredCount: number;
  sourceBreakdown: Record<string, number>;
  folders: Record<string, number>;
  totalWords: number;
} {
  let filtered = memories;
  if (config.filterBySource && config.filterBySource.length > 0) {
    filtered = memories.filter((m) =>
      config.filterBySource!.includes(m.sourceType || 'text'),
    );
  }

  const sourceBreakdown: Record<string, number> = {};
  for (const m of filtered) {
    const type = m.sourceType || 'text';
    sourceBreakdown[type] = (sourceBreakdown[type] || 0) + 1;
  }

  const folders: Record<string, number> = {};
  for (const m of filtered) {
    const folder = getMemoryFolder(m, config.folderStructure) || '(root)';
    folders[folder] = (folders[folder] || 0) + 1;
  }

  const totalWords = filtered.reduce(
    (sum, m) => sum + m.content.split(/\s+/).filter(Boolean).length,
    0,
  );

  return {
    totalMemories: memories.length,
    filteredCount: filtered.length,
    sourceBreakdown,
    folders,
    totalWords,
  };
}

/** Create a SyncRecord for an export */
export function buildExportSyncRecord(count: number): SyncRecord {
  return {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    direction: 'export',
    count,
    status: 'success',
  };
}
