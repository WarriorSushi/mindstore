/**
 * Pocket / Instapaper Importer — Route (thin wrapper)
 *
 * POST  — Parse Pocket HTML or Instapaper CSV export
 * GET   — Config info and import stats
 *
 * Logic delegated to src/server/plugins/ports/pocket-importer.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/server/user";
import { importDocuments } from "@/server/import-service";
import {
  parsePocketHTML,
  parseInstapaperCSV,
  formatArticleContent,
  buildArticleMetadata,
} from "@/server/plugins/ports/pocket-importer";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";
import { PLUGIN_MANIFESTS } from "@/server/plugins/registry";

const PLUGIN_SLUG = "pocket-importer";

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
    await getUserId();
    await ensureInstalled();

    const action = req.nextUrl.searchParams.get("action") || "config";

    if (action === "config") {
      return NextResponse.json({
        sources: [
          {
            id: "pocket",
            name: "Pocket",
            format: "HTML",
            exportUrl: "https://getpocket.com/export",
            instructions: [
              "Go to getpocket.com/export",
              "Click \"Export\" to download your data as HTML",
              "Upload the ril_export.html file here",
            ],
          },
          {
            id: "instapaper",
            name: "Instapaper",
            format: "CSV",
            exportUrl: "https://www.instapaper.com/user",
            instructions: [
              "Go to instapaper.com → Settings",
              "Click \"Export\" under Data",
              "Download the CSV file",
              "Upload it here",
            ],
          },
        ],
      });
    }

    if (action === "stats") {
      const userId = await getUserId();
      let stats = { imported: 0, pocket: 0, instapaper: 0 };
      try {
        const rows = await db.execute(sql`
          SELECT
            COUNT(*) FILTER (WHERE metadata->>'importSource' = 'pocket') as pocket,
            COUNT(*) FILTER (WHERE metadata->>'importSource' = 'instapaper') as instapaper,
            COUNT(*) as total
          FROM memories
          WHERE user_id = ${userId}
          AND metadata->>'importedVia' = 'pocket-importer-plugin'
        `);
        const row = (rows as Record<string, string>[])[0];
        stats.imported = parseInt(row?.total || "0");
        stats.pocket = parseInt(row?.pocket || "0");
        stats.instapaper = parseInt(row?.instapaper || "0");
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

    if (action === "import-pocket" || action === "import-instapaper") {
      const { data } = body;

      if (!data) {
        return NextResponse.json({ error: "No data provided" }, { status: 400 });
      }

      const articles =
        action === "import-pocket"
          ? parsePocketHTML(data)
          : parseInstapaperCSV(data);

      if (articles.length === 0) {
        const formatName =
          action === "import-pocket" ? "Pocket HTML" : "Instapaper CSV";
        return NextResponse.json(
          { error: `No articles found. Make sure you uploaded the correct ${formatName} file.` },
          { status: 400 },
        );
      }

      const documents = articles.map((article) => ({
        title: article.title,
        content: formatArticleContent(article),
        sourceType: article.source as string,
        sourceId: article.url,
        timestamp: article.addedAt ? new Date(article.addedAt) : undefined,
        metadata: buildArticleMetadata(article),
      }));

      const result = await importDocuments({ userId, documents });

      return NextResponse.json({
        success: true,
        imported: result.chunks,
        embedded: result.embedded,
        total: articles.length,
        source: action === "import-pocket" ? "pocket" : "instapaper",
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
