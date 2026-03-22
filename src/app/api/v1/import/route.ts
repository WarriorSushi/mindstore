import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/server/db';
import { buildTreeIndex } from '@/server/retrieval';
import { generateEmbeddings } from '@/server/embeddings';
import { sql } from 'drizzle-orm';

// Chunking — intelligent paragraph/sentence splitting
function chunkText(text: string, maxChunkSize = 1000): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length > maxChunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = '';
    }
    current += para + '\n\n';
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.filter(c => c.length > 20); // skip tiny chunks
}

// ChatGPT export parser
function parseChatGPT(json: any): Array<{ title: string; content: string; timestamp: Date }> {
  const results: Array<{ title: string; content: string; timestamp: Date }> = [];

  for (const conv of (Array.isArray(json) ? json : [])) {
    const title = conv.title || 'Untitled Conversation';
    const messages: string[] = [];

    if (conv.mapping) {
      for (const node of Object.values(conv.mapping) as any[]) {
        const msg = node?.message;
        if (msg?.content?.parts) {
          const role = msg.author?.role || 'unknown';
          const text = msg.content.parts.filter((p: any) => typeof p === 'string').join('\n');
          if (text.trim()) messages.push(`${role}: ${text}`);
        }
      }
    }

    if (messages.length > 0) {
      results.push({
        title,
        content: messages.join('\n\n'),
        timestamp: new Date((conv.create_time || 0) * 1000),
      });
    }
  }

  return results;
}

/**
 * POST /api/v1/import
 * Body: multipart form with files + source_type
 * Or JSON: { source_type, documents: [{ title, content }] }
 */
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || '00000000-0000-0000-0000-000000000000';
    
    const contentType = req.headers.get('content-type') || '';
    let documents: Array<{ title: string; content: string; sourceType: string; timestamp?: Date }> = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const sourceType = formData.get('source_type') as string || 'text';
      const files = formData.getAll('files') as File[];

      for (const file of files) {
        const text = await file.text();
        
        if (sourceType === 'chatgpt' && file.name.endsWith('.json')) {
          const parsed = parseChatGPT(JSON.parse(text));
          documents.push(...parsed.map(p => ({ ...p, sourceType: 'chatgpt' })));
        } else {
          documents.push({ title: file.name, content: text, sourceType });
        }
      }
    } else {
      const body = await req.json();
      documents = body.documents || [];
    }

    if (documents.length === 0) {
      return NextResponse.json({ error: 'No documents to import' }, { status: 400 });
    }

    // Chunk all documents
    let totalChunks = 0;
    const allChunks: Array<{ content: string; sourceType: string; sourceTitle: string; timestamp?: Date }> = [];

    for (const doc of documents) {
      const chunks = chunkText(doc.content);
      for (const chunk of chunks) {
        allChunks.push({
          content: chunk,
          sourceType: doc.sourceType,
          sourceTitle: doc.title,
          timestamp: doc.timestamp,
        });
      }
      totalChunks += chunks.length;
    }

    // Generate embeddings using available provider (OpenAI, Gemini, or Ollama)
    let embeddings: number[][] | null = null;
    try {
      embeddings = await generateEmbeddings(allChunks.map(c => c.content));
    } catch (e) {
      console.error('Embedding failed, storing without vectors:', e);
    }

    // Insert into PostgreSQL
    for (let i = 0; i < allChunks.length; i++) {
      const chunk = allChunks[i];
      const embedding = embeddings?.[i];
      const memId = crypto.randomUUID();
      const ts = (chunk.timestamp || new Date()).toISOString();

      if (embedding) {
        const embStr = `[${embedding.join(',')}]`;
        await db.execute(sql`
          INSERT INTO memories (id, user_id, content, embedding, source_type, source_title, created_at, imported_at)
          VALUES (${memId}, ${userId}::uuid, ${chunk.content}, ${embStr}::vector, ${chunk.sourceType}, ${chunk.sourceTitle}, ${ts}, NOW())
        `);
      } else {
        await db.execute(sql`
          INSERT INTO memories (id, user_id, content, source_type, source_title, created_at, imported_at)
          VALUES (${memId}, ${userId}::uuid, ${chunk.content}, ${chunk.sourceType}, ${chunk.sourceTitle}, ${ts}, NOW())
        `);
      }
    }

    // Rebuild tree index after import
    try {
      await buildTreeIndex(userId);
    } catch (e) {
      console.error('Tree index build failed (non-fatal):', e);
    }

    return NextResponse.json({
      imported: {
        documents: documents.length,
        chunks: totalChunks,
        embedded: embeddings ? embeddings.length : 0,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
