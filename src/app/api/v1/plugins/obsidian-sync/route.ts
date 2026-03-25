/**
 * Obsidian Vault Sync Plugin — Route (thin wrapper)
 *
 * GET  ?action=config       — Get sync configuration
 * GET  ?action=preview      — Preview export
 * POST action=save-config   — Save sync settings
 * POST action=export        — Generate vault ZIP for download
 *
 * Logic delegated to src/server/plugins/ports/obsidian-sync.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/server/user';
import { db, schema } from '@/server/db';
import { eq, sql, desc } from 'drizzle-orm';
import JSZip from 'jszip';
import {
  type ObsidianSyncConfig,
  type SyncRecord,
  defaultSyncConfig,
  slugify,
  getMemoryFolder,
  memoryToMarkdown,
  buildVaultFileMap,
  buildExportPreview,
  buildExportSyncRecord,
} from '@/server/plugins/ports/obsidian-sync';

// ─── Config Storage ──────────────────────────────────────────

async function getPluginConfig(userId: string): Promise<ObsidianSyncConfig> {
  try {
    const [row] = await db.select().from(schema.plugins).where(eq(schema.plugins.slug, 'obsidian-sync')).limit(1);
    if (row?.config) return row.config as unknown as ObsidianSyncConfig;
  } catch {}
  return defaultSyncConfig();
}

async function savePluginConfig(config: ObsidianSyncConfig) {
  try {
    const [existing] = await db.select().from(schema.plugins).where(eq(schema.plugins.slug, 'obsidian-sync')).limit(1);
    if (existing) {
      await db.update(schema.plugins).set({ config: config as any, updatedAt: new Date() }).where(eq(schema.plugins.slug, 'obsidian-sync'));
    } else {
      await db.insert(schema.plugins).values({
        slug: 'obsidian-sync', name: 'Obsidian Vault Sync', version: '1.0.0',
        type: 'extension', status: 'active', config: config as any,
      });
    }
  } catch {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS plugins (
        id SERIAL PRIMARY KEY, slug VARCHAR(255) UNIQUE NOT NULL, name VARCHAR(255) NOT NULL,
        version VARCHAR(50) DEFAULT '1.0.0', type VARCHAR(50) DEFAULT 'extension',
        status VARCHAR(50) DEFAULT 'active', config JSONB DEFAULT '{}',
        "createdAt" TIMESTAMP DEFAULT NOW(), "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.insert(schema.plugins).values({
      slug: 'obsidian-sync', name: 'Obsidian Vault Sync', version: '1.0.0',
      type: 'extension', status: 'active', config: config as any,
    });
  }
}

// ─── GET ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'config';
    const config = await getPluginConfig(userId);

    if (action === 'config') {
      return NextResponse.json({ ...config, apiToken: undefined });
    }

    if (action === 'preview') {
      const memories = await db.select({
        id: schema.memories.id, sourceType: schema.memories.sourceType,
        sourceTitle: schema.memories.sourceTitle, content: schema.memories.content,
        createdAt: schema.memories.createdAt,
      }).from(schema.memories).where(eq(schema.memories.userId, userId))
        .orderBy(desc(schema.memories.createdAt)).limit(1000);

      return NextResponse.json(buildExportPreview(memories as any, config));
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('Obsidian sync GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'save-config') {
      const config = await getPluginConfig(userId);
      if (body.vaultName !== undefined) config.vaultName = body.vaultName;
      if (body.folderStructure !== undefined) config.folderStructure = body.folderStructure;
      if (body.includeMetadata !== undefined) config.includeMetadata = body.includeMetadata;
      if (body.includeTags !== undefined) config.includeTags = body.includeTags;
      if (body.includeBacklinks !== undefined) config.includeBacklinks = body.includeBacklinks;
      if (body.includeWikilinks !== undefined) config.includeWikilinks = body.includeWikilinks;
      if (body.frontmatterStyle !== undefined) config.frontmatterStyle = body.frontmatterStyle;
      if (body.filterBySource !== undefined) config.filterBySource = body.filterBySource;
      await savePluginConfig(config);
      return NextResponse.json({ success: true });
    }

    if (action === 'export') {
      const config = await getPluginConfig(userId);

      const memories = await db.select().from(schema.memories)
        .where(eq(schema.memories.userId, userId))
        .orderBy(desc(schema.memories.createdAt)).limit(2000);

      let filtered = memories;
      if (config.filterBySource?.length) {
        filtered = memories.filter(m => config.filterBySource!.includes(m.sourceType || 'text'));
      }

      // Fetch connections for backlinks
      let connections: any[] = [];
      if (config.includeBacklinks || config.includeWikilinks) {
        try {
          connections = await db.select().from(schema.connections)
            .where(eq(schema.connections.userId, userId)).limit(5000);
        } catch {}
      }

      // Build ZIP using port logic
      const fileMap = buildVaultFileMap(filtered as any, connections, config);
      const zip = new JSZip();
      const vaultFolder = zip.folder(config.vaultName || 'MindStore')!;

      for (const [path, content] of fileMap) {
        vaultFolder.file(path, content);
      }

      // Add .obsidian config
      const obsidianFolder = vaultFolder.folder('.obsidian')!;
      obsidianFolder.file('app.json', JSON.stringify({ showViewHeader: true, alwaysUpdateLinks: true }, null, 2));
      obsidianFolder.file('appearance.json', JSON.stringify({ baseFontSize: 16, theme: 'obsidian' }, null, 2));

      // Add README
      vaultFolder.file('README.md', `# ${config.vaultName || 'MindStore'} Vault

Exported from MindStore on ${new Date().toISOString().split('T')[0]}.

## Stats
- **Memories exported:** ${filtered.length}
- **Folder structure:** ${config.folderStructure}
- **Frontmatter:** ${config.frontmatterStyle === 'yaml' ? 'YAML' : 'None'}
- **Tags included:** ${config.includeTags ? 'Yes' : 'No'}
- **Wikilinks:** ${config.includeWikilinks ? 'Yes' : 'No'}

## How to Use
1. Extract this ZIP to your Obsidian vaults directory
2. Open Obsidian → "Open folder as vault"
3. Your MindStore knowledge is now searchable in Obsidian!
`);

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      // Update config with sync record
      config.lastExportAt = new Date().toISOString();
      config.exportCount = (config.exportCount || 0) + 1;
      config.exportedMemoryIds = filtered.map(m => String(m.id));
      config.syncHistory = [buildExportSyncRecord(filtered.length), ...(config.syncHistory || [])].slice(0, 50);
      await savePluginConfig(config);

      return new Response(new Uint8Array(zipBuffer), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${config.vaultName || 'MindStore'}-vault.zip"`,
        },
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('Obsidian sync POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
