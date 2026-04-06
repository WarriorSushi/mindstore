import path from "path";
import { importDocuments } from "@/server/import-service";
import { assertPluginEnabled } from "@/server/plugins/ports/plugin-config";

const PLUGIN_SLUG = "pdf-epub-parser";

export interface DocumentSection {
  title: string;
  content: string;
  level: number;
  pageStart?: number;
  pageEnd?: number;
}

export interface ParsedDocument {
  title: string;
  author?: string;
  format: "pdf" | "epub";
  totalPages?: number;
  totalChapters?: number;
  sections: DocumentSection[];
  metadata: Record<string, string>;
}

export interface Chunk {
  content: string;
  sourceTitle: string;
}

const HEADING_PATTERNS = [
  /^(?:chapter|ch\.?)\s+\d+/i,
  /^(?:section|sec\.?)\s+\d+/i,
  /^(?:part)\s+(?:\d+|[ivxlc]+|[a-z])/i,
  /^(?:appendix)\s+[a-z]/i,
  /^\d+\.\s+[A-Z]/,
  /^\d+\.\d+\s+[A-Z]/,
  /^[IVXLC]+\.\s+/,
];

export async function ensurePdfEpubParserReady() {
  await assertPluginEnabled(PLUGIN_SLUG);
}

export function isLikelyHeading(
  line: string,
  prevLine: string,
  nextLine: string,
): { is: boolean; level: number } {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 120) return { is: false, level: 0 };

  for (const pattern of HEADING_PATTERNS) {
    if (pattern.test(trimmed)) {
      if (/^(?:chapter|part)/i.test(trimmed)) return { is: true, level: 1 };
      if (/^\d+\.\d+/.test(trimmed)) return { is: true, level: 3 };
      return { is: true, level: 2 };
    }
  }

  if (
    trimmed.length > 3
    && trimmed.length < 80
    && trimmed === trimmed.toUpperCase()
    && /[A-Z]/.test(trimmed)
    && !prevLine.trim()
    && (!nextLine.trim() || nextLine.trim().length > trimmed.length * 2)
  ) {
    return { is: true, level: 1 };
  }

  if (
    trimmed.length > 3
    && trimmed.length < 60
    && !prevLine.trim()
    && !nextLine.trim()
    && /^[A-Z]/.test(trimmed)
    && !trimmed.endsWith(".")
    && !trimmed.endsWith(",")
  ) {
    return { is: true, level: 2 };
  }

  return { is: false, level: 0 };
}

export function extractPDFSections(text: string, docTitle: string): DocumentSection[] {
  const lines = text.split("\n");
  const sections: DocumentSection[] = [];
  let currentSection: DocumentSection | null = null;
  let contentBuffer: string[] = [];

  const flushSection = () => {
    if (currentSection) {
      currentSection.content = contentBuffer.join("\n").trim();
      if (currentSection.content.length > 20) {
        sections.push(currentSection);
      }
    }
    contentBuffer = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const heading = isLikelyHeading(lines[index], lines[index - 1] || "", lines[index + 1] || "");

    if (heading.is) {
      flushSection();
      currentSection = {
        title: lines[index].trim(),
        content: "",
        level: heading.level,
      };
    } else {
      contentBuffer.push(lines[index]);
    }
  }

  flushSection();

  if (sections.length === 0) {
    const cleaned = text.trim();
    if (cleaned.length > 0) {
      sections.push({
        title: docTitle,
        content: cleaned,
        level: 1,
      });
    }
  }

  return sections;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|h[1-6]|li|tr|blockquote|section|article)>/gi, "\n")
    .replace(/<(?:h[1-6])[^>]*>/gi, "\n\n## ")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/ul>|<\/ol>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number.parseInt(num, 10)))
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatSectionHeader(doc: ParsedDocument, section: DocumentSection, part?: number) {
  const headingMark = "#".repeat(Math.min(section.level, 3));
  const lines = [
    `${headingMark} ${section.title}${part ? ` (Part ${part})` : ""}`,
    `**Source:** ${doc.title}${doc.author ? ` by ${doc.author}` : ""}`,
  ];

  if (section.pageStart) {
    lines.push(`**Pages:** ${section.pageStart}${section.pageEnd ? `-${section.pageEnd}` : ""}`);
  }

  lines.push("");
  return lines.join("\n");
}

export function smartChunkDocument(doc: ParsedDocument): Chunk[] {
  const chunks: Chunk[] = [];
  const maxChunk = 4000;
  const minChunk = 200;

  for (const section of doc.sections) {
    if (section.content.length <= maxChunk) {
      chunks.push({
        content: `${formatSectionHeader(doc, section)}${section.content}`,
        sourceTitle: `${doc.title} — ${section.title}`,
      });
      continue;
    }

    const paragraphs = section.content.split(/\n\s*\n/);
    let buffer = "";
    let partNumber = 1;

    for (const paragraph of paragraphs) {
      if (buffer.length + paragraph.length > maxChunk && buffer.length > minChunk) {
        chunks.push({
          content: `${formatSectionHeader(doc, section, partNumber)}${buffer.trim()}`,
          sourceTitle: `${doc.title} — ${section.title} (Part ${partNumber})`,
        });
        buffer = "";
        partNumber += 1;
      }

      buffer += `${paragraph}\n\n`;
    }

    if (buffer.trim().length > minChunk) {
      chunks.push({
        content: `${formatSectionHeader(doc, section, partNumber > 1 ? partNumber : undefined)}${buffer.trim()}`,
        sourceTitle:
          `${doc.title} — ${section.title}${partNumber > 1 ? ` (Part ${partNumber})` : ""}`,
      });
    }
  }

  if (chunks.length === 0) {
    const allContent = doc.sections.map((section) => section.content).join("\n\n");
    if (allContent.trim()) {
      chunks.push({
        content: `# ${doc.title}\n${doc.author ? `**Author:** ${doc.author}\n` : ""}\n${allContent}`,
        sourceTitle: doc.title,
      });
    }
  }

  return chunks;
}

