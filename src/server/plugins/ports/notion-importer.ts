/**
 * Notion Importer — Portable Logic
 *
 * Parses Notion export ZIPs (markdown pages + CSV database exports).
 * Pure logic: no HTTP, no DB, no embeddings.
 *
 * Handles:
 * - Notion's UUID-suffixed filenames
 * - CSV database parsing (with quoted fields, multi-line)
 * - Heading-based smart chunking
 * - Database rows → formatted content
 */

// ─── Types ──────────────────────────────────────────────────────

export interface NotionPage {
  path: string;
  name: string;
  content: string;
  type: 'page' | 'database-page' | 'database-csv';
  parentPath?: string;
  properties?: Record<string, string>;
  wordCount: number;
}

export interface NotionDatabase {
  name: string;
  csvPath: string;
  columns: string[];
  rowCount: number;
  rows: Record<string, string>[];
}

export interface NotionImportStats {
  totalPages: number;
  totalDatabases: number;
  totalWords: number;
  folders: Record<string, number>;
  pageTypes: Record<string, number>;
  samplePages: Array<{
    name: string;
    path: string;
    type: string;
    wordCount: number;
    preview: string;
  }>;
  databases: Array<{
    name: string;
    columns: string[];
    rowCount: number;
  }>;
}

export interface NotionImportChunk {
  content: string;
  sourceTitle: string;
  tags: string[];
}

// ─── Title / Content Cleaning ───────────────────────────────────

