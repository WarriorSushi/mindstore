/**
 * Markdown Blog Export — Portable logic module
 *
 * Extracted from the route for convergence with codex runtime.
 * Handles: template definitions, slug generation, frontmatter, file naming.
 */

import { ensurePluginInstalled } from "./plugin-config";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";

const SLUG = "markdown-blog-export";

// ─── Plugin lifecycle ────────────────────────────────────────────

export async function ensureInstalled() {
  await ensurePluginInstalled(SLUG);
}

export async function fetchMemories(userId: string, sourceType?: string): Promise<MemoryForExport[]> {
  const condition = sourceType
    ? sql`WHERE user_id = ${userId} AND source_type = ${sourceType} ORDER BY created_at DESC LIMIT 500`
    : sql`WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 500`;
  const rows = await db.execute(sql`
    SELECT id, content, source_type, source_title, metadata, created_at
    FROM memories ${condition}
  `);
  return (rows as any[]).map(r => ({
    id: r.id,
    content: r.content || '',
    source_type: r.source_type || 'note',
    source_title: r.source_title || '(untitled)',
    metadata: r.metadata || {},
    created_at: r.created_at,
  }));
}

export async function getSourceStats(userId: string) {
  const rows = await db.execute(sql`
    SELECT source_type, COUNT(*) as count
    FROM memories WHERE user_id = ${userId}
    GROUP BY source_type ORDER BY count DESC
  `);
  const sourceTypes = (rows as any[]).map(r => ({
    type: r.source_type || 'unknown',
    count: parseInt(r.count || '0'),
  }));
  const total = sourceTypes.reduce((s, t) => s + t.count, 0);
  return { total, sourceTypes };
}

// ─── Types ────────────────────────────────────────────────────

export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  framework: string;
  fileExtension: string;
  contentDir: string;
  frontmatterFormat: 'yaml' | 'toml';
  slugFormat: 'kebab' | 'date-prefix' | 'folder';
  features: string[];
}

export interface ExportOptions {
  author?: string;
  draft?: boolean;
  tags?: string[];
  includeMetadata?: boolean;
  groupBySource?: boolean;
}

export interface MemoryForExport {
  id: string;
  content: string;
  source_type: string;
  source_title: string;
  metadata: Record<string, any>;
  created_at: string;
}

// ─── Templates ───────────────────────────────────────────────

export const TEMPLATES: ExportTemplate[] = [
  {
    id: 'hugo',
    name: 'Hugo',
    description: 'Hugo static site generator with YAML frontmatter and content/ directory structure.',
    framework: 'Hugo',
    fileExtension: '.md',
    contentDir: 'content/posts',
    frontmatterFormat: 'yaml',
    slugFormat: 'folder',
    features: ['YAML frontmatter', 'Bundles (index.md)', 'Taxonomies', 'Draft support'],
  },
  {
    id: 'jekyll',
    name: 'Jekyll',
    description: 'Jekyll blog with date-prefixed filenames and _posts/ directory.',
    framework: 'Jekyll',
    fileExtension: '.md',
    contentDir: '_posts',
    frontmatterFormat: 'yaml',
    slugFormat: 'date-prefix',
    features: ['YAML frontmatter', 'Date-prefix naming', 'Categories', 'Tags'],
  },
  {
    id: 'astro',
    name: 'Astro',
    description: 'Astro content collections with typed frontmatter.',
    framework: 'Astro',
    fileExtension: '.md',
    contentDir: 'src/content/blog',
    frontmatterFormat: 'yaml',
    slugFormat: 'kebab',
    features: ['Content collections', 'Typed schema', 'MDX support', 'Dynamic routing'],
  },
  {
    id: 'nextjs',
    name: 'Next.js (MDX)',
    description: 'Next.js blog with MDX files and metadata exports.',
    framework: 'Next.js',
    fileExtension: '.mdx',
    contentDir: 'content',
    frontmatterFormat: 'yaml',
    slugFormat: 'kebab',
    features: ['MDX format', 'Component imports', 'Frontmatter metadata', 'App router compatible'],
  },
  {
    id: 'plain',
    name: 'Plain Markdown',
    description: 'Simple markdown files with minimal YAML frontmatter. Universal compatibility.',
    framework: 'Any',
    fileExtension: '.md',
    contentDir: 'posts',
    frontmatterFormat: 'yaml',
    slugFormat: 'kebab',
    features: ['Minimal frontmatter', 'Universal format', 'No framework lock-in'],
  },
];

