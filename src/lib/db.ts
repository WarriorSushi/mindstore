import Dexie, { type Table } from 'dexie';

export interface Memory {
  id: string;
  content: string;
  embedding: number[];
  source: 'chatgpt' | 'text' | 'file' | 'url';
  sourceId: string;
  sourceTitle: string;
  timestamp: Date;
  importedAt: Date;
  metadata: Record<string, any>;
}

export interface Source {
  id: string;
  type: 'chatgpt' | 'text' | 'file' | 'url';
  title: string;
  itemCount: number;
  importedAt: Date;
  metadata: Record<string, any>;
}

class MindstoreDB extends Dexie {
  memories!: Table<Memory>;
  sources!: Table<Source>;

  constructor() {
    super('mindstore');
    this.version(1).stores({
      memories: 'id, source, sourceId, sourceTitle, timestamp, importedAt',
      sources: 'id, type, title, importedAt',
    });
  }
}

export const db = new MindstoreDB();

export async function getStats() {
  const totalMemories = await db.memories.count();
  const totalSources = await db.sources.count();
  const sources = await db.sources.toArray();
  
  const byType = {
    chatgpt: sources.filter(s => s.type === 'chatgpt').length,
    text: sources.filter(s => s.type === 'text').length,
    file: sources.filter(s => s.type === 'file').length,
    url: sources.filter(s => s.type === 'url').length,
  };

  // Get top topics (source titles, grouped)
  const topSources = sources
    .sort((a, b) => b.itemCount - a.itemCount)
    .slice(0, 10);

  return { totalMemories, totalSources, byType, topSources };
}

export async function clearAllData() {
  await db.memories.clear();
  await db.sources.clear();
}

export async function exportAllData() {
  const memories = await db.memories.toArray();
  const sources = await db.sources.toArray();
  return { memories, sources, exportedAt: new Date().toISOString() };
}

export async function importBackup(data: { memories: Memory[]; sources: Source[] }) {
  await db.memories.bulkPut(data.memories);
  await db.sources.bulkPut(data.sources);
}
