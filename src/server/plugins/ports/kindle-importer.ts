import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { importDocuments } from "@/server/import-service";
import { PLUGIN_MANIFESTS } from "@/server/plugins/registry";

const PLUGIN_SLUG = "kindle-importer";
const HIGHLIGHT_CHUNK_SIZE = 10;

export interface KindleClipping {
  bookTitle: string;
  author: string;
  type: "highlight" | "note" | "bookmark";
  page?: string;
  location?: string;
  date?: string;
  content: string;
}

export interface KindleBookGroup {
  title: string;
  author: string;
  highlights: KindleClipping[];
  noteCount: number;
}

export interface KindlePreviewResult {
  books: Array<{
    title: string;
    author: string;
    highlightCount: number;
    noteCount: number;
    preview: Array<{
      content: string;
      type: KindleClipping["type"];
      page?: string;
      location?: string;
    }>;
  }>;
  totalHighlights: number;
  totalBooks: number;
  duplicatesRemoved: number;
}

export interface KindleImportResult {
  imported: {
    books: number;
    highlights: number;
    chunks: number;
    duplicatesRemoved: number;
    embedded: number;
    bookDetails: Array<{
      title: string;
      author: string;
      highlights: number;
    }>;
  };
}

export async function ensureKindleImporterInstalled() {
  const manifest = PLUGIN_MANIFESTS[PLUGIN_SLUG];
  const [existing] = await db
    .select()
    .from(schema.plugins)
    .where(eq(schema.plugins.slug, PLUGIN_SLUG))
    .limit(1);

  if (existing || !manifest) {
    return;
  }

  await db.insert(schema.plugins).values({
    slug: manifest.slug,
    name: manifest.name,
    description: manifest.description,
    version: manifest.version,
    type: manifest.type,
    status: "active",
    icon: manifest.icon,
    category: manifest.category,
    author: manifest.author,
    config: { dedup: true },
    metadata: {
      capabilities: manifest.capabilities,
      hooks: manifest.hooks,
      routes: manifest.routes,
      aliases: manifest.aliases || [],
    },
  });
}

export async function getKindleImporterConfig() {
  await ensureKindleImporterInstalled();

  const [plugin] = await db
    .select()
    .from(schema.plugins)
    .where(eq(schema.plugins.slug, PLUGIN_SLUG))
    .limit(1);

  if (!plugin) {
    throw new Error("Kindle Importer plugin not found");
  }

  if (plugin.status === "disabled") {
    throw new Error("Kindle Importer plugin is disabled. Enable it in the Plugins page.");
  }

  const pluginConfig = isRecord(plugin.config) ? plugin.config : {};

  return {
    shouldDedup: pluginConfig.dedup !== false,
  };
}

export function parseKindleClippings(text: string): KindleClipping[] {
  const clippings: KindleClipping[] = [];
  const entries = text.split("==========").filter((entry) => entry.trim());

  for (const entry of entries) {
    const lines = entry.trim().split("\n").filter((line) => line.trim() !== "");
    if (lines.length < 2) {
      continue;
    }

    const titleLine = lines[0]?.trim() || "";
    let bookTitle = titleLine;
    let author = "Unknown";

    const authorMatch = titleLine.match(/\(([^)]+)\)\s*$/);
    if (authorMatch) {
      author = authorMatch[1]?.trim() || "Unknown";
      bookTitle = titleLine.slice(0, titleLine.lastIndexOf("(")).trim();
    }

    bookTitle = bookTitle.replace(/^\uFEFF/, "").trim();

    const metaLine = lines[1]?.trim() || "";
    let type: KindleClipping["type"] = "highlight";
    if (/your note/i.test(metaLine)) type = "note";
    else if (/your bookmark/i.test(metaLine)) type = "bookmark";

    const pageMatch = metaLine.match(/page\s+(\d+[-–]?\d*)/i);
    const locationMatch = metaLine.match(/location\s+(\d+[-–]?\d*)/i);
    const dateMatch = metaLine.match(/Added on\s+(.+)$/i);
    const content = lines.slice(2).join("\n").trim();

    if (type === "bookmark" || !content) {
      continue;
    }

    clippings.push({
      bookTitle,
      author,
      type,
      page: pageMatch?.[1],
      location: locationMatch?.[1],
      date: dateMatch?.[1]?.trim(),
      content,
    });
  }

  return clippings;
}

export function deduplicateKindleClippings(clippings: KindleClipping[]): KindleClipping[] {
  const seen = new Map<string, KindleClipping>();

  for (const clipping of clippings) {
    let isSubstring = false;
    for (const [otherKey, other] of seen) {
      if (other.bookTitle !== clipping.bookTitle) {
        continue;
      }

      const currentNormalized = normalizeKindleText(clipping.content);
      const otherNormalized = normalizeKindleText(other.content);

      if (
        currentNormalized !== otherNormalized
        && otherNormalized.startsWith(currentNormalized)
      ) {
        isSubstring = true;
        break;
      }

      if (
        currentNormalized !== otherNormalized
        && currentNormalized.startsWith(otherNormalized)
      ) {
        seen.delete(otherKey);
      }
    }

    if (!isSubstring) {
      const key = `${clipping.bookTitle}::${clipping.location || clipping.page || clipping.content.slice(0, 100)}`;
      seen.set(key, clipping);
    }
  }

  return Array.from(seen.values());
}

