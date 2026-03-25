import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

/**
 * Spotify Listening History Importer Plugin
 * 
 * Imports Spotify streaming history from privacy data exports.
 * Users request their data from: spotify.com → Account → Privacy → Download your data
 * 
 * The export contains JSON files like:
 *   StreamingHistory_music_0.json, StreamingHistory_music_1.json, etc.
 *   or (extended): Streaming_History_Audio_*.json
 * 
 * POST ?action=import    — Parse uploaded Spotify streaming history
 * GET  ?action=config    — Get import configuration
 * GET  ?action=stats     — Get music taste profile
 */

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

// ─── Spotify Data Parsing ────────────────────────────────────

interface SpotifyStream {
  artistName: string;
  trackName: string;
  albumName?: string;
  msPlayed: number;
  endTime?: string;
  ts?: string; // Extended format uses ts instead of endTime
  platform?: string;
  reason_start?: string;
  reason_end?: string;
  shuffle?: boolean;
  skipped?: boolean;
}

interface ArtistProfile {
  name: string;
  totalMs: number;
  trackCount: number;
  topTracks: { name: string; plays: number; totalMs: number }[];
  albums: Set<string>;
}

function parseSpotifyData(rawData: string): SpotifyStream[] {
  const data = JSON.parse(rawData);
  if (!Array.isArray(data)) throw new Error('Expected JSON array');

  return data.map((item: any) => ({
    artistName: item.artistName || item.master_metadata_album_artist_name || 'Unknown Artist',
    trackName: item.trackName || item.master_metadata_track_name || 'Unknown Track',
    albumName: item.albumName || item.master_metadata_album_album_name || undefined,
    msPlayed: item.msPlayed || item.ms_played || 0,
    endTime: item.endTime || undefined,
    ts: item.ts || undefined,
    platform: item.platform || undefined,
    reason_start: item.reason_start || undefined,
    reason_end: item.reason_end || undefined,
    shuffle: item.shuffle ?? undefined,
    skipped: item.skipped ?? undefined,
  }));
}

function buildMusicProfile(streams: SpotifyStream[]): {
  totalListeningMs: number;
  uniqueArtists: number;
  uniqueTracks: number;
  topArtists: ArtistProfile[];
  listeningByMonth: Record<string, number>;
  tasteProfile: string;
} {
  const artistMap = new Map<string, ArtistProfile>();
  const trackSet = new Set<string>();
  const monthMap: Record<string, number> = {};
  let totalMs = 0;

  for (const stream of streams) {
    // Skip very short plays (< 30 seconds)
    if (stream.msPlayed < 30000) continue;

    totalMs += stream.msPlayed;
    const trackKey = `${stream.artistName} - ${stream.trackName}`;
    trackSet.add(trackKey);

    // Artist aggregation
    const artist = artistMap.get(stream.artistName) || {
      name: stream.artistName,
      totalMs: 0,
      trackCount: 0,
      topTracks: [],
      albums: new Set<string>(),
    };
    artist.totalMs += stream.msPlayed;

    // Track within artist
    const existingTrack = artist.topTracks.find(t => t.name === stream.trackName);
    if (existingTrack) {
      existingTrack.plays++;
      existingTrack.totalMs += stream.msPlayed;
    } else {
      artist.topTracks.push({ name: stream.trackName, plays: 1, totalMs: stream.msPlayed });
      artist.trackCount++;
    }

    if (stream.albumName) artist.albums.add(stream.albumName);
    artistMap.set(stream.artistName, artist);

    // Monthly aggregation
    const date = stream.ts || stream.endTime;
    if (date) {
      const month = date.slice(0, 7); // YYYY-MM
      monthMap[month] = (monthMap[month] || 0) + stream.msPlayed;
    }
  }

  // Sort top artists by listening time
  const topArtists = Array.from(artistMap.values())
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, 50);

  // Sort each artist's top tracks
  for (const artist of topArtists) {
    artist.topTracks.sort((a, b) => b.totalMs - a.totalMs);
    artist.topTracks = artist.topTracks.slice(0, 5);
  }

  // Generate taste profile narrative
  const hours = Math.round(totalMs / 3600000);
  const top5 = topArtists.slice(0, 5).map(a => a.name);
  const tasteProfile = [
    `## My Music Taste Profile`,
    '',
    `Total listening time: ${hours} hours across ${trackSet.size} unique tracks by ${artistMap.size} artists.`,
    '',
    `### Top Artists`,
    ...topArtists.slice(0, 10).map((a, i) => {
      const hrs = Math.round(a.totalMs / 3600000 * 10) / 10;
      return `${i + 1}. **${a.name}** — ${hrs}h, ${a.trackCount} tracks${a.albums.size > 0 ? `, ${a.albums.size} albums` : ''}`;
    }),
    '',
    `### Most Played Tracks`,
    ...topArtists.slice(0, 5).flatMap(a =>
      a.topTracks.slice(0, 2).map(t => `- "${t.name}" by ${a.name} (${t.plays} plays)`)
    ),
    '',
    `### Listening Patterns`,
    `My most-listened artists are ${top5.join(', ')}.`,
  ].join('\n');

  return {
    totalListeningMs: totalMs,
    uniqueArtists: artistMap.size,
    uniqueTracks: trackSet.size,
    topArtists,
    listeningByMonth: monthMap,
    tasteProfile,
  };
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
        const hours = Math.round(artist.totalMs / 3600000 * 10) / 10;
        const content = [
          `## ${artist.name}`,
          '',
          `Listening time: ${hours} hours`,
          `Unique tracks: ${artist.trackCount}`,
          artist.albums.size > 0 ? `Albums: ${Array.from(artist.albums).slice(0, 10).join(', ')}` : '',
          '',
          '### Top Tracks',
          ...artist.topTracks.map(t => `- "${t.name}" (${t.plays} plays)`),
        ].filter(Boolean).join('\n');

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
        const monthContent = [
          '## Listening History by Month',
          '',
          ...months.map(([month, ms]) => {
            const hours = Math.round((ms as number) / 3600000 * 10) / 10;
            return `- **${month}**: ${hours} hours`;
          }),
        ].join('\n');

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
