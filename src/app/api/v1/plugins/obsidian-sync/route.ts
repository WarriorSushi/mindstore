/**
 * Obsidian Vault Sync Plugin — API Route
 *
 * Two-way sync between MindStore and an Obsidian vault.
 * Export memories as markdown files for Obsidian, import changes back.
 *
 * GET  ?action=config       — Get sync configuration
 * GET  ?action=preview      — Preview export (what would be synced)
 * GET  ?action=download     — Download vault as ZIP
 * POST action=save-config   — Save sync settings
 * POST action=export        — Generate vault ZIP for download
 * POST action=import        — Upload modified vault ZIP to sync back
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/server/user';
import { db, schema } from '@/server/db';
import { eq, sql, desc } from 'drizzle-orm';
import JSZip from 'jszip';

// ─── Types ──────────────────────────────────────────────────────

interface ObsidianSyncConfig {
  vaultName: string;
  folderStructure: 'flat' | 'by-source' | 'by-date' | 'by-topic';
  includeMetadata: boolean;
  includeTags: boolean;
  includeBacklinks: boolean;
  includeWikilinks: boolean;
  frontmatterStyle: 'yaml' | 'none';
  filterBySource?: string[];
  lastExportAt?: string;
  lastImportAt?: string;
  exportCount?: number;
  importCount?: number;
  exportedMemoryIds?: string[];
  syncHistory?: SyncRecord[];
}

interface SyncRecord {
  id: string;
  timestamp: string;
  direction: 'export' | 'import';
  count: number;
  status: 'success' | 'partial' | 'failed';
}

// ─── Helpers ────────────────────────────────────────────────────

async function getPluginConfig(userId: string): Promise<ObsidianSyncConfig> {
  try {
    const [row] = await db
      .select()
      .from(schema.plugins)
      .where(eq(schema.plugins.slug, 'obsidian-sync'))
      .limit(1);
    
    if (row?.config) {
      return row.config as unknown as ObsidianSyncConfig;
    }
  } catch { /* table may not exist */ }
  
  return {
    vaultName: 'MindStore',
    folderStructure: 'by-source',
    includeMetadata: true,
    includeTags: true,
    includeBacklinks: true,
    includeWikilinks: true,
    frontmatterStyle: 'yaml',
    exportedMemoryIds: [],
    syncHistory: [],
  };
}

async function savePluginConfig(config: ObsidianSyncConfig) {
  try {
    const [existing] = await db
      .select()
      .from(schema.plugins)
      .where(eq(schema.plugins.slug, 'obsidian-sync'))
      .limit(1);
    
    if (existing) {
      await db
        .update(schema.plugins)
        .set({ config: config as any, updatedAt: new Date() })
        .where(eq(schema.plugins.slug, 'obsidian-sync'));
    } else {
      await db.insert(schema.plugins).values({
        slug: 'obsidian-sync',
        name: 'Obsidian Vault Sync',
        version: '1.0.0',
        type: 'extension',
        status: 'active',
        config: config as any,
      });
    }
  } catch {
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
      slug: 'obsidian-sync',
      name: 'Obsidian Vault Sync',
      version: '1.0.0',
      type: 'extension',
      status: 'active',
      config: config as any,
    });
  }
}

// ─── Markdown Generation ────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100)
    .replace(/(^-|-$)/g, '') || 'untitled';
}

