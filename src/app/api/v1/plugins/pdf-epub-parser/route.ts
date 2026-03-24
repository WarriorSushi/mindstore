/**
 * PDF & EPUB Document Parser — Plugin API Route
 * 
 * POST /api/v1/plugins/pdf-epub-parser
 *   Body: multipart form with a PDF or EPUB file
 *   Parses with structure preservation (chapters, headings, sections)
 *   Smart chunking by section boundaries, not arbitrary character limits
 * 
 * Supports:
 *   - PDF: text extraction via pdf-parse, heading detection, page-aware chunking
 *   - EPUB: chapter extraction via epub2, HTML-to-text conversion, chapter-aware chunking
 * 
 * Query params:
 *   ?action=preview — returns parsed structure without importing
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/server/user';
import { db, schema } from '@/server/db';
import { eq, sql } from 'drizzle-orm';
import { generateEmbeddings } from '@/server/embeddings';
import { buildTreeIndex } from '@/server/retrieval';
import path from 'path';

// ─── Types ──────────────────────────────────────────────────────

interface DocumentSection {
  title: string;
  content: string;
  level: number;        // heading level (1=chapter, 2=section, 3=subsection)
  pageStart?: number;
  pageEnd?: number;
}

interface ParsedDocument {
  title: string;
  author?: string;
  format: 'pdf' | 'epub';
  totalPages?: number;
  totalChapters?: number;
  sections: DocumentSection[];
  metadata: Record<string, string>;
}

// ─── PDF Parser ─────────────────────────────────────────────────

async function parsePDF(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  // pdf-parse v2 uses a class-based API
  const { PDFParse } = await import('pdf-parse');
  
  const parser = new PDFParse({ data: buffer });
  
  // Extract text
  const textResult = await parser.getText();
  const fullText = textResult.text || '';
  
  // Extract metadata
  let info: any = {};
  try {
    const infoResult = await parser.getInfo();
    info = infoResult?.info || {};
  } catch {
    // info extraction can fail on some PDFs
  }
  
  const title = info?.Title || fileName.replace(/\.pdf$/i, '');
  const author = info?.Author || undefined;
  const totalPages = textResult?.pages?.length || undefined;
  
  // Detect structure from text
  const sections = extractPDFSections(fullText, title);
  
  const metadata: Record<string, string> = {};
  if (info?.Title) metadata['title'] = info.Title;
  if (info?.Author) metadata['author'] = info.Author;
  if (info?.Subject) metadata['subject'] = info.Subject;
  if (info?.Creator) metadata['creator'] = info.Creator;
  if (info?.Producer) metadata['producer'] = info.Producer;
  if (totalPages) metadata['pages'] = String(totalPages);
  
  // Clean up
  await parser.destroy().catch(() => {});
  
  return {
    title,
    author,
    format: 'pdf',
    totalPages,
    totalChapters: sections.length,
    sections,
    metadata,
  };
}

/**
 * Extract sections from PDF text using heading detection heuristics.
 * 
 * PDF text doesn't have semantic heading markers, so we use heuristics:
 * - Lines that are ALL CAPS and < 100 chars → likely chapter/section titles
 * - Lines that start with "Chapter", "Section", "Part" + number
 * - Short lines (< 80 chars) preceded/followed by blank lines (title-like)
 * - Lines matching common heading patterns (numbered: "1.", "1.1", "I.", "A.")
 */
