/**
 * PDF & EPUB Document Parser — Plugin API Route (thin wrapper)
 *
 * POST /api/v1/plugins/pdf-epub-parser
 *   Body: multipart form with a PDF or EPUB file
 *   ?action=preview — returns parsed structure without importing
 *
 * Library-specific parsing (pdf-parse, epub2) stays in route.
 * Text processing delegated to src/server/plugins/ports/pdf-epub-parser.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/server/user';
import { db, schema } from '@/server/db';
import { eq, sql } from 'drizzle-orm';
import { generateEmbeddings } from '@/server/embeddings';
import { buildTreeIndex } from '@/server/retrieval';
import path from 'path';
import {
  extractPDFSections,
  htmlToText,
  smartChunk,
  countWords,
  type DocumentSection,
  type ParsedDocument,
} from '@/server/plugins/ports/pdf-epub-parser';

// ─── PDF Parser (library-specific) ─────────────────────────────

async function parsePDF(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });

  const textResult = await parser.getText();
  const fullText = textResult.text || '';

  let info: any = {};
  try {
    const infoResult = await parser.getInfo();
    info = infoResult?.info || {};
  } catch { /* info extraction can fail on some PDFs */ }

  const title = info?.Title || fileName.replace(/\.pdf$/i, '');
  const author = info?.Author || undefined;
  const totalPages = textResult?.pages?.length || undefined;

  const sections = extractPDFSections(fullText, title);

  const metadata: Record<string, string> = {};
  if (info?.Title) metadata['title'] = info.Title;
  if (info?.Author) metadata['author'] = info.Author;
  if (info?.Subject) metadata['subject'] = info.Subject;
  if (info?.Creator) metadata['creator'] = info.Creator;
  if (info?.Producer) metadata['producer'] = info.Producer;
  if (totalPages) metadata['pages'] = String(totalPages);

  await parser.destroy().catch(() => {});

  return { title, author, format: 'pdf', totalPages, totalChapters: sections.length, sections, metadata };
}

// ─── EPUB Parser (library-specific) ─────────────────────────────

async function parseEPUB(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  const EPub = (await import('epub2')).EPub;
  const os = await import('os');
  const fs = await import('fs/promises');

  const tempPath = path.join(os.tmpdir(), `mindstore-epub-${Date.now()}.epub`);
  await fs.writeFile(tempPath, buffer);

  try {
    const epub = await EPub.createAsync(tempPath);
    const title = epub.metadata?.title || fileName.replace(/\.epub$/i, '');
    const author = epub.metadata?.creator || epub.metadata?.author || undefined;

    const flow = epub.flow || [];
    const sections: DocumentSection[] = [];

    for (let i = 0; i < flow.length; i++) {
      const chapter = flow[i];
      if (!chapter.id) continue;
      try {
        const html = await new Promise<string>((resolve, reject) => {
          epub.getChapter(chapter.id, (err: Error | null, text: string) => {
            if (err) reject(err); else resolve(text || '');
          });
        });
        const text = htmlToText(html);
        if (text.trim().length < 20) continue;

        const toc = epub.toc || [];
        const tocItem = toc.find((t: any) => t.id === chapter.id || t.href?.includes(chapter.id));
        const sectionTitle = tocItem?.title || `Chapter ${i + 1}`;

        sections.push({ title: sectionTitle, content: text.trim(), level: 1 });
      } catch (err) {
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

    return { title, author, format: 'epub', totalChapters: sections.length, sections, metadata };
  } finally {
    const fs = await import('fs/promises');
    await fs.unlink(tempPath).catch(() => {});
  }
}

// ─── POST Handler ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();

    // Auto-install plugin
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
        { status: 403 },
      );
    }

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
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (buffer.length > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 50MB.' }, { status: 400 });
    }

    let doc: ParsedDocument;
    try {
      doc = ext === '.pdf' ? await parsePDF(buffer, fileName) : await parseEPUB(buffer, fileName);
    } catch (parseErr: any) {
      console.error('Document parse error:', parseErr);
      return NextResponse.json(
        { error: `Failed to parse ${ext.toUpperCase()} file: ${parseErr.message || 'Unknown error'}` },
        { status: 400 },
      );
    }

    if (doc.sections.length === 0) {
      return NextResponse.json(
        { error: 'No readable text found in the document. It may be a scanned PDF (image-only).' },
        { status: 400 },
      );
    }

    const chunks = smartChunk(doc);
    const totalWords = doc.sections.reduce((sum, s) => sum + countWords(s.content), 0);
    const totalChars = doc.sections.reduce((sum, s) => sum + s.content.length, 0);

    // ─── Preview mode ─────────────────────────────────────────
    if (action === 'preview') {
      return NextResponse.json({
        document: {
          title: doc.title, author: doc.author, format: doc.format,
          totalPages: doc.totalPages, totalChapters: doc.sections.length,
          totalWords, totalChars, metadata: doc.metadata,
        },
        sections: doc.sections.map(s => ({
          title: s.title, level: s.level,
          wordCount: countWords(s.content), charCount: s.content.length,
          preview: s.content.substring(0, 200),
        })),
        chunks: chunks.length,
        estimatedReadingTime: Math.max(1, Math.round(totalWords / 225)),
      });
    }

    // ─── Import ───────────────────────────────────────────────
    let embeddings: number[][] | null = null;
    if (chunks.length <= 100) {
      try { embeddings = await generateEmbeddings(chunks.map(c => c.content)); }
      catch (e) { console.error('Document embeddings failed (non-fatal):', e); }
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings?.[i];
      const memId = crypto.randomUUID();

      if (embedding) {
        const embStr = `[${embedding.join(',')}]`;
        await db.execute(sql`
          INSERT INTO memories (id, user_id, content, embedding, source_type, source_title, created_at, imported_at)
          VALUES (${memId}, ${userId}::uuid, ${chunk.content}, ${embStr}::vector, 'document', ${chunk.sourceTitle}, NOW(), NOW())
        `);
      } else {
        await db.execute(sql`
          INSERT INTO memories (id, user_id, content, source_type, source_title, created_at, imported_at)
          VALUES (${memId}, ${userId}::uuid, ${chunk.content}, 'document', ${chunk.sourceTitle}, NOW(), NOW())
        `);
      }
    }

    try { await buildTreeIndex(userId); } catch (e) { console.error('Tree index build failed (non-fatal):', e); }

    try {
      const { notifyImportComplete } = await import('@/server/notifications');
      await notifyImportComplete('pdf-epub-parser', `${doc.format?.toUpperCase() || 'Document'}`, chunks.length, '/app/explore');
    } catch { /* non-fatal */ }

    return NextResponse.json({
      imported: {
        title: doc.title, author: doc.author, format: doc.format,
        sections: doc.sections.length, chunks: chunks.length, words: totalWords,
        pages: doc.totalPages, embedded: embeddings?.length || 0,
        readingTime: Math.max(1, Math.round(totalWords / 225)),
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Document parser error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