// ─── Slug Generator ──────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

// ─── Frontmatter Generator ──────────────────────────────────

export function generateFrontmatter(
  memory: MemoryForExport,
  template: ExportTemplate,
  options: ExportOptions,
): string {
  const title = memory.source_title || memory.content?.slice(0, 60)?.replace(/\n/g, ' ') || 'Untitled';
  const date = memory.created_at ? new Date(memory.created_at).toISOString() : new Date().toISOString();
  const metadata = memory.metadata || {};
  const tags = options.tags || metadata.tags || [memory.source_type || 'note'];
  const description = memory.content?.slice(0, 160)?.replace(/\n/g, ' ') || '';

  const fm: Record<string, any> = { title, date, description };

  if (options.draft !== undefined) fm.draft = options.draft;
  if (options.author) fm.author = options.author;
  if (tags.length > 0) fm.tags = tags;

  // Framework-specific additions
  if (template.id === 'hugo') {
    fm.slug = slugify(title);
    fm.categories = [memory.source_type || 'general'];
    if (metadata.language) fm.language = metadata.language;
  }

  if (template.id === 'jekyll') {
    fm.layout = 'post';
    fm.categories = [memory.source_type || 'general'];
  }

  if (template.id === 'astro') {
    fm.pubDate = date;
    fm.heroImage = '';
  }

  // Serialize to YAML frontmatter
  const lines = ['---'];
  for (const [key, value] of Object.entries(fm)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      value.forEach(v => lines.push(`  - "${v}"`));
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === 'string') {
      const escaped = value.includes(':') || value.includes('#') || value.includes("'")
        ? `"${value.replace(/"/g, '\\"')}"`
        : value;
      lines.push(`${key}: ${escaped}`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

// ─── File Naming ─────────────────────────────────────────────

export function getFileName(memory: MemoryForExport, template: ExportTemplate, index: number): string {
  const title = memory.source_title || `memory-${index + 1}`;
  const slug = slugify(title);
  const date = memory.created_at
    ? new Date(memory.created_at).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  switch (template.slugFormat) {
    case 'date-prefix':
      return `${date}-${slug}${template.fileExtension}`;
    case 'folder':
      return `${slug}/index${template.fileExtension}`;
    case 'kebab':
    default:
      return `${slug}${template.fileExtension}`;
  }
}

// ─── Full File Content ───────────────────────────────────────

export function buildExportContent(
  memory: MemoryForExport,
  template: ExportTemplate,
  options: ExportOptions,
): string {
  const frontmatter = generateFrontmatter(memory, template, options);
  const content = memory.content || '';

  let fullContent = `${frontmatter}\n\n${content}`;
  if (options.includeMetadata && memory.source_type) {
    fullContent += `\n\n<!-- Source: ${memory.source_type}${memory.source_title ? ` | ${memory.source_title}` : ''} | Exported from MindStore -->`;
  }

  return fullContent;
}

// ─── Astro Content Config ────────────────────────────────────

export const ASTRO_CONTENT_CONFIG = [
  "import { defineCollection, z } from 'astro:content';",
  '',
  'const blog = defineCollection({',
  "  type: 'content',",
  '  schema: z.object({',
  '    title: z.string(),',
  '    description: z.string(),',
  '    pubDate: z.coerce.date(),',
  '    tags: z.array(z.string()).optional(),',
  '    draft: z.boolean().optional(),',
  '    heroImage: z.string().optional(),',
  '  }),',
  '});',
  '',
  'export const collections = { blog };',
].join('\n');

// ─── Template Lookup ─────────────────────────────────────────

export function getTemplate(id: string): ExportTemplate {
  return TEMPLATES.find(t => t.id === id) || TEMPLATES[4]; // default: plain
}
