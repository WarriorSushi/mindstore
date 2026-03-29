import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { generateEmbeddings } from "@/server/embeddings";
import { scheduleEmbeddingBackfill } from "@/server/indexing-jobs";

export interface MemoryCreateInput {
  userId: string;
  content: string;
  sourceType?: string;
  sourceId?: string | null;
  sourceTitle?: string | null;
  metadata?: Record<string, unknown>;
}

export async function createMemory(input: MemoryCreateInput) {
  const id = crypto.randomUUID();
  let embStr: string | null = null;

  try {
    const embeddings = await generateEmbeddings([input.content]);
    if (embeddings && embeddings.length > 0) {
      embStr = `[${embeddings[0].join(",")}]`;
    }
  } catch {
    // Keep capture and manual memory creation resilient when embeddings are unavailable.
  }

  const metadata = JSON.stringify(input.metadata || {});

  if (embStr) {
    await db.execute(sql`
      INSERT INTO memories (id, user_id, content, embedding, source_type, source_id, source_title, metadata, created_at, imported_at)
      VALUES (
        ${id},
        ${input.userId}::uuid,
        ${input.content},
        ${embStr}::vector,
        ${input.sourceType || "text"},
        ${input.sourceId || null},
        ${input.sourceTitle || null},
        ${metadata}::jsonb,
        NOW(),
        NOW()
      )
    `);
  } else {
    await db.execute(sql`
      INSERT INTO memories (id, user_id, content, source_type, source_id, source_title, metadata, created_at, imported_at)
      VALUES (
        ${id},
        ${input.userId}::uuid,
        ${input.content},
        ${input.sourceType || "text"},
        ${input.sourceId || null},
        ${input.sourceTitle || null},
        ${metadata}::jsonb,
        NOW(),
        NOW()
      )
    `);
  }

  const indexingJob = !embStr
    ? await scheduleEmbeddingBackfill({
        userId: input.userId,
        requestedCount: 1,
        reason: "single-memory-created-without-embedding",
        metadata: {
          sourceType: input.sourceType || "text",
          sourceTitle: input.sourceTitle || null,
          surface: "memory-ingest",
        },
      })
    : null;

  return {
    id,
    embedded: !!embStr,
    indexingQueued: !!indexingJob,
    indexingJobId: indexingJob?.id ?? null,
  };
}
