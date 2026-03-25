/**
 * Telegram Importer — Portable logic module
 *
 * Extracted from the route for convergence with codex runtime.
 * Handles: Telegram Desktop JSON export parsing, message grouping,
 * text entity extraction, link extraction.
 */

// ─── Types ────────────────────────────────────────────────────

export interface ParsedMessage {
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

export interface TelegramMemory {
  content: string;
  title: string;
  metadata: Record<string, any>;
  createdAt: Date;
  dedupKey: string;
}

export interface TelegramParseResult {
  messages: ParsedMessage[];
  chatName: string;
  chatType: string;
}

export interface TelegramImportResult {
  memories: TelegramMemory[];
  totalMessages: number;
  filteredMessages: number;
  groups: number;
}

// ─── Text Extraction ─────────────────────────────────────────

/**
 * Extract text from Telegram's mixed-content format.
 * Telegram exports text as either a plain string or an array of
 * string/object parts (bold, italic, links, code, mentions).
 */
export function extractText(msg: any): string {
  if (typeof msg.text === 'string') return msg.text;
  if (Array.isArray(msg.text)) {
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

/**
 * Extract URLs from message entities and inline text parts.
 */
export function extractLinks(msg: any): string[] {
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

// ─── Export Parsing ──────────────────────────────────────────

/**
 * Parse a Telegram Desktop JSON export.
 * Handles both single-chat and full-account exports.
 */
export function parseExport(rawData: string): TelegramParseResult {
  const data = JSON.parse(rawData);

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
      if (msg.type !== 'message' && msg.type !== undefined) continue;

      const text = extractText(msg);
      if (!text || text.length < 3) continue;
      if (msg.media_type && !text) continue;

      allMessages.push({
        id: msg.id,
        text,
        date: msg.date || (msg.date_unixtime
          ? new Date(parseInt(msg.date_unixtime) * 1000).toISOString()
          : new Date().toISOString()),
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

// ─── Message Grouping ────────────────────────────────────────

/**
 * Group sequential messages from the same sender within 5 minutes
 * into logical conversation chunks. This creates more meaningful memories.
 */
export function groupMessages(messages: ParsedMessage[]): ParsedMessage[][] {
  const groups: ParsedMessage[][] = [];
  let currentGroup: ParsedMessage[] = [];

  for (const msg of messages) {
    if (currentGroup.length === 0) {
      currentGroup.push(msg);
      continue;
    }

    const lastMsg = currentGroup[currentGroup.length - 1];
    const timeDiff = Math.abs(
      new Date(msg.date).getTime() - new Date(lastMsg.date).getTime()
    );

    if (msg.from === lastMsg.from && msg.chatName === lastMsg.chatName && timeDiff < 5 * 60 * 1000) {
      currentGroup.push(msg);
    } else {
      groups.push(currentGroup);
      currentGroup = [msg];
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  return groups;
}

// ─── Memory Formatting ───────────────────────────────────────

/**
 * Convert a message group into a memory-ready object.
 */
export function formatGroupMemory(group: ParsedMessage[]): TelegramMemory {
  const content = group.map(m => m.text).join('\n\n');
  const first = group[0];

  const title = first.chatName === 'Saved Messages'
    ? `Saved: ${content.slice(0, 60)}...`
    : `${first.chatName} — ${first.from}: ${content.slice(0, 50)}...`;

  const metadata: Record<string, any> = {
    telegramMsgId: first.id,
    chatName: first.chatName,
    chatType: first.chatType,
    from: first.from,
    messageCount: group.length,
    source: 'telegram',
    importedVia: 'telegram-importer-plugin',
  };

  if (first.forwardedFrom) metadata.forwardedFrom = first.forwardedFrom;
  if (first.links && first.links.length > 0) metadata.links = first.links;

  return {
    content,
    title,
    metadata,
    createdAt: new Date(first.date),
    dedupKey: first.id.toString(),
  };
}

/**
 * Process a full Telegram import: parse, filter, group, format.
 */
export function processImport(opts: {
  rawData: string;
  chatFilter?: string[];
  minLength?: number;
}): TelegramImportResult {
  const { rawData, chatFilter, minLength = 10 } = opts;

  const { messages, chatName, chatType } = parseExport(rawData);

  let filtered = messages;
  if (chatFilter && chatFilter.length > 0) {
    filtered = messages.filter(m => chatFilter.includes(m.chatType));
  }
  filtered = filtered.filter(m => m.text.length >= minLength);

  const groups = groupMessages(filtered);
  const memories = groups.map(formatGroupMemory);

  return {
    memories,
    totalMessages: messages.length,
    filteredMessages: filtered.length,
    groups: groups.length,
  };
}
