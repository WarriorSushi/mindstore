/**
 * Spotify Listening History Importer — Portable logic module
 *
 * Extracted from the route for convergence with codex runtime.
 * Handles: parsing Spotify streaming history JSON, building music taste profiles.
 */

import { ensurePluginInstalled } from "./plugin-config";
import { importDocuments } from "@/server/import-service";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";

const SLUG = "spotify-importer";

// ─── Plugin lifecycle ─────────────────────────────────────────

export async function ensureInstalled() {
  await ensurePluginInstalled(SLUG);
}

export function getSpotifyConfig() {
  return {
    instructions: [
      "Go to spotify.com → Account → Privacy",
      'Click "Request data" under "Download your data"',
      "Wait for Spotify to email you (usually 5-30 days)",
      "Download and unzip the file",
      "Find StreamingHistory_music_0.json (or similar)",
      "Upload it here",
    ],
    expectedFiles: [
      "StreamingHistory_music_0.json",
      "StreamingHistory_music_1.json",
      "Streaming_History_Audio_*.json (extended format)",
    ],
    features: [
      "Builds a music taste profile as searchable knowledge",
      "Top artists, tracks, and albums",
      "Monthly listening patterns",
      'Ask "What kind of music do I like?" in chat',
    ],
  };
}

export async function getSpotifyStats(userId: string) {
  let stats = { imported: 0, hasProfile: false };
  try {
    const rows = await db.execute(sql`
      SELECT COUNT(*) as count FROM memories
      WHERE user_id = ${userId} AND source_type = 'spotify'
    `);
    stats.imported = parseInt((rows as Record<string, string>[])[0]?.count || "0");
    stats.hasProfile = stats.imported > 0;
  } catch {
    /* ignore */
  }
  return stats;
}

export async function runImport(userId: string, rawData: string) {
  const streams = parseSpotifyData(rawData);
  if (streams.length === 0) {
    throw new Error(
      "No streaming history found. Make sure you uploaded a StreamingHistory file.",
    );
  }

  const profile = buildMusicProfile(streams);

  // Replace old spotify memories with fresh import
  try {
    await db.execute(sql`
      DELETE FROM memories WHERE user_id = ${userId} AND source_type = 'spotify'
    `);
  } catch {
    /* ignore */
  }

  const documents = buildImportDocuments(profile);
  const result = await importDocuments({ userId, documents });

  return {
    success: true,
    imported: result.chunks,
    embedded: result.embedded,
    stats: {
      totalStreams: streams.length,
      totalHours: Math.round(profile.totalListeningMs / 3600000),
      uniqueArtists: profile.uniqueArtists,
      uniqueTracks: profile.uniqueTracks,
      topArtist: profile.topArtists[0]?.name || "N/A",
    },
  };
}

// ─── Types ────────────────────────────────────────────────────

export interface SpotifyStream {
  artistName: string;
  trackName: string;
  albumName?: string;
  msPlayed: number;
  endTime?: string;
  ts?: string;
  platform?: string;
  reason_start?: string;
  reason_end?: string;
  shuffle?: boolean;
  skipped?: boolean;
}

export interface ArtistProfile {
  name: string;
  totalMs: number;
  trackCount: number;
  topTracks: { name: string; plays: number; totalMs: number }[];
  albums: Set<string>;
}

export interface MusicProfile {
  totalListeningMs: number;
  uniqueArtists: number;
  uniqueTracks: number;
  topArtists: ArtistProfile[];
  listeningByMonth: Record<string, number>;
  tasteProfile: string;
}

// ─── Parser ───────────────────────────────────────────────────

/**
 * Parse Spotify streaming history JSON.
 * Supports both standard and extended export formats.
 */