export function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

export function previewParsedDocument(doc: ParsedDocument, chunks: Chunk[]) {
  const totalWords = doc.sections.reduce((sum, section) => sum + countWords(section.content), 0);
  const totalChars = doc.sections.reduce((sum, section) => sum + section.content.length, 0);

  return {
    document: {
      title: doc.title,
      author: doc.author,
      format: doc.format,
      totalPages: doc.totalPages,
      totalChapters: doc.sections.length,
      totalWords,
      totalChars,
      metadata: doc.metadata,
    },
    sections: doc.sections.map((section) => ({
      title: section.title,
      level: section.level,
      wordCount: countWords(section.content),
      charCount: section.content.length,
      preview: section.content.substring(0, 200),
    })),
    chunks: chunks.length,
    estimatedReadingTime: Math.max(1, Math.round(totalWords / 225)),
  };
}

// ─── Parsing ─────────────────────────────────────────────────

function getChapterContent(epub: any, chapterId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    epub.getChapter(chapterId, (error: Error | null, text: string) => {
      if (error) reject(error);
      else resolve(text || "");
    });
  });
}

function findTocTitle(epub: any, idOrHref: string): string | null {
  for (const item of epub.toc || []) {
    if (item.id === idOrHref || item.href?.includes(idOrHref)) {
      return item.title || null;
    }
  }
  return null;
}

export async function parsePDF(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  const { extractText } = await import("unpdf");

  const uint8 = new Uint8Array(buffer);
  const { text, totalPages } = await extractText(uint8, { mergePages: true });
  const fullText = Array.isArray(text) ? text.join('\n') : (text || '');
  const title = fileName.replace(/\.pdf$/i, '');

  return {
    title,
    author: undefined,
    format: "pdf",
    totalPages,
    totalChapters: undefined,
    sections: extractPDFSections(fullText, title),
    metadata: {
      ...(totalPages ? { pages: String(totalPages) } : {}),
    },
  };
}

export async function parseEPUB(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  const { EPub } = await import("epub2");
  const os = await import("os");
  const fs = await import("fs/promises");
  const tempPath = path.join(os.tmpdir(), `mindstore-epub-${Date.now()}.epub`);
  await fs.writeFile(tempPath, buffer);

  try {
    const epub = await EPub.createAsync(tempPath);
    const title = epub.metadata?.title || fileName.replace(/\.epub$/i, "");
    const author = epub.metadata?.creator || epub.metadata?.author || undefined;
    const sections = [];

    for (let index = 0; index < (epub.flow || []).length; index += 1) {
      const chapter = epub.flow[index];
      if (!chapter?.id) continue;

      try {
        const text = htmlToText(await getChapterContent(epub, chapter.id));
        if (text.trim().length < 20) continue;

        sections.push({
          title: findTocTitle(epub, chapter.id || chapter.href) || `Chapter ${index + 1}`,
          content: text.trim(),
          level: 1,
        });
      } catch {
        continue;
      }
    }

    return {
      title,
      author,
      format: "epub",
      totalChapters: sections.length,
      sections,
      metadata: {
        ...(epub.metadata?.title ? { title: epub.metadata.title } : {}),
        ...(author ? { author } : {}),
        ...(epub.metadata?.language ? { language: epub.metadata.language } : {}),
        ...(epub.metadata?.publisher ? { publisher: epub.metadata.publisher } : {}),
        ...(epub.metadata?.date ? { date: epub.metadata.date } : {}),
        ...(epub.metadata?.description ? { description: epub.metadata.description } : {}),
      },
    };
  } finally {
    const fs = await import("fs/promises");
    await fs.unlink(tempPath).catch(() => {});
  }
}

export function parseDocument(buffer: Buffer, fileName: string, ext: string): Promise<ParsedDocument> {
  return ext === ".pdf" ? parsePDF(buffer, fileName) : parseEPUB(buffer, fileName);
}

// ─── Import ──────────────────────────────────────────────────

export async function importParsedDocument({
  userId,
  document,
}: {
  userId: string;
  document: ParsedDocument;
}) {
  const chunks = smartChunkDocument(document);
  const summary = await importDocuments({
    userId,
    documents: chunks.map((chunk) => ({
      title: chunk.sourceTitle,
      content: chunk.content,
      sourceType: "document",
      metadata: {
        plugin: PLUGIN_SLUG,
        format: document.format,
        documentTitle: document.title,
      },
      preChunked: true,
    })),
  });

  const totalWords = document.sections.reduce((sum, section) => sum + countWords(section.content), 0);

  return {
    imported: {
      title: document.title,
      author: document.author,
      format: document.format,
      sections: document.sections.length,
      chunks: summary.chunks,
      words: totalWords,
      pages: document.totalPages,
      embedded: summary.embedded,
      readingTime: Math.max(1, Math.round(totalWords / 225)),
    },
  };
}
