/**
 * Twitter/X Bookmarks Importer — Route (thin wrapper)
 *
 * GET   — Config info and import stats
 * POST  — Parse uploaded Twitter archive JSON or manual tweet entry
 *
 * Logic delegated to src/server/plugins/ports/twitter-importer.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/server/user";
import {
  ensureInstalled,
  getTwitterConfig,
  getTwitterStats,
  importArchive,
  importManual,
} from "@/server/plugins/ports/twitter-importer";

export async function GET(req: NextRequest) {
  try {
    await ensureInstalled();
    const userId = await getUserId();
    const action = req.nextUrl.searchParams.get("action") || "config";

    if (action === "config") return NextResponse.json(getTwitterConfig());
    if (action === "stats") return NextResponse.json(await getTwitterStats(userId));
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

    if (body.action === "import-archive") {
      if (!body.data) return NextResponse.json({ error: "No data provided" }, { status: 400 });
      return NextResponse.json(await importArchive(userId, body.data));
    }

    if (body.action === "import-manual") {
      if (!body.tweets || !Array.isArray(body.tweets) || body.tweets.length === 0) {
        return NextResponse.json({ error: "No tweets provided" }, { status: 400 });
      }
      return NextResponse.json(await importManual(userId, body.tweets));
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Could not parse") || message.includes("No tweets") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
