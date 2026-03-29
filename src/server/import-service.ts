import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { generateEmbeddings } from "@/server/embeddings";
import { buildTreeIndex } from "@/server/retrieval";
import { scheduleEmbeddingBackfill } from "@/server/indexing-jobs";

export type MemoryContentType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "code"
  | "conversation"
  | "webpage"
  | "document";

export interface ImportDocument {
  title: string;
  content: string;
  sourceType: string;
  sourceId?: string | null;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
  contentType?: MemoryContentType;
  preChunked?: boolean;
}

interface ImportedChunk {
  content: string;
  contentType: MemoryContentType;
  sourceType: string;
  sourceTitle: string;
  sourceId?: string | null;
  timestamp?: Date;
  metadata: Record<string, unknown>;
}

export interface ImportSummary {
  documents: number;
  chunks: number;
  embedded: number;
  embeddingsSkipped: boolean;
  indexing: {
    queued: boolean;
    jobId: string | null;
    pendingEmbeddings: number;
  };
}

export function sanitizeImportDocuments(documents: ImportDocument[]): ImportDocument[] {
  return documents
    .map((document) => ({
      ...document,
      title: document.title?.trim() || "Untitled",
      content: document.content?.trim() || "",
      sourceType: document.sourceType?.trim() || "text",
      metadata: isRecord(document.metadata) ? document.metadata : {},
      contentType: document.contentType ?? "text",
    }))
    .filter((document) => document.content.length > 0);
}

export function chunkText(text: string, maxChunkSize = 1000): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed.length <= maxChunkSize) {
    return [trimmed];
  }

  const paragraphs = trimmed.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (current.length + paragraph.length > maxChunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = "";
    }

    current += `${paragraph}\n\n`;
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.filter((chunk) => chunk.trim().length > 0);
}

export async function importDocuments({
  userId,
  documents,
}: {
  userId: string;
  documents: ImportDocument[];
}): Promise<ImportSummary> {
  const sanitizedDocuments = sanitizeImportDocuments(documents);

  if (sanitizedDocuments.length === 0) {
    throw new Error("No documents to import");
  }

  const allChunks: ImportedChunk[] = [];

  for (const document of sanitizedDocuments) {
    const chunks = document.preChunked ? [document.content] : chunkText(document.content);
    for (const chunk of chunks) {
      allChunks.push({
        content: chunk,
        contentType: document.contentType ?? "text",
        sourceType: document.sourceType,
        sourceTitle: document.title,
        sourceId: document.sourceId,
        timestamp: document.timestamp,
        metadata: document.metadata ?? {},
      });
    }
  }

  let embeddings: number[][] | null = null;
  const MAX_EMBED_CHUNKS = 100;

  if (allChunks.length <= MAX_EMBED_CHUNKS) {
    try {
      embeddings = await generateEmbeddings(allChunks.map((chunk) => chunk.content));
    } catch (error) {
      console.error("Embedding failed, storing without vectors:", error);
    }
  }

  let insertedWithoutEmbeddings = 0;

  const BATCH_SIZE = 50;

  for (let batchStart = 0; batchStart < allChunks.length; batchStart += BATCH_SIZE) {
    const batch = allChunks.slice(batchStart, batchStart + BATCH_SIZE);

    for (let index = 0; index < batch.length; index += 1) {
      const chunk = batch[index];
      const globalIndex = batchStart + index;
      const embedding = embeddings?.[globalIndex];
      const memoryId = crypto.randomUUID();
      const createdAt = (chunk.timestamp || new Date()).toISOString();
      const metadataJson = JSON.stringify(chunk.metadata ?? {});

      if (embedding) {
        const embeddingVector = `[${embedding.join(",")}]`;
        await db.execute(sql`
          INSERT INTO memories (
            id,
            user_id,
            content,
            embedding,
            content_type,
            source_type,
            source_id,
            source_title,
            metadata,
            created_at,
            imported_at
          )
          VALUES (
            ${memoryId},
            ${userId}::uuid,
            ${chunk.content},
            ${embeddingVector}::vector,
            ${chunk.contentType},
            ${chunk.sourceType},
            ${chunk.sourceId ?? null},
            ${chunk.sourceTitle},
            ${metadataJson}::jsonb,
            ${createdAt}::timestamptz,
            NOW()
          )
        `);
      } else {
        insertedWithoutEmbeddings += 1;
        await db.execute(sql`
          INSERT INTO memories (
            id,
            user_id,
            content,
            content_type,
            source_type,
            source_id,
            source_title,
            metadata,
            created_at,
            imported_at
          )
          VALUES (
            ${memoryId},
            ${userId}::uuid,
            ${chunk.content},
            ${chunk.contentType},
            ${chunk.sourceType},
            ${chunk.sourceId ?? null},
            ${chunk.sourceTitle},
            ${metadataJson}::jsonb,
            ${createdAt}::timestamptz,
            NOW()
          )
        `);
      }
    }
  }

  try {
    await buildTreeIndex(userId);
  } catch (error) {
    console.error("Tree index build failed (non-fatal):", error);
  }

  const indexingJob =
    insertedWithoutEmbeddings > 0
      ? await scheduleEmbeddingBackfill({
          userId,
          requestedCount: insertedWithoutEmbeddings,
          reason:
            allChunks.length > MAX_EMBED_CHUNKS
              ? "import-too-large-for-inline-embedding"
              : "embedding-provider-unavailable-during-import",
          metadata: {
            surface: "import-service",
            documents: sanitizedDocuments.length,
            sourceTypes: [...new Set(sanitizedDocuments.map((document) => document.sourceType))],
          },
        })
      : null;

  return {
    documents: sanitizedDocuments.length,
    chunks: allChunks.length,
    embedded: embeddings ? embeddings.length : 0,
    embeddingsSkipped: allChunks.length > MAX_EMBED_CHUNKS,
    indexing: {
      queued: !!indexingJob,
      jobId: indexingJob?.id ?? null,
      pendingEmbeddings: insertedWithoutEmbeddings,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
