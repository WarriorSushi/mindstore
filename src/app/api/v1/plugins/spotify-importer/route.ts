/**
 * Spotify Listening History Importer — Route (thin wrapper)
 *
 * GET   — Config info and profile stats
 * POST  — Parse uploaded Spotify streaming history
 *
 * Logic delegated to src/server/plugins/ports/spotify-importer.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/server/user";
import {
  ensureInstalled,
  getSpotifyConfig,
  getSpotifyStats,
  runImport,
} from "@/server/plugins/ports/spotify-importer";

export async function GET(req: NextRequest) {
  try {
    await ensureInstalled();
    const userId = await getUserId();
    const action = req.nextUrl.searchParams.get("action") || "config";

    if (action === "config") return NextResponse.json(getSpotifyConfig());
    if (action === "stats") return NextResponse.json(await getSpotifyStats(userId));
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureInstalled();
    const userId = await getUserId();
    const body = await req.json();

    if (body.action === "import") {
      if (!body.data) return NextResponse.json({ error: "No data provided" }, { status: 400 });
      return NextResponse.json(await runImport(userId, body.data));
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
