/**
 * Pocket / Instapaper Importer — Portable logic module
 *
 * Extracted from the route for convergence with codex runtime.
 * Handles: parsing Pocket HTML export, Instapaper CSV export, formatting.
 */

// ─── Types ────────────────────────────────────────────────────

export interface SavedArticle {
  url: string;
  title: string;
  tags?: string[];
  addedAt?: string;
  source: 'pocket' | 'instapaper';
  folder?: string;
  description?: string;
}

export interface PocketImportResult {
  articles: SavedArticle[];
  source: 'pocket' | 'instapaper';
}

// ─── Pocket HTML Parser ──────────────────────────────────────

/**
 * Parse Pocket's Netscape-format HTML bookmark export.
 * Format: <a href="URL" time_added="timestamp" tags="tag1,tag2">Title</a>
 */
export function parsePocketHTML(html: string): SavedArticle[] {
  const articles: SavedArticle[] = [];
  const linkRegex = /<a\s+href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const attrs = match[2];
    const title = match[3].replace(/<[^>]*>/g, '').trim();

    if (!url || url.startsWith('javascript:')) continue;

    const tagsMatch = attrs.match(/tags="([^"]*)"/i);
    const tags = tagsMatch
      ? tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean)
      : [];

    const timeMatch = attrs.match(/time_added="(\d+)"/i);
    const addedAt = timeMatch
      ? new Date(parseInt(timeMatch[1]) * 1000).toISOString()
      : undefined;

    articles.push({
      url,
      title: title || url,
      tags,
      addedAt,
      source: 'pocket',
    });
  }

  return articles;
}

// ─── Instapaper CSV Parser ───────────────────────────────────

export function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
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
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

export function parseInstapaperCSV(csv: string): SavedArticle[] {
  const articles: SavedArticle[] = [];
  const lines = csv.split('\n');

  if (lines.length < 2) return articles;

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const urlIdx = headers.indexOf('url');
  const titleIdx = headers.indexOf('title');
  const selectionIdx = headers.indexOf('selection');
  const folderIdx = headers.indexOf('folder');
  const timestampIdx = headers.indexOf('timestamp');

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);
    const url = fields[urlIdx] || '';
    const title = fields[titleIdx] || '';

    if (!url || !url.startsWith('http')) continue;

    articles.push({
      url,
      title: title || url,
      description: fields[selectionIdx] || undefined,
      folder: fields[folderIdx] || undefined,
      addedAt: fields[timestampIdx]
        ? new Date(parseInt(fields[timestampIdx]) * 1000).toISOString()
        : undefined,
      source: 'instapaper',
    });
  }

  return articles;
}

// ─── Format Article Content ──────────────────────────────────

export function formatArticleContent(article: SavedArticle): string {
  const parts: string[] = [
    article.title,
    '',
    `URL: ${article.url}`,
  ];
  if (article.description) parts.push(`\n${article.description}`);
  if (article.tags && article.tags.length > 0) parts.push(`\nTags: ${article.tags.join(', ')}`);
  if (article.folder) parts.push(`\nFolder: ${article.folder}`);

  return parts.filter(Boolean).join('\n');
}

// ─── Article Metadata ────────────────────────────────────────

export function buildArticleMetadata(article: SavedArticle): Record<string, any> {
  const metadata: Record<string, any> = {
    url: article.url,
    importSource: article.source,
    importedVia: 'pocket-importer-plugin',
  };
  if (article.tags?.length) metadata.tags = article.tags;
  if (article.folder) metadata.folder = article.folder;
  if (article.description) metadata.description = article.description;
  return metadata;
}
