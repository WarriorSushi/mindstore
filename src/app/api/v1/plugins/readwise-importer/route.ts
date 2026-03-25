/**
 * Readwise Highlights Importer — Route (thin wrapper)
 *
 * POST  — Import highlights via Readwise API, or save API token
 * GET   — Config info and import stats
 *
 * Logic delegated to src/server/plugins/ports/readwise-importer.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/server/user";
import { importDocuments } from "@/server/import-service";
import {
  validateToken,
  processImport,
} from "@/server/plugins/ports/readwise-importer";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";
import { PLUGIN_MANIFESTS } from "@/server/plugins/registry";

const PLUGIN_SLUG = "readwise-importer";

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

async function getPluginConfig(): Promise<Record<string, unknown>> {
  try {
    const rows = await db.execute(
      sql`SELECT config FROM plugins WHERE slug = ${PLUGIN_SLUG}`,
    );
    const row = (rows as Record<string, unknown>[])[0];
    if (!row?.config) return {};
    return typeof row.config === "string"
      ? JSON.parse(row.config)
      : (row.config as Record<string, unknown>);
  } catch {
    return {};
  }
}

async function savePluginConfig(config: Record<string, unknown>) {
  await db.execute(sql`
    UPDATE plugins SET config = ${JSON.stringify(config)}::jsonb, updated_at = NOW()
    WHERE slug = ${PLUGIN_SLUG}
  `);
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    await ensureInstalled();

    const action = req.nextUrl.searchParams.get("action") || "config";

    if (action === "config") {
      const config = await getPluginConfig();
      return NextResponse.json({
        hasToken: !!config.readwiseToken,
        lastSync: config.lastSync || null,
        totalImported: config.totalImported || 0,
        instructions: [
          "Get your Readwise API token from readwise.io/access_token",
          "Paste it below and click Save",
          "Click Import to fetch all your highlights",
          "Supports: Books, Articles, Tweets, Podcasts, Supplementals",
        ],
        categories: ["books", "articles", "tweets", "podcasts", "supplementals"],
      });
    }

    if (action === "stats") {
      let stats = { imported: 0, books: 0, articles: 0, tweets: 0, podcasts: 0 };
      try {
        const rows = await db.execute(sql`
          SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE metadata->>'readwiseCategory' = 'books') as books,
            COUNT(*) FILTER (WHERE metadata->>'readwiseCategory' = 'articles') as articles,
            COUNT(*) FILTER (WHERE metadata->>'readwiseCategory' = 'tweets') as tweets,
            COUNT(*) FILTER (WHERE metadata->>'readwiseCategory' = 'podcasts') as podcasts
          FROM memories WHERE user_id = ${userId} AND source_type = 'readwise'
        `);
        const row = (rows as Record<string, string>[])[0];
        stats.imported = parseInt(row?.total || "0");
        stats.books = parseInt(row?.books || "0");
        stats.articles = parseInt(row?.articles || "0");
        stats.tweets = parseInt(row?.tweets || "0");
        stats.podcasts = parseInt(row?.podcasts || "0");
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

    if (action === "save-token") {
      const { token } = body;
      if (!token) {
        return NextResponse.json({ error: "Token required" }, { status: 400 });
      }

      try {
        const valid = await validateToken(token);
        if (!valid) {
          return NextResponse.json(
            { error: "Invalid Readwise API token" },
            { status: 400 },
          );
        }
      } catch {
        return NextResponse.json(
          { error: "Could not validate token — check your internet connection" },
          { status: 400 },
        );
      }

      const config = await getPluginConfig();
      config.readwiseToken = token;
      await savePluginConfig(config);
      return NextResponse.json({ success: true });
    }

    if (action === "import") {
      const config = await getPluginConfig();
      const token = (body.token || config.readwiseToken) as string | undefined;
      if (!token) {
        return NextResponse.json(
          { error: "No Readwise API token configured. Add one first." },
          { status: 400 },
        );
      }

      const { categories } = body;
      const result = await processImport({
        token,
        categories,
        updatedAfter: config.lastSync as string | undefined,
      });

      if (result.memories.length === 0) {
        return NextResponse.json({
          success: true,
          imported: 0,
          message: config.lastSync
            ? "No new highlights since last sync."
            : "No highlights found in your Readwise account.",
        });
      }

      const documents = result.memories.map((m) => ({
        title: m.title,
        content: m.content,
        sourceType: "readwise" as const,
        sourceId: m.dedupKey,
        timestamp: m.createdAt,
        metadata: m.metadata,
      }));

      const importResult = await importDocuments({ userId, documents });

      const updatedConfig = await getPluginConfig();
      updatedConfig.lastSync = new Date().toISOString();
      updatedConfig.totalImported =
        ((updatedConfig.totalImported as number) || 0) + importResult.chunks;
      await savePluginConfig(updatedConfig);

      return NextResponse.json({
        success: true,
        imported: importResult.chunks,
        embedded: importResult.embedded,
        totalHighlights: result.memories.length,
        booksProcessed: result.booksProcessed,
        categories: result.categories,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Invalid") || message.includes("token")
      ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
