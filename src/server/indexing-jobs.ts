import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { generateEmbeddings, getEmbeddingConfig } from "@/server/embeddings";
import { buildTreeIndex } from "@/server/retrieval";

export type IndexingJobType = "embedding_backfill";
export type IndexingJobStatus = "pending" | "running" | "blocked" | "completed" | "failed";

export interface IndexingJob {
  id: string;
  userId: string;
  jobType: IndexingJobType;
  status: IndexingJobStatus;
  reason: string | null;
  provider: string | null;
  requestedCount: number;
  processedCount: number;
  remainingCount: number;
  lastError: string | null;
  metadata: Record<string, unknown>;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
}

export interface IndexingSnapshot {
  total: number;
  withEmbeddings: number;
  withoutEmbeddings: number;
  latestJob: IndexingJob | null;
}

export interface IndexingRunResult {
  job: IndexingJob;
  processed: number;
  remaining: number;
  provider: string | null;
  message: string;
}

export async function getIndexingSnapshot(userId: string): Promise<IndexingSnapshot> {
  const countResult = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(embedding)::int AS with_embeddings,
      (COUNT(*) - COUNT(embedding))::int AS without_embeddings
    FROM memories
    WHERE user_id = ${userId}::uuid
  `);

  const countRow = getFirstRow(countResult);
  const latestJob = await getLatestIndexingJob(userId);

  return {
    total: Number(countRow?.total ?? 0),
    withEmbeddings: Number(countRow?.with_embeddings ?? 0),
    withoutEmbeddings: Number(countRow?.without_embeddings ?? 0),
    latestJob,
  };
}

export async function scheduleEmbeddingBackfill(input: {
  userId: string;
  requestedCount: number;
  reason: string;
  metadata?: Record<string, unknown>;
}): Promise<IndexingJob | null> {
  if (input.requestedCount <= 0) {
    return null;
  }

  const snapshot = await getIndexingSnapshot(input.userId);
  const effectiveRemaining = Math.max(snapshot.withoutEmbeddings, input.requestedCount);
  if (effectiveRemaining <= 0) {
    return null;
  }

  const existingResult = await db.execute(sql`
    SELECT *
    FROM indexing_jobs
    WHERE user_id = ${input.userId}::uuid
      AND job_type = 'embedding_backfill'
      AND status IN ('pending', 'running', 'blocked')
    ORDER BY scheduled_at DESC
    LIMIT 1
  `);
  const existing = mapIndexingJob(getFirstRow(existingResult));
  const metadataJson = JSON.stringify(input.metadata ?? {});

  if (existing) {
    await db.execute(sql`
      UPDATE indexing_jobs
      SET
        status = CASE WHEN status = 'blocked' THEN 'pending' ELSE status END,
        reason = ${input.reason},
        requested_count = GREATEST(requested_count, ${input.requestedCount}),
        remaining_count = GREATEST(remaining_count, ${effectiveRemaining}),
        metadata = CASE
          WHEN ${metadataJson}::jsonb = '{}'::jsonb THEN metadata
          ELSE metadata || ${metadataJson}::jsonb
        END,
        updated_at = NOW()
      WHERE id = ${existing.id}::uuid
    `);

    return getIndexingJobById(existing.id);
  }

  const jobId = crypto.randomUUID();
  await db.execute(sql`
    INSERT INTO indexing_jobs (
      id,
      user_id,
      job_type,
      status,
      reason,
      requested_count,
      processed_count,
      remaining_count,
      metadata,
      scheduled_at,
      updated_at
    )
    VALUES (
      ${jobId},
      ${input.userId}::uuid,
      'embedding_backfill',
      'pending',
      ${input.reason},
      ${input.requestedCount},
      0,
      ${effectiveRemaining},
      ${metadataJson}::jsonb,
      NOW(),
      NOW()
    )
  `);

  return getIndexingJobById(jobId);
}

export async function runEmbeddingBackfillBatch(input?: {
  userId?: string;
  jobId?: string;
  batchSize?: number;
}): Promise<IndexingRunResult | null> {
  const batchSize = Math.min(Math.max(input?.batchSize ?? 50, 1), 100);
  const job = input?.jobId
    ? await getIndexingJobById(input.jobId)
    : input?.userId
      ? await getLatestIndexingJob(input.userId)
      : await getNextRunnableIndexingJob();

  if (!job || !["pending", "running", "blocked"].includes(job.status)) {
    return null;
  }

  const snapshotBefore = await getIndexingSnapshot(job.userId);
  const providerConfig = await getEmbeddingConfig();

  if (!providerConfig) {
    await db.execute(sql`
      UPDATE indexing_jobs
      SET
        status = 'blocked',
        provider = NULL,
        remaining_count = ${snapshotBefore.withoutEmbeddings},
        last_error = 'No embedding provider configured',
        updated_at = NOW()
      WHERE id = ${job.id}::uuid
    `);

    const blockedJob = await getIndexingJobById(job.id);
    if (!blockedJob) {
      return null;
    }

    return {
      job: blockedJob,
      processed: 0,
      remaining: snapshotBefore.withoutEmbeddings,
      provider: null,
      message: "Embedding backfill is queued, but no embedding provider is configured yet.",
    };
  }

  await db.execute(sql`
    UPDATE indexing_jobs
    SET
      status = 'running',
      provider = ${providerConfig.provider},
      started_at = COALESCE(started_at, NOW()),
      last_error = NULL,
      updated_at = NOW()
    WHERE id = ${job.id}::uuid
  `);

  const pendingResult = await db.execute(sql`
    SELECT id, content
    FROM memories
    WHERE user_id = ${job.userId}::uuid
      AND embedding IS NULL
    ORDER BY imported_at ASC, created_at ASC
    LIMIT ${batchSize}
  `);
  const pendingRows = getRows(pendingResult);

  if (pendingRows.length === 0) {
    try {
      await buildTreeIndex(job.userId);
    } catch (error) {
      console.error("[indexing-jobs] Tree index rebuild failed:", error);
    }

    await db.execute(sql`
      UPDATE indexing_jobs
      SET
        status = 'completed',
        provider = ${providerConfig.provider},
        remaining_count = 0,
        completed_at = NOW(),
        updated_at = NOW(),
        last_error = NULL
      WHERE id = ${job.id}::uuid
    `);

    const completedJob = await getIndexingJobById(job.id);
    if (!completedJob) {
      return null;
    }

    return {
      job: completedJob,
      processed: 0,
      remaining: 0,
      provider: providerConfig.provider,
      message: "All memories already have embeddings.",
    };
  }

  try {
    const embeddings = await generateEmbeddings(pendingRows.map((row) => String(row.content ?? "")));
    if (!embeddings || embeddings.length !== pendingRows.length) {
      throw new Error("Embedding provider returned an unexpected number of vectors");
    }

    for (let index = 0; index < pendingRows.length; index += 1) {
      const vector = `[${embeddings[index].join(",")}]`;
      await db.execute(sql`
        UPDATE memories
        SET embedding = ${vector}::vector
        WHERE id = ${String(pendingRows[index].id)}::uuid
      `);
    }

    const snapshotAfter = await getIndexingSnapshot(job.userId);
    const nextStatus: IndexingJobStatus = snapshotAfter.withoutEmbeddings > 0 ? "pending" : "completed";

    if (nextStatus === "completed") {
      try {
        await buildTreeIndex(job.userId);
      } catch (error) {
        console.error("[indexing-jobs] Tree index rebuild failed:", error);
      }
    }

    await db.execute(sql`
      UPDATE indexing_jobs
      SET
        status = ${nextStatus},
        provider = ${providerConfig.provider},
        processed_count = processed_count + ${pendingRows.length},
        remaining_count = ${snapshotAfter.withoutEmbeddings},
        completed_at = CASE WHEN ${nextStatus} = 'completed' THEN NOW() ELSE completed_at END,
        updated_at = NOW(),
        last_error = NULL
      WHERE id = ${job.id}::uuid
    `);

    const updatedJob = await getIndexingJobById(job.id);
    if (!updatedJob) {
      return null;
    }

    return {
      job: updatedJob,
      processed: pendingRows.length,
      remaining: snapshotAfter.withoutEmbeddings,
      provider: providerConfig.provider,
      message:
        snapshotAfter.withoutEmbeddings > 0
          ? `Processed ${pendingRows.length} memories. ${snapshotAfter.withoutEmbeddings} still need embeddings.`
          : `Processed ${pendingRows.length} memories. Embedding backfill is complete.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Embedding backfill failed";
    await db.execute(sql`
      UPDATE indexing_jobs
      SET
        status = 'failed',
        provider = ${providerConfig.provider},
        remaining_count = ${snapshotBefore.withoutEmbeddings},
        last_error = ${message},
        updated_at = NOW()
      WHERE id = ${job.id}::uuid
    `);

    const failedJob = await getIndexingJobById(job.id);
    if (!failedJob) {
      return null;
    }

    return {
      job: failedJob,
      processed: 0,
      remaining: snapshotBefore.withoutEmbeddings,
      provider: providerConfig.provider,
      message,
    };
  }
}