function memoryToMarkdown(
  memory: any,
  config: ObsidianSyncConfig,
  allMemories: any[],
  connections: any[]
): string {
  const parts: string[] = [];
  
  // ─── YAML Frontmatter ───────────────────────────────────
  if (config.frontmatterStyle === 'yaml') {
    const title = memory.sourceTitle || memory.content.split('\n')[0].replace(/^#+\s*/, '').substring(0, 80) || 'Untitled';
    const tags = memory.metadata?.tags || [];
    const sourceType = memory.sourceType || 'text';
    
    parts.push('---');
    parts.push(`title: "${title.replace(/"/g, '\\"')}"`);
    parts.push(`source: ${sourceType}`);
    if (memory.sourceTitle) parts.push(`source_title: "${memory.sourceTitle.replace(/"/g, '\\"')}"`);
    parts.push(`created: ${memory.createdAt.toISOString()}`);
    parts.push(`mindstore_id: ${memory.id}`);
    
    if (config.includeTags && tags.length > 0) {
      parts.push('tags:');
      for (const tag of tags) {
        parts.push(`  - ${tag}`);
      }
    }
    
    if (config.includeMetadata) {
      const wordCount = memory.content.split(/\s+/).filter(Boolean).length;
      parts.push(`word_count: ${wordCount}`);
      if (memory.metadata?.pinned) parts.push('pinned: true');
      if (memory.metadata?.language) parts.push(`language: ${memory.metadata.language}`);
      if (memory.metadata?.domain) parts.push(`domain: ${memory.metadata.domain}`);
    }
    
    parts.push('---');
    parts.push('');
  }
  
  // ─── Content ────────────────────────────────────────────
  parts.push(memory.content);
  
  // ─── Backlinks / Wikilinks ──────────────────────────────
  if (config.includeBacklinks || config.includeWikilinks) {
    const relatedIds = connections
      .filter(c => c.memoryAId === memory.id || c.memoryBId === memory.id)
      .map(c => c.memoryAId === memory.id ? c.memoryBId : c.memoryAId);
    
    if (relatedIds.length > 0) {
      parts.push('');
      parts.push('---');
      parts.push('## Related');
      
      for (const relId of relatedIds.slice(0, 10)) {
        const related = allMemories.find(m => m.id === relId);
        if (related) {
          const relTitle = related.sourceTitle || related.content.split('\n')[0].substring(0, 60) || 'Untitled';
          if (config.includeWikilinks) {
            parts.push(`- [[${slugify(relTitle)}|${relTitle}]]`);
          } else {
            parts.push(`- ${relTitle}`);
          }
        }
      }
    }
  }
  
  return parts.join('\n');
}

function getMemoryFolder(memory: any, structure: string): string {
  switch (structure) {
    case 'by-source': {
      const sourceMap: Record<string, string> = {
        chatgpt: 'ChatGPT',
        file: 'Files',
        url: 'URLs',
        text: 'Notes',
        kindle: 'Kindle',
        youtube: 'YouTube',
        reddit: 'Reddit',
        obsidian: 'Obsidian',
        document: 'Documents',
        audio: 'Audio',
        image: 'Images',
      };
      return sourceMap[memory.sourceType || 'text'] || 'Other';
    }
    case 'by-date': {
      const date = new Date(memory.createdAt);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${year}/${year}-${month}`;
    }
    case 'flat':
    default:
      return '';
  }
}

// ─── GET Handler ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'config';

    const config = await getPluginConfig(userId);

    if (action === 'config') {
      return NextResponse.json({
        ...config,
        apiToken: undefined, // Don't expose
      });
    }

    if (action === 'preview') {
      const memories = await db
        .select({
          id: schema.memories.id,
          sourceType: schema.memories.sourceType,
          sourceTitle: schema.memories.sourceTitle,
          content: schema.memories.content,
          createdAt: schema.memories.createdAt,
        })
        .from(schema.memories)
        .where(eq(schema.memories.userId, userId))
        .orderBy(desc(schema.memories.createdAt))
        .limit(1000);

      // Apply source filter
      let filtered = memories;
      if (config.filterBySource && config.filterBySource.length > 0) {
        filtered = memories.filter(m => config.filterBySource!.includes(m.sourceType || 'text'));
      }

      // Source breakdown
      const sourceBreakdown: Record<string, number> = {};
      for (const m of filtered) {
        const type = m.sourceType || 'text';
        sourceBreakdown[type] = (sourceBreakdown[type] || 0) + 1;
      }

      // Folder preview
      const folders: Record<string, number> = {};
      for (const m of filtered) {
        const folder = getMemoryFolder(m, config.folderStructure);
        const key = folder || '(root)';
        folders[key] = (folders[key] || 0) + 1;
      }

      // Total words
      const totalWords = filtered.reduce((sum, m) => sum + m.content.split(/\s+/).filter(Boolean).length, 0);

      return NextResponse.json({
        totalMemories: memories.length,
        filteredCount: filtered.length,
        sourceBreakdown,
        folders,
        totalWords,
        sample: filtered.slice(0, 5).map(m => ({
          id: m.id,
          title: m.sourceTitle || m.content.split('\n')[0].substring(0, 60),
          sourceType: m.sourceType,
          folder: getMemoryFolder(m, config.folderStructure),
        })),
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('Obsidian sync GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST Handler ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    
    const contentType = req.headers.get('content-type') || '';
    
    // Handle JSON requests
    if (contentType.includes('application/json')) {
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
        
        // Fetch all memories
        const memories = await db
          .select()
          .from(schema.memories)
          .where(eq(schema.memories.userId, userId))
          .orderBy(desc(schema.memories.createdAt))
          .limit(2000);

        // Apply source filter
        let filtered = memories;
        if (config.filterBySource && config.filterBySource.length > 0) {
          filtered = memories.filter(m => config.filterBySource!.includes(m.sourceType || 'text'));
        }

        // Fetch connections
        let connections: any[] = [];
        if (config.includeBacklinks || config.includeWikilinks) {
          try {
            connections = await db
              .select()
              .from(schema.connections)
              .where(eq(schema.connections.userId, userId))
              .limit(5000);
          } catch { /* connections table may not exist */ }
        }

        // Build ZIP
        const zip = new JSZip();
        const vaultFolder = zip.folder(config.vaultName || 'MindStore')!;
        const usedNames = new Set<string>();

        for (const memory of filtered) {
          const folder = getMemoryFolder(memory, config.folderStructure);
          const title = memory.sourceTitle || memory.content.split('\n')[0].replace(/^#+\s*/, '').substring(0, 80) || 'Untitled';
          let filename = slugify(title);
          
          // Ensure unique filenames
          let counter = 1;
          let fullPath = folder ? `${folder}/${filename}.md` : `${filename}.md`;
          while (usedNames.has(fullPath)) {
            filename = `${slugify(title)}-${counter++}`;
            fullPath = folder ? `${folder}/${filename}.md` : `${filename}.md`;
          }
          usedNames.add(fullPath);

          const markdown = memoryToMarkdown(memory, config, filtered, connections);
          
          if (folder) {
            const subFolder = vaultFolder.folder(folder)!;
            subFolder.file(`${filename}.md`, markdown);
          } else {
            vaultFolder.file(`${filename}.md`, markdown);
          }
        }

        // Add .obsidian config for vault recognition
        const obsidianFolder = vaultFolder.folder('.obsidian')!;
        obsidianFolder.file('app.json', JSON.stringify({
          showViewHeader: true,
          alwaysUpdateLinks: true,
        }, null, 2));
        obsidianFolder.file('appearance.json', JSON.stringify({
          baseFontSize: 16,
          theme: 'obsidian',
        }, null, 2));

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
2. Open Obsidian → "Open folder as vault" → select the \`${config.vaultName || 'MindStore'}\` folder
3. Your MindStore knowledge is now searchable in Obsidian!

## Re-importing Changes
Edit any note in Obsidian, then re-export to MindStore via the Obsidian Sync plugin.
`);

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

        // Update config
        config.lastExportAt = new Date().toISOString();
        config.exportCount = (config.exportCount || 0) + 1;
        config.exportedMemoryIds = filtered.map(m => String(m.id));
        config.syncHistory = [{
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          direction: 'export' as const,
          count: filtered.length,
          status: 'success' as const,
        }, ...(config.syncHistory || [])].slice(0, 50);
        
        await savePluginConfig(config);

        const zipUint8 = new Uint8Array(zipBuffer);

        return new Response(zipUint8, {
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${config.vaultName || 'MindStore'}-vault.zip"`,
          },
        });
      }

      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
  } catch (err: any) {
    console.error('Obsidian sync POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
