/**
 * Twitter/X Importer — Portable logic module
 *
 * Extracted from the route for convergence with codex runtime.
 * Handles: Twitter archive parsing (bookmarks.js, tweets.js),
 * JS module format detection, tweet formatting, manual import.
 */

// ─── Types ────────────────────────────────────────────────────

export interface ParsedTweet {
  id: string;
  text: string;
  author?: string;
  authorHandle?: string;
  createdAt?: string;
  likes?: number;
  retweets?: number;
  urls?: string[];
  mediaUrls?: string[];
  isThread?: boolean;
  threadPosition?: number;
  inReplyTo?: string;
  hashtags?: string[];
}

export interface TwitterMemory {
  content: string;
  title: string;
  metadata: Record<string, any>;
  createdAt: Date;
  dedupKey: string;
}

// ─── Archive Parsing ─────────────────────────────────────────

/**
 * Extract JSON array from Twitter's JS module format.
 * Twitter exports data as `window.YTD.bookmark.part0 = [...]`
 * This extracts the JSON array portion.
 */
function extractJsonFromJsModule(rawData: string): any[] {
  let jsonStr = rawData;

  // Handle Twitter's JS module format
  const match = rawData.match(/=\s*(\[[\s\S]*\])\s*;?\s*$/);
  if (match) {
    jsonStr = match[1];
  }

  return JSON.parse(jsonStr);
}

/**
 * Parse Twitter archive bookmarks or tweets export.
 * Handles both bookmarks.js and tweets.js formats.
 */
export function parseArchive(rawData: string): ParsedTweet[] {
  const tweets: ParsedTweet[] = [];

  try {
    const data = extractJsonFromJsModule(rawData);

    for (const item of data) {
      const tweet = item.bookmark || item.tweet || item;

      // Handle bookmark-only format (just tweetId, no text)
      if (tweet.tweetId && !tweet.full_text && !tweet.text) {
        tweets.push({
          id: tweet.tweetId,
          text: `[Bookmarked tweet ID: ${tweet.tweetId}]`,
          createdAt: tweet.created_at || undefined,
        });
        continue;
      }

      const text = tweet.full_text || tweet.text || '';
      const entities = tweet.entities || {};

      tweets.push({
        id: tweet.id_str || tweet.id || '',
        text,
        author: tweet.user?.name || tweet.core?.user_results?.result?.legacy?.name || undefined,
        authorHandle: tweet.user?.screen_name || tweet.core?.user_results?.result?.legacy?.screen_name || undefined,
        createdAt: tweet.created_at || undefined,
        likes: parseInt(tweet.favorite_count || tweet.public_metrics?.like_count || '0'),
        retweets: parseInt(tweet.retweet_count || tweet.public_metrics?.retweet_count || '0'),
        urls: entities.urls?.map((u: any) => u.expanded_url).filter(Boolean) || [],
        mediaUrls: (entities.media || tweet.extended_entities?.media)?.map((m: any) => m.media_url_https || m.url).filter(Boolean) || [],
        hashtags: entities.hashtags?.map((h: any) => h.text || h.tag).filter(Boolean) || [],
        inReplyTo: tweet.in_reply_to_status_id_str || undefined,
      });
    }
  } catch {
    // Fallback: try parsing as tweets.js
    try {
      const data = extractJsonFromJsModule(rawData);
      for (const item of data) {
        const tweet = item.tweet || item;
        tweets.push({
          id: tweet.id_str || tweet.id || '',
          text: tweet.full_text || tweet.text || '',
          createdAt: tweet.created_at || undefined,
          likes: parseInt(tweet.favorite_count || '0'),
          retweets: parseInt(tweet.retweet_count || '0'),
          hashtags: tweet.entities?.hashtags?.map((h: any) => h.text).filter(Boolean) || [],
        });
      }
    } catch {
      throw new Error(
        'Could not parse Twitter data. Expected bookmarks.js or tweets.js from your Twitter archive.'
      );
    }
  }

  return tweets;
}

// ─── Content Formatting ──────────────────────────────────────

/**
 * Format a parsed tweet into a memory-ready object.
 */
export function formatTweetMemory(tweet: ParsedTweet): TwitterMemory {
  let content = tweet.text;

  // Add author attribution
  if (tweet.author || tweet.authorHandle) {
    const attribution = tweet.authorHandle
      ? `@${tweet.authorHandle}${tweet.author ? ` (${tweet.author})` : ''}`
      : tweet.author;
    content = `${attribution}:\n\n${content}`;
  }

  // Add linked URLs
  if (tweet.urls && tweet.urls.length > 0) {
    content += '\n\nLinks:\n' + tweet.urls.map(u => `- ${u}`).join('\n');
  }

  // Add hashtags
  if (tweet.hashtags && tweet.hashtags.length > 0) {
    content += '\n\nHashtags: ' + tweet.hashtags.map(h => `#${h}`).join(' ');
  }

  // Build title
  const title = tweet.authorHandle
    ? `@${tweet.authorHandle}: ${tweet.text.slice(0, 60)}...`
    : tweet.text.slice(0, 80);

  // Build metadata
  const metadata: Record<string, any> = {
    tweetId: tweet.id,
    source: 'twitter',
    importedVia: 'twitter-importer-plugin',
  };

  if (tweet.author) metadata.author = tweet.author;
  if (tweet.authorHandle) metadata.authorHandle = tweet.authorHandle;
  if (tweet.likes) metadata.likes = tweet.likes;
  if (tweet.retweets) metadata.retweets = tweet.retweets;
  if (tweet.mediaUrls?.length) metadata.mediaUrls = tweet.mediaUrls;
  if (tweet.hashtags?.length) metadata.tags = tweet.hashtags;
  if (tweet.createdAt) metadata.originalDate = tweet.createdAt;

  return {
    content,
    title,
    metadata,
    createdAt: tweet.createdAt ? new Date(tweet.createdAt) : new Date(),
    dedupKey: tweet.id,
  };
}

/**
 * Process a Twitter archive import: parse, filter meaningful tweets, format.
 */
export function processArchiveImport(rawData: string): {
  memories: TwitterMemory[];
  total: number;
  valid: number;
} {
  const tweets = parseArchive(rawData);
  
  // Filter out tweets with no meaningful text
  const valid = tweets.filter(
    t => t.text && t.text.length > 5 && !t.text.startsWith('[Bookmarked tweet ID:')
  );

  const memories = valid.map(formatTweetMemory);

  return { memories, total: tweets.length, valid: valid.length };
}

/**
 * Format manually entered tweets.
 */
export function formatManualTweets(
  tweets: Array<{ text?: string; content?: string; author?: string; url?: string }>
): TwitterMemory[] {
  const memories: TwitterMemory[] = [];

  for (const tweet of tweets) {
    const content = tweet.text || tweet.content || '';
    if (!content || content.length < 3) continue;

    const metadata: Record<string, any> = {
      source: 'twitter',
      importedVia: 'twitter-importer-plugin-manual',
    };
    if (tweet.author) metadata.author = tweet.author;
    if (tweet.url) metadata.url = tweet.url;

    memories.push({
      content,
      title: content.slice(0, 80),
      metadata,
      createdAt: new Date(),
      dedupKey: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });
  }

  return memories;
}
