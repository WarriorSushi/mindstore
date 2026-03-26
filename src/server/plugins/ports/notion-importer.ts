import { importDocuments } from "@/server/import-service";
import { assertPluginEnabled } from "@/server/plugins/ports/plugin-config";

const PLUGIN_SLUG = "notion-importer";

export interface NotionPage {
  path: string;
  name: string;
  content: string;
  type: "page" | "database-page" | "database-csv";
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

export interface NotionImportChunk {
  content: string;
  sourceTitle: string;
  tags: string[];
}

export async function ensureNotionImporterReady() {
  await assertPluginEnabled(PLUGIN_SLUG);
}

export function cleanNotionTitle(filename: string): string {
  return filename
    .replace(/\.md$/i, "")
    .replace(/\.csv$/i, "")
    .replace(/\s+[a-f0-9]{32}$/i, "")
    .replace(/\s+[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i, "")
    .trim();
}

export function cleanNotionContent(content: string): string {
  return content
    .replace(/^# .+\n\n?/, "")
    .replace(/\[([^\]]+)\]\([^)]*notion\.so[^)]*\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

export function parseCSV(csvContent: string) {
  const lines = csvContent.split("\n");
  if (lines.length < 2) return { columns: [], rows: [] as Record<string, string>[] };

  const columns = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  let currentLine = "";

  for (let index = 1; index < lines.length; index += 1) {
    currentLine += `${currentLine ? "\n" : ""}${lines[index]}`;
    const quoteCount = (currentLine.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) continue;

    const values = parseCSVLine(currentLine);
    if (values.length > 0) {
      const row: Record<string, string> = {};
      for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
        row[columns[columnIndex]] = values[columnIndex] || "";
      }
      rows.push(row);
    }

    currentLine = "";
  }

  return { columns, rows };
}

export function databaseRowToContent(
  row: Record<string, string>,
  columns: string[],
  databaseName: string,
) {
  const titleColumn = columns.find((column) => /^(name|title|page|heading)$/i.test(column)) || columns[0];
  const title = row[titleColumn] || "Untitled";
  const parts: string[] = [`## ${title}`, `_From Notion Database: ${databaseName}_`, ""];

  for (const column of columns) {
    if (column === titleColumn) continue;
    const value = row[column];
    if (value && value.trim()) {
      parts.push(`**${column}:** ${value}`);
    }
  }

  return parts.join("\n");
}

export function smartChunk(content: string, maxSize: number = 4000): string[] {
  if (content.length <= maxSize) return [content];

  const chunks: string[] = [];
  const sections = content.split(/(?=\n#{1,6}\s)/);
  let current = "";

  for (const section of sections) {
    if (current.length + section.length > maxSize && current.length > 0) {
      chunks.push(current.trim());
      current = "";
    }

    if (section.length > maxSize) {
      const paragraphs = section.split(/\n\n+/);
      for (const paragraph of paragraphs) {
        if (current.length + paragraph.length + 2 > maxSize && current.length > 0) {
          chunks.push(current.trim());
          current = "";
        }
        current += `${current ? "\n\n" : ""}${paragraph}`;
      }
    } else {
      current += `${current ? "\n" : ""}${section}`;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function stripCommonRoot(paths: string[]) {
  if (paths.length === 0) return { prefix: "", stripped: paths };
  const firstSlash = paths[0].indexOf("/");
  if (firstSlash <= 0) return { prefix: "", stripped: paths };

  const candidate = paths[0].substring(0, firstSlash + 1);
  if (paths.every((path) => path.startsWith(candidate))) {
    return {
      prefix: candidate,
      stripped: paths.map((path) => path.substring(candidate.length)),
    };
  }

  return { prefix: "", stripped: paths };
}

export function parseNotionExport(files: Map<string, string>) {
  const pages: NotionPage[] = [];
  const databases: NotionDatabase[] = [];
  const csvFiles = new Map<string, string>();
  const markdownFiles = new Map<string, string>();

  for (const [path, content] of files) {
    if (path.endsWith(".csv")) csvFiles.set(path, content);
    else if (path.endsWith(".md")) markdownFiles.set(path, content);
  }

  for (const [csvPath, csvContent] of csvFiles) {
    const { columns, rows } = parseCSV(csvContent);
    if (columns.length === 0 || rows.length === 0) continue;

    const databaseName = cleanNotionTitle(csvPath.split("/").pop() || "Database");
    databases.push({ name: databaseName, csvPath, columns, rowCount: rows.length, rows });

    const titleColumn = columns.find((column) => /^(name|title|page|heading)$/i.test(column)) || columns[0];

    for (const row of rows) {
      const content = databaseRowToContent(row, columns, databaseName);
      const name = row[titleColumn] || "Untitled";
      pages.push({
        path: csvPath,
        name: `${databaseName}: ${name}`,
        content,
        type: "database-page",
        properties: row,
        wordCount: content.split(/\s+/).filter(Boolean).length,
      });
    }
  }

  for (const [markdownPath, markdownContent] of markdownFiles) {
    const name = cleanNotionTitle(markdownPath.split("/").pop() || "");
    const cleaned = cleanNotionContent(markdownContent);
    if (cleaned.length < 20) continue;

    pages.push({
      path: markdownPath,
      name,
      content: cleaned,
      type: "page",
      parentPath: markdownPath.split("/").slice(0, -1).join("/") || undefined,
      wordCount: cleaned.split(/\s+/).filter(Boolean).length,
    });
  }

  return { pages, databases };
}

export function buildNotionImportStats(
  pages: NotionPage[],
  databases: NotionDatabase[],
  sampleCount: number = 8,
) {
  const folders: Record<string, number> = {};
  const pageTypes: Record<string, number> = {};

  for (const page of pages) {
    const folder = page.path.split("/").slice(0, -1).join("/") || "(root)";
    folders[folder] = (folders[folder] || 0) + 1;
    pageTypes[page.type] = (pageTypes[page.type] || 0) + 1;
  }

  return {
    totalPages: pages.length,
    totalDatabases: databases.length,
    totalWords: pages.reduce((sum, page) => sum + page.wordCount, 0),
    folders,
    pageTypes,
    samplePages: pages.slice(0, sampleCount).map((page) => ({
      name: page.name,
      path: page.path,
      type: page.type,
      wordCount: page.wordCount,
      preview: page.content.substring(0, 150),
    })),
    databases: databases.map((database) => ({
      name: database.name,
      columns: database.columns,
      rowCount: database.rowCount,
    })),
  };
}

export function chunkPagesForImport(pages: NotionPage[], maxChunks: number = 500): NotionImportChunk[] {
  const allChunks: NotionImportChunk[] = [];

  for (const page of pages) {
    const chunks = smartChunk(page.content);
    const tags: string[] = [];

    if (page.type === "database-page") tags.push("notion-database");
    if (page.parentPath) {
      const folderTag = page.parentPath.split("/").pop();
      if (folderTag) tags.push(cleanNotionTitle(folderTag));
    }

    for (let index = 0; index < chunks.length; index += 1) {
      const suffix = chunks.length > 1 ? ` (Part ${index + 1}/${chunks.length})` : "";
      allChunks.push({
        content: chunks[index],
        sourceTitle: `${page.name}${suffix}`,
        tags,
      });
    }
  }

  return allChunks.slice(0, maxChunks);
}

export async function importNotionPages({
  userId,
  pages,
}: {
  userId: string;
  pages: NotionPage[];
}) {
  await ensureNotionImporterReady();
  const chunks = chunkPagesForImport(pages);
  const summary = await importDocuments({
    userId,
    documents: chunks.map((chunk) => ({
      title: chunk.sourceTitle,
      content: chunk.content,
      sourceType: "notion",
      metadata: {
        plugin: PLUGIN_SLUG,
        tags: chunk.tags,
        importSource: "notion-enhanced",
      },
      preChunked: true,
    })),
  });

  return {
    imported: {
      pages: pages.filter((page) => page.type === "page").length,
      databaseRows: pages.filter((page) => page.type === "database-page").length,
      chunks: summary.chunks,
      embedded: summary.embedded,
      skipped: Math.max(0, chunkPagesForImport(pages, Number.MAX_SAFE_INTEGER).length - chunks.length),
    },
  };
}
