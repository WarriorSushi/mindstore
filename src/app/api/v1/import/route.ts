import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/server/db';
import { buildTreeIndex } from '@/server/retrieval';
import { generateEmbeddings } from '@/server/embeddings';
import { sql } from 'drizzle-orm';
import JSZip from 'jszip';

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

// ChatGPT export parser — walks the conversation tree to preserve message order
function parseChatGPT(json: any): Array<{ title: string; content: string; timestamp: Date }> {
  const results: Array<{ title: string; content: string; timestamp: Date }> = [];

  for (const conv of (Array.isArray(json) ? json : [])) {
    const title = conv.title || 'Untitled Conversation';
    const messages: string[] = [];

    if (conv.mapping) {
      // Walk the tree using parent/children links to get correct order
      const visited = new Set<string>();
      function walk(nodeId: string) {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        const node = conv.mapping[nodeId];
        if (!node) return;

        const msg = node.message;
        if (msg?.content?.parts) {
          const role = msg.author?.role || 'unknown';
          const text = msg.content.parts.filter((p: any) => typeof p === 'string').join('\n');
          if (text.trim() && role !== 'system') {
            messages.push(`${role}: ${text}`);
          }
        }

        for (const childId of (node.children || [])) {
          walk(childId);
        }
      }

      // Find root nodes (no parent or parent not in mapping)
      for (const [id, node] of Object.entries(conv.mapping) as [string, any][]) {
        if (!node.parent || !conv.mapping[node.parent]) {
          walk(id);
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
    let documents: Array<{ title: string; content: string; sourceType: string; sourceId?: string; timestamp?: Date }> = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const sourceType = formData.get('source_type') as string || 'text';
      const files = formData.getAll('files') as File[];

      for (const file of files) {
        const isZip = file.name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
        
        if (isZip) {
          // Handle ZIP files (ChatGPT exports come as ZIP containing conversations.json)
          const buffer = await file.arrayBuffer();
          const zip = await JSZip.loadAsync(buffer);
          
          for (const [filename, zipEntry] of Object.entries(zip.files)) {
            if (zipEntry.dir) continue;
            const entryText = await zipEntry.async('text');
            
            if (filename.endsWith('.json') && (sourceType === 'chatgpt' || filename.includes('conversations'))) {
              try {
                const parsed = parseChatGPT(JSON.parse(entryText));
                documents.push(...parsed.map(p => ({ ...p, sourceType: 'chatgpt' })));
              } catch { /* skip non-ChatGPT JSON files in ZIP */ }
            } else if (filename.endsWith('.md') || filename.endsWith('.txt')) {
              documents.push({ title: filename.replace(/^.*\//, ''), content: entryText, sourceType: sourceType || 'file' });
            }
          }
        } else {
          const text = await file.text();
          
          if (sourceType === 'chatgpt' && file.name.endsWith('.json')) {
            const parsed = parseChatGPT(JSON.parse(text));
            documents.push(...parsed.map(p => ({ ...p, sourceType: 'chatgpt' })));
          } else {
            documents.push({ title: file.name, content: text, sourceType });
          }
        }
      }
    } else {
      const body = await req.json();
      
      if (body.documents) {
        // Standard import format: { documents: [{ title, content, sourceType, sourceId }] }
        documents = body.documents;
      } else if (body.memories) {
        // Restore from export format: { memories: [{ content, source, sourceId, sourceTitle }] }
        documents = body.memories.map((m: any) => ({
          title: m.sourceTitle || 'Restored',
          content: m.content,
          sourceType: m.source || 'text',
          sourceId: m.sourceId || null,
          timestamp: m.timestamp ? new Date(m.timestamp) : undefined,
        }));
      }
    }

    if (documents.length === 0) {
      return NextResponse.json({ error: 'No documents to import' }, { status: 400 });
    }

    // Chunk all documents
    let totalChunks = 0;
    const allChunks: Array<{ content: string; sourceType: string; sourceTitle: string; sourceId?: string; timestamp?: Date }> = [];

    for (const doc of documents) {
      const chunks = chunkText(doc.content);
      for (const chunk of chunks) {
        allChunks.push({
          content: chunk,
          sourceType: doc.sourceType,
          sourceTitle: doc.title,
          sourceId: doc.sourceId,
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
          INSERT INTO memories (id, user_id, content, embedding, source_type, source_id, source_title, created_at, imported_at)
          VALUES (${memId}, ${userId}::uuid, ${chunk.content}, ${embStr}::vector, ${chunk.sourceType}, ${chunk.sourceId || null}, ${chunk.sourceTitle}, ${ts}, NOW())
        `);
      } else {
        await db.execute(sql`
          INSERT INTO memories (id, user_id, content, source_type, source_id, source_title, created_at, imported_at)
          VALUES (${memId}, ${userId}::uuid, ${chunk.content}, ${chunk.sourceType}, ${chunk.sourceId || null}, ${chunk.sourceTitle}, ${ts}, NOW())
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
