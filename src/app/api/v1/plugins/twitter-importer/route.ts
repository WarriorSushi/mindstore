/**
 * Twitter/X Bookmarks Importer — Route (thin wrapper)
 *
 * POST ?action=import-archive  — Parse uploaded Twitter archive JSON
 * POST ?action=import-manual   — Manual entry of tweets/thread URLs
 * GET  ?action=config          — Get import configuration
 * GET  ?action=stats           — Get imported Twitter memories stats
 *
 * Logic delegated to src/server/plugins/ports/twitter-importer.ts
 */

import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import {
  parseArchive,
  formatTweetMemory,
  processArchiveImport,
  formatManualTweets,
} from '@/server/plugins/ports/twitter-importer';

const PLUGIN_SLUG = 'twitter-importer';

async function ensurePluginInstalled() {
  try {
    const existing = await db.execute(sql`SELECT id FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
    if ((existing as any[]).length === 0) {
      await db.execute(sql`
        INSERT INTO plugins (slug, name, description, type, status, icon, category)
        VALUES (
          ${PLUGIN_SLUG},
          'Twitter/X Bookmarks',
          'Import saved tweets and bookmarks from your Twitter/X data archive.',
          'extension',
          'active',
          'AtSign',
          'import'
        )
      `);
    }
  } catch {}
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
        supportedFormats: [
          {
            id: 'bookmarks-js',
            name: 'bookmarks.js',
            description: 'From your Twitter data archive (Settings → Your Account → Download Archive)',
          },
          {
            id: 'tweets-js',
            name: 'tweets.js',
            description: 'Full tweet history from your Twitter data archive',
          },
          {
            id: 'json',
            name: 'JSON',
            description: 'Raw JSON array of tweet objects',
          },
        ],
        instructions: [
          'Go to twitter.com → Settings → Your Account → Download an archive',
          'Wait for Twitter to prepare your data (can take 24-48 hours)',
          'Download and unzip the archive',
          'Find data/bookmarks.js or data/tweets.js',
          'Upload the file here',
        ],
      });
    }

    if (action === 'stats') {
      let stats = { imported: 0, authors: 0, totalLikes: 0 };
      try {
        const rows = await db.execute(sql`
          SELECT COUNT(*) as count FROM memories 
          WHERE user_id = ${userId} AND source_type = 'twitter'
        `);
        stats.imported = parseInt((rows as any[])[0]?.count || '0');
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

    if (action === 'import-archive') {
      const { data, dedup = true } = body;

      if (!data) {
        return NextResponse.json({ error: 'No data provided' }, { status: 400 });
      }

      const { memories, total, valid } = processArchiveImport(data);

      if (total === 0) {
        return NextResponse.json({ error: 'No tweets found in the provided data' }, { status: 400 });
      }

      let imported = 0;
      let skipped = 0;

      for (const memory of memories) {
        // Dedup check
        if (dedup) {
          try {
            const existing = await db.execute(sql`
              SELECT id FROM memories 
              WHERE user_id = ${userId} 
              AND source_type = 'twitter'
              AND metadata->>'tweetId' = ${memory.dedupKey}
              LIMIT 1
            `);
            if ((existing as any[]).length > 0) {
              skipped++;
              continue;
            }
          } catch {}
        }

        try {
          await db.execute(sql`
            INSERT INTO memories (id, user_id, content, source_type, source_title, metadata, created_at, imported_at)
            VALUES (
              ${uuid()}, ${userId}, ${memory.content}, 'twitter', ${memory.title},
              ${JSON.stringify(memory.metadata)}::jsonb,
              ${memory.createdAt},
              NOW()
            )
          `);
          imported++;
        } catch (e) {
          // Skip individual failures
        }
      }

      return NextResponse.json({
        success: true,
        imported,
        skipped,
        total,
        validTweets: valid,
      });
    }

    if (action === 'import-manual') {
      const { tweets: manualTweets } = body;

      if (!manualTweets || !Array.isArray(manualTweets) || manualTweets.length === 0) {
        return NextResponse.json({ error: 'No tweets provided' }, { status: 400 });
      }

      const memories = formatManualTweets(manualTweets);

      let imported = 0;
      for (const memory of memories) {
        try {
          await db.execute(sql`
            INSERT INTO memories (id, user_id, content, source_type, source_title, metadata, imported_at)
            VALUES (
              ${uuid()}, ${userId}, ${memory.content}, 'twitter',
              ${memory.title},
              ${JSON.stringify(memory.metadata)}::jsonb,
              NOW()
            )
          `);
          imported++;
        } catch {}
      }

      return NextResponse.json({ success: true, imported });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
