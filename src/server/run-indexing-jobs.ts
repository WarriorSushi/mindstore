import { runEmbeddingBackfillBatch } from "@/server/indexing-jobs";

async function main() {
  const limitArg = process.argv[2];
  const parsedLimit = limitArg ? Number.parseInt(limitArg, 10) : undefined;
  const limit = Number.isFinite(parsedLimit) && parsedLimit && parsedLimit > 0 ? parsedLimit : 10;

  console.log(`[mindstore] Running indexing backfill batches (limit=${limit})`);

  let processedBatches = 0;
  while (processedBatches < limit) {
    const result = await runEmbeddingBackfillBatch();
    if (!result) {
      break;
    }

    processedBatches += 1;
    console.log(
      `[mindstore] ${result.job.userId}/${result.job.id} -> ${result.job.status}: ${result.message}`
    );
  }

  if (processedBatches === 0) {
    console.log("[mindstore] No indexing backfill work found.");
    return;
  }

  console.log(`[mindstore] Processed ${processedBatches} indexing batch(es).`);
}

main().catch((error) => {
  console.error("[mindstore] Failed to run indexing jobs:", error);
  process.exitCode = 1;
});
