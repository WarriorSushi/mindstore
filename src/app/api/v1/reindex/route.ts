import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/server/user';
import { getIndexingSnapshot, runEmbeddingBackfillBatch, scheduleEmbeddingBackfill } from '@/server/indexing-jobs';

/**
 * POST /api/v1/reindex — generate embeddings for memories that don't have them
 * 
 * This is the "I imported first, configured AI later" fix.
 * Processes memories in batches to avoid timeout.
 * Body: { batchSize?: number } (default 50, max 100)
 * Returns: { processed, remaining, provider }
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(body.batchSize || 50, 100);
    const runNow = body.runNow !== false;
    const snapshot = await getIndexingSnapshot(userId);
    if (snapshot.withoutEmbeddings === 0) {
      return NextResponse.json({
        processed: 0,
        remaining: 0,
        message: 'All memories already have embeddings',
        indexing: snapshot,
      });
    }

    const job = await scheduleEmbeddingBackfill({
      userId,
      requestedCount: snapshot.withoutEmbeddings,
      reason: 'manual-reindex-request',
      metadata: {
        surface: 'api:v1:reindex',
      },
    });

    if (!job) {
      return NextResponse.json({
        processed: 0,
        remaining: snapshot.withoutEmbeddings,
        message: 'Embedding backfill is already complete.',
        indexing: snapshot,
      });
    }

    if (!runNow) {
      return NextResponse.json({
        queued: true,
        job,
        message: `Queued embedding backfill for ${snapshot.withoutEmbeddings} memories.`,
      }, { status: 202 });
    }

    const result = await runEmbeddingBackfillBatch({ userId, jobId: job.id, batchSize });
    if (!result) {
      return NextResponse.json({ error: 'Failed to start embedding backfill' }, { status: 500 });
    }

    return NextResponse.json({
      processed: result.processed,
      remaining: result.remaining,
      provider: result.provider,
      job: result.job,
      message: result.message,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * GET /api/v1/reindex — check embedding status
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const snapshot = await getIndexingSnapshot(userId);
    return NextResponse.json({
      total: snapshot.total,
      withEmbeddings: snapshot.withEmbeddings,
      withoutEmbeddings: snapshot.withoutEmbeddings,
      needsReindex: snapshot.withoutEmbeddings > 0,
      latestJob: snapshot.latestJob,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
