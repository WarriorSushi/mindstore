/**
 * ChatGPT conversation export importer for MindStore
 * Parses conversations.json from ChatGPT data export
 */

import { createDocument, createChunk, getDb } from '../lib/db';
import { chunkConversation, chunkText } from '../lib/chunker';
import { generateEmbeddings, EmbeddingProvider } from '../lib/embeddings';
import { createHash } from 'crypto';

interface ChatGPTMessage {
  id: string;
  author: { role: string };
  content: { parts: string[] };
  create_time: number;
}

interface ChatGPTConversation {
  title: string;
  create_time: number;
  update_time: number;
  mapping: Record<string, {
    message?: ChatGPTMessage;
    parent?: string;
    children: string[];
  }>;
}

/**
 * Extract messages from ChatGPT conversation mapping (tree structure)
 */
function extractMessages(conversation: ChatGPTConversation): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string; time: number }> = [];

  for (const node of Object.values(conversation.mapping)) {
    if (!node.message) continue;
    const msg = node.message;
    const role = msg.author?.role || 'unknown';
    const content = msg.content?.parts?.join('\n') || '';
    
    if (content.trim() && (role === 'user' || role === 'assistant')) {
      messages.push({
        role,
        content: content.trim(),
        time: msg.create_time || 0,
      });
    }
  }

  // Sort by time
  messages.sort((a, b) => a.time - b.time);
  return messages.map(({ role, content }) => ({ role, content }));
}

/**
 * Import ChatGPT conversations.json export
 */
export async function importChatGPTExport(
  jsonContent: string,
  provider: EmbeddingProvider = 'openai'
): Promise<{ documents: number; chunks: number }> {
  const db = getDb();
  let totalDocs = 0;
  let totalChunks = 0;

  let conversations: ChatGPTConversation[];
  try {
    conversations = JSON.parse(jsonContent);
  } catch {
    throw new Error('Invalid ChatGPT export JSON');
  }

  if (!Array.isArray(conversations)) {
    throw new Error('Expected an array of conversations');
  }

  for (const conv of conversations) {
    const messages = extractMessages(conv);
    if (messages.length === 0) continue;

    const fullContent = messages.map(m => `[${m.role}]: ${m.content}`).join('\n\n');
    const hash = createHash('sha256').update(fullContent).digest('hex');

    // Skip if already imported
    const existing = db.prepare('SELECT id FROM documents WHERE hash = ?').get(hash);
    if (existing) continue;

    // Create document
    const docId = createDocument({
      source_type: 'chatgpt',
      title: conv.title || 'Untitled Conversation',
      content: fullContent,
      metadata: {
        messageCount: messages.length,
        createdAt: conv.create_time ? new Date(conv.create_time * 1000).toISOString() : null,
        updatedAt: conv.update_time ? new Date(conv.update_time * 1000).toISOString() : null,
      },
      hash,
    });
    totalDocs++;

    // Chunk conversation
    const chunks = chunkConversation(messages);
    
    // Generate embeddings
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
