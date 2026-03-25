import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/server/user";
import {
  ensureSentimentTimelineInstalled,
  getSentimentResults,
  getSentimentSummary,
  runSentimentAnalysis,
} from "@/server/plugins/ports/sentiment-timeline";

export async function GET(req: NextRequest) {
  try {
    await ensureSentimentTimelineInstalled();
    const userId = await getUserId();
    const action = req.nextUrl.searchParams.get("action") || "results";

    if (action === "results") {
      return NextResponse.json(await getSentimentResults(userId));
    }

    if (action === "summary") {
      return NextResponse.json(await getSentimentSummary(userId));
    }

    if (action === "analyze") {
      return NextResponse.json(await runSentimentAnalysis(userId));
    }

    return NextResponse.json(
      { error: "Unknown action. Use: results, summary, analyze" },
      { status: 400 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
