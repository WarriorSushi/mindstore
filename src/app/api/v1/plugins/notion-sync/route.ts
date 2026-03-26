/**
 * Notion Sync Plugin — Route (thin wrapper)
 *
 * GET  ?action=config       — Get sync configuration + status
 * GET  ?action=history      — Get sync history
 * GET  ?action=preview      — Preview what would sync
 * POST action=save-config   — Save Notion API token + database config
 * POST action=sync          — Run a sync (push memories to Notion)
 * POST action=disconnect    — Remove Notion connection
 * POST action=validate      — Validate API token
 * POST action=create-database — Create MindStore database in Notion
 *
 * Logic delegated to src/server/plugins/ports/notion-sync.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/server/user';
import { db, schema } from '@/server/db';
import { eq, desc } from 'drizzle-orm';
import {
  type NotionSyncConfig,
  type MemoryForSync,
  defaultSyncConfig,
  validateNotionToken,
  listNotionDatabases,
  createNotionDatabase,
  filterUnsyncedMemories,
  pushBatch,
  buildSyncRecord,
} from '@/server/plugins/ports/notion-sync';

// ─── Config Storage ──────────────────────────────────────────

async function getPluginConfig(userId: string): Promise<NotionSyncConfig> {
  try {
    const [row] = await db.select().from(schema.plugins).where(eq(schema.plugins.slug, 'notion-sync')).limit(1);
    if (row?.config) return row.config as unknown as NotionSyncConfig;
  } catch {}
  return defaultSyncConfig();
}

async function savePluginConfig(config: NotionSyncConfig) {
  const [existing] = await db.select().from(schema.plugins).where(eq(schema.plugins.slug, 'notion-sync')).limit(1);
  if (existing) {
    await db.update(schema.plugins).set({ config: config as any, updatedAt: new Date() }).where(eq(schema.plugins.slug, 'notion-sync'));
  } else {
    await db.insert(schema.plugins).values({
      slug: 'notion-sync', name: 'Notion Sync', version: '1.0.0',
      type: 'extension', status: 'active', config: config as any,
    });
  }
}

/** Load user memories (up to 500) for sync preview/execution. */
async function loadUserMemories(userId: string): Promise<MemoryForSync[]> {
  const rows = await db.select({
    id: schema.memories.id, content: schema.memories.content,
    sourceType: schema.memories.sourceType, sourceTitle: schema.memories.sourceTitle,
    createdAt: schema.memories.createdAt, metadata: schema.memories.metadata,
  }).from(schema.memories).where(eq(schema.memories.userId, userId))
    .orderBy(desc(schema.memories.createdAt)).limit(500);
  return rows as unknown as MemoryForSync[];
}

// ─── GET ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'config';
    const config = await getPluginConfig(userId);

    if (action === 'config') {
      let databases: Array<{ id: string; title: string }> = [];
      if (config.apiToken) databases = await listNotionDatabases(config.apiToken);
      return NextResponse.json({
        connected: !!config.apiToken,
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
      return NextResponse.json({ history: (config.syncHistory || []).slice(0, 20) });
    }

    if (action === 'preview') {
      const syncedIds = new Set(config.syncedMemoryIds || []);
      const memories = await loadUserMemories(userId);
      const unsynced = filterUnsyncedMemories(memories, syncedIds);

      const sourceBreakdown: Record<string, number> = {};
      for (const m of unsynced) sourceBreakdown[m.sourceType || 'text'] = (sourceBreakdown[m.sourceType || 'text'] || 0) + 1;

      return NextResponse.json({
        totalMemories: memories.length, unsyncedCount: unsynced.length,
        syncedCount: syncedIds.size, sourceBreakdown,
        sample: unsynced.slice(0, 5).map(m => ({
          id: m.id, title: m.sourceTitle || m.content.split('\n')[0].substring(0, 60),
          sourceType: m.sourceType, createdAt: m.createdAt, preview: m.content.substring(0, 120),
        })),
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('Notion sync GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST ────────────────────────────────────────────────────

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
      if (result.valid) databases = await listNotionDatabases(token);
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

      const syncedIds = new Set(config.syncedMemoryIds || []);
      const allMemories = await loadUserMemories(userId);
      const toSync = filterUnsyncedMemories(allMemories, syncedIds, config.filterBySource);
      const { successCount, errors, syncedIds: newIds } = await pushBatch(config.apiToken, config.databaseId, toSync, 50);

      const syncRecord = buildSyncRecord(successCount, errors);
      config.syncedMemoryIds = [...(config.syncedMemoryIds || []), ...newIds];
      config.lastSyncAt = new Date().toISOString();
      config.lastSyncCount = successCount;
      config.totalSynced = (config.totalSynced || 0) + successCount;
      config.syncHistory = [syncRecord, ...(config.syncHistory || [])].slice(0, 50);
      await savePluginConfig(config);

      return NextResponse.json({
        success: true, synced: successCount, errors: errors.length,
        remaining: toSync.length - Math.min(toSync.length, 50), record: syncRecord,
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
