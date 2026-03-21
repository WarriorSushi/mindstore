/**
 * Generic text/markdown importer for MindStore
 */

import { createDocument, createChunk, getDb } from '../lib/db';
import { chunkText } from '../lib/chunker';
import { generateEmbeddings, EmbeddingProvider } from '../lib/embeddings';
import { createHash } from 'crypto';

/**
 * Import raw text or markdown content
 */
export async function importText(
  content: string,
  title: string,
  sourceType: string = 'text',
  provider: EmbeddingProvider = 'openai'
): Promise<{ documentId: string; chunks: number }> {
  const db = getDb();
  const hash = createHash('sha256').update(content).digest('hex');

  const existing = db.prepare('SELECT id FROM documents WHERE hash = ?').get(hash) as { id: string } | undefined;
  if (existing) {
    return { documentId: existing.id, chunks: 0 };
  }

  const docId = createDocument({
    source_type: sourceType,
    title,
    content,
    hash,
  });

  const chunks = chunkText(content);
  const embeddings = await generateEmbeddings(
    chunks.map(c => c.content),
    provider
  );

  let totalChunks = 0;
  for (let i = 0; i < chunks.length; i++) {
    createChunk({
      document_id: docId,
      content: chunks[i].content,
      embedding: embeddings[i],
      position: chunks[i].position,
      token_count: chunks[i].tokenCount,
    });
    totalChunks++;
  }

  return { documentId: docId, chunks: totalChunks };
}
