import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import JSZip from 'jszip';

/**
 * Markdown Blog Export Plugin — Export memories as blog-ready markdown
 *
 * GET  ?action=config          — Get export options, memory stats, templates
 * GET  ?action=preview         — Preview export for selected memories
 * POST ?action=export          — Generate and download markdown ZIP
 * POST ?action=export-single   — Export a single memory as markdown
 *
 * Supports: Hugo, Jekyll, Astro, Next.js MDX, plain markdown
 * Each generates proper frontmatter + file naming conventions
 */

const PLUGIN_SLUG = 'markdown-blog-export';

// ─── Auto-install ────────────────────────────────────────────

async function ensurePluginInstalled() {
  try {
    const existing = await db.execute(sql`SELECT id FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
    if ((existing as any[]).length === 0) {
      await db.execute(sql`
        INSERT INTO plugins (slug, name, description, type, status, icon, category)
        VALUES (
          ${PLUGIN_SLUG},
          'Markdown Blog Export',
          'Export memories as blog-ready markdown with frontmatter for Hugo, Jekyll, Astro, and more.',
          'extension',
          'active',
          'FolderDown',
          'export'
        )
      `);
    }
  } catch {}
}

// ─── Templates ───────────────────────────────────────────────

interface ExportTemplate {
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

const TEMPLATES: ExportTemplate[] = [
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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

// ─── Frontmatter Generators ─────────────────────────────────

function generateFrontmatter(
  memory: any,
  template: ExportTemplate,
  options: { author?: string; draft?: boolean; tags?: string[] },
): string {
  const title = memory.source_title || memory.content?.slice(0, 60)?.replace(/\n/g, ' ') || 'Untitled';
  const date = memory.created_at ? new Date(memory.created_at).toISOString() : new Date().toISOString();
  const metadata = typeof memory.metadata === 'string' ? JSON.parse(memory.metadata) : (memory.metadata || {});
  const tags = options.tags || metadata.tags || [memory.source_type || 'note'];
  const description = memory.content?.slice(0, 160)?.replace(/\n/g, ' ') || '';

  const fm: Record<string, any> = {
    title,
    date,
    description,
  };

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

  // YAML frontmatter
  const lines = ['---'];
  for (const [key, value] of Object.entries(fm)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      value.forEach(v => lines.push(`  - "${v}"`));
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === 'string') {
      // Escape YAML special characters
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

function getFileName(memory: any, template: ExportTemplate, index: number): string {
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

// ─── Memory Fetching ─────────────────────────────────────────

async function getMemories(userId: string, options: {
  ids?: string[];
  sourceTypes?: string[];
  limit?: number;
  search?: string;
}): Promise<any[]> {
  let query = `SELECT id, content, source_type, source_title, metadata, created_at 
               FROM memories WHERE user_id = '${userId}'`;

  if (options.ids && options.ids.length > 0) {
    const idList = options.ids.map(id => `'${id}'`).join(',');
    query += ` AND id IN (${idList})`;
  }

  if (options.sourceTypes && options.sourceTypes.length > 0) {
    const stList = options.sourceTypes.map(s => `'${s}'`).join(',');
    query += ` AND source_type IN (${stList})`;
  }

  if (options.search) {
    const escaped = options.search.replace(/'/g, "''");
    query += ` AND (content ILIKE '%${escaped}%' OR source_title ILIKE '%${escaped}%')`;
  }

  query += ` ORDER BY created_at DESC`;

  if (options.limit) {
    query += ` LIMIT ${options.limit}`;
  } else {
    query += ` LIMIT 500`;
  }

  try {
    const rows = await db.execute(sql.raw(query));
    return rows as any[];
  } catch {
    return [];
  }
}

// ─── Route Handlers ──────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    await ensurePluginInstalled();

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'config';

    // ─── Config ────────────────────────────────────────
    if (action === 'config') {
      // Get memory stats
      let stats = { total: 0, sourceTypes: [] as { type: string; count: number }[] };
      try {
        const totalRows = await db.execute(
          sql`SELECT COUNT(*) as count FROM memories WHERE user_id = ${userId}`
        );
        stats.total = parseInt((totalRows as any[])[0]?.count || '0');

        const sourceRows = await db.execute(sql`
          SELECT source_type, COUNT(*) as count 
          FROM memories WHERE user_id = ${userId}
          GROUP BY source_type ORDER BY count DESC
        `);
        stats.sourceTypes = (sourceRows as any[]).map(r => ({
          type: r.source_type,
          count: parseInt(r.count),
        }));
      } catch {}

      return NextResponse.json({
        templates: TEMPLATES,
        stats,
        options: {
          author: { type: 'text', label: 'Author Name', default: '' },
          draft: { type: 'boolean', label: 'Mark as Draft', default: false },
          includeMetadata: { type: 'boolean', label: 'Include Source Metadata', default: true },
          groupBySource: { type: 'boolean', label: 'Group by Source Type', default: false },
        },
      });
    }

    // ─── Preview ───────────────────────────────────────
    if (action === 'preview') {
      const templateId = searchParams.get('template') || 'plain';
      const template = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[4]; // default: plain
      const sourceType = searchParams.get('sourceType');

      const memories = await getMemories(userId, {
        sourceTypes: sourceType ? [sourceType] : undefined,
        limit: 5,
      });

      const previews = memories.map((mem, i) => {
        const frontmatter = generateFrontmatter(mem, template, {});
        const content = mem.content || '';
        const fullContent = `${frontmatter}\n\n${content}`;
        const fileName = getFileName(mem, template, i);

        return {
          id: mem.id,
          fileName: `${template.contentDir}/${fileName}`,
          title: mem.source_title || 'Untitled',
          preview: fullContent.slice(0, 500),
          wordCount: content.split(/\s+/).length,
        };
      });

      return NextResponse.json({ previews, template });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    await ensurePluginInstalled();

    const body = await req.json();
    const action = body.action;

    // ─── Full export ───────────────────────────────────
    if (action === 'export') {
      const {
        templateId = 'plain',
        memoryIds,
        sourceTypes,
        search,
        author = '',
        draft = false,
        includeMetadata = true,
        groupBySource = false,
      } = body;

      const template = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[4];

      const memories = await getMemories(userId, {
        ids: memoryIds,
        sourceTypes,
        search,
      });

      if (memories.length === 0) {
        return NextResponse.json({
          error: 'No memories found to export. Try different filters.',
        }, { status: 400 });
      }

      const zip = new JSZip();

      memories.forEach((mem, i) => {
        const frontmatter = generateFrontmatter(mem, template, { author, draft });
        const content = mem.content || '';

        // Add source metadata as comment if requested
        let fullContent = `${frontmatter}\n\n${content}`;
        if (includeMetadata && mem.source_type) {
          fullContent += `\n\n<!-- Source: ${mem.source_type}${mem.source_title ? ` | ${mem.source_title}` : ''} | Exported from MindStore -->`;
        }

        let filePath: string;
        if (groupBySource) {
          const sourceDir = mem.source_type || 'other';
          filePath = `${template.contentDir}/${sourceDir}/${getFileName(mem, template, i)}`;
        } else {
          filePath = `${template.contentDir}/${getFileName(mem, template, i)}`;
        }

        zip.file(filePath, fullContent);
      });

      // Add README
      zip.file('README.md', [
        `# MindStore Blog Export`,
        '',
        `- **Template**: ${template.name} (${template.framework})`,
        `- **Exported**: ${new Date().toISOString().slice(0, 10)}`,
        `- **Posts**: ${memories.length}`,
        '',
        '## Usage',
        '',
        template.id === 'hugo' ? '```bash\n# Copy content/ to your Hugo project\ncp -r content/ /path/to/hugo-site/content/\nhugo server\n```' :
        template.id === 'jekyll' ? '```bash\n# Copy _posts/ to your Jekyll site\ncp -r _posts/ /path/to/jekyll-site/_posts/\nbundle exec jekyll serve\n```' :
        template.id === 'astro' ? '```bash\n# Copy src/content/blog/ to your Astro project\ncp -r src/content/blog/ /path/to/astro-site/src/content/blog/\nnpx astro dev\n```' :
        template.id === 'nextjs' ? '```bash\n# Copy content/ to your Next.js project\ncp -r content/ /path/to/nextjs-site/content/\nnpm run dev\n```' :
        '```bash\n# Copy posts/ to your site\'s content directory\ncp -r posts/ /path/to/your-site/\n```',
        '',
        '## Structure',
        '',
        `\`\`\``,
        ...memories.slice(0, 10).map((mem, i) => {
          const fileName = getFileName(mem, template, i);
          return groupBySource
            ? `${template.contentDir}/${mem.source_type || 'other'}/${fileName}`
            : `${template.contentDir}/${fileName}`;
        }),
        memories.length > 10 ? `... and ${memories.length - 10} more` : '',
        `\`\`\``,
      ].join('\n'));

      // For Astro: add content config schema
      if (template.id === 'astro') {
        zip.file('src/content/config.ts', [
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
        ].join('\n'));
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      return NextResponse.json({
        file: zipBuffer.toString('base64'),
        filename: `mindstore-blog-${template.id}-${new Date().toISOString().slice(0, 10)}.zip`,
        contentType: 'application/zip',
        size: zipBuffer.length,
        stats: {
          postsExported: memories.length,
          template: template.name,
          framework: template.framework,
          totalWords: memories.reduce((sum, m) => sum + (m.content?.split(/\s+/).length || 0), 0),
        },
      });
    }

    // ─── Single memory export ──────────────────────────
    if (action === 'export-single') {
      const { memoryId, templateId = 'plain' } = body;
      if (!memoryId) {
        return NextResponse.json({ error: 'memoryId required' }, { status: 400 });
      }

      const template = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[4];
      const memories = await getMemories(userId, { ids: [memoryId] });

      if (memories.length === 0) {
        return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
      }

      const mem = memories[0];
      const frontmatter = generateFrontmatter(mem, template, {});
      const fullContent = `${frontmatter}\n\n${mem.content || ''}`;
      const fileName = getFileName(mem, template, 0);

      return NextResponse.json({
        content: fullContent,
        fileName,
        wordCount: (mem.content?.split(/\s+/).length || 0),
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
