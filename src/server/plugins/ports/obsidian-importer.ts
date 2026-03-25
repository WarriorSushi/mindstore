/**
 * Obsidian Vault Importer — Portable Logic
 *
 * Parses Obsidian vault exports (ZIP of .md files) with full support for:
 * - YAML frontmatter (tags, aliases, dates)
 * - [[wikilinks]] and [[wikilink|alias]] resolution
 * - #inline-tags
 * - Folder structure preservation
 * - Heading-based smart chunking
 * - Link graph + backlink analysis
 *
 * Pure logic: no HTTP, no DB, no ZIP library (caller extracts files).
 */

// ─── Types ──────────────────────────────────────────────────────

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
  headings: { level: number; text: string; position: number }[];
  wordCount: number;
  createdDate?: string;
}

export interface VaultStats {
  totalNotes: number;
  totalWords: number;
  totalTags: number;
  totalWikilinks: number;
  totalFolders: number;
  uniqueTags: string[];
  topTags: { tag: string; count: number }[];
  topFolders: { path: string; count: number }[];
  orphanNotes: number;
  mostLinked: { name: string; inLinks: number }[];
  dateRange: { oldest: string | null; newest: string | null };
}

export interface ParsedVault {
  notes: ObsidianNote[];
  stats: VaultStats;
  linkGraph: Map<string, string[]>;
  backlinks: Map<string, string[]>;
}

export interface NoteChunk {
  content: string;
  title: string;
  noteName: string;
  folder: string;
  tags: string[];
}

// ─── YAML Frontmatter Parser ────────────────────────────────────

