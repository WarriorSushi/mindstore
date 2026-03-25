/**
 * Pocket / Instapaper Importer Plugin — Route (thin wrapper)
 *
 * POST ?action=import-pocket       — Parse Pocket HTML export
 * POST ?action=import-instapaper   — Parse Instapaper CSV export
 * GET  ?action=config              — Get import configuration
 * GET  ?action=stats               — Get imported article stats
 *
 * Logic delegated to src/server/plugins/ports/pocket-importer.ts
 */

import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import {
  parsePocketHTML,
  parseInstapaperCSV,
  formatArticleContent,
  buildArticleMetadata,
  type SavedArticle,
} from '@/server/plugins/ports/pocket-importer';

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

        const content = formatArticleContent(article);
        const metadata = buildArticleMetadata(article);

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
