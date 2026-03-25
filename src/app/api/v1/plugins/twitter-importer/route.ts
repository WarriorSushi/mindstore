import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

/**
 * Twitter/X Bookmarks Importer Plugin
 * 
 * Imports saved/bookmarked tweets from Twitter/X data exports.
 * Users can download their data from Settings → Your Account → Download Archive.
 * The archive contains bookmarks.js and tweets.js with full tweet data.
 * 
 * POST ?action=import-archive  — Parse uploaded Twitter archive JSON
 * POST ?action=import-manual   — Manual entry of tweets/thread URLs
 * GET  ?action=config          — Get import configuration
 * GET  ?action=stats           — Get imported Twitter memories stats
 */

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

// ─── Twitter Data Parsing ────────────────────────────────────

interface ParsedTweet {
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

function parseTwitterArchiveBookmarks(rawData: string): ParsedTweet[] {
  const tweets: ParsedTweet[] = [];

  try {
    // Twitter archive format: window.YTD.bookmark.part0 = [...]
    let jsonStr = rawData;
    
    // Handle Twitter's JS module format
    const match = rawData.match(/=\s*(\[[\s\S]*\])\s*;?\s*$/);
    if (match) {
      jsonStr = match[1];
    }

    // Also handle plain JSON array
    const data = JSON.parse(jsonStr);

    for (const item of data) {
      const tweet = item.bookmark || item.tweet || item;
      
      // Handle the nested tweetId format from bookmarks
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
        id: tweet.id_str || tweet.id || uuid(),
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
  } catch (e) {
    // Try parsing as tweets.js format
    try {
      let jsonStr = rawData;
      const match = rawData.match(/=\s*(\[[\s\S]*\])\s*;?\s*$/);
      if (match) jsonStr = match[1];
      const data = JSON.parse(jsonStr);

      for (const item of data) {
        const tweet = item.tweet || item;
        tweets.push({
          id: tweet.id_str || tweet.id || uuid(),
          text: tweet.full_text || tweet.text || '',
          createdAt: tweet.created_at || undefined,
          likes: parseInt(tweet.favorite_count || '0'),
          retweets: parseInt(tweet.retweet_count || '0'),
          hashtags: tweet.entities?.hashtags?.map((h: any) => h.text).filter(Boolean) || [],
        });
      }
    } catch {
      throw new Error('Could not parse Twitter data. Expected bookmarks.js or tweets.js from your Twitter archive.');
    }
  }

  return tweets;
}

function formatTweetAsMemory(tweet: ParsedTweet): { content: string; metadata: Record<string, any> } {
  let content = tweet.text;

  // Add author attribution if available
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

  return { content, metadata };
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

      const tweets = parseTwitterArchiveBookmarks(data);

      if (tweets.length === 0) {
        return NextResponse.json({ error: 'No tweets found in the provided data' }, { status: 400 });
      }

      // Filter out tweets with no meaningful text
      const validTweets = tweets.filter(t => t.text && t.text.length > 5 && !t.text.startsWith('[Bookmarked tweet ID:'));

      let imported = 0;
      let skipped = 0;

      for (const tweet of validTweets) {
        // Dedup check
        if (dedup) {
          try {
            const existing = await db.execute(sql`
              SELECT id FROM memories 
              WHERE user_id = ${userId} 
              AND source_type = 'twitter'
              AND metadata->>'tweetId' = ${tweet.id}
              LIMIT 1
            `);
            if ((existing as any[]).length > 0) {
              skipped++;
              continue;
            }
          } catch {}
        }

        const { content, metadata } = formatTweetAsMemory(tweet);
        const title = tweet.authorHandle
          ? `@${tweet.authorHandle}: ${tweet.text.slice(0, 60)}...`
          : tweet.text.slice(0, 80);

        try {
          await db.execute(sql`
            INSERT INTO memories (id, user_id, content, source_type, source_title, metadata, created_at, imported_at)
            VALUES (
              ${uuid()}, ${userId}, ${content}, 'twitter', ${title},
              ${JSON.stringify(metadata)}::jsonb,
              ${tweet.createdAt ? new Date(tweet.createdAt) : new Date()},
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
        total: tweets.length,
        validTweets: validTweets.length,
      });
    }

    if (action === 'import-manual') {
      const { tweets: manualTweets } = body;

      if (!manualTweets || !Array.isArray(manualTweets) || manualTweets.length === 0) {
        return NextResponse.json({ error: 'No tweets provided' }, { status: 400 });
      }

      let imported = 0;
      for (const tweet of manualTweets) {
        const content = tweet.text || tweet.content || '';
        if (!content || content.length < 3) continue;

        const metadata: Record<string, any> = {
          source: 'twitter',
          importedVia: 'twitter-importer-plugin-manual',
        };
        if (tweet.author) metadata.author = tweet.author;
        if (tweet.url) metadata.url = tweet.url;

        try {
          await db.execute(sql`
            INSERT INTO memories (id, user_id, content, source_type, source_title, metadata, imported_at)
            VALUES (
              ${uuid()}, ${userId}, ${content}, 'twitter',
              ${content.slice(0, 80)},
              ${JSON.stringify(metadata)}::jsonb,
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
