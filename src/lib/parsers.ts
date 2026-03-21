import { v4 as uuid } from 'uuid';
import type { Memory } from './db';

interface ChatGPTConversation {
  title: string;
  create_time: number;
  update_time: number;
  mapping: Record<string, {
    message?: {
      content?: { parts?: string[] };
      author?: { role?: string };
      create_time?: number;
    };
    parent?: string;
    children?: string[];
  }>;
}

export interface ParsedChunk {
  content: string;
  sourceTitle: string;
  sourceId: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export function parseChatGPTExport(data: ChatGPTConversation[]): ParsedChunk[] {
  const chunks: ParsedChunk[] = [];
  
  for (const conv of data) {
    if (!conv.mapping) continue;
    
    // Find root node (one without parent or with null parent)
    const nodes = Object.entries(conv.mapping);
    const childIds = new Set<string>();
    for (const [, node] of nodes) {
      if (node.children) node.children.forEach(c => childIds.add(c));
    }
    
    // Walk tree in order to extract messages
    const messages: { role: string; content: string; time?: number }[] = [];
    
    // BFS from root
    const rootId = nodes.find(([id]) => !childIds.has(id) || !conv.mapping[id]?.parent)?.[0]
      || nodes.find(([, n]) => !n.parent)?.[0];
    
    if (!rootId) continue;
    
    const visited = new Set<string>();
    const queue = [rootId];
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      
      const node = conv.mapping[nodeId];
      if (!node) continue;
      
      if (node.message?.content?.parts && node.message.author?.role) {
        const text = node.message.content.parts
          .filter((p): p is string => typeof p === 'string')
          .join('\n')
          .trim();
        
        if (text && (node.message.author.role === 'user' || node.message.author.role === 'assistant')) {
          messages.push({
            role: node.message.author.role,
            content: text,
            time: node.message.create_time ?? undefined,
          });
        }
      }
      
      if (node.children) {
        for (const childId of node.children) {
          queue.push(childId);
        }
      }
    }
    
    // Group into user+assistant pairs
    const convId = uuid();
    for (let i = 0; i < messages.length; i += 2) {
      const user = messages[i];
      const assistant = messages[i + 1];
      if (!user) continue;
      
      let content = `User: ${user.content}`;
      if (assistant) {
        content += `\n\nAssistant: ${assistant.content}`;
      }
      
      chunks.push({
        content,
        sourceTitle: conv.title || 'Untitled Conversation',
        sourceId: convId,
        timestamp: new Date((user.time || conv.create_time || 0) * 1000),
        metadata: {
          conversationTitle: conv.title,
          turnIndex: Math.floor(i / 2),
        },
      });
    }
  }
  
  return chunks;
}

export function chunkText(text: string, maxTokens: number = 500): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = '';
  
  for (const para of paragraphs) {
    const combined = current ? `${current}\n\n${para}` : para;
    // rough token estimate: 1 token ≈ 4 chars
    if (combined.length / 4 > maxTokens && current) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = combined;
    }
  }
  
  if (current.trim()) {
    chunks.push(current.trim());
  }
  
  return chunks.filter(c => c.length > 10);
}

export function createMemoriesFromChunks(
  chunks: ParsedChunk[],
  embeddings: number[][],
  source: Memory['source'],
): Memory[] {
  const now = new Date();
  return chunks.map((chunk, i) => ({
    id: uuid(),
    content: chunk.content,
    embedding: embeddings[i],
    source,
    sourceId: chunk.sourceId,
    sourceTitle: chunk.sourceTitle,
    timestamp: chunk.timestamp,
    importedAt: now,
    metadata: chunk.metadata,
  }));
}
