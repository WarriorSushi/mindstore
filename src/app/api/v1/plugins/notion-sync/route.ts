/**
 * Notion Sync Plugin — API Route
 *
 * Syncs MindStore memories to a Notion workspace as a searchable database.
 * 
 * GET  ?action=config       — Get sync configuration + status
 * GET  ?action=history      — Get sync history
 * GET  ?action=preview      — Preview what would sync
 * POST action=save-config   — Save Notion API token + database config
 * POST action=sync          — Run a sync (push memories to Notion)
 * POST action=disconnect    — Remove Notion connection
 * POST action=validate      — Validate API token
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/server/user';
import { db, schema } from '@/server/db';
import { eq, sql, desc, and, isNotNull, gt } from 'drizzle-orm';

// ─── Types ──────────────────────────────────────────────────────

interface NotionSyncConfig {
  apiToken?: string;
  databaseId?: string;
  databaseName?: string;
  syncDirection: 'push' | 'pull' | 'both';
  autoSync: boolean;
  syncInterval: number; // minutes
  lastSyncAt?: string;
  lastSyncCount?: number;
  syncedMemoryIds?: string[];
  totalSynced?: number;
  filterBySource?: string[];
  syncHistory?: SyncRecord[];
}

interface SyncRecord {
  id: string;
  timestamp: string;
  direction: 'push' | 'pull';
  count: number;
  status: 'success' | 'partial' | 'failed';
  errors?: string[];
}

// ─── Helpers ────────────────────────────────────────────────────

async function getPluginConfig(userId: string): Promise<NotionSyncConfig> {
  try {
    const [row] = await db
      .select()
      .from(schema.plugins)
      .where(eq(schema.plugins.slug, 'notion-sync'))
      .limit(1);
    
    if (row?.config) {
      return row.config as unknown as NotionSyncConfig;
    }
  } catch { /* table may not exist */ }
  
  return {
    syncDirection: 'push',
    autoSync: false,
    syncInterval: 60,
    syncedMemoryIds: [],
    totalSynced: 0,
    syncHistory: [],
  };
}

async function savePluginConfig(config: NotionSyncConfig) {
  try {
    const [existing] = await db
      .select()
      .from(schema.plugins)
      .where(eq(schema.plugins.slug, 'notion-sync'))
      .limit(1);
    
    if (existing) {
      await db
        .update(schema.plugins)
        .set({ config: config as any, updatedAt: new Date() })
        .where(eq(schema.plugins.slug, 'notion-sync'));
    } else {
      await db.insert(schema.plugins).values({
        slug: 'notion-sync',
        name: 'Notion Sync',
        version: '1.0.0',
        type: 'extension',
        status: 'active',
        config: config as any,
      });
    }
  } catch {
    // Auto-create plugins table if needed
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS plugins (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        version VARCHAR(50) DEFAULT '1.0.0',
        type VARCHAR(50) DEFAULT 'extension',
        status VARCHAR(50) DEFAULT 'active',
        config JSONB DEFAULT '{}',
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.insert(schema.plugins).values({
      slug: 'notion-sync',
      name: 'Notion Sync',
      version: '1.0.0',
      type: 'extension',
      status: 'active',
      config: config as any,
    });
  }
}

// ─── Notion API helpers ─────────────────────────────────────────

async function validateNotionToken(token: string): Promise<{ valid: boolean; workspaceName?: string; error?: string }> {
  try {
    const res = await fetch('https://api.notion.com/v1/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
      },
    });
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { valid: false, error: data.message || `HTTP ${res.status}` };
    }
    
    const data = await res.json();
    return { valid: true, workspaceName: data.name || data.bot?.owner?.workspace?.name || 'Unknown Workspace' };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Connection failed' };
  }
}

async function listNotionDatabases(token: string): Promise<Array<{ id: string; title: string }>> {
  try {
    const res = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: { value: 'database', property: 'object' },
        sort: { direction: 'descending', timestamp: 'last_edited_time' },
      }),
    });
    
    if (!res.ok) return [];
    
    const data = await res.json();
    return (data.results || []).map((db: any) => ({
      id: db.id,
      title: db.title?.[0]?.text?.content || db.title?.[0]?.plain_text || 'Untitled',
    }));
  } catch {
    return [];
  }
}

