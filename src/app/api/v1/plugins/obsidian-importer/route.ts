import JSZip from "jszip";
import { sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { generateEmbeddings } from "@/server/embeddings";
import { buildTreeIndex } from "@/server/retrieval";
import { getUserId } from "@/server/user";
import {
  analyzeVault,
  buildObsidianPreview,
  chunkAllNotes,
  ensureObsidianImporterReady,
  parseNote,
  stripVaultRoot,
  type ObsidianNote,
} from "@/server/plugins/ports/obsidian-importer";

async function extractNotesFromZip(file: File): Promise<ObsidianNote[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const notes: ObsidianNote[] = [];
  const tasks: Promise<void>[] = [];

  zip.forEach((relativePath, entry) => {
    if (entry.dir) return;
    if (relativePath.startsWith(".") || relativePath.includes("/.")) return;
    if (relativePath.startsWith("__MACOSX/")) return;
    if (!relativePath.toLowerCase().endsWith(".md")) return;
    if (relativePath.includes(".obsidian/") || relativePath.includes(".trash/")) return;

    tasks.push(entry.async("string").then((content) => {
      const note = parseNote(relativePath, content);
      if (note.content.trim().length > 0) {
        notes.push(note);
      }
    }));
  });

  await Promise.all(tasks);
  stripVaultRoot(notes);
  notes.sort((left, right) => left.path.localeCompare(right.path));
  return notes;
}

export async function POST(req: NextRequest) {
  try {
    await ensureObsidianImporterReady();

    const formData = await req.formData();
    const file = formData.get("file");
    const action = typeof formData.get("action") === "string" ? String(formData.get("action")) : "import";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No vault file uploaded" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json({
        error: "Please upload a ZIP of your Obsidian vault. Right-click your vault folder and compress it first.",
      }, { status: 400 });
    }

    let notes: ObsidianNote[];
    try {
      notes = await extractNotesFromZip(file);
    } catch {
      return NextResponse.json({
        error: "Failed to parse ZIP file. Make sure it's a valid ZIP containing .md files.",
      }, { status: 400 });
    }

    if (notes.length === 0) {
      return NextResponse.json({
        error: "No markdown notes found in the ZIP. Make sure you zipped your vault folder containing .md files.",
      }, { status: 404 });
    }

    const vault = analyzeVault(notes);

    if (action === "preview") {
      return NextResponse.json(buildObsidianPreview(vault));
    }

    const userId = await getUserId();
    const allChunks = chunkAllNotes(vault.notes);
    let embeddings: number[][] | null = null;

    if (allChunks.length <= 300) {
      try {
        const allEmbeddings: number[][] = [];
        for (let index = 0; index < allChunks.length; index += 50) {
          const batch = allChunks.slice(index, index + 50);
          const batchEmbeddings = await generateEmbeddings(batch.map((chunk) => chunk.content));
          if (batchEmbeddings) allEmbeddings.push(...batchEmbeddings);
        }
        if (allEmbeddings.length === allChunks.length) {
          embeddings = allEmbeddings;
        }
      } catch (error) {
        console.error("Obsidian embeddings failed (non-fatal):", error);
      }
    }

    const noteMemoryIds = new Map<string, string[]>();

    for (let start = 0; start < allChunks.length; start += 20) {
      const batch = allChunks.slice(start, start + 20);
      await Promise.all(batch.map(async (chunk, batchIndex) => {
        const globalIndex = start + batchIndex;
        const embedding = embeddings?.[globalIndex];
        const memoryId = crypto.randomUUID();
        const metadata = JSON.stringify({
          folder: chunk.folder || undefined,
          tags: chunk.tags.length > 0 ? chunk.tags : undefined,
          plugin: "obsidian-importer",
        });

        if (embedding) {
          const embeddingVector = `[${embedding.join(",")}]`;
          await db.execute(sql`
            INSERT INTO memories (id, user_id, content, embedding, source_type, source_title, metadata, tree_path, created_at, imported_at)
            VALUES (${memoryId}, ${userId}::uuid, ${chunk.content}, ${embeddingVector}::vector, 'obsidian', ${chunk.title}, ${metadata}::jsonb, ${chunk.folder || null}, NOW(), NOW())
          `);
        } else {
          await db.execute(sql`
            INSERT INTO memories (id, user_id, content, source_type, source_title, metadata, tree_path, created_at, imported_at)
            VALUES (${memoryId}, ${userId}::uuid, ${chunk.content}, 'obsidian', ${chunk.title}, ${metadata}::jsonb, ${chunk.folder || null}, NOW(), NOW())
          `);
        }

        const existing = noteMemoryIds.get(chunk.noteName.toLowerCase()) || [];
        existing.push(memoryId);
        noteMemoryIds.set(chunk.noteName.toLowerCase(), existing);
      }));
    }

    let connectionsCreated = 0;
    const connectionPairs = new Set<string>();

    for (const note of vault.notes) {
      const sourceIds = noteMemoryIds.get(note.name.toLowerCase());
      if (!sourceIds?.length) continue;

      for (const link of note.wikilinks) {
        const targetIds = noteMemoryIds.get(link.toLowerCase());
        if (!targetIds?.length) continue;

        const pairKey = [sourceIds[0], targetIds[0]].sort().join(":");
        if (connectionPairs.has(pairKey)) continue;
        connectionPairs.add(pairKey);

        try {
          await db.execute(sql`
            INSERT INTO connections (id, user_id, memory_a_id, memory_b_id, similarity, bridge_concept, discovered_at)
            VALUES (${crypto.randomUUID()}, ${userId}::uuid, ${sourceIds[0]}::uuid, ${targetIds[0]}::uuid, 0.8, ${"wikilink"}, NOW())
            ON CONFLICT DO NOTHING
          `);
          connectionsCreated += 1;
        } catch {
          continue;
        }
      }
    }

    try {
      await buildTreeIndex(userId);
    } catch (error) {
      console.error("Tree index build failed (non-fatal):", error);
    }

    return NextResponse.json({
      imported: {
        totalNotes: vault.notes.length,
        totalChunks: allChunks.length,
        embedded: embeddings?.length || 0,
        connections: connectionsCreated,
        tags: vault.stats.totalTags,
        stats: vault.stats,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("plugin is disabled") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
