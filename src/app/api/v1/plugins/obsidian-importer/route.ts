/**
 * Obsidian Vault Import — Plugin API Route (thin wrapper)
 *
 * POST /api/v1/plugins/obsidian-importer
 *   Body: FormData with:
 *     - file: ZIP of Obsidian vault
 *     - action: "preview" | "import" (default: "import")
 *
 * Logic delegated to src/server/plugins/ports/obsidian-importer.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/server/user';
import { db, schema } from '@/server/db';
import { eq, sql } from 'drizzle-orm';
import { generateEmbeddings } from '@/server/embeddings';
import { buildTreeIndex } from '@/server/retrieval';
import JSZip from 'jszip';
import {
  parseNote,
  analyzeVault,
  chunkNote,
  stripVaultRoot,
  type ObsidianNote,
} from '@/server/plugins/ports/obsidian-importer';

// ─── ZIP Extraction (route-level wiring) ────────────────────────

async function extractNotesFromZip(file: File): Promise<ObsidianNote[]> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const notes: ObsidianNote[] = [];
  const promises: Promise<void>[] = [];

  zip.forEach((relativePath, zipEntry) => {
    if (zipEntry.dir) return;
    if (relativePath.startsWith('.') || relativePath.includes('/.')) return;
    if (relativePath.startsWith('__MACOSX/')) return;
    if (!relativePath.toLowerCase().endsWith('.md')) return;
    if (relativePath.includes('.obsidian/') || relativePath.includes('.trash/')) return;

    promises.push(
      zipEntry.async('string').then((content) => {
        const note = parseNote(relativePath, content);
        if (note.content.trim().length > 0) notes.push(note);
      }),
    );
  });

  await Promise.all(promises);

  // Strip common vault root prefix
  stripVaultRoot(notes);

  notes.sort((a, b) => a.path.localeCompare(b.path));
  return notes;
}

// ─── POST Handler ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const action = (formData.get('action') as string) || 'import';

    if (!file) {
      return NextResponse.json({ error: 'No vault file uploaded' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      return NextResponse.json(
        { error: 'Please upload a ZIP of your Obsidian vault. In Finder/Explorer, right-click your vault folder → Compress/Send to ZIP.' },
        { status: 400 },
      );
    }

    let notes: ObsidianNote[];
    try {
      notes = await extractNotesFromZip(file);
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse ZIP file. Make sure it\'s a valid ZIP containing .md files.' },
        { status: 400 },
      );
    }

    if (notes.length === 0) {
      return NextResponse.json(
        { error: 'No markdown notes found in the ZIP. Make sure you zipped your vault folder containing .md files.' },
        { status: 404 },
      );
    }

    const vault = analyzeVault(notes);

    // Auto-install plugin
    let [plugin] = await db
      .select()
      .from(schema.plugins)
      .where(eq(schema.plugins.slug, 'obsidian-importer'))
      .limit(1);

    if (!plugin) {
      [plugin] = await db
        .insert(schema.plugins)
        .values({
          slug: 'obsidian-importer',
          name: 'Obsidian Vault Import',
          description: 'Import Obsidian vaults with wikilinks, tags, frontmatter, and graph structure.',
          version: '1.0.0',
          type: 'extension',
          status: 'active',
          icon: 'Gem',
          category: 'import',
          author: 'MindStore',
          config: {},
          metadata: {},
        })
        .returning();
    }

    if (plugin.status === 'disabled') {
      return NextResponse.json(
        { error: 'Obsidian Importer plugin is disabled. Enable it in the Plugins page.' },
        { status: 403 },
      );
    }

    // ─── Preview mode ─────────────────────────────────────────
    if (action === 'preview') {
      return NextResponse.json({
        stats: vault.stats,
        sampleNotes: vault.notes.slice(0, 8).map(n => ({
          name: n.name,
          folder: n.folder || 'Root',
          wordCount: n.wordCount,
          tags: n.tags.slice(0, 5),
          linkCount: n.wikilinks.length,
          hasBacklinks: vault.backlinks.has(n.name.toLowerCase()),
          preview: n.content.substring(0, 120).replace(/\n/g, ' '),
        })),
        graphPreview: {
          connectedNotes: vault.notes.length - vault.stats.orphanNotes,
          totalLinks: vault.stats.totalWikilinks,
          avgLinksPerNote: vault.notes.length > 0
            ? Math.round((vault.stats.totalWikilinks / vault.notes.length) * 10) / 10
            : 0,
        },
      });
    }

    // ─── Import mode ──────────────────────────────────────────
    const allChunks: { content: string; title: string; noteName: string; folder: string; tags: string[] }[] = [];
    for (const note of vault.notes) {
      const chunks = chunkNote(note);
      for (const chunk of chunks) {
        allChunks.push({ ...chunk, noteName: note.name, folder: note.folder, tags: note.tags });
      }
    }

    // Generate embeddings in batches
    let embeddings: number[][] | null = null;
    const MAX_EMBED_CHUNKS = 300;
    if (allChunks.length <= MAX_EMBED_CHUNKS) {
      try {
        const allEmbeddings: number[][] = [];
        for (let i = 0; i < allChunks.length; i += 50) {
          const batch = allChunks.slice(i, i + 50);
          const batchEmbeddings = await generateEmbeddings(batch.map(c => c.content));
          if (batchEmbeddings) allEmbeddings.push(...batchEmbeddings);
        }
        if (allEmbeddings.length === allChunks.length) embeddings = allEmbeddings;
      } catch (e) {
        console.error('Obsidian embeddings failed (non-fatal):', e);
      }
    }

    // Insert memories
    const noteMemoryIds = new Map<string, string[]>();
    let inserted = 0;
    const BATCH_SIZE = 20;

    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      const batch = allChunks.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (chunk, j) => {
        const idx = i + j;
        const embedding = embeddings?.[idx];
        const memId = crypto.randomUUID();

        const metadata: Record<string, unknown> = {};
        if (chunk.folder) metadata.folder = chunk.folder;
        if (chunk.tags.length > 0) metadata.tags = chunk.tags;
        const metaStr = JSON.stringify(metadata);

        if (embedding) {
          const embStr = `[${embedding.join(',')}]`;
          await db.execute(sql`
            INSERT INTO memories (id, user_id, content, embedding, source_type, source_title, metadata, tree_path, created_at, imported_at)
            VALUES (${memId}, ${userId}::uuid, ${chunk.content}, ${embStr}::vector, 'obsidian', ${chunk.title}, ${metaStr}::jsonb, ${chunk.folder || null}, NOW(), NOW())
          `);
        } else {
          await db.execute(sql`
            INSERT INTO memories (id, user_id, content, source_type, source_title, metadata, tree_path, created_at, imported_at)
            VALUES (${memId}, ${userId}::uuid, ${chunk.content}, 'obsidian', ${chunk.title}, ${metaStr}::jsonb, ${chunk.folder || null}, NOW(), NOW())
          `);
        }

        const existing = noteMemoryIds.get(chunk.noteName.toLowerCase()) || [];
        existing.push(memId);
        noteMemoryIds.set(chunk.noteName.toLowerCase(), existing);
        inserted++;
      }));
    }

    // Create wikilink connections
    let connectionsCreated = 0;
    const connectionPairs = new Set<string>();

    for (const note of vault.notes) {
      const sourceIds = noteMemoryIds.get(note.name.toLowerCase());
      if (!sourceIds?.length) continue;

      for (const link of note.wikilinks) {
        const targetIds = noteMemoryIds.get(link.toLowerCase());
        if (!targetIds?.length) continue;

        const pairKey = [sourceIds[0], targetIds[0]].sort().join(':');
        if (connectionPairs.has(pairKey)) continue;
        connectionPairs.add(pairKey);

        try {
          await db.execute(sql`
            INSERT INTO connections (id, user_id, memory_a_id, memory_b_id, similarity, bridge_concept, discovered_at)
            VALUES (${crypto.randomUUID()}, ${userId}::uuid, ${sourceIds[0]}::uuid, ${targetIds[0]}::uuid, 0.8, ${'wikilink'}, NOW())
            ON CONFLICT DO NOTHING
          `);
          connectionsCreated++;
        } catch { /* non-fatal */ }
      }
    }

    try { await buildTreeIndex(userId); } catch (e) { console.error('Tree index build failed (non-fatal):', e); }

    try {
      const { notifyImportComplete } = await import('@/server/notifications');
      await notifyImportComplete('obsidian-importer', 'Obsidian Vault', vault.notes.length, '/app/explore?source=obsidian');
    } catch { /* non-fatal */ }

    return NextResponse.json({
      imported: {
        totalNotes: vault.notes.length,
        totalChunks: inserted,
        embedded: embeddings?.length || 0,
        connections: connectionsCreated,
        tags: vault.stats.totalTags,
        stats: vault.stats,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Obsidian import error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
