import { NextRequest, NextResponse } from "next/server";
import { runDuePluginJobs } from "@/server/plugin-jobs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const limit =
      typeof body.limit === "number" && Number.isFinite(body.limit)
        ? Math.max(1, Math.min(body.limit, 50))
        : 10;

    const results = await runDuePluginJobs({ limit });

    return NextResponse.json({
      ok: true,
      processed: results.length,
      results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to run scheduled plugin jobs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