export function groupKindleClippingsByBook(clippings: KindleClipping[]): KindleBookGroup[] {
  const books = new Map<string, KindleBookGroup>();

  for (const clipping of clippings) {
    if (!books.has(clipping.bookTitle)) {
      books.set(clipping.bookTitle, {
        title: clipping.bookTitle,
        author: clipping.author,
        highlights: [],
        noteCount: 0,
      });
    }

    const book = books.get(clipping.bookTitle);
    if (!book) {
      continue;
    }

    book.highlights.push(clipping);
    if (clipping.type === "note") {
      book.noteCount += 1;
    }
  }

  for (const book of books.values()) {
    book.highlights.sort((left, right) => {
      const leftLoc = Number.parseInt(left.location?.split(/[-–]/)[0] || "0", 10);
      const rightLoc = Number.parseInt(right.location?.split(/[-–]/)[0] || "0", 10);
      return leftLoc - rightLoc;
    });
  }

  return Array.from(books.values()).sort((left, right) => right.highlights.length - left.highlights.length);
}

export function formatKindleBookContent(book: KindleBookGroup): string {
  const parts: string[] = [];
  parts.push(`# ${book.title}`);
  parts.push(`**Author:** ${book.author}`);
  parts.push(`**Highlights:** ${book.highlights.length}`);
  if (book.noteCount > 0) {
    parts.push(`**Notes:** ${book.noteCount}`);
  }
  parts.push("");
  parts.push("---");
  parts.push("");

  for (const highlight of book.highlights) {
    const meta: string[] = [];
    if (highlight.page) meta.push(`p.${highlight.page}`);
    if (highlight.location) meta.push(`loc. ${highlight.location}`);

    parts.push(
      highlight.type === "note"
        ? `Note ${meta.length ? `(${meta.join(", ")})` : ""}`
        : `Highlight ${meta.length ? `(${meta.join(", ")})` : ""}`,
    );
    parts.push(`> ${highlight.content}`);
    parts.push("");
  }

  return parts.join("\n");
}

export function previewKindleImport(
  text: string,
  options: { dedup?: boolean } = {},
): KindlePreviewResult {
  validateKindleClippingsText(text);

  const parsed = parseKindleClippings(text);
  if (parsed.length === 0) {
    throw new Error("No highlights or notes found in the file.");
  }

  const originalCount = parsed.length;
  const clippings = options.dedup === false ? parsed : deduplicateKindleClippings(parsed);
  const books = groupKindleClippingsByBook(clippings);

  return {
    books: books.map((book) => ({
      title: book.title,
      author: book.author,
      highlightCount: book.highlights.length,
      noteCount: book.noteCount,
      preview: book.highlights.slice(0, 3).map((highlight) => ({
        content: highlight.content.slice(0, 200),
        type: highlight.type,
        page: highlight.page,
        location: highlight.location,
      })),
    })),
    totalHighlights: clippings.length,
    totalBooks: books.length,
    duplicatesRemoved: originalCount - clippings.length,
  };
}

export async function importKindleClippings({
  userId,
  text,
  dedup = true,
}: {
  userId: string;
  text: string;
  dedup?: boolean;
}): Promise<KindleImportResult> {
  validateKindleClippingsText(text);

  const parsed = parseKindleClippings(text);
  if (parsed.length === 0) {
    throw new Error("No highlights or notes found in the file.");
  }

  const originalCount = parsed.length;
  const clippings = dedup ? deduplicateKindleClippings(parsed) : parsed;
  const books = groupKindleClippingsByBook(clippings);
  const documents = prepareKindleImportDocuments(books);

  const summary = await importDocuments({
    userId,
    documents,
  });

  return {
    imported: {
      books: books.length,
      highlights: clippings.length,
      chunks: summary.chunks,
      duplicatesRemoved: originalCount - clippings.length,
      embedded: summary.embedded,
      bookDetails: books.map((book) => ({
        title: book.title,
        author: book.author,
        highlights: book.highlights.length,
      })),
    },
  };
}

export function prepareKindleImportDocuments(books: KindleBookGroup[]) {
  return books.flatMap((book) => {
    if (book.highlights.length <= 15) {
      return [toKindleDocument(book)];
    }

    const documents: Array<{
      title: string;
      content: string;
      sourceType: string;
      metadata: Record<string, unknown>;
    }> = [];

    for (let index = 0; index < book.highlights.length; index += HIGHLIGHT_CHUNK_SIZE) {
      const slice = book.highlights.slice(index, index + HIGHLIGHT_CHUNK_SIZE);
      const chunkBook: KindleBookGroup = {
        ...book,
        highlights: slice,
        noteCount: slice.filter((highlight) => highlight.type === "note").length,
      };

      documents.push(toKindleDocument(chunkBook, `${book.title} (Part ${Math.floor(index / HIGHLIGHT_CHUNK_SIZE) + 1})`));
    }

    return documents;
  });
}

function toKindleDocument(book: KindleBookGroup, titleOverride?: string) {
  return {
    title: titleOverride || book.title,
    content: formatKindleBookContent(book),
    sourceType: "kindle",
    metadata: {
      plugin: PLUGIN_SLUG,
      author: book.author,
      highlightCount: book.highlights.length,
      noteCount: book.noteCount,
      kind: "kindle-book-group",
    },
  };
}

function validateKindleClippingsText(text: string) {
  if (!text.includes("==========")) {
    throw new Error("This doesn't look like a Kindle clippings file. Expected \"My Clippings.txt\" from your Kindle.");
  }
}

function normalizeKindleText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
