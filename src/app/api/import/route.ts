import { NextRequest, NextResponse } from 'next/server';
import { importObsidianVault } from '@/importers/obsidian';
import { importChatGPTExport } from '@/importers/chatgpt';
import { importNotionExport } from '@/importers/notion';
import { importText } from '@/importers/text';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const sourceType = formData.get('source_type') as string;
    const files = formData.getAll('files') as File[];

    if (!sourceType) {
      return NextResponse.json({ error: 'Missing source_type' }, { status: 400 });
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    let result = { documents: 0, chunks: 0 };

    if (sourceType === 'chatgpt') {
      // ChatGPT export is a single JSON file
      const file = files[0];
      const content = await file.text();
      result = await importChatGPTExport(content, 'local');
    } else if (sourceType === 'obsidian' || sourceType === 'notion') {
      // Process all uploaded files
      const parsedFiles: Array<{ path: string; content: string }> = [];
      
      for (const file of files) {
        const content = await file.text();
        parsedFiles.push({ path: file.name, content });
      }

      if (sourceType === 'obsidian') {
        result = await importObsidianVault(parsedFiles, 'local');
      } else {
        result = await importNotionExport(parsedFiles, 'local');
      }
    } else if (sourceType === 'text') {
      const file = files[0];
      const content = await file.text();
      const textResult = await importText(content, file.name, 'text', 'local');
      result = { documents: 1, chunks: textResult.chunks };
    } else {
      return NextResponse.json({ error: `Unknown source type: ${sourceType}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      imported: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