export function parseFrontmatter(
  content: string,
): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const yamlStr = match[1];
  const body = match[2];
  const frontmatter: Record<string, unknown> = {};
  let currentKey = '';
  let inArray = false;
  const arrayValues: string[] = [];

  for (const line of yamlStr.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (inArray && trimmed.startsWith('- ')) {
      arrayValues.push(trimmed.slice(2).trim().replace(/^['"]|['"]$/g, ''));
      continue;
    }

    if (inArray) {
      frontmatter[currentKey] = [...arrayValues];
      inArray = false;
      arrayValues.length = 0;
    }

    const kvMatch = trimmed.match(/^([a-zA-Z_-]+)\s*:\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1].toLowerCase();
      const value = kvMatch[2].trim();

      if (value === '' || value === '[]') {
        currentKey = key;
        inArray = true;
        arrayValues.length = 0;
        continue;
      }

      if (value.startsWith('[') && value.endsWith(']')) {
        frontmatter[key] = value
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
          .filter((s) => s.length > 0);
        continue;
      }

      if (value === 'true' || value === 'false') {
        frontmatter[key] = value === 'true';
        continue;
      }

      if (/^\d+(\.\d+)?$/.test(value)) {
        frontmatter[key] = parseFloat(value);
        continue;
      }

      frontmatter[key] = value.replace(/^['"]|['"]$/g, '');
    }
  }

  if (inArray && arrayValues.length > 0) {
    frontmatter[currentKey] = [...arrayValues];
  }

  return { frontmatter, body };
}

// ─── Extractors ─────────────────────────────────────────────────

/** Extract [[wikilinks]] (excluding ![[embeds]]) */
export function extractWikilinks(content: string): string[] {
  const links: string[] = [];
  const regex = /(?<!!)\[\[([^\]|#]+?)(?:\|[^\]]+?)?\]\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const linkTarget = match[1].trim();
    if (linkTarget && !links.includes(linkTarget)) links.push(linkTarget);
  }
  return links;
}

/** Extract inline #tags (not headings) */
export function extractInlineTags(content: string): string[] {
  const tags: string[] = [];
  const regex = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_/-]*)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const tag = match[1].toLowerCase();
    if (!tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

/** Extract markdown headings with level and position */
export function extractHeadings(
  content: string,
): { level: number; text: string; position: number }[] {
  const headings: { level: number; text: string; position: number }[] = [];
  const lines = content.split('\n');
  let pos = 0;
  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.+)$/);
    if (m) headings.push({ level: m[1].length, text: m[2].trim(), position: pos });
    pos += line.length + 1;
  }
  return headings;
}

// ─── Note Parser ────────────────────────────────────────────────

/** Parse a single markdown file into an ObsidianNote */
export function parseNote(path: string, rawContent: string): ObsidianNote {
  const parts = path.split('/');
  const fileName = parts[parts.length - 1];
  const name = fileName.replace(/\.md$/i, '');
  const folder = parts.slice(0, -1).join('/') || '';

  const { frontmatter, body } = parseFrontmatter(rawContent);

  const fmTags = Array.isArray(frontmatter.tags)
    ? (frontmatter.tags as string[]).map((t) =>
        String(t).toLowerCase().replace(/^#/, ''),
      )
    : typeof frontmatter.tags === 'string'
      ? [frontmatter.tags.toLowerCase().replace(/^#/, '')]
      : [];

  const inlineTags = extractInlineTags(body);
  const allTags = [...new Set([...fmTags, ...inlineTags])];

  const aliases = Array.isArray(frontmatter.aliases)
    ? (frontmatter.aliases as string[]).map(String)
    : typeof frontmatter.aliases === 'string'
      ? [frontmatter.aliases]
      : [];

  const wikilinks = extractWikilinks(body);
  const headings = extractHeadings(body);
  const wordCount = body.split(/\s+/).filter((w) => w.length > 0).length;
  const createdDate = (
    frontmatter.created ||
    frontmatter.date ||
    frontmatter['date created']
  ) as string | undefined;

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

// ─── Vault Analysis ─────────────────────────────────────────────

/** Build link graph, backlinks, and vault statistics from parsed notes */
export function analyzeVault(notes: ObsidianNote[]): ParsedVault {
  const linkGraph = new Map<string, string[]>();
  const backlinks = new Map<string, string[]>();
  const noteNames = new Set(notes.map((n) => n.name.toLowerCase()));

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
      const resolved = noteNames.has(linkLower)
        ? linkLower
        : aliasMap.has(linkLower)
          ? aliasMap.get(linkLower)!
          : null;
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

  // Stats
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

  const allFolders = new Set<string>();
  for (const note of notes) {
    if (note.folder) {
      const parts = note.folder.split('/');
      for (let i = 0; i < parts.length; i++) {
        allFolders.add(parts.slice(0, i + 1).join('/'));
      }
    }
  }

  let orphanNotes = 0;
  for (const note of notes) {
    const nameLower = note.name.toLowerCase();
    if (
      (linkGraph.get(nameLower)?.length || 0) === 0 &&
      (backlinks.get(nameLower)?.length || 0) === 0
    ) {
      orphanNotes++;
    }
  }

  const linkCounts: { name: string; inLinks: number }[] = [];
  for (const [name, links] of backlinks) {
    linkCounts.push({ name, inLinks: links.length });
  }
  linkCounts.sort((a, b) => b.inLinks - a.inLinks);

  const dates = notes
    .map((n) => n.createdDate)
    .filter(Boolean)
    .map((d) => new Date(d!))
    .filter((d) => !isNaN(d.getTime()));

  const sortedTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
  const sortedFolders = [...folderCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  );

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
      topFolders: sortedFolders
        .slice(0, 10)
        .map(([path, count]) => ({ path, count })),
      orphanNotes,
      mostLinked: linkCounts.slice(0, 8),
      dateRange: {
        oldest:
          dates.length > 0
            ? new Date(Math.min(...dates.map((d) => d.getTime())))
                .toISOString()
                .split('T')[0]
            : null,
        newest:
          dates.length > 0
            ? new Date(Math.max(...dates.map((d) => d.getTime())))
                .toISOString()
                .split('T')[0]
            : null,
      },
    },
  };
}

// ─── Content Formatting ─────────────────────────────────────────

/** Format a note with metadata header, resolved wikilinks, and link section */
export function formatNoteContent(note: ObsidianNote): string {
  const parts: string[] = [];
  parts.push(`# ${note.name}`);

  const meta: string[] = [];
  if (note.folder) meta.push(`📁 ${note.folder}`);
  if (note.tags.length > 0) meta.push(note.tags.map((t) => `#${t}`).join(' '));
  if (note.createdDate) meta.push(`📅 ${note.createdDate}`);
  if (meta.length > 0) parts.push(meta.join(' · '));

  if (note.aliases.length > 0) {
    parts.push(`**Aliases:** ${note.aliases.join(', ')}`);
  }

  parts.push('');

  let processedContent = note.content;
  processedContent = processedContent.replace(
    /\[\[([^\]|]+?)\|([^\]]+?)\]\]/g,
    '$2',
  );
  processedContent = processedContent.replace(/\[\[([^\]]+?)\]\]/g, '$1');
  processedContent = processedContent.replace(
    /!\[\[([^\]]+?)\]\]/g,
    '(embedded: $1)',
  );

  parts.push(processedContent);

  if (note.wikilinks.length > 0) {
    parts.push('');
    parts.push(`**Linked to:** ${note.wikilinks.join(', ')}`);
  }

  return parts.join('\n').trim();
}

