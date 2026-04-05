import { NextResponse } from "next/server";
import { runEmbeddingBackfillBatch } from "@/server/indexing-jobs";
import { headers } from "next/headers";

// Vercel cron: runs every minute to process pending embedding backfill jobs.
// Protected by CRON_SECRET env var when set.
export async function GET() {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const headersList = await headers();
    const auth = headersList.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let processed = 0;
  try {
    while (processed < 5) {
      const result = await runEmbeddingBackfillBatch();
      if (!result) break;
      processed++;
    }
  } catch (err) {
    console.error("[cron/indexing] Error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }

  return NextResponse.json({ ok: true, processed });
}
