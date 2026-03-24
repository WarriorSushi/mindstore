/**
 * Obsidian Vault Importer — Plugin API Route
 *
 * POST /api/v1/plugins/obsidian-importer
 *   Body: FormData with:
 *     - file: ZIP file of an Obsidian vault (or individual .md files)
 *     - action: "preview" | "import" (default: "import")
 *
 *   preview: Parses vault → returns note count, tags, wikilinks, folder structure
 *   import: Parses vault, resolves wikilinks, stores as memories with connections
 *
 * Handles:
 * - YAML frontmatter (tags, aliases, dates, custom fields)
 * - [[wikilinks]] and [[wikilink|alias]] resolution
 * - #tags inline and in frontmatter
 * - Folder structure preserved as tree paths
 * - Smart chunking by heading structure
 * - Graph topology imported as connections
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/server/user';
import { db, schema } from '@/server/db';
import { eq, sql } from 'drizzle-orm';
import { generateEmbeddings } from '@/server/embeddings';
import { buildTreeIndex } from '@/server/retrieval';
import JSZip from 'jszip';

// ─── Types ──────────────────────────────────────────────────────

interface ObsidianNote {
  path: string;           // Full file path within vault: "folder/subfolder/Note.md"
  name: string;           // File name without extension: "Note"
  folder: string;         // Parent folder path: "folder/subfolder"
  content: string;        // Raw markdown content (without frontmatter)
  rawContent: string;     // Original content including frontmatter
  frontmatter: Record<string, unknown>;
  tags: string[];         // Combined from frontmatter + inline #tags
  aliases: string[];      // From frontmatter aliases
  wikilinks: string[];    // [[linked notes]] found in content
  headings: { level: number; text: string; position: number }[];
  wordCount: number;
  createdDate?: string;   // From frontmatter or file metadata
}

interface VaultStats {
  totalNotes: number;
  totalWords: number;
  totalTags: number;
  totalWikilinks: number;
  totalFolders: number;
  uniqueTags: string[];
  topTags: { tag: string; count: number }[];
  topFolders: { path: string; count: number }[];
  orphanNotes: number;    // Notes with no incoming or outgoing links
  mostLinked: { name: string; inLinks: number }[];
  dateRange: { oldest: string | null; newest: string | null };
}

interface ParsedVault {
  notes: ObsidianNote[];
  stats: VaultStats;
  linkGraph: Map<string, string[]>; // note name → [linked note names]
  backlinks: Map<string, string[]>; // note name → [notes that link to it]
}

// ─── YAML Frontmatter Parser ────────────────────────────────────

function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const yamlStr = match[1];
  const body = match[2];
  const frontmatter: Record<string, unknown> = {};

  // Simple YAML parser for common Obsidian frontmatter patterns
  let currentKey = '';
  let inArray = false;
  const arrayValues: string[] = [];

  for (const line of yamlStr.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Array item: "  - value"
    if (inArray && trimmed.startsWith('- ')) {
      arrayValues.push(trimmed.slice(2).trim().replace(/^['"]|['"]$/g, ''));
      continue;
    }

    // If we were collecting array items, save them
    if (inArray) {
      frontmatter[currentKey] = [...arrayValues];
      inArray = false;
      arrayValues.length = 0;
    }

    // Key-value pair: "key: value"
    const kvMatch = trimmed.match(/^([a-zA-Z_-]+)\s*:\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1].toLowerCase();
      const value = kvMatch[2].trim();

      if (value === '' || value === '[]') {
        // Could be start of array on next lines or empty
        currentKey = key;
        inArray = true;
        arrayValues.length = 0;
        continue;
      }

      // Inline array: [item1, item2]
      if (value.startsWith('[') && value.endsWith(']')) {
        const items = value
          .slice(1, -1)
          .split(',')
          .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
          .filter(s => s.length > 0);
        frontmatter[key] = items;
        continue;
      }

      // Boolean
      if (value === 'true' || value === 'false') {
        frontmatter[key] = value === 'true';
        continue;
      }

      // Number
      if (/^\d+(\.\d+)?$/.test(value)) {
        frontmatter[key] = parseFloat(value);
        continue;
      }

      // String (strip quotes)
      frontmatter[key] = value.replace(/^['"]|['"]$/g, '');
    }
  }

  // Flush remaining array
  if (inArray && arrayValues.length > 0) {
    frontmatter[currentKey] = [...arrayValues];
  }

  return { frontmatter, body };
}

// ─── Wikilink Extractor ─────────────────────────────────────────

function extractWikilinks(content: string): string[] {
  const links: string[] = [];
  // Match [[Note Name]] and [[Note Name|Display Text]]
  // Exclude embedded files ![[file]] but include regular links
  const regex = /(?<!!)\[\[([^\]|#]+?)(?:\|[^\]]+?)?\]\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const linkTarget = match[1].trim();
    if (linkTarget && !links.includes(linkTarget)) {
      links.push(linkTarget);
    }
  }
  return links;
}

// ─── Inline Tag Extractor ───────────────────────────────────────

function extractInlineTags(content: string): string[] {
  const tags: string[] = [];
  // Match #tag patterns (not inside code blocks or URLs)
  // Obsidian tags: start with # followed by word chars, can have / for nested tags
  const regex = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_/-]*)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const tag = match[1].toLowerCase();
    // Skip markdown headings (## heading)
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  }
  return tags;
}

// ─── Heading Extractor ──────────────────────────────────────────

function extractHeadings(content: string): { level: number; text: string; position: number }[] {
  const headings: { level: number; text: string; position: number }[] = [];
  const lines = content.split('\n');
  let pos = 0;
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        position: pos,
      });
    }
    pos += line.length + 1;
  }
  return headings;
}

// ─── Note Parser ────────────────────────────────────────────────

function parseNote(path: string, rawContent: string): ObsidianNote {
  // Extract name and folder from path
  const parts = path.split('/');
  const fileName = parts[parts.length - 1];
  const name = fileName.replace(/\.md$/i, '');
  const folder = parts.slice(0, -1).join('/') || '';

  // Parse frontmatter
  const { frontmatter, body } = parseFrontmatter(rawContent);

  // Extract tags from frontmatter and inline
  const fmTags = Array.isArray(frontmatter.tags)
    ? (frontmatter.tags as string[]).map(t => String(t).toLowerCase().replace(/^#/, ''))
    : typeof frontmatter.tags === 'string'
      ? [frontmatter.tags.toLowerCase().replace(/^#/, '')]
      : [];

  const inlineTags = extractInlineTags(body);
  const allTags = [...new Set([...fmTags, ...inlineTags])];

  // Extract aliases
  const aliases = Array.isArray(frontmatter.aliases)
    ? (frontmatter.aliases as string[]).map(String)
    : typeof frontmatter.aliases === 'string'
      ? [frontmatter.aliases]
      : [];

  // Extract wikilinks
  const wikilinks = extractWikilinks(body);

  // Extract headings
  const headings = extractHeadings(body);

  // Word count
  const wordCount = body.split(/\s+/).filter(w => w.length > 0).length;

  // Created date from frontmatter
  const createdDate = (frontmatter.created || frontmatter.date || frontmatter['date created']) as string | undefined;

  return {
    path,
    name,
    folder,
    content: body.trim(),
    rawContent,
    frontmatter,
    tags: allTags,
    aliases,
    wikilinks,
    headings,
    wordCount,
    createdDate: createdDate ? String(createdDate) : undefined,
  };
}

// ─── Vault Parser ───────────────────────────────────────────────

function parseVault(notes: ObsidianNote[]): ParsedVault {
  // Build link graph
  const linkGraph = new Map<string, string[]>();
  const backlinks = new Map<string, string[]>();
  const noteNames = new Set(notes.map(n => n.name.toLowerCase()));

  // Also build alias → note name map
  const aliasMap = new Map<string, string>();
  for (const note of notes) {
    for (const alias of note.aliases) {
      aliasMap.set(alias.toLowerCase(), note.name.toLowerCase());
    }
  }

  for (const note of notes) {
    const outgoing: string[] = [];
    for (const link of note.wikilinks) {
      const linkLower = link.toLowerCase();
      // Resolve the link to an actual note (direct match or via alias)
      const resolved = noteNames.has(linkLower) ? linkLower
        : aliasMap.has(linkLower) ? aliasMap.get(linkLower)!
          : null;
      if (resolved) {
        outgoing.push(resolved);
        // Add backlink
        const existing = backlinks.get(resolved) || [];
        if (!existing.includes(note.name.toLowerCase())) {
          existing.push(note.name.toLowerCase());
          backlinks.set(resolved, existing);
        }
      }
    }
    linkGraph.set(note.name.toLowerCase(), outgoing);
  }

  // Calculate stats
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

    const topFolder = note.folder.split('/')[0] || 'Root';
    folderCounts.set(topFolder, (folderCounts.get(topFolder) || 0) + 1);
  }

  // Unique folders
  const allFolders = new Set<string>();
  for (const note of notes) {
    if (note.folder) {
      const parts = note.folder.split('/');
      for (let i = 0; i < parts.length; i++) {
        allFolders.add(parts.slice(0, i + 1).join('/'));
      }
    }
  }

  // Orphan notes (no incoming or outgoing links)
  let orphanNotes = 0;
  for (const note of notes) {
    const nameLower = note.name.toLowerCase();
    const hasOutgoing = (linkGraph.get(nameLower)?.length || 0) > 0;
    const hasIncoming = (backlinks.get(nameLower)?.length || 0) > 0;
    if (!hasOutgoing && !hasIncoming) orphanNotes++;
  }

  // Most linked notes
  const linkCounts: { name: string; inLinks: number }[] = [];
  for (const [name, links] of backlinks) {
    linkCounts.push({ name, inLinks: links.length });
  }
  linkCounts.sort((a, b) => b.inLinks - a.inLinks);

  // Date range
  const dates = notes
    .map(n => n.createdDate)
    .filter(Boolean)
    .map(d => new Date(d!))
    .filter(d => !isNaN(d.getTime()));

  const sortedTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
  const sortedFolders = [...folderCounts.entries()].sort((a, b) => b[1] - a[1]);

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
      uniqueTags: sortedTags.map(([t]) => t),
      topTags: sortedTags.slice(0, 15).map(([tag, count]) => ({ tag, count })),
      topFolders: sortedFolders.slice(0, 10).map(([path, count]) => ({ path, count })),
      orphanNotes,
      mostLinked: linkCounts.slice(0, 8),
      dateRange: {
        oldest: dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))).toISOString().split('T')[0] : null,
        newest: dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))).toISOString().split('T')[0] : null,
      },
    },
  };
}

// ─── Smart Content Formatter ────────────────────────────────────

function formatNoteContent(note: ObsidianNote): string {
  const parts: string[] = [];

  // Title
  parts.push(`# ${note.name}`);

  // Metadata line
  const meta: string[] = [];
  if (note.folder) meta.push(`📁 ${note.folder}`);
  if (note.tags.length > 0) meta.push(note.tags.map(t => `#${t}`).join(' '));
  if (note.createdDate) meta.push(`📅 ${note.createdDate}`);
  if (meta.length > 0) parts.push(meta.join(' · '));

  // Aliases
  if (note.aliases.length > 0) {
    parts.push(`**Aliases:** ${note.aliases.join(', ')}`);
  }

  parts.push('');

  // Convert wikilinks to readable format in content
  let processedContent = note.content;
  // [[Note|Display]] → Display
  processedContent = processedContent.replace(/\[\[([^\]|]+?)\|([^\]]+?)\]\]/g, '$2');
  // [[Note]] → Note
  processedContent = processedContent.replace(/\[\[([^\]]+?)\]\]/g, '$1');
  // Remove embedded files ![[file.ext]]
  processedContent = processedContent.replace(/!\[\[([^\]]+?)\]\]/g, '(embedded: $1)');

  parts.push(processedContent);

  // Linked notes section (for context)
  if (note.wikilinks.length > 0) {
    parts.push('');
    parts.push(`**Linked to:** ${note.wikilinks.join(', ')}`);
  }

  return parts.join('\n').trim();
}

// ─── Smart Chunking ────────────────────────────────────────────

function chunkNote(note: ObsidianNote, maxChunkSize: number = 4000): { content: string; title: string }[] {
  const formatted = formatNoteContent(note);

  // If the note fits in one chunk, return as-is
  if (formatted.length <= maxChunkSize) {
    return [{ content: formatted, title: note.name }];
  }

  // Split by headings for large notes
  const chunks: { content: string; title: string }[] = [];
  const lines = formatted.split('\n');
  let currentChunk: string[] = [];
  let currentTitle = note.name;
  let chunkIndex = 0;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);

    if (headingMatch && currentChunk.join('\n').length > 500) {
      // Save current chunk
      const chunkContent = currentChunk.join('\n').trim();
      if (chunkContent.length > 0) {
        chunks.push({
          content: chunkContent,
          title: chunkIndex === 0 ? note.name : `${note.name} — ${currentTitle}`,
        });
        chunkIndex++;
      }
      currentChunk = [`# ${note.name} (continued)`, ''];
      currentTitle = headingMatch[2];
    }

    currentChunk.push(line);

    // Force-split if chunk gets too large
    if (currentChunk.join('\n').length > maxChunkSize) {
      const content = currentChunk.join('\n').trim();
      chunks.push({
        content,
        title: chunkIndex === 0 ? note.name : `${note.name} — ${currentTitle}`,
      });
      chunkIndex++;
      currentChunk = [`# ${note.name} (continued)`, ''];
    }
  }

  // Save remaining chunk
  const remaining = currentChunk.join('\n').trim();
  if (remaining.length > 0) {
    chunks.push({
      content: remaining,
      title: chunkIndex === 0 ? note.name : `${note.name} — ${currentTitle}`,
    });
  }

  return chunks;
}

// ─── ZIP Extraction ─────────────────────────────────────────────

async function extractNotesFromZip(file: File): Promise<ObsidianNote[]> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const notes: ObsidianNote[] = [];

  // Process all .md files
  const promises: Promise<void>[] = [];

  zip.forEach((relativePath, zipEntry) => {
    // Skip directories, hidden files, and non-markdown
    if (zipEntry.dir) return;
    if (relativePath.startsWith('.') || relativePath.includes('/.')) return;
    if (relativePath.startsWith('__MACOSX/')) return;
    if (!relativePath.toLowerCase().endsWith('.md')) return;

    // Skip Obsidian config files
    if (relativePath.includes('.obsidian/')) return;
    if (relativePath.includes('.trash/')) return;

    promises.push(
      zipEntry.async('string').then((content) => {
        // Strip vault root folder if ZIP was created by zipping the vault folder
        // e.g. "MyVault/folder/note.md" → "folder/note.md"
        let cleanPath = relativePath;
        const firstSlash = relativePath.indexOf('/');
        if (firstSlash > 0) {
          // Check if first segment is the vault root (all files share it)
          // We'll handle this after collecting all files
        }

        const note = parseNote(cleanPath, content);
        if (note.content.trim().length > 0) {
          notes.push(note);
        }
      })
    );
  });

  await Promise.all(promises);

  // Strip common vault root prefix
  if (notes.length > 0) {
    const allPaths = notes.map(n => n.path);
    const firstPath = allPaths[0];
    const firstSlash = firstPath.indexOf('/');
    if (firstSlash > 0) {
      const prefix = firstPath.substring(0, firstSlash + 1);
      const allSharePrefix = allPaths.every(p => p.startsWith(prefix));
      if (allSharePrefix) {
        for (const note of notes) {
          note.path = note.path.substring(prefix.length);
          note.folder = note.path.split('/').slice(0, -1).join('/') || '';
        }
      }
    }
  }

  // Sort by path for consistent ordering
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

    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.zip')) {
      return NextResponse.json(
        { error: 'Please upload a ZIP of your Obsidian vault. In Finder/Explorer, right-click your vault folder → Compress/Send to ZIP.' },
        { status: 400 },
      );
    }

    // Extract and parse notes
    let notes: ObsidianNote[];
    try {
      notes = await extractNotesFromZip(file);
    } catch (e) {
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

    // Parse vault structure
    const vault = parseVault(notes);

    // Auto-install plugin if needed
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

    // Chunk all notes
    const allChunks: { content: string; title: string; noteName: string; folder: string; tags: string[] }[] = [];
    for (const note of vault.notes) {
      const chunks = chunkNote(note);
      for (const chunk of chunks) {
        allChunks.push({
          ...chunk,
          noteName: note.name,
          folder: note.folder,
          tags: note.tags,
        });
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
          if (batchEmbeddings) {
            allEmbeddings.push(...batchEmbeddings);
          }
        }
        if (allEmbeddings.length === allChunks.length) {
          embeddings = allEmbeddings;
        }
      } catch (e) {
        console.error('Obsidian embeddings failed (non-fatal):', e);
      }
    }

    // Insert memories in batches — track note name → memory IDs for connections
    const noteMemoryIds = new Map<string, string[]>(); // note name → memory IDs
    let inserted = 0;
    const BATCH_SIZE = 20;

    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      const batch = allChunks.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (chunk, j) => {
        const idx = i + j;
        const embedding = embeddings?.[idx];
        const memId = crypto.randomUUID();

        // Build metadata
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

        // Track memory IDs per note
        const existing = noteMemoryIds.get(chunk.noteName.toLowerCase()) || [];
        existing.push(memId);
        noteMemoryIds.set(chunk.noteName.toLowerCase(), existing);

        inserted++;
      });

      await Promise.all(batchPromises);
    }

    // Create connections based on wikilinks
    let connectionsCreated = 0;
    const connectionPairs = new Set<string>(); // prevent duplicates

    for (const note of vault.notes) {
      const sourceIds = noteMemoryIds.get(note.name.toLowerCase());
      if (!sourceIds?.length) continue;

      for (const link of note.wikilinks) {
        const targetIds = noteMemoryIds.get(link.toLowerCase());
        if (!targetIds?.length) continue;

        // Create connection between first memory of each note
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
        } catch (e) {
          // Non-fatal — connection may already exist
        }
      }
    }

    // Rebuild tree index
    try {
      await buildTreeIndex(userId);
    } catch (e) {
      console.error('Tree index build failed (non-fatal):', e);
    }

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