function extractPDFSections(text: string, docTitle: string): DocumentSection[] {
  const lines = text.split('\n');
  const sections: DocumentSection[] = [];
  let currentSection: DocumentSection | null = null;
  let contentBuffer: string[] = [];
  
  const HEADING_PATTERNS = [
    /^(?:chapter|ch\.?)\s+\d+/i,
    /^(?:section|sec\.?)\s+\d+/i,
    /^(?:part)\s+(?:\d+|[ivxlc]+|[a-z])/i,
    /^(?:appendix)\s+[a-z]/i,
    /^\d+\.\s+[A-Z]/,            // "1. Introduction"
    /^\d+\.\d+\s+[A-Z]/,         // "1.1 Background"
    /^[IVXLC]+\.\s+/,            // "IV. Methods"
  ];
  
  function isLikelyHeading(line: string, prevLine: string, nextLine: string): { is: boolean; level: number } {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > 120) return { is: false, level: 0 };
    
    // Chapter/Section/Part markers
    for (const pattern of HEADING_PATTERNS) {
      if (pattern.test(trimmed)) {
        if (/^(?:chapter|part)/i.test(trimmed)) return { is: true, level: 1 };
        if (/^\d+\.\d+/.test(trimmed)) return { is: true, level: 3 };
        return { is: true, level: 2 };
      }
    }
    
    // ALL CAPS short lines (common in PDFs)
    if (trimmed.length > 3 && trimmed.length < 80 && 
        trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed) &&
        !prevLine.trim() && (!nextLine.trim() || nextLine.trim().length > trimmed.length * 2)) {
      return { is: true, level: 1 };
    }
    
    // Short lines surrounded by blank lines (title-like)
    if (trimmed.length > 3 && trimmed.length < 60 && 
        !prevLine.trim() && !nextLine?.trim() &&
        /^[A-Z]/.test(trimmed) && !trimmed.endsWith('.') && !trimmed.endsWith(',')) {
      return { is: true, level: 2 };
    }
    
    return { is: false, level: 0 };
  }
  
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
    const line = lines[i];
    const prevLine = lines[i - 1] || '';
    const nextLine = lines[i + 1] || '';
    
    const heading = isLikelyHeading(line, prevLine, nextLine);
    
    if (heading.is) {
      flushSection();
      currentSection = {
        title: line.trim(),
        content: '',
        level: heading.level,
      };
    } else {
      contentBuffer.push(line);
    }
  }
  
  // Flush last section
  flushSection();
  
  // If no sections detected, create a single section with all content
  if (sections.length === 0) {
    const cleanedText = text.trim();
    if (cleanedText.length > 0) {
      sections.push({
        title: docTitle,
        content: cleanedText,
        level: 1,
      });
    }
  }
  
  return sections;
}

// ─── EPUB Parser ────────────────────────────────────────────────

async function parseEPUB(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  const EPub = (await import('epub2')).EPub;
  const os = await import('os');
  const fs = await import('fs/promises');
  
  // epub2 needs a file path, not a buffer — write to temp
  const tempPath = path.join(os.tmpdir(), `mindstore-epub-${Date.now()}.epub`);
  await fs.writeFile(tempPath, buffer);
  
  try {
    const epub = await EPub.createAsync(tempPath);
    
    const title = epub.metadata?.title || fileName.replace(/\.epub$/i, '');
    const author = epub.metadata?.creator || epub.metadata?.author || undefined;
    
    // Get chapter flow
    const flow = epub.flow || [];
    const sections: DocumentSection[] = [];
    
    for (let i = 0; i < flow.length; i++) {
      const chapter = flow[i];
      if (!chapter.id) continue;
      
      try {
        const html = await getChapterContent(epub, chapter.id);
        const text = htmlToText(html);
        
        if (text.trim().length < 20) continue; // skip near-empty chapters
        
        // Try to get chapter title from TOC
        const tocTitle = findTocTitle(epub, chapter.id || chapter.href);
        const sectionTitle = tocTitle || `Chapter ${i + 1}`;
        
        sections.push({
          title: sectionTitle,
          content: text.trim(),
          level: 1,
        });
      } catch (err) {
        // Skip chapters that fail to parse
        console.error(`Failed to parse EPUB chapter ${chapter.id}:`, err);
      }
    }
    
    const metadata: Record<string, string> = {};
    if (epub.metadata?.title) metadata['title'] = epub.metadata.title;
    if (author) metadata['author'] = author;
    if (epub.metadata?.language) metadata['language'] = epub.metadata.language;
    if (epub.metadata?.publisher) metadata['publisher'] = epub.metadata.publisher;
    if (epub.metadata?.date) metadata['date'] = epub.metadata.date;
    if (epub.metadata?.description) metadata['description'] = epub.metadata.description;
    
    return {
      title,
      author,
      format: 'epub',
      totalChapters: sections.length,
      sections,
      metadata,
    };
  } finally {
    // Clean up temp file
    const fs = await import('fs/promises');
    await fs.unlink(tempPath).catch(() => {});
  }
}