export function parseSpotifyData(rawData: string): SpotifyStream[] {
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

// ─── Profile Builder ─────────────────────────────────────────

/**
 * Build a music taste profile from streaming data.
 * Filters out short plays (<30s), aggregates by artist/track/month.
 */
export function buildMusicProfile(streams: SpotifyStream[]): MusicProfile {
  const artistMap = new Map<string, ArtistProfile>();
  const trackSet = new Set<string>();
  const monthMap: Record<string, number> = {};
  let totalMs = 0;

  for (const stream of streams) {
    if (stream.msPlayed < 30000) continue;

    totalMs += stream.msPlayed;
    const trackKey = `${stream.artistName} - ${stream.trackName}`;
    trackSet.add(trackKey);

    const artist = artistMap.get(stream.artistName) || {
      name: stream.artistName,
      totalMs: 0,
      trackCount: 0,
      topTracks: [],
      albums: new Set<string>(),
    };
    artist.totalMs += stream.msPlayed;

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

    const date = stream.ts || stream.endTime;
    if (date) {
      const month = date.slice(0, 7);
      monthMap[month] = (monthMap[month] || 0) + stream.msPlayed;
    }
  }

  const topArtists = Array.from(artistMap.values())
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, 50);

  for (const artist of topArtists) {
    artist.topTracks.sort((a, b) => b.totalMs - a.totalMs);
    artist.topTracks = artist.topTracks.slice(0, 5);
  }

  const tasteProfile = formatTasteProfile(topArtists, totalMs, trackSet.size, artistMap.size);

  return {
    totalListeningMs: totalMs,
    uniqueArtists: artistMap.size,
    uniqueTracks: trackSet.size,
    topArtists,
    listeningByMonth: monthMap,
    tasteProfile,
  };
}

// ─── Formatters ──────────────────────────────────────────────

function formatTasteProfile(
  topArtists: ArtistProfile[],
  totalMs: number,
  uniqueTracks: number,
  uniqueArtists: number,
): string {
  const hours = Math.round(totalMs / 3600000);
  const top5 = topArtists.slice(0, 5).map(a => a.name);

  return [
    `## My Music Taste Profile`,
    '',
    `Total listening time: ${hours} hours across ${uniqueTracks} unique tracks by ${uniqueArtists} artists.`,
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
}

export function formatArtistContent(artist: ArtistProfile): string {
  const hours = Math.round(artist.totalMs / 3600000 * 10) / 10;
  return [
    `## ${artist.name}`,
    '',
    `Listening time: ${hours} hours`,
    `Unique tracks: ${artist.trackCount}`,
    artist.albums.size > 0 ? `Albums: ${Array.from(artist.albums).slice(0, 10).join(', ')}` : '',
    '',
    '### Top Tracks',
    ...artist.topTracks.map(t => `- "${t.name}" (${t.plays} plays)`),
  ].filter(Boolean).join('\n');
}

export function formatMonthlyListening(listeningByMonth: Record<string, number>): string {
  const months = Object.entries(listeningByMonth).sort(([a], [b]) => a.localeCompare(b));

  return [
    '## Listening History by Month',
    '',
    ...months.map(([month, ms]) => {
      const hours = Math.round((ms as number) / 3600000 * 10) / 10;
      return `- **${month}**: ${hours} hours`;
    }),
  ].join('\n');
}

// ─── Import Document Builder ────────────────────────────────────

export interface SpotifyImportDocument {
  title: string;
  content: string;
  sourceType: string;
  metadata: Record<string, unknown>;
}

/**
 * Build import-ready documents from a music profile:
 * taste profile + top artist summaries + monthly summary.
 */
export function buildImportDocuments(profile: MusicProfile): SpotifyImportDocument[] {
  const documents: SpotifyImportDocument[] = [];

  // 1. Taste profile
  documents.push({
    title: 'My Music Taste Profile',
    content: profile.tasteProfile,
    sourceType: 'spotify',
    metadata: {
      type: 'taste-profile',
      totalHours: Math.round(profile.totalListeningMs / 3600000),
      uniqueArtists: profile.uniqueArtists,
      uniqueTracks: profile.uniqueTracks,
      importedVia: 'spotify-importer-plugin',
    },
  });

  // 2. Top 20 artist summaries
  for (const artist of profile.topArtists.slice(0, 20)) {
    documents.push({
      title: `Artist: ${artist.name}`,
      content: formatArtistContent(artist),
      sourceType: 'spotify',
      metadata: {
        type: 'artist-profile',
        artist: artist.name,
        totalMs: artist.totalMs,
        trackCount: artist.trackCount,
        importedVia: 'spotify-importer-plugin',
      },
    });
  }

  // 3. Monthly listening summary
  const months = Object.keys(profile.listeningByMonth);
  if (months.length > 0) {
    documents.push({
      title: 'Monthly Listening History',
      content: formatMonthlyListening(profile.listeningByMonth),
      sourceType: 'spotify',
      metadata: {
        type: 'monthly-summary',
        months: months.length,
        importedVia: 'spotify-importer-plugin',
      },
    });
  }

  return documents;
}
