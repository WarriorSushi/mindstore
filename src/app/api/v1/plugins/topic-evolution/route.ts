import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/server/user";
import {
  analyzeTopicEvolution,
  ensureTopicEvolutionInstalled,
} from "@/server/plugins/ports/topic-evolution";

export async function GET(req: NextRequest) {
  try {
    await ensureTopicEvolutionInstalled();
    const userId = await getUserId();
    const granularityParam = req.nextUrl.searchParams.get("granularity");
    const granularity = granularityParam === "week" || granularityParam === "quarter" ? granularityParam : "month";
    const maxTopics = Math.min(
      Number.parseInt(req.nextUrl.searchParams.get("maxTopics") || "10", 10) || 10,
      16,
    );

    return NextResponse.json(await analyzeTopicEvolution(userId, { granularity, maxTopics }));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