/** Remove Notion's UUID suffix from filenames: "My Page abc123def456.md" → "My Page" */
export function cleanNotionTitle(filename: string): string {
  return filename
    .replace(/\.md$/i, '')
    .replace(/\.csv$/i, '')
    .replace(/\s+[a-f0-9]{32}$/i, '')
    .replace(
      /\s+[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
      '',
    )
    .trim();
}

/** Strip Notion artifacts (redundant H1, internal links, extra newlines) */
export function cleanNotionContent(content: string): string {
  return content
    .replace(/^# .+\n\n?/, '')
    .replace(/\[([^\]]+)\]\([^)]*notion\.so[^)]*\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── CSV Parsing ────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/** Parse a CSV string into columns + rows, handling quoted multi-line fields */
export function parseCSV(
  csvContent: string,
): { columns: string[]; rows: Record<string, string>[] } {
  const lines = csvContent.split('\n');
  if (lines.length < 2) return { columns: [], rows: [] };

  const columns = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  let currentLine = '';

  for (let i = 1; i < lines.length; i++) {
    currentLine += (currentLine ? '\n' : '') + lines[i];
    const quoteCount = (currentLine.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) continue;

    const values = parseCSVLine(currentLine);
    if (values.length > 0) {
      const row: Record<string, string> = {};
      for (let j = 0; j < columns.length; j++) {
        row[columns[j]] = values[j] || '';
      }
      rows.push(row);
    }
    currentLine = '';
  }

  return { columns, rows };
}

// ─── Content Formatting ─────────────────────────────────────────

/** Convert a database row into readable markdown content */
export function databaseRowToContent(
  row: Record<string, string>,
  columns: string[],
  dbName: string,
): string {
  const titleCol =
    columns.find((c) => /^(name|title|page|heading)$/i.test(c)) || columns[0];
  const title = row[titleCol] || 'Untitled';

  const parts: string[] = [
    `## ${title}`,
    `_From Notion Database: ${dbName}_`,
    '',
  ];

  for (const col of columns) {
    if (col === titleCol) continue;
    const value = row[col];
    if (value && value.trim()) {
      parts.push(`**${col}:** ${value}`);
    }
  }

  return parts.join('\n');
}

// ─── Smart Chunking ────────────────────────────────────────────

/** Split content into chunks, preferring heading boundaries, capped at maxSize chars */
export function smartChunk(content: string, maxSize: number = 4000): string[] {
  if (content.length <= maxSize) return [content];

  const chunks: string[] = [];
  const sections = content.split(/(?=\n#{1,6}\s)/);

  let current = '';
  for (const section of sections) {
    if (current.length + section.length > maxSize && current.length > 0) {
      chunks.push(current.trim());
      current = '';
    }

    if (section.length > maxSize) {
      const paragraphs = section.split(/\n\n+/);
      for (const para of paragraphs) {
        if (current.length + para.length + 2 > maxSize && current.length > 0) {
          chunks.push(current.trim());
          current = '';
        }
        current += (current ? '\n\n' : '') + para;
      }
    } else {
      current += (current ? '\n' : '') + section;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// ─── Vault Parsing Pipeline ─────────────────────────────────────

/**
 * Given a map of relative paths → file contents from a ZIP,
 * extract NotionPages and NotionDatabases.
 *
 * `files` should already have __MACOSX filtered out and common root stripped.
 */
export function parseNotionExport(files: Map<string, string>): {
  pages: NotionPage[];
  databases: NotionDatabase[];
} {
  const pages: NotionPage[] = [];
  const databases: NotionDatabase[] = [];
  const csvFiles = new Map<string, string>();
  const mdFiles = new Map<string, string>();

  for (const [path, content] of files) {
    if (path.endsWith('.csv')) csvFiles.set(path, content);
    else if (path.endsWith('.md')) mdFiles.set(path, content);
  }

  // Process CSV databases
  for (const [csvPath, csvContent] of csvFiles) {
    const { columns, rows } = parseCSV(csvContent);
    if (columns.length === 0 || rows.length === 0) continue;

    const dbName = cleanNotionTitle(csvPath.split('/').pop() || 'Database');
    databases.push({ name: dbName, csvPath, columns, rowCount: rows.length, rows });

    const titleCol =
      columns.find((c) => /^(name|title|page|heading)$/i.test(c)) ||
      columns[0];

    for (const row of rows) {
      const content = databaseRowToContent(row, columns, dbName);
      const name = row[titleCol] || 'Untitled';
      pages.push({
        path: csvPath,
        name: `${dbName}: ${name}`,
        content,
        type: 'database-page',
        properties: row,
        wordCount: content.split(/\s+/).filter(Boolean).length,
      });
    }
  }

  // Process markdown pages
  for (const [mdPath, mdContent] of mdFiles) {
    const filename = mdPath.split('/').pop() || '';
    const name = cleanNotionTitle(filename);
    const cleaned = cleanNotionContent(mdContent);
    if (cleaned.length < 20) continue;

    const parentPath = mdPath.split('/').slice(0, -1).join('/');
    pages.push({
      path: mdPath,
      name,
      content: cleaned,
      type: 'page',
      parentPath: parentPath || undefined,
      wordCount: cleaned.split(/\s+/).filter(Boolean).length,
    });
  }

  return { pages, databases };
}

/**
 * Build import preview stats from parsed pages + databases.
 */
export function buildImportStats(
  pages: NotionPage[],
  databases: NotionDatabase[],
  sampleCount: number = 8,
): NotionImportStats {
  const folders: Record<string, number> = {};
  for (const page of pages) {
    const folder =
      page.path.split('/').slice(0, -1).join('/') || '(root)';
    folders[folder] = (folders[folder] || 0) + 1;
  }

  const pageTypes: Record<string, number> = {};
  for (const page of pages) {
    pageTypes[page.type] = (pageTypes[page.type] || 0) + 1;
  }

  return {
    totalPages: pages.length,
    totalDatabases: databases.length,
    totalWords: pages.reduce((sum, p) => sum + p.wordCount, 0),
    folders,
    pageTypes,
    samplePages: pages.slice(0, sampleCount).map((p) => ({
      name: p.name,
      path: p.path,
      type: p.type,
      wordCount: p.wordCount,
      preview: p.content.substring(0, 150),
    })),
    databases: databases.map((d) => ({
      name: d.name,
      columns: d.columns,
      rowCount: d.rowCount,
    })),
  };
}

/**
 * Chunk all pages into import-ready chunks (content + title + tags).
 * Cap at `maxChunks`.
 */
export function chunkPagesForImport(
  pages: NotionPage[],
  maxChunks: number = 500,
): NotionImportChunk[] {
  const allChunks: NotionImportChunk[] = [];

  for (const page of pages) {
    const chunks = smartChunk(page.content);
    const tags: string[] = [];
    if (page.type === 'database-page') tags.push('notion-database');
    if (page.parentPath) {
      const folderTag = page.parentPath.split('/').pop();
      if (folderTag) tags.push(cleanNotionTitle(folderTag));
    }

    for (let i = 0; i < chunks.length; i++) {
      const suffix =
        chunks.length > 1 ? ` (Part ${i + 1}/${chunks.length})` : '';
      allChunks.push({
        content: chunks[i],
        sourceTitle: page.name + suffix,
        tags,
      });
    }
  }

  return allChunks.slice(0, maxChunks);
}

/**
 * Strip the common vault-root prefix from a list of file paths.
 * E.g. if every path starts with "My Export/", strip that prefix.
 */
export function stripCommonRoot(paths: string[]): { prefix: string; stripped: string[] } {
  if (paths.length === 0) return { prefix: '', stripped: paths };

  const firstSlash = paths[0].indexOf('/');
  if (firstSlash <= 0) return { prefix: '', stripped: paths };

  const candidate = paths[0].substring(0, firstSlash + 1);
  if (paths.every((p) => p.startsWith(candidate))) {
    return {
      prefix: candidate,
      stripped: paths.map((p) => p.substring(candidate.length)),
    };
  }
  return { prefix: '', stripped: paths };
}
