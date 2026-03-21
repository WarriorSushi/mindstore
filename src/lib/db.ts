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
  metadata: Record<string, unknown>;
}

export interface Source {
  id: string;
  type: 'chatgpt' | 'text' | 'file' | 'url';
  title: string;
  itemCount: number;
  importedAt: Date;
  metadata: Record<string, unknown>;
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
  const sourceTypes = new Set(sources.map(s => s.type));
  const lastSource = sources.sort((a, b) => 
    new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
  )[0];
  return { totalMemories, totalSources, sourceTypes: sourceTypes.size, lastActivity: lastSource?.importedAt };
}

export async function exportAllData() {
  const memories = await db.memories.toArray();
  const sources = await db.sources.toArray();
  return { memories, sources, exportedAt: new Date().toISOString() };
}

export async function importBackup(data: { memories: Memory[]; sources: Source[] }) {
  await db.transaction('rw', db.memories, db.sources, async () => {
    await db.memories.bulkPut(data.memories);
    await db.sources.bulkPut(data.sources);
  });
}

export async function clearAllData() {
  await db.memories.clear();
  await db.sources.clear();
}