async function getLatestIndexingJob(userId: string): Promise<IndexingJob | null> {
  const result = await db.execute(sql`
    SELECT *
    FROM indexing_jobs
    WHERE user_id = ${userId}::uuid
      AND job_type = 'embedding_backfill'
    ORDER BY scheduled_at DESC
    LIMIT 1
  `);

  return mapIndexingJob(getFirstRow(result));
}

async function getIndexingJobById(jobId: string): Promise<IndexingJob | null> {
  const result = await db.execute(sql`
    SELECT *
    FROM indexing_jobs
    WHERE id = ${jobId}::uuid
    LIMIT 1
  `);

  return mapIndexingJob(getFirstRow(result));
}

async function getNextRunnableIndexingJob(): Promise<IndexingJob | null> {
  const result = await db.execute(sql`
    SELECT *
    FROM indexing_jobs
    WHERE job_type = 'embedding_backfill'
      AND status IN ('pending', 'running', 'blocked')
    ORDER BY scheduled_at ASC
    LIMIT 1
  `);

  return mapIndexingJob(getFirstRow(result));
}

function mapIndexingJob(row: Record<string, unknown> | null): IndexingJob | null {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    userId: String(row.user_id),
    jobType: "embedding_backfill",
    status: String(row.status) as IndexingJobStatus,
    reason: row.reason ? String(row.reason) : null,
    provider: row.provider ? String(row.provider) : null,
    requestedCount: Number(row.requested_count ?? 0),
    processedCount: Number(row.processed_count ?? 0),
    remainingCount: Number(row.remaining_count ?? 0),
    lastError: row.last_error ? String(row.last_error) : null,
    metadata: isRecord(row.metadata) ? row.metadata : {},
    scheduledAt: row.scheduled_at ? String(row.scheduled_at) : null,
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

function getRows(result: unknown): Array<Record<string, unknown>> {
  return Array.isArray(result) ? (result as Array<Record<string, unknown>>) : [];
}

function getFirstRow(result: unknown): Record<string, unknown> | null {
  const rows = getRows(result);
  return rows.length > 0 ? rows[0] : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
