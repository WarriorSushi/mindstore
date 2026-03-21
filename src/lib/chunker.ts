/**
 * Document chunking for MindStore
 * Splits documents into semantic chunks for embedding and retrieval
 */

export interface Chunk {
  content: string;
  position: number;
  tokenCount: number;
}

const CHUNK_SIZE = 500; // target tokens per chunk
const CHUNK_OVERLAP = 50; // overlap tokens between chunks

// Rough token estimation (4 chars ≈ 1 token for English)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into semantic chunks
 * Tries to split on paragraph boundaries, then sentences, then words
 */
export function chunkText(text: string, maxTokens = CHUNK_SIZE, overlap = CHUNK_OVERLAP): Chunk[] {
  if (!text || text.trim().length === 0) return [];
  
  const tokens = estimateTokens(text);
  if (tokens <= maxTokens) {
    return [{ content: text.trim(), position: 0, tokenCount: tokens }];
  }

  const chunks: Chunk[] = [];
  
  // Split into paragraphs first
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  
  let currentChunk = '';
  let position = 0;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);
    const currentTokens = estimateTokens(currentChunk);

    if (currentTokens + paraTokens <= maxTokens) {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    } else {
      if (currentChunk) {
        chunks.push({
          content: currentChunk.trim(),
          position,
          tokenCount: estimateTokens(currentChunk),
        });
        position++;
        
        // Keep overlap from end of current chunk
        const overlapText = getOverlapText(currentChunk, overlap);
        currentChunk = overlapText + '\n\n' + para;
      } else {
        // Single paragraph is too big — split by sentences
        const sentenceChunks = chunkBySentences(para, maxTokens, overlap);
        for (const sc of sentenceChunks) {
          chunks.push({ ...sc, position });
          position++;
        }
        currentChunk = '';
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      position,
      tokenCount: estimateTokens(currentChunk),
    });
  }

  return chunks;
}

function chunkBySentences(text: string, maxTokens: number, overlap: number): Chunk[] {
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  const chunks: Chunk[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (estimateTokens(current + sentence) <= maxTokens) {
      current += sentence;
    } else {
      if (current) {
        chunks.push({ content: current.trim(), position: 0, tokenCount: estimateTokens(current) });
        const overlapText = getOverlapText(current, overlap);
        current = overlapText + sentence;
      } else {
        // Single sentence too long — just truncate
        chunks.push({ content: sentence.trim().slice(0, maxTokens * 4), position: 0, tokenCount: maxTokens });
        current = '';
      }
    }
  }

  if (current.trim()) {
    chunks.push({ content: current.trim(), position: 0, tokenCount: estimateTokens(current) });
  }

  return chunks;
}

function getOverlapText(text: string, overlapTokens: number): string {
  const chars = overlapTokens * 4;
  if (text.length <= chars) return text;
  return '...' + text.slice(-chars);
}

/**
 * Chunk ChatGPT conversation format
 * Each message becomes its own chunk with role context
 */
export function chunkConversation(messages: Array<{ role: string; content: string }>, maxTokens = CHUNK_SIZE): Chunk[] {
  const chunks: Chunk[] = [];
  let position = 0;

  for (const msg of messages) {
    if (!msg.content || msg.content.trim().length === 0) continue;
    
    const prefixed = `[${msg.role}]: ${msg.content}`;
    const msgChunks = chunkText(prefixed, maxTokens, 0);
    
    for (const chunk of msgChunks) {
      chunks.push({ ...chunk, position });
      position++;
    }
  }

  return chunks;
}
