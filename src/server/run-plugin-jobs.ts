import { runDuePluginJobs } from "@/server/plugin-jobs";

async function main() {
  const limitArg = process.argv[2];
  const parsedLimit = limitArg ? Number.parseInt(limitArg, 10) : undefined;
  const limit = Number.isFinite(parsedLimit) && parsedLimit && parsedLimit > 0 ? parsedLimit : 10;

  const startedAt = new Date();
  console.log(`[mindstore] Running due plugin jobs at ${startedAt.toISOString()} (limit=${limit})`);

  const results = await runDuePluginJobs({ limit });

  if (results.length === 0) {
    console.log("[mindstore] No due plugin jobs found.");
    return;
  }

  for (const result of results) {
    console.log(
      `[mindstore] ${result.pluginSlug}/${result.jobId} -> ${result.status}: ${result.summary}`
    );
  }

  console.log(`[mindstore] Processed ${results.length} plugin job(s).`);
}

main().catch((error) => {
  console.error("[mindstore] Failed to run due plugin jobs:", error);
  process.exitCode = 1;
});
