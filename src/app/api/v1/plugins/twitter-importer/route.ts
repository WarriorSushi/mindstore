/**
 * Twitter/X Bookmarks Importer — Route (thin wrapper)
 *
 * POST  — Parse uploaded Twitter archive JSON or manual tweet entry
 * GET   — Config info and import stats
 *
 * Logic delegated to src/server/plugins/ports/twitter-importer.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/server/user";
import { importDocuments } from "@/server/import-service";
import {
  processArchiveImport,
  formatManualTweets,
} from "@/server/plugins/ports/twitter-importer";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";
import { PLUGIN_MANIFESTS } from "@/server/plugins/registry";

const PLUGIN_SLUG = "twitter-importer";

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
        supportedFormats: [
          {
            id: "bookmarks-js",
            name: "bookmarks.js",
            description:
              "From your Twitter data archive (Settings → Your Account → Download Archive)",
          },
          {
            id: "tweets-js",
            name: "tweets.js",
            description: "Full tweet history from your Twitter data archive",
          },
          {
            id: "json",
            name: "JSON",
            description: "Raw JSON array of tweet objects",
          },
        ],
        instructions: [
          "Go to twitter.com → Settings → Your Account → Download an archive",
          "Wait for Twitter to prepare your data (can take 24-48 hours)",
          "Download and unzip the archive",
          "Find data/bookmarks.js or data/tweets.js",
          "Upload the file here",
        ],
      });
    }

    if (action === "stats") {
      let imported = 0;
      try {
        const rows = await db.execute(sql`
          SELECT COUNT(*) as count FROM memories
          WHERE user_id = ${userId} AND source_type = 'twitter'
        `);
        imported = parseInt((rows as Record<string, string>[])[0]?.count || "0");
      } catch {
        /* ignore */
      }
      return NextResponse.json({ imported });
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

    if (action === "import-archive") {
      const { data } = body;
      if (!data) {
        return NextResponse.json({ error: "No data provided" }, { status: 400 });
      }

      const { memories, total, valid } = processArchiveImport(data);

      if (total === 0) {
        return NextResponse.json(
          { error: "No tweets found in the provided data" },
          { status: 400 },
        );
      }

      const documents = memories.map((m) => ({
        title: m.title,
        content: m.content,
        sourceType: "twitter" as const,
        sourceId: m.dedupKey,
        timestamp: m.createdAt,
        metadata: m.metadata,
      }));

      const result = await importDocuments({ userId, documents });

      return NextResponse.json({
        success: true,
        imported: result.chunks,
        embedded: result.embedded,
        total,
        validTweets: valid,
      });
    }

    if (action === "import-manual") {
      const { tweets: manualTweets } = body;
      if (!manualTweets || !Array.isArray(manualTweets) || manualTweets.length === 0) {
        return NextResponse.json({ error: "No tweets provided" }, { status: 400 });
      }

      const memories = formatManualTweets(manualTweets);
      const documents = memories.map((m) => ({
        title: m.title,
        content: m.content,
        sourceType: "twitter" as const,
        metadata: m.metadata,
      }));

      const result = await importDocuments({ userId, documents });

      return NextResponse.json({
        success: true,
        imported: result.chunks,
        embedded: result.embedded,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Could not parse") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
