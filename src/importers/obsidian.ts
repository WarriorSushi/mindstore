/**
 * Obsidian vault importer for MindStore
 * Parses markdown files from an Obsidian vault export
 */

import { createDocument, createChunk, getDb } from '../lib/db';
import { chunkText } from '../lib/chunker';
import { generateEmbeddings, EmbeddingProvider } from '../lib/embeddings';
import { createHash } from 'crypto';

interface ObsidianNote {
  title: string;
  content: string;
  path: string;
  tags: string[];
  links: string[];
  frontmatter: Record<string, unknown>;
}

/**
 * Parse a single Obsidian markdown file
 */
function parseObsidianNote(content: string, filePath: string): ObsidianNote {
  const title = filePath.split('/').pop()?.replace('.md', '') || 'Untitled';
  
  // Extract frontmatter
  let frontmatter: Record<string, unknown> = {};
  let body = content;
  
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (fmMatch) {
    body = content.slice(fmMatch[0].length);
    // Simple YAML-like parsing
    const lines = fmMatch[1].split('\n');
    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        frontmatter[key.trim()] = valueParts.join(':').trim();
      }
    }
  }

  // Extract tags
  const tags = Array.from(body.matchAll(/#(\w+)/g)).map(m => m[1]);
  
  // Extract wiki links
  const links = Array.from(body.matchAll(/\[\[(.*?)\]\]/g)).map(m => m[1].split('|')[0]);

  return { title, content: body, path: filePath, tags, links, frontmatter };
}

/**
 * Import an Obsidian vault from uploaded files
 * @param files Array of { path: string, content: string }
 */
export async function importObsidianVault(
  files: Array<{ path: string; content: string }>,
  provider: EmbeddingProvider = 'openai'
): Promise<{ documents: number; chunks: number }> {
  const db = getDb();
  let totalDocs = 0;
  let totalChunks = 0;

  // Filter markdown files
  const mdFiles = files.filter(f => f.path.endsWith('.md'));

  for (const file of mdFiles) {
    const hash = createHash('sha256').update(file.content).digest('hex');
    
    // Skip if already imported
    const existing = db.prepare('SELECT id FROM documents WHERE hash = ?').get(hash);
    if (existing) continue;

    const note = parseObsidianNote(file.content, file.path);
    
    // Create document
    const docId = createDocument({
      source_type: 'obsidian',
      title: note.title,
      content: note.content,
      metadata: {
        tags: note.tags,
        links: note.links,
        frontmatter: note.frontmatter,
        originalPath: note.path,
      },
      file_path: note.path,
      hash,
    });
    totalDocs++;

    // Chunk the content
    const chunks = chunkText(note.content);
    
    // Generate embeddings in batch
    const embeddings = await generateEmbeddings(
      chunks.map(c => c.content),
      provider
    );

    // Store chunks with embeddings
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