// ─── Chunking ───────────────────────────────────────────────────

/** Chunk a note into import-ready pieces, splitting at headings when needed */
export function chunkNote(
  note: ObsidianNote,
  maxChunkSize: number = 4000,
): { content: string; title: string }[] {
  const formatted = formatNoteContent(note);
  if (formatted.length <= maxChunkSize) {
    return [{ content: formatted, title: note.name }];
  }

  const chunks: { content: string; title: string }[] = [];
  const lines = formatted.split('\n');
  let currentChunk: string[] = [];
  let currentTitle = note.name;
  let chunkIndex = 0;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch && currentChunk.join('\n').length > 500) {
      const chunkContent = currentChunk.join('\n').trim();
      if (chunkContent.length > 0) {
        chunks.push({
          content: chunkContent,
          title:
            chunkIndex === 0
              ? note.name
              : `${note.name} — ${currentTitle}`,
        });
        chunkIndex++;
      }
      currentChunk = [`# ${note.name} (continued)`, ''];
      currentTitle = headingMatch[2];
    }

    currentChunk.push(line);

    if (currentChunk.join('\n').length > maxChunkSize) {
      const content = currentChunk.join('\n').trim();
      chunks.push({
        content,
        title:
          chunkIndex === 0
            ? note.name
            : `${note.name} — ${currentTitle}`,
      });
      chunkIndex++;
      currentChunk = [`# ${note.name} (continued)`, ''];
    }
  }

  const remaining = currentChunk.join('\n').trim();
  if (remaining.length > 0) {
    chunks.push({
      content: remaining,
      title:
        chunkIndex === 0 ? note.name : `${note.name} — ${currentTitle}`,
    });
  }

  return chunks;
}

/** Chunk all notes and flatten into NoteChunks ready for import */
export function chunkAllNotes(notes: ObsidianNote[]): NoteChunk[] {
  const allChunks: NoteChunk[] = [];
  for (const note of notes) {
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
  return allChunks;
}

/**
 * Strip a common vault-root prefix from file paths (e.g. "MyVault/...")
 * and update note paths + folders accordingly.
 */
export function stripVaultRoot(notes: ObsidianNote[]): void {
  if (notes.length === 0) return;
  const allPaths = notes.map((n) => n.path);
  const firstSlash = allPaths[0].indexOf('/');
  if (firstSlash <= 0) return;

  const prefix = allPaths[0].substring(0, firstSlash + 1);
  if (!allPaths.every((p) => p.startsWith(prefix))) return;

  for (const note of notes) {
    note.path = note.path.substring(prefix.length);
    note.folder = note.path.split('/').slice(0, -1).join('/') || '';
  }
}
