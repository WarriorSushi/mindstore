import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/server/user";
import {
  analyzeKnowledgeGaps,
  ensureKnowledgeGapsInstalled,
} from "@/server/plugins/ports/knowledge-gaps";

export async function GET(req: NextRequest) {
  try {
    await ensureKnowledgeGapsInstalled();
    const userId = await getUserId();
    const actionParam = req.nextUrl.searchParams.get("action");
    const action = actionParam === "suggest" ? "suggest" : "analyze";
    const maxTopics = Math.min(
      Number.parseInt(req.nextUrl.searchParams.get("maxTopics") || "12", 10) || 12,
      20,
    );

    return NextResponse.json(await analyzeKnowledgeGaps(userId, { action, maxTopics }));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
