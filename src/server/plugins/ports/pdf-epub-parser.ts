/**
 * PDF & EPUB Parser — Portable logic module
 *
 * Extracted from the route for convergence with codex runtime.
 * Handles: PDF section extraction via heuristics, EPUB HTML-to-text,
 * smart chunking by document structure, content formatting.
 *
 * Note: Actual PDF/EPUB binary parsing still requires platform-specific
 * libraries (pdf-parse, epub2). This module extracts the text processing,
 * section detection, and chunking logic that is fully portable.
 */

// ─── Types ────────────────────────────────────────────────────

export interface DocumentSection {
  title: string;
  content: string;
  level: number; // 1=chapter, 2=section, 3=subsection
  pageStart?: number;
  pageEnd?: number;
}

export interface ParsedDocument {
  title: string;
  author?: string;
  format: 'pdf' | 'epub';
  totalPages?: number;
  totalChapters?: number;
  sections: DocumentSection[];
  metadata: Record<string, string>;
}

export interface Chunk {
  content: string;
  sourceTitle: string;
}

export interface ChunkStats {
  chunks: number;
  totalWords: number;
  totalChars: number;
  estimatedReadingTime: number;
}

// ─── PDF Section Extraction ──────────────────────────────────

const HEADING_PATTERNS = [
  /^(?:chapter|ch\.?)\s+\d+/i,
  /^(?:section|sec\.?)\s+\d+/i,
  /^(?:part)\s+(?:\d+|[ivxlc]+|[a-z])/i,
  /^(?:appendix)\s+[a-z]/i,
  /^\d+\.\s+[A-Z]/,
  /^\d+\.\d+\s+[A-Z]/,
  /^[IVXLC]+\.\s+/,
];

/**
 * Detect if a line is likely a heading in PDF-extracted text.
 * Uses heuristics since PDFs lack semantic heading markers.
 */
export function isLikelyHeading(
  line: string,
  prevLine: string,
  nextLine: string
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

  // ALL CAPS short lines
  if (
    trimmed.length > 3 && trimmed.length < 80 &&
    trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed) &&
    !prevLine.trim() &&
    (!nextLine.trim() || nextLine.trim().length > trimmed.length * 2)
  ) {
    return { is: true, level: 1 };
  }

  // Short title-like lines surrounded by blank lines
  if (
    trimmed.length > 3 && trimmed.length < 60 &&
    !prevLine.trim() && !nextLine?.trim() &&
    /^[A-Z]/.test(trimmed) && !trimmed.endsWith('.') && !trimmed.endsWith(',')
  ) {
    return { is: true, level: 2 };
  }

  return { is: false, level: 0 };
}

/**
 * Extract sections from raw PDF text using heading detection heuristics.
 */
export function extractPDFSections(text: string, docTitle: string): DocumentSection[] {
  const lines = text.split('\n');
  const sections: DocumentSection[] = [];
  let currentSection: DocumentSection | null = null;
  let contentBuffer: string[] = [];

  function flushSection() {
    if (currentSection) {
      currentSection.content = contentBuffer.join('\n').trim();
      if (currentSection.content.length > 20) {
        sections.push(currentSection);
      }
    }
    contentBuffer = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const heading = isLikelyHeading(lines[i], lines[i - 1] || '', lines[i + 1] || '');

    if (heading.is) {
      flushSection();
      currentSection = { title: lines[i].trim(), content: '', level: heading.level };
    } else {
      contentBuffer.push(lines[i]);
    }
  }
  flushSection();

  if (sections.length === 0) {
    const cleaned = text.trim();
    if (cleaned.length > 0) {
      sections.push({ title: docTitle, content: cleaned, level: 1 });
    }
  }

  return sections;
}

// ─── EPUB HTML → Text ────────────────────────────────────────

/**
 * Convert EPUB HTML content to clean text, preserving basic structure.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6]|li|tr|blockquote|section|article)>/gi, '\n')
    .replace(/<(?:h[1-6])[^>]*>/gi, '\n\n## ')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/ul>|<\/ol>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── Smart Chunking ──────────────────────────────────────────

const MAX_CHUNK = 4000;
const MIN_CHUNK = 200;

function formatSectionHeader(
  doc: ParsedDocument,
  section: DocumentSection,
  part?: number
): string {
  const headingMark = '#'.repeat(Math.min(section.level, 3));
  const lines: string[] = [
    `${headingMark} ${section.title}${part ? ` (Part ${part})` : ''}`,
    `**Source:** ${doc.title}${doc.author ? ` by ${doc.author}` : ''}`,
  ];
  if (section.pageStart) {
    lines.push(`**Pages:** ${section.pageStart}${section.pageEnd ? `–${section.pageEnd}` : ''}`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Smart chunking that respects document structure.
 * - Sections under MAX_CHUNK → single chunk
 * - Longer sections → split at paragraph boundaries
 */
export function smartChunk(doc: ParsedDocument): Chunk[] {
  const chunks: Chunk[] = [];

  for (const section of doc.sections) {
    const content = section.content;

    if (content.length <= MAX_CHUNK) {
      const header = formatSectionHeader(doc, section);
      chunks.push({
        content: header + content,
        sourceTitle: `${doc.title} — ${section.title}`,
      });
    } else {
      const paragraphs = content.split(/\n\s*\n/);
      let buffer = '';
      let partNum = 1;

      for (const para of paragraphs) {
        if (buffer.length + para.length > MAX_CHUNK && buffer.length > MIN_CHUNK) {
          const header = formatSectionHeader(doc, section, partNum);
          chunks.push({
            content: header + buffer.trim(),
            sourceTitle: `${doc.title} — ${section.title} (Part ${partNum})`,
          });
          buffer = '';
          partNum++;
        }
        buffer += para + '\n\n';
      }

      if (buffer.trim().length > MIN_CHUNK) {
        const header = formatSectionHeader(doc, section, partNum > 1 ? partNum : undefined);
        chunks.push({
          content: header + buffer.trim(),
          sourceTitle: `${doc.title} — ${section.title}${partNum > 1 ? ` (Part ${partNum})` : ''}`,
        });
      }
    }
  }

  if (chunks.length === 0) {
    const allContent = doc.sections.map(s => s.content).join('\n\n');
    if (allContent.trim()) {
      chunks.push({
        content: `# ${doc.title}\n${doc.author ? `**Author:** ${doc.author}\n` : ''}\n${allContent}`,
        sourceTitle: doc.title,
      });
    }
  }

  return chunks;
}

// ─── Utilities ───────────────────────────────────────────────

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Compute stats for a set of chunks from a parsed document.
 */
export function computeStats(doc: ParsedDocument, chunks: Chunk[]): ChunkStats {
  const totalWords = doc.sections.reduce((s, sec) => s + countWords(sec.content), 0);
  const totalChars = doc.sections.reduce((s, sec) => s + sec.content.length, 0);
  return {
    chunks: chunks.length,
    totalWords,
    totalChars,
    estimatedReadingTime: Math.max(1, Math.round(totalWords / 225)),
  };
}
