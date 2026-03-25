/**
 * Telegram Saved Messages Importer — Route (thin wrapper)
 *
 * POST  — Parse uploaded Telegram export JSON
 * GET   — Config info and import stats
 *
 * Logic delegated to src/server/plugins/ports/telegram-importer.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/server/user";
import { importDocuments } from "@/server/import-service";
import {
  processImport,
} from "@/server/plugins/ports/telegram-importer";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";
import { PLUGIN_MANIFESTS } from "@/server/plugins/registry";

const PLUGIN_SLUG = "telegram-importer";

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
            id: "telegram-json",
            name: "Telegram Desktop JSON Export",
            description:
              "Export from Telegram Desktop: Settings → Advanced → Export Telegram Data → JSON format",
          },
          {
            id: "result-json",
            name: "result.json",
            description: "The result.json file from a Telegram data export",
          },
        ],
        instructions: [
          "Open Telegram Desktop (not mobile)",
          "Go to Settings → Advanced → Export Telegram Data",
          "Select the chats/channels you want to export",
          "Choose \"Machine-readable JSON\" format",
          "Wait for export to complete",
          "Upload the result.json file here",
        ],
        chatTypes: [
          { id: "saved_messages", label: "Saved Messages" },
          { id: "personal_chat", label: "Private Chats" },
          { id: "private_group", label: "Groups" },
          { id: "private_supergroup", label: "Supergroups" },
          { id: "public_channel", label: "Channels" },
        ],
      });
    }

    if (action === "stats") {
      let imported = 0;
      try {
        const rows = await db.execute(sql`
          SELECT COUNT(*) as count FROM memories
          WHERE user_id = ${userId} AND source_type = 'telegram'
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

    if (action === "import") {
      const { data, chatFilter, minLength = 10 } = body;

      if (!data) {
        return NextResponse.json({ error: "No data provided" }, { status: 400 });
      }

      const result = processImport({ rawData: data, chatFilter, minLength });

      if (result.totalMessages === 0) {
        return NextResponse.json(
          {
            error:
              "No messages found. Make sure you exported in JSON format from Telegram Desktop.",
          },
          { status: 400 },
        );
      }

      const documents = result.memories.map((m) => ({
        title: m.title,
        content: m.content,
        sourceType: "telegram" as const,
        sourceId: m.dedupKey,
        timestamp: m.createdAt,
        metadata: m.metadata,
      }));

      const importResult = await importDocuments({ userId, documents });

      return NextResponse.json({
        success: true,
        imported: importResult.chunks,
        embedded: importResult.embedded,
        totalMessages: result.totalMessages,
        filteredMessages: result.filteredMessages,
        groups: result.groups,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
