/**
 * Notion Enhanced Importer — Route (thin wrapper)
 *
 * POST with FormData:
 *   - file: Notion export ZIP
 *   - action: "preview" | "import"
 *
 * Logic delegated to src/server/plugins/ports/notion-importer.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/server/user';
import { db, schema } from '@/server/db';
import { eq, sql } from 'drizzle-orm';
import { generateEmbeddings } from '@/server/embeddings';
import { buildTreeIndex } from '@/server/retrieval';
import JSZip from 'jszip';
import {
  cleanNotionTitle,
  cleanNotionContent,
  parseCSV,
  databaseRowToContent,
  smartChunk,
  parseNotionExport,
  buildImportStats,
  stripCommonRoot,
} from '@/server/plugins/ports/notion-importer';

async function ensureInstalled() {
  try {
    const [existing] = await db.select().from(schema.plugins).where(eq(schema.plugins.slug, 'notion-importer')).limit(1);
    if (!existing) {
      await db.insert(schema.plugins).values({
        slug: 'notion-importer',
        name: 'Notion Import (Enhanced)',
        version: '1.0.0',
        type: 'extension',
        status: 'active',
        config: {},
      });
    }
  } catch {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS plugins (
          id SERIAL PRIMARY KEY, slug VARCHAR(255) UNIQUE NOT NULL, name VARCHAR(255) NOT NULL,
          version VARCHAR(50) DEFAULT '1.0.0', type VARCHAR(50) DEFAULT 'extension',
          status VARCHAR(50) DEFAULT 'active', config JSONB DEFAULT '{}',
          "createdAt" TIMESTAMP DEFAULT NOW(), "updatedAt" TIMESTAMP DEFAULT NOW()
        )
      `);
      await db.insert(schema.plugins).values({
        slug: 'notion-importer', name: 'Notion Import (Enhanced)',
        version: '1.0.0', type: 'extension', status: 'active', config: {},
      });
    } catch {}
  }
}

// ─── POST ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    await ensureInstalled();

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const action = (formData.get('action') as string) || 'import';

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const zip = await JSZip.loadAsync(buffer);

    // Extract all file contents from ZIP
    const allPaths = Object.keys(zip.files).filter(p =>
      !p.startsWith('__MACOSX/') && !p.startsWith('.') && !zip.files[p].dir
    );

    // Strip common root
    const { prefix: rootPrefix } = stripCommonRoot(allPaths);

    const fileContents = new Map<string, string>();
    for (const path of allPaths) {
      const relativePath = rootPrefix ? path.substring(rootPrefix.length) : path;
      if (!relativePath) continue;
      fileContents.set(relativePath, await zip.files[path].async('text'));
    }

    // Parse using port logic
    const { pages, databases } = parseNotionExport(fileContents);

    // ─── PREVIEW ─────────────────────────────────────────
    if (action === 'preview') {
      return NextResponse.json({ success: true, stats: buildImportStats(pages, databases) });
    }

    // ─── IMPORT ──────────────────────────────────────────
    if (action === 'import') {
      const allChunks: Array<{ content: string; sourceTitle: string; tags: string[] }> = [];

      for (const page of pages) {
        const chunks = smartChunk(page.content);
        const tags: string[] = [];
        if (page.type === 'database-page') tags.push('notion-database');
        if (page.parentPath) {
          const folderTag = page.parentPath.split('/').pop();
          if (folderTag) tags.push(cleanNotionTitle(folderTag));
        }
        for (let i = 0; i < chunks.length; i++) {
          const suffix = chunks.length > 1 ? ` (Part ${i + 1}/${chunks.length})` : '';
          allChunks.push({ content: chunks[i], sourceTitle: page.name + suffix, tags });
        }
      }

      const toImport = allChunks.slice(0, 500);
      const BATCH_SIZE = 50;
      let importedCount = 0;
      const memoryIds: any[] = [];

      for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
        const batch = toImport.slice(i, i + BATCH_SIZE);
        const inserted = await db.insert(schema.memories).values(
          batch.map(chunk => ({
            userId,
            content: chunk.content,
            sourceType: 'notion' as any,
            sourceTitle: chunk.sourceTitle,
            metadata: { tags: chunk.tags, importSource: 'notion-enhanced' },
          }))
        ).returning({ id: schema.memories.id });
        memoryIds.push(...inserted.map(r => r.id));
        importedCount += batch.length;
      }

      // Generate embeddings
      let embeddedCount = 0;
      for (let i = 0; i < memoryIds.length; i += BATCH_SIZE) {
        const batch = memoryIds.slice(i, i + BATCH_SIZE);
        const mems = await db.select({ id: schema.memories.id, content: schema.memories.content })
          .from(schema.memories).where(sql`${schema.memories.id} = ANY(${batch})`);
        try {
          const embeddings = await generateEmbeddings(mems.map(m => m.content));
          if (embeddings) {
            for (let j = 0; j < mems.length; j++) {
              if (embeddings[j]) {
                await db.update(schema.memories).set({ embedding: embeddings[j] }).where(eq(schema.memories.id, mems[j].id));
                embeddedCount++;
              }
            }
          }
        } catch (e) { console.error('Embedding generation failed:', e); }
      }

      try { await buildTreeIndex(userId); } catch {}

      return NextResponse.json({
        success: true, imported: importedCount, embedded: embeddedCount,
        pages: pages.filter(p => p.type === 'page').length,
        databaseRows: pages.filter(p => p.type === 'database-page').length,
        databases: databases.length,
        skipped: allChunks.length - toImport.length,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('Notion import error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