function getChapterContent(epub: any, chapterId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    epub.getChapter(chapterId, (err: Error | null, text: string) => {
      if (err) reject(err);
      else resolve(text || '');
    });
  });
}

function findTocTitle(epub: any, idOrHref: string): string | null {
  const toc = epub.toc || [];
  for (const item of toc) {
    if (item.id === idOrHref || item.href?.includes(idOrHref)) {
      return item.title || null;
    }
  }
  return null;
}

/**
 * Convert HTML to clean text, preserving basic structure.
 * Handles common EPUB HTML patterns without needing a full DOM parser.
 */
function htmlToText(html: string): string {
  return html
    // Replace block-level elements with newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6]|li|tr|blockquote|section|article)>/gi, '\n')
    .replace(/<(?:h[1-6])[^>]*>/gi, '\n\n## ')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/ul>|<\/ol>/gi, '\n')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
    .replace(/&[a-z]+;/gi, ' ')
    // Clean up whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── Smart Chunking ─────────────────────────────────────────────

interface Chunk {
  content: string;
  sourceTitle: string;
}

/**
 * Smart chunking that respects document structure.
 * 
 * Strategy:
 * 1. Each section (chapter/heading) is a natural boundary
 * 2. Sections under ~2000 chars → keep as single chunk
 * 3. Sections 2000-6000 chars → split at paragraph boundaries
 * 4. Very long sections → split at ~3000 chars on paragraph boundaries
 */
