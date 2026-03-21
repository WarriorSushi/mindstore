/**
 * Notion export importer for MindStore
 * Parses markdown/CSV files from a Notion workspace export
 */

import { createDocument, createChunk, getDb } from '../lib/db';
import { chunkText } from '../lib/chunker';
import { generateEmbeddings, EmbeddingProvider } from '../lib/embeddings';
import { createHash } from 'crypto';

/**
 * Parse a Notion exported markdown file
 * Notion exports include page title as first H1 and metadata in the filename
 */
function parseNotionPage(content: string, filePath: string): { title: string; content: string; metadata: Record<string, unknown> } {
  let title = filePath.split('/').pop()?.replace('.md', '').replace(/ [a-f0-9]{32}$/, '') || 'Untitled';
  let body = content;

  // Extract title from first H1
  const h1Match = content.match(/^# (.+)\n/);
  if (h1Match) {
    title = h1Match[1];
    body = content.slice(h1Match[0].length);
  }

  // Extract any Notion metadata (properties at top)
  const metadata: Record<string, unknown> = {
    originalPath: filePath,
  };

  // Notion exports sometimes have property tables at top
  const propMatch = body.match(/^(\|.+\|[\s\S]*?\n\n)/);
  if (propMatch) {
    metadata.properties = propMatch[1];
  }

  return { title, content: body, metadata };
}

/**
 * Import Notion export files
 * @param files Array of { path: string, content: string }
 */
export async function importNotionExport(
  files: Array<{ path: string; content: string }>,
  provider: EmbeddingProvider = 'openai'
): Promise<{ documents: number; chunks: number }> {
  const db = getDb();
  let totalDocs = 0;
  let totalChunks = 0;

  // Filter to markdown and CSV files
  const importableFiles = files.filter(f => 
    f.path.endsWith('.md') || f.path.endsWith('.csv')
  );

  for (const file of importableFiles) {
    const hash = createHash('sha256').update(file.content).digest('hex');
    
    const existing = db.prepare('SELECT id FROM documents WHERE hash = ?').get(hash);
    if (existing) continue;

    const parsed = parseNotionPage(file.content, file.path);

    const docId = createDocument({
      source_type: 'notion',
      title: parsed.title,
      content: parsed.content,
      metadata: parsed.metadata,
      file_path: file.path,
      hash,
    });
    totalDocs++;

    const chunks = chunkText(parsed.content);
    const embeddings = await generateEmbeddings(
      chunks.map(c => c.content),
      provider
    );

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
  }

  return { documents: totalDocs, chunks: totalChunks };
}
