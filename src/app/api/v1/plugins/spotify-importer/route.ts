/**
 * Spotify Listening History Importer — Route (thin wrapper)
 *
 * POST ?action=import    — Parse uploaded Spotify streaming history
 * GET  ?action=config    — Get import configuration
 * GET  ?action=stats     — Get music taste profile
 *
 * Logic delegated to src/server/plugins/ports/spotify-importer.ts
 */

import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import {
  parseSpotifyData,
  buildMusicProfile,
  formatArtistContent,
  formatMonthlyListening,
} from '@/server/plugins/ports/spotify-importer';

const PLUGIN_SLUG = 'spotify-importer';

async function ensurePluginInstalled() {
  try {
    const existing = await db.execute(sql`SELECT id FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
    if ((existing as any[]).length === 0) {
      await db.execute(sql`
        INSERT INTO plugins (slug, name, description, type, status, icon, category)
        VALUES (
          ${PLUGIN_SLUG},
          'Spotify Listening History',
          'Import listening history and build a music taste profile as knowledge.',
          'extension',
          'active',
          'Music',
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
        instructions: [
          'Go to spotify.com → Account → Privacy',
          'Click "Request data" under "Download your data"',
          'Wait for Spotify to email you (usually 5-30 days)',
          'Download and unzip the file',
          'Find StreamingHistory_music_0.json (or similar)',
          'Upload it here',
        ],
        expectedFiles: [
          'StreamingHistory_music_0.json',
          'StreamingHistory_music_1.json',
          'Streaming_History_Audio_*.json (extended format)',
        ],
        features: [
          'Builds a music taste profile as searchable knowledge',
          'Top artists, tracks, and albums',
          'Monthly listening patterns',
          'Ask "What kind of music do I like?" in chat',
        ],
      });
    }

    if (action === 'stats') {
      let stats = { imported: 0, hasProfile: false };
      try {
        const rows = await db.execute(sql`
          SELECT COUNT(*) as count FROM memories 
          WHERE user_id = ${userId} AND source_type = 'spotify'
        `);
        stats.imported = parseInt((rows as any[])[0]?.count || '0');
        stats.hasProfile = stats.imported > 0;
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
      const { data } = body;

      if (!data) {
        return NextResponse.json({ error: 'No data provided' }, { status: 400 });
      }

      const streams = parseSpotifyData(data);

      if (streams.length === 0) {
        return NextResponse.json({
          error: 'No streaming history found. Make sure you uploaded a StreamingHistory file.',
        }, { status: 400 });
      }

      const profile = buildMusicProfile(streams);

      // Remove old spotify memories for this user (replace with fresh import)
      try {
        await db.execute(sql`
          DELETE FROM memories 
          WHERE user_id = ${userId} AND source_type = 'spotify'
        `);
      } catch {}

      let imported = 0;

      // 1. Save the taste profile as a memory
      try {
        await db.execute(sql`
          INSERT INTO memories (id, user_id, content, source_type, source_title, metadata, imported_at)
          VALUES (
            ${uuid()}, ${userId}, ${profile.tasteProfile}, 'spotify', 'My Music Taste Profile',
            ${JSON.stringify({
              type: 'taste-profile',
              totalHours: Math.round(profile.totalListeningMs / 3600000),
              uniqueArtists: profile.uniqueArtists,
              uniqueTracks: profile.uniqueTracks,
              importedVia: 'spotify-importer-plugin',
            })}::jsonb,
            NOW()
          )
        `);
        imported++;
      } catch {}

      // 2. Save top 20 artist summaries as individual memories
      for (const artist of profile.topArtists.slice(0, 20)) {
        const content = formatArtistContent(artist);

        try {
          await db.execute(sql`
            INSERT INTO memories (id, user_id, content, source_type, source_title, metadata, imported_at)
            VALUES (
              ${uuid()}, ${userId}, ${content}, 'spotify', ${`Artist: ${artist.name}`},
              ${JSON.stringify({
                type: 'artist-profile',
                artist: artist.name,
                totalMs: artist.totalMs,
                trackCount: artist.trackCount,
                importedVia: 'spotify-importer-plugin',
              })}::jsonb,
              NOW()
            )
          `);
          imported++;
        } catch {}
      }

      // 3. Save monthly listening summary
      const months = Object.entries(profile.listeningByMonth)
        .sort(([a], [b]) => a.localeCompare(b));

      if (months.length > 0) {
        const monthContent = formatMonthlyListening(profile.listeningByMonth);

        try {
          await db.execute(sql`
            INSERT INTO memories (id, user_id, content, source_type, source_title, metadata, imported_at)
            VALUES (
              ${uuid()}, ${userId}, ${monthContent}, 'spotify', 'Monthly Listening History',
              ${JSON.stringify({
                type: 'monthly-summary',
                months: months.length,
                importedVia: 'spotify-importer-plugin',
              })}::jsonb,
              NOW()
            )
          `);
          imported++;
        } catch {}
      }

      return NextResponse.json({
        success: true,
        imported,
        stats: {
          totalStreams: streams.length,
          totalHours: Math.round(profile.totalListeningMs / 3600000),
          uniqueArtists: profile.uniqueArtists,
          uniqueTracks: profile.uniqueTracks,
          topArtist: profile.topArtists[0]?.name || 'N/A',
        },
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