async function createNotionDatabase(token: string, parentPageId?: string): Promise<{ id: string; title: string } | null> {
  try {
    // Search for a page to use as parent if not provided
    let parentId = parentPageId;
    if (!parentId) {
      const res = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
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
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { type: 'page_id', page_id: parentId },
        title: [{ type: 'text', text: { content: 'MindStore Knowledge Base' } }],
        properties: {
          'Title': { title: {} },
          'Source': { select: { options: [
            { name: 'ChatGPT', color: 'green' },
            { name: 'File', color: 'blue' },
            { name: 'URL', color: 'orange' },
            { name: 'Text', color: 'default' },
            { name: 'Kindle', color: 'yellow' },
            { name: 'YouTube', color: 'red' },
            { name: 'Reddit', color: 'default' },
            { name: 'Obsidian', color: 'gray' },
          ]}},
          'Tags': { multi_select: { options: [] }},
          'Created': { date: {} },
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

async function pushMemoryToNotion(
  token: string,
  databaseId: string,
  memory: { id: number; content: string; sourceType: string; sourceTitle: string; createdAt: Date; metadata?: any }
): Promise<{ success: boolean; notionPageId?: string; error?: string }> {
  try {
    // Extract title from content
    const title = memory.sourceTitle ||
      memory.content.split('\n')[0].replace(/^#+\s*/, '').substring(0, 80) ||
      'Untitled Memory';

    // Split content into Notion blocks (max 2000 chars per block)
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

    // Cap blocks at 100 (Notion limit per request)
    const blocks = contentBlocks.slice(0, 100);

    const wordCount = memory.content.split(/\s+/).filter(Boolean).length;
    const tags = memory.metadata?.tags || [];

    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          'Title': {
            title: [{ type: 'text', text: { content: title.substring(0, 200) } }],
          },
          'Source': {
            select: { name: formatSourceType(memory.sourceType) },
          },
          'Tags': {
            multi_select: tags.slice(0, 10).map((t: string) => ({ name: t.substring(0, 100) })),
          },
          'Created': {
            date: { start: memory.createdAt.toISOString() },
          },
          'Word Count': {
            number: wordCount,
          },
          'MindStore ID': {
            rich_text: [{ type: 'text', text: { content: String(memory.id) } }],
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

function formatSourceType(type: string): string {
  const map: Record<string, string> = {
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
  return map[type] || 'Text';
}

// ─── GET Handler ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'config';

    const config = await getPluginConfig(userId);

    if (action === 'config') {
      // Check if token is set (don't return the actual token)
      const isConnected = !!config.apiToken;
      
      // Get databases if connected
      let databases: Array<{ id: string; title: string }> = [];
      if (isConnected && config.apiToken) {
        databases = await listNotionDatabases(config.apiToken);
      }

      return NextResponse.json({
        connected: isConnected,
        databaseId: config.databaseId || null,
        databaseName: config.databaseName || null,
        syncDirection: config.syncDirection,
        autoSync: config.autoSync,
        syncInterval: config.syncInterval,
        lastSyncAt: config.lastSyncAt || null,
        lastSyncCount: config.lastSyncCount || 0,
        totalSynced: config.totalSynced || 0,
        filterBySource: config.filterBySource || [],
        databases,
      });
    }

    if (action === 'history') {
      return NextResponse.json({
        history: (config.syncHistory || []).slice(0, 20),
      });
    }

    if (action === 'preview') {
      // Get memories that haven't been synced yet
      const syncedIds = new Set(config.syncedMemoryIds || []);
      
      const memories = await db
        .select({
          id: schema.memories.id,
          content: schema.memories.content,
          sourceType: schema.memories.sourceType,
          sourceTitle: schema.memories.sourceTitle,
          createdAt: schema.memories.createdAt,
        })
        .from(schema.memories)
        .where(eq(schema.memories.userId, userId))
        .orderBy(desc(schema.memories.createdAt))
        .limit(500);

      const unsynced = memories.filter(m => !syncedIds.has(String(m.id)));
      const sourceBreakdown: Record<string, number> = {};
      for (const m of unsynced) {
        const type = m.sourceType || 'text';
        sourceBreakdown[type] = (sourceBreakdown[type] || 0) + 1;
      }

      return NextResponse.json({
        totalMemories: memories.length,
        unsyncedCount: unsynced.length,
        syncedCount: syncedIds.size,
        sourceBreakdown,
        sample: unsynced.slice(0, 5).map(m => ({
          id: m.id,
          title: m.sourceTitle || m.content.split('\n')[0].substring(0, 60),
          sourceType: m.sourceType,
          createdAt: m.createdAt,
          preview: m.content.substring(0, 120),
        })),
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('Notion sync GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST Handler ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    const body = await req.json();
    const { action } = body;

    if (action === 'validate') {
      const { token } = body;
      if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });
      
      const result = await validateNotionToken(token);
      let databases: Array<{ id: string; title: string }> = [];
      if (result.valid) {
        databases = await listNotionDatabases(token);
      }
      
      return NextResponse.json({ ...result, databases });
    }

    if (action === 'save-config') {
      const config = await getPluginConfig(userId);
      
      if (body.token) config.apiToken = body.token;
      if (body.databaseId !== undefined) config.databaseId = body.databaseId;
      if (body.databaseName !== undefined) config.databaseName = body.databaseName;
      if (body.syncDirection !== undefined) config.syncDirection = body.syncDirection;
      if (body.autoSync !== undefined) config.autoSync = body.autoSync;
      if (body.syncInterval !== undefined) config.syncInterval = body.syncInterval;
      if (body.filterBySource !== undefined) config.filterBySource = body.filterBySource;
      
      await savePluginConfig(config);
      return NextResponse.json({ success: true });
    }

    if (action === 'create-database') {
      const config = await getPluginConfig(userId);
      if (!config.apiToken) return NextResponse.json({ error: 'Not connected to Notion' }, { status: 400 });
      
      const result = await createNotionDatabase(config.apiToken);
      if (!result) return NextResponse.json({ error: 'Failed to create database. Make sure your integration has access to at least one page.' }, { status: 400 });
      
      config.databaseId = result.id;
      config.databaseName = result.title;
      await savePluginConfig(config);
      
      return NextResponse.json({ success: true, database: result });
    }

    if (action === 'sync') {
      const config = await getPluginConfig(userId);
      if (!config.apiToken) return NextResponse.json({ error: 'Not connected to Notion' }, { status: 400 });
      if (!config.databaseId) return NextResponse.json({ error: 'No database selected' }, { status: 400 });

      // Get unsynced memories
      const syncedIds = new Set(config.syncedMemoryIds || []);
      
      let query = db
        .select({
          id: schema.memories.id,
          content: schema.memories.content,
          sourceType: schema.memories.sourceType,
          sourceTitle: schema.memories.sourceTitle,
          createdAt: schema.memories.createdAt,
          metadata: schema.memories.metadata,
        })
        .from(schema.memories)
        .where(eq(schema.memories.userId, userId))
        .orderBy(desc(schema.memories.createdAt))
        .limit(500);

      const allMemories = await query;
      let toSync = allMemories.filter(m => !syncedIds.has(String(m.id)));

      // Apply source filter if configured
      if (config.filterBySource && config.filterBySource.length > 0) {
        toSync = toSync.filter(m => config.filterBySource!.includes(m.sourceType || 'text'));
      }

      // Cap at 50 per sync to avoid rate limits
      const batch = toSync.slice(0, 50);
      
      let successCount = 0;
      const errors: string[] = [];
      const newSyncedIds = [...(config.syncedMemoryIds || [])];

      // Process in batches of 3 (Notion rate limit: 3 req/s)
      for (let i = 0; i < batch.length; i += 3) {
        const chunk = batch.slice(i, i + 3);
        const results = await Promise.allSettled(
          chunk.map(m => pushMemoryToNotion(config.apiToken!, config.databaseId!, m as any))
        );

        for (let j = 0; j < results.length; j++) {
          const result = results[j];
          if (result.status === 'fulfilled' && result.value.success) {
            successCount++;
            newSyncedIds.push(String(chunk[j].id));
          } else {
            const error = result.status === 'fulfilled'
              ? result.value.error || 'Unknown error'
              : (result.reason?.message || 'Failed');
            errors.push(`Memory ${chunk[j].id}: ${error}`);
          }
        }

        // Rate limit delay
        if (i + 3 < batch.length) {
          await new Promise(r => setTimeout(r, 400));
        }
      }

      // Update config
      const syncRecord: SyncRecord = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        direction: 'push',
        count: successCount,
        status: errors.length === 0 ? 'success' : successCount > 0 ? 'partial' : 'failed',
        errors: errors.slice(0, 5),
      };

      config.syncedMemoryIds = newSyncedIds;
      config.lastSyncAt = new Date().toISOString();
      config.lastSyncCount = successCount;
      config.totalSynced = (config.totalSynced || 0) + successCount;
      config.syncHistory = [syncRecord, ...(config.syncHistory || [])].slice(0, 50);
      
      await savePluginConfig(config);

      return NextResponse.json({
        success: true,
        synced: successCount,
        errors: errors.length,
        remaining: toSync.length - batch.length,
        record: syncRecord,
      });
    }

    if (action === 'disconnect') {
      const config = await getPluginConfig(userId);
      config.apiToken = undefined;
      config.databaseId = undefined;
      config.databaseName = undefined;
      config.syncedMemoryIds = [];
      config.totalSynced = 0;
      await savePluginConfig(config);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('Notion sync POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
