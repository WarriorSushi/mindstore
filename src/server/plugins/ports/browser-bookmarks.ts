/**
 * Browser Bookmarks Importer — Portable logic module
 *
 * Extracted from the route for convergence with codex runtime.
 * Handles: parsing Netscape bookmark HTML, content formatting, text extraction.
 */

// ─── Types ────────────────────────────────────────────────────

export interface Bookmark {
  title: string;
  url: string;
  addDate: number | null;
  folder: string;
  content?: string;
}

export interface BookmarkFolder {
  name: string;
  path: string;
  bookmarks: Bookmark[];
  children: BookmarkFolder[];
}

export interface BookmarkParseResult {
  root: BookmarkFolder;
  all: Bookmark[];
  stats: {
    totalBookmarks: number;
    totalFolders: number;
    topFolders: { name: string; count: number }[];
    oldestDate: string | null;
    newestDate: string | null;
  };
}

// ─── HTML Entity Decoder ─────────────────────────────────────

export function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

export function extractDomainTitle(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url.substring(0, 60);
  }
}

// ─── Netscape Bookmark HTML Parser ──────────────────────────

/**
 * Parse Netscape-format bookmarks HTML used by Chrome, Firefox, Safari, Edge, Brave, Arc, Opera.
 */
export function parseBookmarksHTML(html: string): BookmarkParseResult {
  const all: Bookmark[] = [];
  const root: BookmarkFolder = { name: 'Bookmarks', path: '', bookmarks: [], children: [] };
  const folderCounts = new Map<string, number>();

  const lines = html.split('\n');
  const folderStack: BookmarkFolder[] = [root];
  let currentFolder = root;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Folder open: <DT><H3 ...>Folder Name</H3>
    const folderMatch = line.match(/<DT>\s*<H3[^>]*>(.*?)<\/H3>/i);
    if (folderMatch) {
      const folderName = decodeHTMLEntities(folderMatch[1]);
      const path = currentFolder.path
        ? `${currentFolder.path} / ${folderName}`
        : folderName;
      const newFolder: BookmarkFolder = { name: folderName, path, bookmarks: [], children: [] };
      currentFolder.children.push(newFolder);
      folderStack.push(newFolder);
      currentFolder = newFolder;
      continue;
    }

    // Bookmark: <DT><A HREF="..." ADD_DATE="..." ...>Title</A>
    const bookmarkMatch = line.match(/<DT>\s*<A\s+([^>]*)>(.*?)<\/A>/i);
    if (bookmarkMatch) {
      const attrs = bookmarkMatch[1];
      const title = decodeHTMLEntities(bookmarkMatch[2]);

      const hrefMatch = attrs.match(/HREF="([^"]*)"/i);
      const addDateMatch = attrs.match(/ADD_DATE="(\d+)"/i);

      if (hrefMatch) {
        const url = hrefMatch[1];
        if (url.startsWith('javascript:') || url.startsWith('data:') ||
            url.startsWith('chrome://') || url.startsWith('about:') ||
            url.startsWith('edge://') || url.startsWith('brave://')) {
          continue;
        }

        const addDate = addDateMatch ? parseInt(addDateMatch[1]) : null;
        const bookmark: Bookmark = {
          title: title || extractDomainTitle(url),
          url,
          addDate,
          folder: currentFolder.path || 'Uncategorized',
        };

        currentFolder.bookmarks.push(bookmark);
        all.push(bookmark);

        const topFolder = currentFolder.path.split(' / ')[0] || 'Uncategorized';
        folderCounts.set(topFolder, (folderCounts.get(topFolder) || 0) + 1);
      }
      continue;
    }

    // Folder close: </DL>
    if (line.match(/<\/DL>/i)) {
      if (folderStack.length > 1) {
        folderStack.pop();
        currentFolder = folderStack[folderStack.length - 1];
      }
      continue;
    }
  }

  // Calculate stats
  const dates = all.filter(b => b.addDate).map(b => b.addDate!);
  const oldestDate = dates.length > 0 ? new Date(Math.min(...dates) * 1000).toISOString().split('T')[0] : null;
  const newestDate = dates.length > 0 ? new Date(Math.max(...dates) * 1000).toISOString().split('T')[0] : null;

  let totalFolders = 0;
  const countFolders = (f: BookmarkFolder) => {
    totalFolders += f.children.length;
    f.children.forEach(countFolders);
  };
  countFolders(root);

  const topFolders = [...folderCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  return {
    root,
    all,
    stats: { totalBookmarks: all.length, totalFolders, topFolders, oldestDate, newestDate },
  };
}

// ─── Content Extraction from HTML ────────────────────────────

/**
 * Basic readability extraction — strip tags, get text content from fetched HTML.
 */
export function extractReadableText(html: string): string {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');

  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  const title = titleMatch ? decodeHTMLEntities(titleMatch[1]) : '';

  const descMatch = html.match(/<meta\s+(?:name="description"\s+content="([^"]*)"| content="([^"]*)"\s+name="description")/i);
  const description = descMatch ? decodeHTMLEntities(descMatch[1] || descMatch[2] || '') : '';

  text = text.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n## $1\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/?(p|div|li|tr|blockquote)[^>]*>/gi, '\n');
  text = text.replace(/<[^>]+>/g, ' ');
  text = decodeHTMLEntities(text);

  text = text
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line.length > 0)
    .join('\n');

  if (text.length > 4000) text = text.substring(0, 4000) + '…';

  const parts: string[] = [];
  if (title) parts.push(`# ${title}`);
  if (description) parts.push(description);
  if (parts.length > 0) parts.push('');
  parts.push(text);

  return parts.join('\n').trim();
}

// ─── Format Bookmark for Storage ─────────────────────────────

export function formatBookmarkContent(bookmark: Bookmark): string {
  const parts: string[] = [
    `# ${bookmark.title}`,
    `**URL:** ${bookmark.url}`,
    `**Folder:** ${bookmark.folder}`,
  ];
  if (bookmark.addDate) {
    const date = new Date(bookmark.addDate * 1000);
    parts.push(`**Saved:** ${date.toISOString().split('T')[0]}`);
  }
  if (bookmark.content) {
    parts.push('', '---', '', bookmark.content);
  }
  return parts.join('\n');
}
