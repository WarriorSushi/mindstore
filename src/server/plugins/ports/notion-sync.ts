/**
 * Notion Sync — Portable Logic
 *
 * Push MindStore memories to a Notion database.
 * Pure logic for Notion API interactions and content formatting.
 *
 * Does NOT store config — the caller handles persistence.
 * Does NOT read DB directly — accepts data as arguments.
 */

// ─── Types ──────────────────────────────────────────────────────

export interface NotionSyncConfig {
  apiToken?: string;
  databaseId?: string;
  databaseName?: string;
  syncDirection: 'push' | 'pull' | 'both';
  autoSync: boolean;
  syncInterval: number;
  lastSyncAt?: string;
  lastSyncCount?: number;
  syncedMemoryIds?: string[];
  totalSynced?: number;
  filterBySource?: string[];
  syncHistory?: SyncRecord[];
}

export interface SyncRecord {
  id: string;
  timestamp: string;
  direction: 'push' | 'pull';
  count: number;
  status: 'success' | 'partial' | 'failed';
  errors?: string[];
}

export interface MemoryForSync {
  id: number;
  content: string;
  sourceType: string;
  sourceTitle: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface PushResult {
  success: boolean;
  notionPageId?: string;
  error?: string;
}

// ─── Default Config ─────────────────────────────────────────────

export function defaultSyncConfig(): NotionSyncConfig {
  return {
    syncDirection: 'push',
    autoSync: false,
    syncInterval: 60,
    syncedMemoryIds: [],
    totalSynced: 0,
    syncHistory: [],
  };
}

// ─── Notion API ─────────────────────────────────────────────────

const NOTION_VERSION = '2022-06-28';

function notionHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

/** Validate a Notion integration token. Returns workspace name on success. */
export async function validateNotionToken(
  token: string,
): Promise<{ valid: boolean; workspaceName?: string; error?: string }> {
  try {
    const res = await fetch('https://api.notion.com/v1/users/me', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
      },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { valid: false, error: data.message || `HTTP ${res.status}` };
    }
    const data = await res.json();
    return {
      valid: true,
      workspaceName:
        data.name || data.bot?.owner?.workspace?.name || 'Unknown Workspace',
    };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Connection failed' };
  }
}

