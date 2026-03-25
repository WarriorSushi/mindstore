import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/server/user";
import {
  extractPDFSections,
  htmlToText,
  importParsedDocument,
  previewParsedDocument,
  smartChunkDocument,
  type ParsedDocument,
  ensurePdfEpubParserReady,
} from "@/server/plugins/ports/pdf-epub-parser";

async function parsePDF(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });

  const textResult = await parser.getText();
  const fullText = textResult.text || "";

  let info: Record<string, string> = {};
  try {
    info = ((await parser.getInfo())?.info || {}) as Record<string, string>;
  } catch {
    info = {};
  }

  const title = info.Title || fileName.replace(/\.pdf$/i, "");
  const author = info.Author || undefined;
  const totalPages = textResult?.pages?.length || undefined;

  await parser.destroy().catch(() => {});

  return {
    title,
    author,
    format: "pdf",
    totalPages,
    totalChapters: undefined,
    sections: extractPDFSections(fullText, title),
    metadata: {
      ...(info.Title ? { title: info.Title } : {}),
      ...(info.Author ? { author: info.Author } : {}),
      ...(info.Subject ? { subject: info.Subject } : {}),
      ...(info.Creator ? { creator: info.Creator } : {}),
      ...(info.Producer ? { producer: info.Producer } : {}),
      ...(totalPages ? { pages: String(totalPages) } : {}),
    },
  };
}

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

async function parseEPUB(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
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

export async function POST(req: NextRequest) {
  try {
    await ensurePdfEpubParserReady();

    const formData = await req.formData();
    const file = formData.get("file");
    const action = typeof formData.get("action") === "string" ? String(formData.get("action")) : "import";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileName = file.name || "document";
    const ext = path.extname(fileName).toLowerCase();
    if (![".pdf", ".epub"].includes(ext)) {
      return NextResponse.json({
        error: `Unsupported file type: ${ext}. Upload a PDF or EPUB file.`,
      }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum size is 50MB." }, { status: 400 });
    }

    const document = ext === ".pdf" ? await parsePDF(buffer, fileName) : await parseEPUB(buffer, fileName);
    if (document.sections.length === 0) {
      return NextResponse.json({
        error: "No readable text found in the document. It may be a scanned PDF (image-only).",
      }, { status: 400 });
    }

    if (action === "preview") {
      return NextResponse.json(previewParsedDocument(document, smartChunkDocument(document)));
    }

    const userId = await getUserId();
    return NextResponse.json(await importParsedDocument({ userId, document }));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message.includes("Unsupported file type")
      || message.includes("File too large")
      || message.includes("No readable text")
        ? 400
        : message.includes("plugin is disabled")
          ? 403
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
