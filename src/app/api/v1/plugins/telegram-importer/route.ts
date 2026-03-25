import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

/**
 * Telegram Saved Messages Importer Plugin
 * 
 * Imports messages from Telegram Desktop JSON export.
 * Users export via: Telegram Desktop → Settings → Advanced → Export Data
 * 
 * POST ?action=import    — Parse uploaded Telegram export JSON
 * GET  ?action=config    — Get import configuration
 * GET  ?action=stats     — Get imported Telegram stats
 */

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

// ─── Telegram Data Parsing ───────────────────────────────────

interface ParsedMessage {
  id: number;
  text: string;
  date: string;
  from: string;
  fromId?: string;
  chatName: string;
  chatType: string;
  replyTo?: number;
  forwardedFrom?: string;
  mediaType?: string;
  fileName?: string;
  links?: string[];
}

function extractTextFromTelegramMessage(msg: any): string {
  if (typeof msg.text === 'string') return msg.text;
  if (Array.isArray(msg.text)) {
    // Telegram exports mixed content as array of strings and objects
    return msg.text.map((part: any) => {
      if (typeof part === 'string') return part;
      if (part.text) return part.text;
      if (part.type === 'link' || part.type === 'text_link') return part.text || part.href || '';
      if (part.type === 'mention') return part.text || '';
      if (part.type === 'code' || part.type === 'pre') return `\`${part.text || ''}\``;
      if (part.type === 'bold') return `**${part.text || ''}**`;
      if (part.type === 'italic') return `_${part.text || ''}_`;
      return part.text || '';
    }).join('');
  }
  return '';
}

function extractLinks(msg: any): string[] {
  const links: string[] = [];
  if (Array.isArray(msg.text_entities)) {
    for (const entity of msg.text_entities) {
      if (entity.type === 'link' || entity.type === 'text_link') {
        const url = entity.href || entity.text;
        if (url && url.startsWith('http')) links.push(url);
      }
    }
  }
  if (Array.isArray(msg.text)) {
    for (const part of msg.text) {
      if (typeof part === 'object') {
        if (part.href) links.push(part.href);
        if (part.type === 'link' && part.text?.startsWith('http')) links.push(part.text);
      }
    }
  }
  return [...new Set(links)];
}

function parseTelegramExport(rawData: string): { messages: ParsedMessage[]; chatName: string; chatType: string } {
  const data = JSON.parse(rawData);

  // Telegram export can be a single chat or full export
  const chats = data.chats?.list || (data.messages ? [data] : []);

  const allMessages: ParsedMessage[] = [];
  let primaryChatName = data.name || 'Telegram';
  let primaryChatType = data.type || 'personal_chat';

  for (const chat of chats) {
    const chatName = chat.name || 'Unknown Chat';
    const chatType = chat.type || 'personal_chat';
    
    if (chats.length === 1) {
      primaryChatName = chatName;
      primaryChatType = chatType;
    }

    if (!chat.messages || !Array.isArray(chat.messages)) continue;

    for (const msg of chat.messages) {
      // Skip service messages (joins, leaves, etc)
      if (msg.type !== 'message' && msg.type !== undefined) continue;

      const text = extractTextFromTelegramMessage(msg);
      if (!text || text.length < 3) continue;

      // Skip media-only messages with no text
      if (msg.media_type && !text) continue;

      allMessages.push({
        id: msg.id,
        text,
        date: msg.date || msg.date_unixtime ? new Date(parseInt(msg.date_unixtime) * 1000).toISOString() : new Date().toISOString(),
        from: msg.from || msg.actor || 'Unknown',
        fromId: msg.from_id?.toString() || msg.actor_id?.toString(),
        chatName,
        chatType,
        replyTo: msg.reply_to_message_id,
        forwardedFrom: msg.forwarded_from,
        mediaType: msg.media_type,
        fileName: msg.file,
        links: extractLinks(msg),
      });
    }
  }

  return { messages: allMessages, chatName: primaryChatName, chatType: primaryChatType };
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

      const { messages, chatName, chatType } = parseTelegramExport(data);

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

      let imported = 0;
      let skipped = 0;

      // Group nearby messages from same sender for context (within 5 minutes)
      const groups: ParsedMessage[][] = [];
      let currentGroup: ParsedMessage[] = [];

      for (const msg of filteredMessages) {
        if (currentGroup.length === 0) {
          currentGroup.push(msg);
          continue;
        }

        const lastMsg = currentGroup[currentGroup.length - 1];
        const timeDiff = Math.abs(
          new Date(msg.date).getTime() - new Date(lastMsg.date).getTime()
        );

        // Same sender within 5 minutes → group together
        if (msg.from === lastMsg.from && msg.chatName === lastMsg.chatName && timeDiff < 5 * 60 * 1000) {
          currentGroup.push(msg);
        } else {
          groups.push(currentGroup);
          currentGroup = [msg];
        }
      }
      if (currentGroup.length > 0) groups.push(currentGroup);

      for (const group of groups) {
        const content = group.map(m => m.text).join('\n\n');
        const firstMsg = group[0];

        // Build title
        const title = firstMsg.chatName === 'Saved Messages'
          ? `Saved: ${content.slice(0, 60)}...`
          : `${firstMsg.chatName} — ${firstMsg.from}: ${content.slice(0, 50)}...`;

        // Dedup check
        if (dedup) {
          try {
            const existing = await db.execute(sql`
              SELECT id FROM memories 
              WHERE user_id = ${userId} 
              AND source_type = 'telegram'
              AND metadata->>'telegramMsgId' = ${firstMsg.id.toString()}
              LIMIT 1
            `);
            if ((existing as any[]).length > 0) {
              skipped++;
              continue;
            }
          } catch {}
        }

        const metadata: Record<string, any> = {
          telegramMsgId: firstMsg.id,
          chatName: firstMsg.chatName,
          chatType: firstMsg.chatType,
          from: firstMsg.from,
          messageCount: group.length,
          source: 'telegram',
          importedVia: 'telegram-importer-plugin',
        };

        if (firstMsg.forwardedFrom) metadata.forwardedFrom = firstMsg.forwardedFrom;
        if (firstMsg.links && firstMsg.links.length > 0) metadata.links = firstMsg.links;

        try {
          await db.execute(sql`
            INSERT INTO memories (id, user_id, content, source_type, source_title, metadata, created_at, imported_at)
            VALUES (
              ${uuid()}, ${userId}, ${content}, 'telegram', ${title},
              ${JSON.stringify(metadata)}::jsonb,
              ${new Date(firstMsg.date)},
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
