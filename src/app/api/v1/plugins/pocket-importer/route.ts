/**
 * Pocket / Instapaper Importer — Route (thin wrapper)
 *
 * GET   — Config info and import stats
 * POST  — Parse Pocket HTML or Instapaper CSV export
 *
 * Logic delegated to src/server/plugins/ports/pocket-importer.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/server/user";
import {
  ensureInstalled,
  getPocketConfig,
  getPocketStats,
  runImport,
} from "@/server/plugins/ports/pocket-importer";

export async function GET(req: NextRequest) {
  try {
    await ensureInstalled();
    const action = req.nextUrl.searchParams.get("action") || "config";

    if (action === "config") return NextResponse.json(getPocketConfig());
    if (action === "stats") {
      const userId = await getUserId();
      return NextResponse.json(await getPocketStats(userId));
    }
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

    if (body.action === "import-pocket" || body.action === "import-instapaper") {
      if (!body.data) return NextResponse.json({ error: "No data provided" }, { status: 400 });
      return NextResponse.json(await runImport(userId, body.action, body.data));
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