function smartChunk(doc: ParsedDocument): Chunk[] {
  const chunks: Chunk[] = [];
  const MAX_CHUNK = 4000;  // chars — optimal for embedding models
  const MIN_CHUNK = 200;    // don't create tiny chunks
  
  for (const section of doc.sections) {
    const content = section.content;
    
    if (content.length <= MAX_CHUNK) {
      // Section fits in one chunk
      const header = formatSectionHeader(doc, section);
      chunks.push({
        content: header + content,
        sourceTitle: `${doc.title} — ${section.title}`,
      });
    } else {
      // Split long section at paragraph boundaries
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
      
      // Flush remaining
      if (buffer.trim().length > MIN_CHUNK) {
        const header = formatSectionHeader(doc, section, partNum > 1 ? partNum : undefined);
        chunks.push({
          content: header + buffer.trim(),
          sourceTitle: `${doc.title} — ${section.title}${partNum > 1 ? ` (Part ${partNum})` : ''}`,
        });
      }
    }
  }
  
  // If we end up with zero chunks (shouldn't happen), create one from raw content
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

function formatSectionHeader(doc: ParsedDocument, section: DocumentSection, part?: number): string {
  const lines: string[] = [];
  const headingMark = '#'.repeat(Math.min(section.level, 3));
  lines.push(`${headingMark} ${section.title}${part ? ` (Part ${part})` : ''}`);
  lines.push(`**Source:** ${doc.title}${doc.author ? ` by ${doc.author}` : ''}`);
  if (section.pageStart) {
    lines.push(`**Pages:** ${section.pageStart}${section.pageEnd ? `–${section.pageEnd}` : ''}`);
  }
  lines.push('');
  return lines.join('\n');
}

// ─── Word/Char Count ────────────────────────────────────────────

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// ─── POST Handler ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    
    // Check plugin is installed — auto-install if not (built-in plugin)
    let [plugin] = await db
      .select()
      .from(schema.plugins)
      .where(eq(schema.plugins.slug, 'pdf-epub-parser'))
      .limit(1);
    
    if (!plugin) {
      [plugin] = await db
        .insert(schema.plugins)
        .values({
          slug: 'pdf-epub-parser',
          name: 'PDF & EPUB Parser',
          description: 'Smart document parsing with chapter structure and section-aware chunking.',
          version: '1.0.0',
          type: 'extension',
          status: 'active',
          icon: 'FileText',
          category: 'import',
          author: 'MindStore',
          config: {},
          metadata: {},
        })
        .returning();
    }
    
    if (plugin.status === 'disabled') {
      return NextResponse.json(
        { error: 'PDF & EPUB Parser plugin is disabled. Enable it in the Plugins page.' },
        { status: 403 }
      );
    }
    
    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const action = formData.get('action') as string;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    const fileName = file.name || 'document';
    const ext = path.extname(fileName).toLowerCase();
    
    if (!['.pdf', '.epub'].includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${ext}. Upload a PDF or EPUB file.` },
        { status: 400 }
      );
    }
    
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Size check — 50MB limit
    if (buffer.length > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB.' },
        { status: 400 }
      );
    }
    
    // Parse document
    let doc: ParsedDocument;
    try {
      if (ext === '.pdf') {
        doc = await parsePDF(buffer, fileName);
      } else {
        doc = await parseEPUB(buffer, fileName);
      }
    } catch (parseErr: any) {
      console.error('Document parse error:', parseErr);
      return NextResponse.json(
        { error: `Failed to parse ${ext.toUpperCase()} file: ${parseErr.message || 'Unknown error'}` },
        { status: 400 }
      );
    }
    
    if (doc.sections.length === 0) {
      return NextResponse.json(
        { error: 'No readable text found in the document. It may be a scanned PDF (image-only).' },
        { status: 400 }
      );
    }
    
    // Smart chunk the document
    const chunks = smartChunk(doc);
    
    const totalWords = doc.sections.reduce((sum, s) => sum + countWords(s.content), 0);
    const totalChars = doc.sections.reduce((sum, s) => sum + s.content.length, 0);
    
    // ─── Preview mode ─────────────────────────────────────────
    if (action === 'preview') {
      return NextResponse.json({
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
        sections: doc.sections.map(s => ({
          title: s.title,
          level: s.level,
          wordCount: countWords(s.content),
          charCount: s.content.length,
          preview: s.content.substring(0, 200),
        })),
        chunks: chunks.length,
        estimatedReadingTime: Math.max(1, Math.round(totalWords / 225)),
      });
    }
    
    // ─── Import ───────────────────────────────────────────────
    
    // Generate embeddings
    let embeddings: number[][] | null = null;
    const MAX_EMBED = 100;
    if (chunks.length <= MAX_EMBED) {
      try {
        embeddings = await generateEmbeddings(chunks.map(c => c.content));
      } catch (e) {
        console.error('Document embeddings failed (non-fatal):', e);
      }
    }
    
    // Determine source type — 'document' is the plugin-specific type
    const sourceType = 'document';
    
    // Insert chunks into DB
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings?.[i];
      const memId = crypto.randomUUID();
      
      if (embedding) {
        const embStr = `[${embedding.join(',')}]`;
        await db.execute(sql`
          INSERT INTO memories (id, user_id, content, embedding, source_type, source_title, created_at, imported_at)
          VALUES (${memId}, ${userId}::uuid, ${chunk.content}, ${embStr}::vector, ${sourceType}, ${chunk.sourceTitle}, NOW(), NOW())
        `);
      } else {
        await db.execute(sql`
          INSERT INTO memories (id, user_id, content, source_type, source_title, created_at, imported_at)
          VALUES (${memId}, ${userId}::uuid, ${chunk.content}, ${sourceType}, ${chunk.sourceTitle}, NOW(), NOW())
        `);
      }
    }
    
    // Rebuild tree index
    try {
      await buildTreeIndex(userId);
    } catch (e) {
      console.error('Tree index build failed (non-fatal):', e);
    }
    
    return NextResponse.json({
      imported: {
        title: doc.title,
        author: doc.author,
        format: doc.format,
        sections: doc.sections.length,
        chunks: chunks.length,
        words: totalWords,
        pages: doc.totalPages,
        embedded: embeddings?.length || 0,
        readingTime: Math.max(1, Math.round(totalWords / 225)),
      },
    });
    
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Document parser error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
