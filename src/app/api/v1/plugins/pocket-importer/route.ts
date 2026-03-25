import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

/**
 * Pocket / Instapaper Importer Plugin
 * 
 * Imports saved articles from Pocket (HTML export) or Instapaper (CSV export).
 * 
 * Pocket: Export from getpocket.com/export → HTML file
 * Instapaper: Export from instapaper.com/export → CSV file
 * 
 * POST ?action=import-pocket       — Parse Pocket HTML export
 * POST ?action=import-instapaper   — Parse Instapaper CSV export
 * GET  ?action=config              — Get import configuration
 * GET  ?action=stats               — Get imported article stats
 */

const PLUGIN_SLUG = 'pocket-importer';

async function ensurePluginInstalled() {
  try {
    const existing = await db.execute(sql`SELECT id FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
    if ((existing as any[]).length === 0) {
      await db.execute(sql`
        INSERT INTO plugins (slug, name, description, type, status, icon, category)
        VALUES (
          ${PLUGIN_SLUG},
          'Pocket / Instapaper',
          'Import saved articles from Pocket or Instapaper with tags and metadata.',
          'extension',
          'active',
          'BookmarkCheck',
          'import'
        )
      `);
    }
  } catch {}
}

// ─── Pocket HTML Parser ──────────────────────────────────────

interface SavedArticle {
  url: string;
  title: string;
  tags?: string[];
  addedAt?: string;
  source: 'pocket' | 'instapaper';
  folder?: string;
  description?: string;
}

function parsePocketHTML(html: string): SavedArticle[] {
  const articles: SavedArticle[] = [];

  // Pocket exports as Netscape bookmark HTML
  // Format: <a href="URL" time_added="timestamp" tags="tag1,tag2">Title</a>
  const linkRegex = /<a\s+href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const attrs = match[2];
    const title = match[3].replace(/<[^>]*>/g, '').trim();

    if (!url || url.startsWith('javascript:')) continue;

    // Extract tags attribute
    const tagsMatch = attrs.match(/tags="([^"]*)"/i);
    const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean) : [];

    // Extract time_added
    const timeMatch = attrs.match(/time_added="(\d+)"/i);
    const addedAt = timeMatch
      ? new Date(parseInt(timeMatch[1]) * 1000).toISOString()
      : undefined;

    articles.push({
      url,
      title: title || url,
      tags,
      addedAt,
      source: 'pocket',
    });
  }

  return articles;
}

// ─── Instapaper CSV Parser ───────────────────────────────────

function parseInstapaperCSV(csv: string): SavedArticle[] {
  const articles: SavedArticle[] = [];
  const lines = csv.split('\n');

  if (lines.length < 2) return articles;

  // Find header indices
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const urlIdx = headers.indexOf('url');
  const titleIdx = headers.indexOf('title');
  const selectionIdx = headers.indexOf('selection');
  const folderIdx = headers.indexOf('folder');
  const timestampIdx = headers.indexOf('timestamp');

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);
    const url = fields[urlIdx] || '';
    const title = fields[titleIdx] || '';

    if (!url || !url.startsWith('http')) continue;

    articles.push({
      url,
      title: title || url,
      description: fields[selectionIdx] || undefined,
      folder: fields[folderIdx] || undefined,
      addedAt: fields[timestampIdx] ? new Date(parseInt(fields[timestampIdx]) * 1000).toISOString() : undefined,
      source: 'instapaper',
    });
  }

  return articles;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

// ─── Route Handlers ──────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    await ensurePluginInstalled();

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'config';

    if (action === 'config') {
      return NextResponse.json({
        sources: [
          {
            id: 'pocket',
            name: 'Pocket',
            format: 'HTML',
            exportUrl: 'https://getpocket.com/export',
            instructions: [
              'Go to getpocket.com/export',
              'Click "Export" to download your data as HTML',
              'Upload the ril_export.html file here',
            ],
          },
          {
            id: 'instapaper',
            name: 'Instapaper',
            format: 'CSV',
            exportUrl: 'https://www.instapaper.com/user',
            instructions: [
              'Go to instapaper.com → Settings',
              'Click "Export" under Data',
              'Download the CSV file',
              'Upload it here',
            ],
          },
        ],
      });
    }

    if (action === 'stats') {
      let stats = { imported: 0, pocket: 0, instapaper: 0 };
      try {
        const rows = await db.execute(sql`
          SELECT 
            COUNT(*) FILTER (WHERE metadata->>'importSource' = 'pocket') as pocket,
            COUNT(*) FILTER (WHERE metadata->>'importSource' = 'instapaper') as instapaper,
            COUNT(*) as total
          FROM memories 
          WHERE user_id = ${userId} AND source_type IN ('pocket', 'instapaper', 'article')
          AND metadata->>'importedVia' = 'pocket-importer-plugin'
        `);
        const row = (rows as any[])[0];
        stats.imported = parseInt(row?.total || '0');
        stats.pocket = parseInt(row?.pocket || '0');
        stats.instapaper = parseInt(row?.instapaper || '0');
      } catch {}
      return NextResponse.json(stats);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    await ensurePluginInstalled();

    const body = await req.json();
    const action = body.action;

    if (action === 'import-pocket' || action === 'import-instapaper') {
      const { data, dedup = true } = body;

      if (!data) {
        return NextResponse.json({ error: 'No data provided' }, { status: 400 });
      }

      const articles = action === 'import-pocket'
        ? parsePocketHTML(data)
        : parseInstapaperCSV(data);

      if (articles.length === 0) {
        return NextResponse.json({
          error: `No articles found. Make sure you uploaded the correct ${action === 'import-pocket' ? 'Pocket HTML' : 'Instapaper CSV'} file.`,
        }, { status: 400 });
      }

      let imported = 0;
      let skipped = 0;

      for (const article of articles) {
        // Dedup by URL
        if (dedup) {
          try {
            const existing = await db.execute(sql`
              SELECT id FROM memories 
              WHERE user_id = ${userId} 
              AND metadata->>'url' = ${article.url}
              LIMIT 1
            `);
            if ((existing as any[]).length > 0) {
              skipped++;
              continue;
            }
          } catch {}
        }

        const content = [
          article.title,
          '',
          `URL: ${article.url}`,
          article.description ? `\n${article.description}` : '',
          article.tags && article.tags.length > 0 ? `\nTags: ${article.tags.join(', ')}` : '',
          article.folder ? `\nFolder: ${article.folder}` : '',
        ].filter(Boolean).join('\n');

        const metadata: Record<string, any> = {
          url: article.url,
          importSource: article.source,
          importedVia: 'pocket-importer-plugin',
        };
        if (article.tags?.length) metadata.tags = article.tags;
        if (article.folder) metadata.folder = article.folder;
        if (article.description) metadata.description = article.description;

        try {
          await db.execute(sql`
            INSERT INTO memories (id, user_id, content, source_type, source_title, metadata, created_at, imported_at)
            VALUES (
              ${uuid()}, ${userId}, ${content}, ${article.source}, ${article.title},
              ${JSON.stringify(metadata)}::jsonb,
              ${article.addedAt ? new Date(article.addedAt) : new Date()},
              NOW()
            )
          `);
          imported++;
        } catch {}
      }

      return NextResponse.json({
        success: true,
        imported,
        skipped,
        total: articles.length,
        source: action === 'import-pocket' ? 'pocket' : 'instapaper',
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
