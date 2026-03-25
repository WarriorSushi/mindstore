/**
 * Spotify Listening History Importer — Route (thin wrapper)
 *
 * POST  — Parse uploaded Spotify streaming history
 * GET   — Config info and profile stats
 *
 * Logic delegated to src/server/plugins/ports/spotify-importer.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/server/user";
import { importDocuments } from "@/server/import-service";
import {
  parseSpotifyData,
  buildMusicProfile,
  formatArtistContent,
  formatMonthlyListening,
} from "@/server/plugins/ports/spotify-importer";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";
import { PLUGIN_MANIFESTS } from "@/server/plugins/registry";

const PLUGIN_SLUG = "spotify-importer";

async function ensureInstalled() {
  const manifest = PLUGIN_MANIFESTS[PLUGIN_SLUG];
  if (!manifest) return;
  try {
    const existing = await db.execute(
      sql`SELECT id FROM plugins WHERE slug = ${PLUGIN_SLUG}`,
    );
    if ((existing as unknown[]).length === 0) {
      await db.execute(sql`
        INSERT INTO plugins (slug, name, description, type, status, icon, category)
        VALUES (
          ${manifest.slug}, ${manifest.name}, ${manifest.description},
          ${"extension"}, ${"active"}, ${manifest.icon}, ${manifest.category}
        )
      `);
    }
  } catch {
    /* ignore */
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    await ensureInstalled();

    const action = req.nextUrl.searchParams.get("action") || "config";

    if (action === "config") {
      return NextResponse.json({
        instructions: [
          "Go to spotify.com → Account → Privacy",
          "Click \"Request data\" under \"Download your data\"",
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
          "Ask \"What kind of music do I like?\" in chat",
        ],
      });
    }

    if (action === "stats") {
      let stats = { imported: 0, hasProfile: false };
      try {
        const rows = await db.execute(sql`
          SELECT COUNT(*) as count FROM memories
          WHERE user_id = ${userId} AND source_type = 'spotify'
        `);
        stats.imported = parseInt(
          (rows as Record<string, string>[])[0]?.count || "0",
        );
        stats.hasProfile = stats.imported > 0;
      } catch {
        /* ignore */
      }
      return NextResponse.json(stats);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    await ensureInstalled();

    const body = await req.json();
    const action = body.action;

    if (action === "import") {
      const { data } = body;

      if (!data) {
        return NextResponse.json({ error: "No data provided" }, { status: 400 });
      }

      const streams = parseSpotifyData(data);

      if (streams.length === 0) {
        return NextResponse.json(
          {
            error:
              "No streaming history found. Make sure you uploaded a StreamingHistory file.",
          },
          { status: 400 },
        );
      }

      const profile = buildMusicProfile(streams);

      // Remove old spotify memories for this user (replace with fresh import)
      try {
        await db.execute(sql`
          DELETE FROM memories
          WHERE user_id = ${userId} AND source_type = 'spotify'
        `);
      } catch {
        /* ignore */
      }

      // Build documents: taste profile + top artist summaries + monthly summary
      const documents: Array<{
        title: string;
        content: string;
        sourceType: string;
        metadata: Record<string, unknown>;
      }> = [];

      // 1. Taste profile
      documents.push({
        title: "My Music Taste Profile",
        content: profile.tasteProfile,
        sourceType: "spotify",
        metadata: {
          type: "taste-profile",
          totalHours: Math.round(profile.totalListeningMs / 3600000),
          uniqueArtists: profile.uniqueArtists,
          uniqueTracks: profile.uniqueTracks,
          importedVia: "spotify-importer-plugin",
        },
      });

      // 2. Top 20 artist summaries
      for (const artist of profile.topArtists.slice(0, 20)) {
        documents.push({
          title: `Artist: ${artist.name}`,
          content: formatArtistContent(artist),
          sourceType: "spotify",
          metadata: {
            type: "artist-profile",
            artist: artist.name,
            totalMs: artist.totalMs,
            trackCount: artist.trackCount,
            importedVia: "spotify-importer-plugin",
          },
        });
      }

      // 3. Monthly listening summary
      const months = Object.keys(profile.listeningByMonth);
      if (months.length > 0) {
        documents.push({
          title: "Monthly Listening History",
          content: formatMonthlyListening(profile.listeningByMonth),
          sourceType: "spotify",
          metadata: {
            type: "monthly-summary",
            months: months.length,
            importedVia: "spotify-importer-plugin",
          },
        });
      }

      const result = await importDocuments({ userId, documents });

      return NextResponse.json({
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
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