/** List databases the integration has access to */
export async function listNotionDatabases(
  token: string,
): Promise<Array<{ id: string; title: string }>> {
  try {
    const res = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: notionHeaders(token),
      body: JSON.stringify({
        filter: { value: 'database', property: 'object' },
        sort: { direction: 'descending', timestamp: 'last_edited_time' },
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((db: any) => ({
      id: db.id,
      title:
        db.title?.[0]?.text?.content ||
        db.title?.[0]?.plain_text ||
        'Untitled',
    }));
  } catch {
    return [];
  }
}

/** Create a MindStore Knowledge Base database inside a Notion page */
export async function createNotionDatabase(
  token: string,
  parentPageId?: string,
): Promise<{ id: string; title: string } | null> {
  try {
    let parentId = parentPageId;
    if (!parentId) {
      const res = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: notionHeaders(token),
        body: JSON.stringify({
          filter: { value: 'page', property: 'object' },
          page_size: 1,
        }),
      });
      const data = await res.json();
      parentId = data.results?.[0]?.id;
    }
    if (!parentId) return null;

    const res = await fetch('https://api.notion.com/v1/databases', {
      method: 'POST',
      headers: notionHeaders(token),
      body: JSON.stringify({
        parent: { type: 'page_id', page_id: parentId },
        title: [
          { type: 'text', text: { content: 'MindStore Knowledge Base' } },
        ],
        properties: {
          Title: { title: {} },
          Source: {
            select: {
              options: [
                { name: 'ChatGPT', color: 'green' },
                { name: 'File', color: 'blue' },
                { name: 'URL', color: 'orange' },
                { name: 'Text', color: 'default' },
                { name: 'Kindle', color: 'yellow' },
                { name: 'YouTube', color: 'red' },
                { name: 'Reddit', color: 'default' },
                { name: 'Obsidian', color: 'gray' },
              ],
            },
          },
          Tags: { multi_select: { options: [] } },
          Created: { date: {} },
          'Word Count': { number: {} },
          'MindStore ID': { rich_text: {} },
        },
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return { id: data.id, title: 'MindStore Knowledge Base' };
  } catch {
    return null;
  }
}

// ─── Source Type Formatting ─────────────────────────────────────

const SOURCE_TYPE_MAP: Record<string, string> = {
  chatgpt: 'ChatGPT',
  file: 'File',
  url: 'URL',
  text: 'Text',
  kindle: 'Kindle',
  youtube: 'YouTube',
  reddit: 'Reddit',
  obsidian: 'Obsidian',
  document: 'File',
  audio: 'File',
  image: 'File',
};

export function formatSourceType(type: string): string {
  return SOURCE_TYPE_MAP[type] || 'Text';
}

// ─── Push a Single Memory ───────────────────────────────────────

/** Push one memory to a Notion database as a page */
export async function pushMemoryToNotion(
  token: string,
  databaseId: string,
  memory: MemoryForSync,
): Promise<PushResult> {
  try {
    const title =
      memory.sourceTitle ||
      memory.content
        .split('\n')[0]
        .replace(/^#+\s*/, '')
        .substring(0, 80) ||
      'Untitled Memory';

    // Split into Notion paragraph blocks (max 2000 chars each)
    const contentBlocks: any[] = [];
    const lines = memory.content.split('\n');
    let currentBlock = '';

    for (const line of lines) {
      if (currentBlock.length + line.length + 1 > 1900) {
        if (currentBlock) {
          contentBlocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: currentBlock } }],
            },
          });
        }
        currentBlock = line;
      } else {
        currentBlock += (currentBlock ? '\n' : '') + line;
      }
    }
    if (currentBlock) {
      contentBlocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: currentBlock } }],
        },
      });
    }

    const blocks = contentBlocks.slice(0, 100); // Notion limit
    const wordCount = memory.content.split(/\s+/).filter(Boolean).length;
    const tags = (memory.metadata?.tags as string[]) || [];

    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: notionHeaders(token),
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          Title: {
            title: [
              {
                type: 'text',
                text: { content: title.substring(0, 200) },
              },
            ],
          },
          Source: {
            select: { name: formatSourceType(memory.sourceType) },
          },
          Tags: {
            multi_select: tags
              .slice(0, 10)
              .map((t: string) => ({ name: t.substring(0, 100) })),
          },
          Created: {
            date: { start: memory.createdAt.toISOString() },
          },
          'Word Count': { number: wordCount },
          'MindStore ID': {
            rich_text: [
              { type: 'text', text: { content: String(memory.id) } },
            ],
          },
        },
        children: blocks,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.message || `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { success: true, notionPageId: data.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Batch Sync ─────────────────────────────────────────────────

/**
 * Filter memories to only those not yet synced, optionally by source type.
 */
export function filterUnsyncedMemories(
  memories: MemoryForSync[],
  syncedIds: Set<string>,
  filterBySource?: string[],
): MemoryForSync[] {
  let unsynced = memories.filter((m) => !syncedIds.has(String(m.id)));
  if (filterBySource && filterBySource.length > 0) {
    unsynced = unsynced.filter((m) =>
      filterBySource.includes(m.sourceType || 'text'),
    );
  }
  return unsynced;
}

/**
 * Push a batch of memories to Notion, respecting rate limits (3 req/s).
 * Returns sync record.
 */
export async function pushBatch(
  token: string,
  databaseId: string,
  memories: MemoryForSync[],
  batchSize: number = 50,
): Promise<{
  successCount: number;
  errors: string[];
  syncedIds: string[];
}> {
  const batch = memories.slice(0, batchSize);
  let successCount = 0;
  const errors: string[] = [];
  const syncedIds: string[] = [];

  for (let i = 0; i < batch.length; i += 3) {
    const chunk = batch.slice(i, i + 3);
    const results = await Promise.allSettled(
      chunk.map((m) => pushMemoryToNotion(token, databaseId, m)),
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled' && result.value.success) {
        successCount++;
        syncedIds.push(String(chunk[j].id));
      } else {
        const error =
          result.status === 'fulfilled'
            ? result.value.error || 'Unknown error'
            : result.reason?.message || 'Failed';
        errors.push(`Memory ${chunk[j].id}: ${error}`);
      }
    }

    // Rate limit: 400ms between bursts of 3
    if (i + 3 < batch.length) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  return { successCount, errors, syncedIds };
}

/**
 * Build a SyncRecord from push results.
 */
export function buildSyncRecord(
  successCount: number,
  errors: string[],
): SyncRecord {
  return {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    direction: 'push',
    count: successCount,
    status:
      errors.length === 0
        ? 'success'
        : successCount > 0
          ? 'partial'
          : 'failed',
    errors: errors.slice(0, 5),
  };
}
