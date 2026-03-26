import { importDocuments } from "@/server/import-service";
import { assertPluginEnabled } from "@/server/plugins/ports/plugin-config";

const PLUGIN_SLUG = "browser-bookmarks";

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
    topFolders: Array<{ name: string; count: number }>;
    oldestDate: string | null;
    newestDate: string | null;
  };
}

export async function ensureBrowserBookmarksReady() {
  await assertPluginEnabled(PLUGIN_SLUG);
}

export function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, value) => String.fromCharCode(Number.parseInt(value, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCharCode(Number.parseInt(value, 16)));
}

export function extractDomainTitle(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.substring(0, 60);
  }
}

export function parseBookmarksHTML(html: string): BookmarkParseResult {
  const all: Bookmark[] = [];
  const root: BookmarkFolder = { name: "Bookmarks", path: "", bookmarks: [], children: [] };
  const folderCounts = new Map<string, number>();
  const lines = html.split("\n");
  const folderStack: BookmarkFolder[] = [root];
  let currentFolder = root;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const folderMatch = line.match(/<DT>\s*<H3[^>]*>(.*?)<\/H3>/i);

    if (folderMatch) {
      const folderName = decodeHTMLEntities(folderMatch[1]);
      const path = currentFolder.path ? `${currentFolder.path} / ${folderName}` : folderName;
      const folder: BookmarkFolder = { name: folderName, path, bookmarks: [], children: [] };
      currentFolder.children.push(folder);
      folderStack.push(folder);
      currentFolder = folder;
      continue;
    }

    const bookmarkMatch = line.match(/<DT>\s*<A\s+([^>]*)>(.*?)<\/A>/i);
    if (bookmarkMatch) {
      const attributes = bookmarkMatch[1];
      const hrefMatch = attributes.match(/HREF="([^"]*)"/i);
      const addDateMatch = attributes.match(/ADD_DATE="(\d+)"/i);

      if (!hrefMatch) continue;

      const url = hrefMatch[1];
      if (
        url.startsWith("javascript:")
        || url.startsWith("data:")
        || url.startsWith("chrome://")
        || url.startsWith("about:")
        || url.startsWith("edge://")
        || url.startsWith("brave://")
      ) {
        continue;
      }

      const bookmark: Bookmark = {
        title: decodeHTMLEntities(bookmarkMatch[2]) || extractDomainTitle(url),
        url,
        addDate: addDateMatch ? Number.parseInt(addDateMatch[1], 10) : null,
        folder: currentFolder.path || "Uncategorized",
      };

      currentFolder.bookmarks.push(bookmark);
      all.push(bookmark);
      const topFolder = currentFolder.path.split(" / ")[0] || "Uncategorized";
      folderCounts.set(topFolder, (folderCounts.get(topFolder) || 0) + 1);
      continue;
    }

    if (line.match(/<\/DL>/i) && folderStack.length > 1) {
      folderStack.pop();
      currentFolder = folderStack[folderStack.length - 1];
    }
  }

  const dates = all.filter((bookmark) => bookmark.addDate).map((bookmark) => bookmark.addDate!);
  let totalFolders = 0;
  const countFolders = (folder: BookmarkFolder) => {
    totalFolders += folder.children.length;
    folder.children.forEach(countFolders);
  };
  countFolders(root);

  return {
    root,
    all,
    stats: {
      totalBookmarks: all.length,
      totalFolders,
      topFolders: [...folderCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 8)
        .map(([name, count]) => ({ name, count })),
      oldestDate: dates.length > 0 ? new Date(Math.min(...dates) * 1000).toISOString().split("T")[0] : null,
      newestDate: dates.length > 0 ? new Date(Math.max(...dates) * 1000).toISOString().split("T")[0] : null,
    },
  };
}

export function extractReadableText(html: string): string {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "");

  const title = decodeHTMLEntities(html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1] || "");
  const description = decodeHTMLEntities(
    html.match(/<meta\s+(?:name="description"\s+content="([^"]*)"| content="([^"]*)"\s+name="description")/i)?.[1]
      || html.match(/<meta\s+(?:name="description"\s+content="([^"]*)"| content="([^"]*)"\s+name="description")/i)?.[2]
      || "",
  );

  text = text.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, "\n## $1\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/?(p|div|li|tr|blockquote)[^>]*>/gi, "\n");
  text = text.replace(/<[^>]+>/g, " ");
  text = decodeHTMLEntities(text)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");

  if (text.length > 4000) {
    text = `${text.substring(0, 4000)}…`;
  }

  const parts: string[] = [];
  if (title) parts.push(`# ${title}`);
  if (description) parts.push(description);
  if (parts.length > 0) parts.push("");
  parts.push(text);
  return parts.join("\n").trim();
}

export function formatBookmarkContent(bookmark: Bookmark) {
  const parts = [
    `# ${bookmark.title}`,
    `**URL:** ${bookmark.url}`,
    `**Folder:** ${bookmark.folder}`,
  ];

  if (bookmark.addDate) {
    parts.push(`**Saved:** ${new Date(bookmark.addDate * 1000).toISOString().split("T")[0]}`);
  }

  if (bookmark.content) {
    parts.push("", "---", "", bookmark.content);
  }

  return parts.join("\n");
}

export function buildBookmarkPreview(parsed: BookmarkParseResult) {
  const folders: Array<{ path: string; count: number }> = [];
  const flatten = (folder: BookmarkFolder) => {
    if (folder.bookmarks.length > 0) {
      folders.push({ path: folder.path || "Root", count: folder.bookmarks.length });
    }
    folder.children.forEach(flatten);
  };
  flatten(parsed.root);

  return {
    stats: parsed.stats,
    folders: folders.sort((left, right) => right.count - left.count).slice(0, 20),
    sampleBookmarks: parsed.all.slice(0, 10).map((bookmark) => ({
      title: bookmark.title,
      url: bookmark.url,
      folder: bookmark.folder,
      addDate: bookmark.addDate ? new Date(bookmark.addDate * 1000).toISOString().split("T")[0] : null,
      domain: extractDomainTitle(bookmark.url),
    })),
  };
}

export async function importBrowserBookmarks({
  userId,
  parsed,
  fetchContent,
  fetchContentForUrl,
}: {
  userId: string;
  parsed: BookmarkParseResult;
  fetchContent: boolean;
  fetchContentForUrl?: (url: string) => Promise<string | null>;
}) {
  await ensureBrowserBookmarksReady();

  if (fetchContent && fetchContentForUrl) {
    for (const bookmark of parsed.all) {
      bookmark.content = (await fetchContentForUrl(bookmark.url)) || undefined;
    }
  }

  const summary = await importDocuments({
    userId,
    documents: parsed.all.map((bookmark) => ({
      title: bookmark.title,
      content: formatBookmarkContent(bookmark),
      sourceType: "bookmark",
      metadata: {
        plugin: PLUGIN_SLUG,
        folder: bookmark.folder,
        url: bookmark.url,
      },
      preChunked: true,
    })),
  });

  return {
    imported: {
      totalBookmarks: parsed.all.length,
      embedded: summary.embedded,
      withContent: fetchContent ? parsed.all.filter((bookmark) => bookmark.content).length : 0,
      stats: parsed.stats,
    },
  };
}
