/**
 * Image-to-Memory Plugin — Route (thin wrapper)
 *
 * GET  ?action=images|stats|check
 * POST multipart (analyze) | JSON action=save|reanalyze|delete|update
 *
 * Logic delegated to src/server/plugins/ports/image-to-memory.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/server/user";
import { generateEmbeddings } from "@/server/embeddings";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";
import { PLUGIN_MANIFESTS } from "@/server/plugins/registry";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE,
  extractTagsFromResponse,
  buildAnalysisPrompt,
  generateTitleFromDescription,
  formatImageMemoryContent,
  getVisionConfig,
  analyzeImage,
  ensureImageTable,
  type ContextType,
} from "@/server/plugins/ports/image-to-memory";

const PLUGIN_SLUG = "image-to-memory";

async function ensureInstalled() {
  const manifest = PLUGIN_MANIFESTS[PLUGIN_SLUG];
  if (!manifest) return;
  try {
    const existing = await db.execute(sql`SELECT id FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
    if ((existing as unknown[]).length === 0) {
      await db.execute(sql`
        INSERT INTO plugins (slug, name, description, type, status, icon, category)
        VALUES (${manifest.slug}, ${manifest.name}, ${manifest.description},
          ${"extension"}, ${"active"}, ${manifest.icon}, ${manifest.category})
      `);
    }
  } catch { /* ignore */ }
}

// ─── GET Handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensureInstalled();
    await ensureImageTable();
    const action = req.nextUrl.searchParams.get("action") || "images";

    if (action === "images") {
      const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");
      const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0");
      const images = await db.execute(sql`
        SELECT id, title, description, image_format, image_size,
               image_width, image_height, tags, context_type,
               provider, model, word_count, saved_as_memory, memory_id, created_at
        FROM image_analyses WHERE user_id = ${userId}::uuid
        ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
      `);
      const countResult = await db.execute(sql`SELECT COUNT(*) as total FROM image_analyses WHERE user_id = ${userId}::uuid`);
      return NextResponse.json({ images, total: parseInt((countResult as Record<string, string>[])[0]?.total || "0") });
    }

    if (action === "stats") {
      const stats = await db.execute(sql`
        SELECT COUNT(*) as total_images, COUNT(*) FILTER (WHERE saved_as_memory = true) as saved_count,
          COALESCE(SUM(word_count), 0) as total_words, COALESCE(SUM(image_size), 0) as total_size,
          COALESCE(AVG(word_count), 0) as avg_words
        FROM image_analyses WHERE user_id = ${userId}::uuid
      `);
      const r = (stats as Record<string, string>[])[0] || {};
      return NextResponse.json({
        totalImages: parseInt(r.total_images || "0"), savedCount: parseInt(r.saved_count || "0"),
        totalWords: parseInt(r.total_words || "0"), totalSize: parseInt(r.total_size || "0"),
        avgWords: Math.round(parseFloat(r.avg_words || "0")),
      });
    }

    if (action === "check") {
      const config = await getVisionConfig();
      return NextResponse.json({ available: !!config, provider: config?.type || null, model: config?.model || null });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal error" }, { status: 500 });
  }
}

