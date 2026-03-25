/**
 * Telegram Saved Messages Importer — Route (thin wrapper)
 *
 * POST ?action=import    — Parse uploaded Telegram export JSON
 * GET  ?action=config    — Get import configuration
 * GET  ?action=stats     — Get imported Telegram stats
 *
 * Logic delegated to src/server/plugins/ports/telegram-importer.ts
 */

import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import {
  parseExport,
  groupMessages,
  formatGroupMemory,
  type ParsedMessage,
} from '@/server/plugins/ports/telegram-importer';

const PLUGIN_SLUG = 'telegram-importer';

async function ensurePluginInstalled() {
  try {
    const existing = await db.execute(sql`SELECT id FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
    if ((existing as any[]).length === 0) {
      await db.execute(sql`
        INSERT INTO plugins (slug, name, description, type, status, icon, category)
        VALUES (
          ${PLUGIN_SLUG},
          'Telegram Messages',
          'Import Telegram saved messages and channel history from data exports.',
          'extension',
          'active',
          'Send',
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
            id: 'telegram-json',
            name: 'Telegram Desktop JSON Export',
            description: 'Export from Telegram Desktop: Settings → Advanced → Export Telegram Data → JSON format',
          },
          {
            id: 'result-json',
            name: 'result.json',
            description: 'The result.json file from a Telegram data export',
          },
        ],
        instructions: [
          'Open Telegram Desktop (not mobile)',
          'Go to Settings → Advanced → Export Telegram Data',
          'Select the chats/channels you want to export',
          'Choose "Machine-readable JSON" format',
          'Wait for export to complete',
          'Upload the result.json file here',
        ],
        chatTypes: [
          { id: 'saved_messages', label: 'Saved Messages', description: 'Your personal saved messages' },
          { id: 'personal_chat', label: 'Private Chats', description: 'One-on-one conversations' },
          { id: 'private_group', label: 'Groups', description: 'Group conversations' },
          { id: 'private_supergroup', label: 'Supergroups', description: 'Large group chats' },
          { id: 'public_channel', label: 'Channels', description: 'Public channel messages' },
        ],
      });
    }

    if (action === 'stats') {
      let stats = { imported: 0, chats: 0 };
      try {
        const rows = await db.execute(sql`
          SELECT COUNT(*) as count FROM memories 
          WHERE user_id = ${userId} AND source_type = 'telegram'
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

    if (action === 'import') {
      const { data, chatFilter, dedup = true, minLength = 10 } = body;

      if (!data) {
        return NextResponse.json({ error: 'No data provided' }, { status: 400 });
      }

      const { messages, chatName, chatType } = parseExport(data);

      if (messages.length === 0) {
        return NextResponse.json({
          error: 'No messages found. Make sure you exported in JSON format from Telegram Desktop.',
        }, { status: 400 });
      }

      // Filter by chat type if specified
      let filteredMessages = messages;
      if (chatFilter && chatFilter.length > 0) {
        filteredMessages = messages.filter(m => chatFilter.includes(m.chatType));
      }

      // Filter by minimum length
      filteredMessages = filteredMessages.filter(m => m.text.length >= minLength);

      // Group nearby messages from same sender for context (within 5 minutes)
      const groups = groupMessages(filteredMessages);

      let imported = 0;
      let skipped = 0;

      for (const group of groups) {
        const memory = formatGroupMemory(group);

        // Dedup check
        if (dedup) {
          try {
            const existing = await db.execute(sql`
              SELECT id FROM memories 
              WHERE user_id = ${userId} 
              AND source_type = 'telegram'
              AND metadata->>'telegramMsgId' = ${memory.dedupKey}
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
              ${uuid()}, ${userId}, ${memory.content}, 'telegram', ${memory.title},
              ${JSON.stringify(memory.metadata)}::jsonb,
              ${memory.createdAt},
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
        totalMessages: messages.length,
        filteredMessages: filteredMessages.length,
        groups: groups.length,
        chatName,
        chatType,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
