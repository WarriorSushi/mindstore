import { NextResponse } from "next/server";
import { runDuePluginJobs } from "@/server/plugin-jobs";
import { headers } from "next/headers";

// Vercel cron: runs every 5 minutes to process scheduled plugin jobs.
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

  try {
    const results = await runDuePluginJobs({ limit: 10 });
    return NextResponse.json({ ok: true, processed: results.length });
  } catch (err) {
    console.error("[cron/jobs] Error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