// ─── POST Handler ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensureInstalled();
    await ensureImageTable();
    const contentType = req.headers.get("content-type") || "";

    // ─── Analyze: multipart upload ─────────────────────────────
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("image") as File | null;
      const contextType = ((formData.get("context") as string) || "general") as ContextType;
      const customPrompt = formData.get("prompt") as string | null;
      if (!file) return NextResponse.json({ error: "No image file provided" }, { status: 400 });
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return NextResponse.json({ error: `Unsupported image type: ${file.type}` }, { status: 400 });
      if (file.size > MAX_IMAGE_SIZE) return NextResponse.json({ error: "Image too large. Maximum 20MB." }, { status: 400 });

      const config = await getVisionConfig();
      if (!config) return NextResponse.json({ error: "No Vision AI provider available. Configure in Settings." }, { status: 400 });

      const base64Image = Buffer.from(await file.arrayBuffer()).toString("base64");
      const prompt = buildAnalysisPrompt(contextType, customPrompt || undefined);
      const result = await analyzeImage(config, base64Image, file.type, prompt);
      const title = generateTitleFromDescription(result.description);
      const wordCount = result.description.split(/\s+/).filter(Boolean).length;
      const thumbnailData = base64Image.length > 700000 ? null : `data:${file.type};base64,${base64Image}`;
      const id = crypto.randomUUID();
      const tagsArray = `{${result.tags.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(",")}}`;

      await db.execute(sql`
        INSERT INTO image_analyses (id, user_id, title, description, image_data, image_size, image_format, tags, context_type, provider, model, word_count, custom_prompt)
        VALUES (${id}::uuid, ${userId}::uuid, ${title}, ${result.description}, ${thumbnailData}, ${file.size}, ${file.type.split("/")[1] || "png"}, ${tagsArray}::text[], ${contextType}, ${config.type}, ${config.model}, ${wordCount}, ${customPrompt})
      `);

      return NextResponse.json({ id, title, description: result.description, tags: result.tags, contextType, provider: config.type, model: config.model, wordCount, imageSize: file.size, imageFormat: file.type.split("/")[1] || "png" });
    }

    // ─── JSON actions ──────────────────────────────────────────
    const body = await req.json();
    const action = body.action;

    if (action === "save") {
      const { imageId, customTitle } = body;
      if (!imageId) return NextResponse.json({ error: "imageId required" }, { status: 400 });
      const images = await db.execute(sql`SELECT * FROM image_analyses WHERE id = ${imageId}::uuid AND user_id = ${userId}::uuid`);
      const image = (images as Record<string, unknown>[])[0];
      if (!image) return NextResponse.json({ error: "Image not found" }, { status: 404 });
      if (image.saved_as_memory) return NextResponse.json({ error: "Already saved as memory", memoryId: image.memory_id }, { status: 409 });

      const memoryTitle = (customTitle as string) || (image.title as string) || "Image Analysis";
      const content = formatImageMemoryContent(memoryTitle, image.description as string, (image.tags as string[]) || [], ((image.context_type as string) || "general") as ContextType);

      let embedding: number[] | null = null;
      try { const e = await generateEmbeddings([content]); if (e?.length) embedding = e[0] as number[]; } catch { /* ignore */ }

      const memoryId = crypto.randomUUID();
      if (embedding) {
        await db.execute(sql`INSERT INTO memories (id, user_id, content, embedding, source_type, source_title, created_at, imported_at) VALUES (${memoryId}::uuid, ${userId}::uuid, ${content}, ${`[${embedding.join(",")}]`}::vector, 'image', ${memoryTitle}, NOW(), NOW())`);
      } else {
        await db.execute(sql`INSERT INTO memories (id, user_id, content, source_type, source_title, created_at, imported_at) VALUES (${memoryId}::uuid, ${userId}::uuid, ${content}, 'image', ${memoryTitle}, NOW(), NOW())`);
      }
      await db.execute(sql`UPDATE image_analyses SET saved_as_memory = true, memory_id = ${memoryId}::uuid WHERE id = ${imageId}::uuid`);
      return NextResponse.json({ memoryId, title: memoryTitle, wordCount: image.word_count, message: "Image analysis saved as memory" });
    }

    if (action === "reanalyze") {
      const { imageId, context, prompt } = body;
      if (!imageId) return NextResponse.json({ error: "imageId required" }, { status: 400 });
      const images = await db.execute(sql`SELECT * FROM image_analyses WHERE id = ${imageId}::uuid AND user_id = ${userId}::uuid`);
      const image = (images as Record<string, unknown>[])[0];
      if (!image) return NextResponse.json({ error: "Image not found" }, { status: 404 });
      if (!image.image_data) return NextResponse.json({ error: "Image data not available" }, { status: 400 });
      const config = await getVisionConfig();
      if (!config) return NextResponse.json({ error: "No Vision AI provider available" }, { status: 400 });

      const base64Match = (image.image_data as string).match(/^data:([^;]+);base64,(.+)$/);
      if (!base64Match) return NextResponse.json({ error: "Invalid stored image data" }, { status: 400 });
      const contextType = ((context || image.context_type || "general") as string) as ContextType;
      const fullPrompt = buildAnalysisPrompt(contextType, prompt || undefined);
      const result = await analyzeImage(config, base64Match[2], base64Match[1], fullPrompt);
      const title = generateTitleFromDescription(result.description);
      const wordCount = result.description.split(/\s+/).filter(Boolean).length;
      const tagsArray = `{${result.tags.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(",")}}`;

      await db.execute(sql`UPDATE image_analyses SET title = ${title}, description = ${result.description}, tags = ${tagsArray}::text[], context_type = ${contextType}, provider = ${config.type}, model = ${config.model}, word_count = ${wordCount}, custom_prompt = ${prompt || null} WHERE id = ${imageId}::uuid`);
      return NextResponse.json({ id: imageId, title, description: result.description, tags: result.tags, contextType, provider: config.type, model: config.model, wordCount });
    }

    if (action === "delete") {
      const { imageId } = body;
      if (!imageId) return NextResponse.json({ error: "imageId required" }, { status: 400 });
      await db.execute(sql`DELETE FROM image_analyses WHERE id = ${imageId}::uuid AND user_id = ${userId}::uuid`);
      return NextResponse.json({ deleted: true });
    }

    if (action === "update") {
      const { imageId, title } = body;
      if (!imageId || !title) return NextResponse.json({ error: "imageId and title required" }, { status: 400 });
      await db.execute(sql`UPDATE image_analyses SET title = ${title} WHERE id = ${imageId}::uuid AND user_id = ${userId}::uuid`);
      return NextResponse.json({ updated: true, title });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal error" }, { status: 500 });
  }
}
