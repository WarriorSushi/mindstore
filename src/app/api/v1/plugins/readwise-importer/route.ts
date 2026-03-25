/**
 * Readwise Importer Plugin — Route (thin wrapper)
 *
 * POST ?action=import      — Fetch and import all highlights via Readwise API
 * POST ?action=save-token  — Save Readwise API token
 * GET  ?action=config      — Get configuration and token status
 * GET  ?action=stats       — Get imported highlights stats
 *
 * Logic delegated to src/server/plugins/ports/readwise-importer.ts
 */

import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/server/db';
import { sql, eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import {
  validateToken,
  processImport,
} from '@/server/plugins/ports/readwise-importer';

const PLUGIN_SLUG = 'readwise-importer';

async function ensureInstalled() {
  try {
    const existing = await db.select().from(schema.plugins).where(eq(schema.plugins.slug, PLUGIN_SLUG)).limit(1);
    if (existing.length === 0) {
      await db.insert(schema.plugins).values({
        slug: PLUGIN_SLUG,
        name: 'Readwise Highlights',
        description: 'Import all your Readwise highlights — books, articles, tweets, podcasts.',
        version: '1.0.0',
        type: 'extension',
        status: 'active',
        icon: 'Highlighter',
        category: 'import',
        config: {},
      });
    }
  } catch {}
}

async function getPluginConfig(): Promise<Record<string, any>> {
  try {
    const rows = await db.execute(sql`SELECT config FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
    const row = (rows as any[])[0];
    if (!row?.config) return {};
    return typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
  } catch { return {}; }
}

async function savePluginConfig(config: Record<string, any>) {
  await db.execute(sql`
    UPDATE plugins SET config = ${JSON.stringify(config)}::jsonb, updated_at = NOW()
    WHERE slug = ${PLUGIN_SLUG}
  `);
}

// ─── GET ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    await ensureInstalled();

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'config';

    if (action === 'config') {
      const config = await getPluginConfig();
      return NextResponse.json({
        hasToken: !!config.readwiseToken,
        lastSync: config.lastSync || null,
        totalImported: config.totalImported || 0,
        instructions: [
          'Get your Readwise API token from readwise.io/access_token',
          'Paste it below and click Save',
          'Click Import to fetch all your highlights',
          'Supports: Books, Articles, Tweets, Podcasts, Supplementals',
        ],
        categories: ['books', 'articles', 'tweets', 'podcasts', 'supplementals'],
      });
    }

    if (action === 'stats') {
      let stats = { imported: 0, books: 0, articles: 0, tweets: 0, podcasts: 0, other: 0 };
      try {
        const rows = await db.execute(sql`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE metadata->>'readwiseCategory' = 'books') as books,
            COUNT(*) FILTER (WHERE metadata->>'readwiseCategory' = 'articles') as articles,
            COUNT(*) FILTER (WHERE metadata->>'readwiseCategory' = 'tweets') as tweets,
            COUNT(*) FILTER (WHERE metadata->>'readwiseCategory' = 'podcasts') as podcasts
          FROM memories WHERE user_id = ${userId} AND source_type = 'readwise'
        `);
        const row = (rows as any[])[0];
        stats.imported = parseInt(row?.total || '0');
        stats.books = parseInt(row?.books || '0');
        stats.articles = parseInt(row?.articles || '0');
        stats.tweets = parseInt(row?.tweets || '0');
        stats.podcasts = parseInt(row?.podcasts || '0');
        stats.other = stats.imported - stats.books - stats.articles - stats.tweets - stats.podcasts;
      } catch {}
      return NextResponse.json(stats);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ─── POST ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    await ensureInstalled();
    const body = await req.json();
    const action = body.action;

    if (action === 'save-token') {
      const { token } = body;
      if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

      try {
        const valid = await validateToken(token);
        if (!valid) return NextResponse.json({ error: 'Invalid Readwise API token' }, { status: 400 });
      } catch {
        return NextResponse.json({ error: 'Could not validate token — check your internet connection' }, { status: 400 });
      }

      const config = await getPluginConfig();
      config.readwiseToken = token;
      await savePluginConfig(config);
      return NextResponse.json({ success: true });
    }

    if (action === 'import') {
      const config = await getPluginConfig();
      const token = body.token || config.readwiseToken;
      if (!token) return NextResponse.json({ error: 'No Readwise API token configured. Add one first.' }, { status: 400 });

      const { categories, dedup = true } = body;
      const result = await processImport({ token, categories, updatedAfter: config.lastSync });

      if (result.memories.length === 0) {
        return NextResponse.json({
          success: true, imported: 0,
          message: config.lastSync ? 'No new highlights since last sync.' : 'No highlights found in your Readwise account.',
        });
      }

      let imported = 0;
      let skipped = 0;

      for (const memory of result.memories) {
        // Dedup check
        if (dedup) {
          try {
            const existing = await db.execute(sql`
              SELECT id FROM memories WHERE user_id = ${userId} AND source_type = 'readwise'
              AND metadata->>'readwiseHighlightId' = ${memory.dedupKey} LIMIT 1
            `);
            if ((existing as any[]).length > 0) { skipped++; continue; }
          } catch {}
        }

        try {
          await db.execute(sql`
            INSERT INTO memories (id, user_id, content, source_type, source_title, metadata, created_at, imported_at)
            VALUES (${uuid()}, ${userId}, ${memory.content}, 'readwise', ${memory.title},
              ${JSON.stringify(memory.metadata)}::jsonb, ${memory.createdAt}, NOW())
          `);
          imported++;
        } catch {}
      }

      config.lastSync = new Date().toISOString();
      config.totalImported = (config.totalImported || 0) + imported;
      await savePluginConfig(config);

      return NextResponse.json({
        success: true, imported, skipped,
        totalHighlights: result.memories.length + skipped,
        booksProcessed: result.booksProcessed,
        categories: result.categories,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
