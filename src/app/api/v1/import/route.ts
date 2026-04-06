import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/server/db';
import { buildTreeIndex } from '@/server/retrieval';
import { generateEmbeddings } from '@/server/embeddings';
import { sql } from 'drizzle-orm';
import { applyRateLimit, RATE_LIMITS } from '@/server/api-rate-limit';
import { scheduleEmbeddingBackfill } from '@/server/indexing-jobs';

/**
 * Clean a filename into a readable title.
 * Strips file extensions, Notion UUIDs (32-char hex), and path prefixes.
 * "My Page abc123def456789012345678901234.md" → "My Page"
 */
function cleanTitle(filename: string): string {
  return filename
    .replace(/^.*[\/\\]/, '')           // strip path
    .replace(/\.(md|txt|markdown)$/i, '') // strip extension
    .replace(/\s+[a-f0-9]{20,}$/i, '')  // strip Notion-style hex ID suffix (20+ hex chars)
    .replace(/\s+[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i, '') // strip standard UUID
    .trim() || filename;
}

// Chunking — intelligent paragraph/sentence splitting with overlap
function chunkText(text: string, maxChunkSize = 1000): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  
  // Short content — don't split
  if (trimmed.length <= maxChunkSize) return [trimmed];
  
  // First try paragraph splitting (natural boundaries)
  const paragraphs = trimmed.split(/\n{2,}/);
  
  if (paragraphs.length > 1) {
    const chunks: string[] = [];
    let current = '';

    for (const para of paragraphs) {
      // If a single paragraph exceeds max, split it by sentences
      if (para.length > maxChunkSize) {
        if (current.trim()) {
          chunks.push(current.trim());
          current = '';
        }
        chunks.push(...splitBySentences(para, maxChunkSize));
        continue;
      }
      
      if (current.length + para.length + 2 > maxChunkSize && current.length > 0) {
        chunks.push(current.trim());
        current = '';
      }
      current += (current ? '\n\n' : '') + para;
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.filter(c => c.trim().length > 20); // Drop fragments < 20 chars
  }
  
  // No paragraph breaks — split by sentences
  return splitBySentences(trimmed, maxChunkSize);
}

/** Split text by sentence boundaries, respecting max chunk size */
function splitBySentences(text: string, maxSize: number): string[] {
  // Match sentence boundaries (period/question/exclamation followed by space/newline or end)
  const sentences = text.match(/[^.!?]*[.!?]+[\s]*/g) || [text];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (current.length + sentence.length > maxSize && current.length > 0) {
      chunks.push(current.trim());
      current = '';
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  
  // If still too large (no sentence breaks found), split by words
  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= maxSize) {
      result.push(chunk);
    } else {
      // Hard split by words
      const words = chunk.split(/\s+/);
      let piece = '';
      for (const word of words) {
        if (piece.length + word.length + 1 > maxSize && piece.length > 0) {
          result.push(piece.trim());
          piece = '';
        }
        piece += (piece ? ' ' : '') + word;
      }
      if (piece.trim()) result.push(piece.trim());
    }
  }
  
  return result.filter(c => c.trim().length > 20);
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
  const limited = applyRateLimit(req, 'import', RATE_LIMITS.write);
  if (limited) return limited;

  try {
    const userId = await getUserId();
    
    const contentType = req.headers.get('content-type') || '';
    let documents: Array<{ title: string; content: string; sourceType: string; sourceId?: string; timestamp?: Date }> = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const sourceType = formData.get('source_type') as string || 'text';
      const files = formData.getAll('files');

      for (const fileEntry of files) {
        // Next.js formData returns File objects (which extend Blob)
        if (!(fileEntry instanceof Blob)) continue;
        const file = fileEntry as File;
        const filename = (file as any).name || 'file.txt';
        const isZip = filename.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
        
        if (isZip) {
          // Handle ZIP files (ChatGPT exports come as ZIP containing conversations.json)
          const buffer = await file.arrayBuffer();
          const JSZip = (await import("jszip")).default;
          const zip = await JSZip.loadAsync(buffer);
          
          for (const [zipFilename, zipEntry] of Object.entries(zip.files)) {
            if (zipEntry.dir) continue;
            const entryText = await zipEntry.async('text');

            if (zipFilename.endsWith('.json') && (sourceType === 'chatgpt' || zipFilename.includes('conversations'))) {
              try {
                const parsed = parseChatGPT(JSON.parse(entryText));
                documents.push(...parsed.map(p => ({ ...p, sourceType: 'chatgpt' })));
              } catch { /* skip non-ChatGPT JSON files in ZIP */ }
            } else if (zipFilename.endsWith('.md') || zipFilename.endsWith('.txt')) {
              documents.push({ title: cleanTitle(zipFilename), content: entryText, sourceType: sourceType || 'file' });
            }
          }
        } else {
          const text = await file.text();
          
          if (sourceType === 'chatgpt' && filename.endsWith('.json')) {
            const parsed = parseChatGPT(JSON.parse(text));
            documents.push(...parsed.map(p => ({ ...p, sourceType: 'chatgpt' })));
          } else {
            documents.push({ title: cleanTitle(filename), content: text, sourceType });
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

    // Filter out empty documents
    documents = documents.filter(d => d.content && d.content.trim().length > 0);

    if (documents.length === 0) {
      return NextResponse.json({ error: 'No documents to import' }, { status: 400 });
    }

    // Limit total import size to prevent abuse
    const MAX_DOCUMENTS = 10_000;
    const MAX_TOTAL_CHARS = 50_000_000; // 50MB of text
    if (documents.length > MAX_DOCUMENTS) {
      return NextResponse.json({ error: `Too many documents (${documents.length}). Maximum ${MAX_DOCUMENTS} per import.` }, { status: 400 });
    }
    const totalChars = documents.reduce((sum, d) => sum + d.content.length, 0);
    if (totalChars > MAX_TOTAL_CHARS) {
      return NextResponse.json({ error: `Import too large (${Math.round(totalChars / 1_000_000)}MB). Maximum 50MB per import.` }, { status: 400 });
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
    // Skip for large imports to avoid Vercel timeout (embeddings can be added later)
    let embeddings: number[][] | null = null;
    const MAX_EMBED_CHUNKS = 100; // ~10s for Gemini batch
    if (allChunks.length <= MAX_EMBED_CHUNKS) {
      try {
        embeddings = await generateEmbeddings(allChunks.map(c => c.content));
      } catch (e) {
        console.error('Embedding failed, storing without vectors:', e);
      }
    }

    // Insert into PostgreSQL (batched for performance — 50 per transaction)
    // Deduplication: skip chunks whose content already exists for this user
    const BATCH_SIZE = 50;
    let skippedDuplicates = 0;
    for (let b = 0; b < allChunks.length; b += BATCH_SIZE) {
      const batch = allChunks.slice(b, b + BATCH_SIZE);
      
      // Check for existing content in batch (dedup by exact content match)
      const contentHashes = batch.map(c => c.content.trim().substring(0, 500));
      let existingPrefixes = new Set<string>();
      try {
        // Build individual OR conditions to avoid array casting issues
        const conditions = contentHashes.map(h => sql`SUBSTRING(content, 1, 500) = ${h}`);
        const combined = conditions.reduce((acc, cond) => sql`${acc} OR ${cond}`);
        const existingCheck = await db.execute(sql`
          SELECT SUBSTRING(content, 1, 500) as prefix FROM memories
          WHERE user_id = ${userId}::uuid AND (${combined})
        `);
        existingPrefixes = new Set((existingCheck as any[]).map(r => r.prefix));
      } catch {
        // If dedup check fails, proceed without it
      }

      for (let i = 0; i < batch.length; i++) {
        const chunk = batch[i];
        const prefix = chunk.content.trim().substring(0, 500);
        
        // Skip if content already exists
        if (existingPrefixes.has(prefix)) {
          skippedDuplicates++;
          continue;
        }
        
        const globalIdx = b + i;
        const embedding = embeddings?.[globalIdx];
        const memId = crypto.randomUUID();
        const ts = (chunk.timestamp || new Date()).toISOString();

        if (embedding) {
          const embStr = `[${embedding.join(',')}]`;
          await db.execute(sql`
            INSERT INTO memories (id, user_id, content, embedding, source_type, source_id, source_title, created_at, imported_at)
            VALUES (${memId}, ${userId}::uuid, ${chunk.content}, ${embStr}::vector, ${chunk.sourceType}, ${chunk.sourceId || null}, ${chunk.sourceTitle}, ${ts}::timestamptz, NOW())
          `);
        } else {
          await db.execute(sql`
            INSERT INTO memories (id, user_id, content, source_type, source_id, source_title, created_at, imported_at)
            VALUES (${memId}, ${userId}::uuid, ${chunk.content}, ${chunk.sourceType}, ${chunk.sourceId || null}, ${chunk.sourceTitle}, ${ts}::timestamptz, NOW())
          `);
        }
      }
    }

    const actuallyImported = totalChunks - skippedDuplicates;
    const pendingEmbeddings = Math.max(actuallyImported - (embeddings?.length || 0), 0);
    const indexingJob = pendingEmbeddings > 0
      ? await scheduleEmbeddingBackfill({
          userId,
          requestedCount: pendingEmbeddings,
          reason: allChunks.length > MAX_EMBED_CHUNKS
            ? 'import-too-large-for-inline-embedding'
            : 'embedding-provider-unavailable-during-import',
          metadata: {
            surface: 'api:v1:import',
            documents: documents.length,
            sourceTypes: [...new Set(documents.map(d => d.sourceType))],
          },
        })
      : null;

    // Rebuild tree index after import
    try {
      await buildTreeIndex(userId);
    } catch (e) {
      console.error('Tree index build failed (non-fatal):', e);
    }

    // Send notification
    try {
      const { notifyImportComplete } = await import('@/server/notifications');
      const sourceLabel = documents.length === 1 ? (documents[0] as any).title || 'ChatGPT' : 'ChatGPT';
      await notifyImportComplete(
        'chatgpt-importer', sourceLabel,
        totalChunks,
        '/app/explore',
        userId,
      );
    } catch (e) { /* non-fatal */ }

    return NextResponse.json({
      imported: {
        documents: documents.length,
        chunks: totalChunks,
        embedded: embeddings ? embeddings.length : 0,
        embeddingsSkipped: allChunks.length > MAX_EMBED_CHUNKS,
        duplicatesSkipped: skippedDuplicates,
        actuallyImported,
        indexing: {
          queued: !!indexingJob,
          jobId: indexingJob?.id ?? null,
          pendingEmbeddings,
        },
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
