import { v4 as uuid } from 'uuid';
import type { Memory, Source } from './db';

interface ChatGPTExport {
  title: string;
  create_time: number;
  update_time: number;
  mapping: Record<string, {
    message?: {
      content: { parts: string[] };
      author: { role: string };
      create_time: number | null;
    };
    parent?: string;
    children?: string[];
  }>;
}

export function parseChatGPTExport(json: ChatGPTExport[]): { memories: Omit<Memory, 'embedding'>[]; sources: Source[] } {
  const memories: Omit<Memory, 'embedding'>[] = [];
  const sources: Source[] = [];
  const now = new Date();

  for (const convo of json) {
    if (!convo.mapping) continue;

    const sourceId = uuid();
    const messages: { role: string; content: string; time: number | null }[] = [];

    // Walk the tree to extract messages in order
    const visited = new Set<string>();
    function walk(nodeId: string) {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      const node = convo.mapping[nodeId];
      if (!node) return;

      if (node.message?.content?.parts) {
        const text = node.message.content.parts
          .filter((p): p is string => typeof p === 'string')
          .join('\n')
          .trim();
        if (text) {
          messages.push({
            role: node.message.author?.role || 'unknown',
            content: text,
            time: node.message.create_time,
          });
        }
      }

      for (const childId of node.children || []) {
        walk(childId);
      }
    }

    // Find root nodes (no parent or parent not in mapping)
    for (const [id, node] of Object.entries(convo.mapping)) {
      if (!node.parent || !convo.mapping[node.parent]) {
        walk(id);
      }
    }

    // Pair user+assistant messages into chunks
    let i = 0;
    let chunkCount = 0;
    while (i < messages.length) {
      let chunk = '';
      const startTime = messages[i].time;

      if (messages[i].role === 'user') {
        chunk += `User: ${messages[i].content}\n`;
        i++;
        if (i < messages.length && messages[i].role === 'assistant') {
          chunk += `Assistant: ${messages[i].content}`;
          i++;
        }
      } else if (messages[i].role === 'assistant') {
        chunk += `Assistant: ${messages[i].content}`;
        i++;
      } else {
        i++;
        continue;
      }

      if (chunk.trim().length > 10) {
        chunkCount++;
        memories.push({
          id: uuid(),
          content: chunk.trim(),
          source: 'chatgpt',
          sourceId,
          sourceTitle: convo.title || 'Untitled Conversation',
          timestamp: startTime ? new Date(startTime * 1000) : new Date(convo.create_time * 1000),
          importedAt: now,
          metadata: { conversationTitle: convo.title },
        });
      }
    }

    if (chunkCount > 0) {
      sources.push({
        id: sourceId,
        type: 'chatgpt',
        title: convo.title || 'Untitled Conversation',
        itemCount: chunkCount,
        importedAt: now,
        metadata: {
          createTime: convo.create_time,
          updateTime: convo.update_time,
          totalMessages: messages.length,
        },
      });
    }
  }

  return { memories, sources };
}

export function chunkText(text: string, maxTokens = 500): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    const combined = current ? `${current}\n\n${para}` : para;
    // Rough token estimate: ~4 chars per token
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

  // If any chunk is still too long, split by sentences
  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length / 4 > maxTokens * 1.5) {
      const sentences = chunk.match(/[^.!?]+[.!?]+/g) || [chunk];
      let sub = '';
      for (const sent of sentences) {
        if ((sub + sent).length / 4 > maxTokens && sub) {
          result.push(sub.trim());
          sub = sent;
        } else {
          sub += sent;
        }
      }
      if (sub.trim()) result.push(sub.trim());
    } else {
      result.push(chunk);
    }
  }

  return result.filter(c => c.length > 20);
}

export function createTextMemories(
  text: string,
  title: string,
  sourceType: 'text' | 'file' | 'url'
): { memories: Omit<Memory, 'embedding'>[]; source: Source } {
  const now = new Date();
  const sourceId = uuid();
  const chunks = chunkText(text);

  const memories = chunks.map(chunk => ({
    id: uuid(),
    content: chunk,
    source: sourceType,
    sourceId,
    sourceTitle: title,
    timestamp: now,
    importedAt: now,
    metadata: {},
  }));

  const source: Source = {
    id: sourceId,
    type: sourceType,
    title,
    itemCount: memories.length,
    importedAt: now,
    metadata: { originalLength: text.length },
  };

  return { memories, source };
}
