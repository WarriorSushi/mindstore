import JSZip from "jszip";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";
import { generateEmbeddings } from "@/server/embeddings";
import { buildTreeIndex } from "@/server/retrieval";
import { assertPluginEnabled } from "@/server/plugins/ports/plugin-config";

const PLUGIN_SLUG = "obsidian-importer";

export interface ObsidianNote {
  path: string;
  name: string;
  folder: string;
  content: string;
  rawContent: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
  aliases: string[];
  wikilinks: string[];
  headings: Array<{ level: number; text: string; position: number }>;
  wordCount: number;
  createdDate?: string;
}

export interface ParsedVault {
  notes: ObsidianNote[];
  stats: {
    totalNotes: number;
    totalWords: number;
    totalTags: number;
    totalWikilinks: number;
    totalFolders: number;
    uniqueTags: string[];
    topTags: Array<{ tag: string; count: number }>;
    topFolders: Array<{ path: string; count: number }>;
    orphanNotes: number;
    mostLinked: Array<{ name: string; inLinks: number }>;
    dateRange: { oldest: string | null; newest: string | null };
  };
  linkGraph: Map<string, string[]>;
  backlinks: Map<string, string[]>;
}

export function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const frontmatter: Record<string, unknown> = {};
  const yaml = match[1];
  let currentKey = "";
  let inArray = false;
  const values: string[] = [];

  for (const line of yaml.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (inArray && trimmed.startsWith("- ")) {
      values.push(trimmed.slice(2).trim().replace(/^['"]|['"]$/g, ""));
      continue;
    }

    if (inArray) {
      frontmatter[currentKey] = [...values];
      inArray = false;
      values.length = 0;
    }

    const matchKey = trimmed.match(/^([a-zA-Z_-]+)\s*:\s*(.*)$/);
    if (!matchKey) continue;

    const key = matchKey[1].toLowerCase();
    const value = matchKey[2].trim();

    if (value === "" || value === "[]") {
      currentKey = key;
      inArray = true;
      values.length = 0;
      continue;
    }

    if (value.startsWith("[") && value.endsWith("]")) {
      frontmatter[key] = value
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);
      continue;
    }

    if (value === "true" || value === "false") {
      frontmatter[key] = value === "true";
      continue;
    }

    if (/^\d+(\.\d+)?$/.test(value)) {
      frontmatter[key] = Number.parseFloat(value);
      continue;
    }

    frontmatter[key] = value.replace(/^['"]|['"]$/g, "");
  }

  if (inArray && values.length > 0) {
    frontmatter[currentKey] = [...values];
  }

  return { frontmatter, body: match[2] };
}

export function extractWikilinks(content: string) {
  const links: string[] = [];
  const regex = /(?<!!)\[\[([^\]|#]+?)(?:\|[^\]]+?)?\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const link = match[1].trim();
    if (link && !links.includes(link)) links.push(link);
  }
  return links;
}

export function extractInlineTags(content: string) {
  const tags: string[] = [];
  const regex = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_/-]*)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const tag = match[1].toLowerCase();
    if (!tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

export function extractHeadings(content: string) {
  const headings: Array<{ level: number; text: string; position: number }> = [];
  const lines = content.split("\n");
  let position = 0;
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        position,
      });
    }
    position += line.length + 1;
  }
  return headings;
}

export function parseNote(path: string, rawContent: string): ObsidianNote {
  const parts = path.split("/");
  const fileName = parts[parts.length - 1];
  const name = fileName.replace(/\.md$/i, "");
  const folder = parts.slice(0, -1).join("/") || "";
  const { frontmatter, body } = parseFrontmatter(rawContent);

  const frontmatterTags = Array.isArray(frontmatter.tags)
    ? (frontmatter.tags as string[]).map((tag) => String(tag).toLowerCase().replace(/^#/, ""))
    : typeof frontmatter.tags === "string"
      ? [frontmatter.tags.toLowerCase().replace(/^#/, "")]
      : [];

  const tags = [...new Set([...frontmatterTags, ...extractInlineTags(body)])];
  const aliases = Array.isArray(frontmatter.aliases)
    ? (frontmatter.aliases as string[]).map(String)
    : typeof frontmatter.aliases === "string"
      ? [frontmatter.aliases]
      : [];

  const createdDate = (
    frontmatter.created
    || frontmatter.date
    || frontmatter["date created"]
  ) as string | undefined;

  return {
    path,
    name,
    folder,
    content: body.trim(),
    rawContent,
    frontmatter,
    tags,
    aliases,
    wikilinks: extractWikilinks(body),
    headings: extractHeadings(body),
    wordCount: body.split(/\s+/).filter(Boolean).length,
    createdDate: createdDate ? String(createdDate) : undefined,
  };
}

export function stripVaultRoot(notes: ObsidianNote[]) {
  if (notes.length === 0) return;
  const firstSlash = notes[0].path.indexOf("/");
  if (firstSlash <= 0) return;

  const prefix = notes[0].path.substring(0, firstSlash + 1);
  if (!notes.every((note) => note.path.startsWith(prefix))) return;

  for (const note of notes) {
    note.path = note.path.substring(prefix.length);
    note.folder = note.path.split("/").slice(0, -1).join("/") || "";
  }
}

export function analyzeVault(notes: ObsidianNote[]): ParsedVault {
  const linkGraph = new Map<string, string[]>();
  const backlinks = new Map<string, string[]>();
  const noteNames = new Set(notes.map((note) => note.name.toLowerCase()));
  const aliasMap = new Map<string, string>();

  for (const note of notes) {
    for (const alias of note.aliases) {
      aliasMap.set(alias.toLowerCase(), note.name.toLowerCase());
    }
  }

  for (const note of notes) {
    const outgoing: string[] = [];
    for (const link of note.wikilinks) {
      const lower = link.toLowerCase();
      const resolved = noteNames.has(lower) ? lower : aliasMap.get(lower) || null;
      if (resolved) {
        outgoing.push(resolved);
        const existing = backlinks.get(resolved) || [];
        if (!existing.includes(note.name.toLowerCase())) {
          existing.push(note.name.toLowerCase());
          backlinks.set(resolved, existing);
        }
      }
    }
    linkGraph.set(note.name.toLowerCase(), outgoing);
  }

  const tagCounts = new Map<string, number>();
  const folderCounts = new Map<string, number>();
  let totalWords = 0;
  let totalWikilinks = 0;

  for (const note of notes) {
    totalWords += note.wordCount;
    totalWikilinks += note.wikilinks.length;
    for (const tag of note.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
    const topFolder = note.folder.split("/")[0] || "Root";
    folderCounts.set(topFolder, (folderCounts.get(topFolder) || 0) + 1);
  }

  const allFolders = new Set<string>();
  for (const note of notes) {
    if (note.folder) {
      const parts = note.folder.split("/");
      for (let index = 0; index < parts.length; index += 1) {
        allFolders.add(parts.slice(0, index + 1).join("/"));
      }
    }
  }

  let orphanNotes = 0;
  for (const note of notes) {
    const lower = note.name.toLowerCase();
    if ((linkGraph.get(lower)?.length || 0) === 0 && (backlinks.get(lower)?.length || 0) === 0) {
      orphanNotes += 1;
    }
  }

  const dates = notes
    .map((note) => note.createdDate)
    .filter(Boolean)
    .map((date) => new Date(date!))
    .filter((date) => !Number.isNaN(date.getTime()));

  return {
    notes,
    linkGraph,
    backlinks,
    stats: {
      totalNotes: notes.length,
      totalWords,
      totalTags: tagCounts.size,
      totalWikilinks,
      totalFolders: allFolders.size,
      uniqueTags: [...tagCounts.entries()].sort((left, right) => right[1] - left[1]).map(([tag]) => tag),
      topTags: [...tagCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 15)
        .map(([tag, count]) => ({ tag, count })),
      topFolders: [...folderCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 10)
        .map(([path, count]) => ({ path, count })),
      orphanNotes,
      mostLinked: [...backlinks.entries()]
        .map(([name, links]) => ({ name, inLinks: links.length }))
        .sort((left, right) => right.inLinks - left.inLinks)
        .slice(0, 8),
      dateRange: {
        oldest: dates.length > 0 ? new Date(Math.min(...dates.map((date) => date.getTime()))).toISOString().split("T")[0] : null,
        newest: dates.length > 0 ? new Date(Math.max(...dates.map((date) => date.getTime()))).toISOString().split("T")[0] : null,
      },
    },
  };
}

export function formatNoteContent(note: ObsidianNote) {
  const parts = [`# ${note.name}`];
  const meta: string[] = [];

  if (note.folder) meta.push(`📁 ${note.folder}`);
  if (note.tags.length > 0) meta.push(note.tags.map((tag) => `#${tag}`).join(" "));
  if (note.createdDate) meta.push(`📅 ${note.createdDate}`);
  if (meta.length > 0) parts.push(meta.join(" · "));
  if (note.aliases.length > 0) parts.push(`**Aliases:** ${note.aliases.join(", ")}`);
  parts.push("");

  let content = note.content;
  content = content.replace(/\[\[([^\]|]+?)\|([^\]]+?)\]\]/g, "$2");
  content = content.replace(/\[\[([^\]]+?)\]\]/g, "$1");
  content = content.replace(/!\[\[([^\]]+?)\]\]/g, "(embedded: $1)");
  parts.push(content);

  if (note.wikilinks.length > 0) {
    parts.push("", `**Linked to:** ${note.wikilinks.join(", ")}`);
  }

  return parts.join("\n").trim();
}

export function chunkNote(
  note: ObsidianNote,
  maxChunkSize: number = 4000,
): Array<{ content: string; title: string }> {
  const formatted = formatNoteContent(note);
  if (formatted.length <= maxChunkSize) {
    return [{ content: formatted, title: note.name }];
  }

  const chunks: Array<{ content: string; title: string }> = [];
  const lines = formatted.split("\n");
  let currentChunk: string[] = [];
  let currentTitle = note.name;
  let chunkIndex = 0;

  for (const line of lines) {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading && currentChunk.join("\n").length > 500) {
      const content = currentChunk.join("\n").trim();
      if (content.length > 0) {
        chunks.push({
          content,
          title: chunkIndex === 0 ? note.name : `${note.name} — ${currentTitle}`,
        });
        chunkIndex += 1;
      }
      currentChunk = [`# ${note.name} (continued)`, ""];
      currentTitle = heading[2];
    }

    currentChunk.push(line);

    if (currentChunk.join("\n").length > maxChunkSize) {
      chunks.push({
        content: currentChunk.join("\n").trim(),
        title: chunkIndex === 0 ? note.name : `${note.name} — ${currentTitle}`,
      });
      chunkIndex += 1;
      currentChunk = [`# ${note.name} (continued)`, ""];
    }
  }

  const remaining = currentChunk.join("\n").trim();
  if (remaining.length > 0) {
    chunks.push({
      content: remaining,
      title: chunkIndex === 0 ? note.name : `${note.name} — ${currentTitle}`,
    });
  }

  return chunks;
}

export function chunkAllNotes(notes: ObsidianNote[]) {
  return notes.flatMap((note) => chunkNote(note).map((chunk) => ({
    ...chunk,
    noteName: note.name,
    folder: note.folder,
    tags: note.tags,
  })));
}

export function buildObsidianPreview(vault: ParsedVault) {
  return {
    stats: vault.stats,
    sampleNotes: vault.notes.slice(0, 8).map((note) => ({
      name: note.name,
      folder: note.folder || "Root",
      wordCount: note.wordCount,
      tags: note.tags.slice(0, 5),
      linkCount: note.wikilinks.length,
      hasBacklinks: vault.backlinks.has(note.name.toLowerCase()),
      preview: note.content.substring(0, 120).replace(/\n/g, " "),
    })),
    graphPreview: {
      connectedNotes: vault.notes.length - vault.stats.orphanNotes,
      totalLinks: vault.stats.totalWikilinks,
      avgLinksPerNote: vault.notes.length > 0
        ? Math.round((vault.stats.totalWikilinks / vault.notes.length) * 10) / 10
        : 0,
    },
  };
}

export async function ensureObsidianImporterReady() {
  await assertPluginEnabled(PLUGIN_SLUG);
}

// ─── ZIP Extraction ──────────────────────────────────────────

export async function extractNotesFromZip(file: File): Promise<ObsidianNote[]> {
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

// ─── Import Orchestration ────────────────────────────────────

export interface ImportVaultResult {
  totalNotes: number;
  totalChunks: number;
  embedded: number;
  connections: number;
  tags: number;
  stats: ParsedVault["stats"];
}

export async function importVault(
  userId: string,
  vault: ParsedVault,
): Promise<ImportVaultResult> {
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

  const connectionsCreated = await createWikilinkConnections(userId, vault.notes, noteMemoryIds);

  try {
    await buildTreeIndex(userId);
  } catch (error) {
    console.error("Tree index build failed (non-fatal):", error);
  }

  return {
    totalNotes: vault.notes.length,
    totalChunks: allChunks.length,
    embedded: embeddings?.length || 0,
    connections: connectionsCreated,
    tags: vault.stats.totalTags,
    stats: vault.stats,
  };
}

// ─── Connection Creation ─────────────────────────────────────

async function createWikilinkConnections(
  userId: string,
  notes: ObsidianNote[],
  noteMemoryIds: Map<string, string[]>,
): Promise<number> {
  let connectionsCreated = 0;
  const connectionPairs = new Set<string>();

  for (const note of notes) {
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

  return connectionsCreated;
}
