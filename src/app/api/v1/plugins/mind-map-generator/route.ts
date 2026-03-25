import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/server/user";
import {
  ensureMindMapInstalled,
  generateMindMap,
} from "@/server/plugins/ports/mind-map-generator";

export async function GET(req: NextRequest) {
  try {
    await ensureMindMapInstalled();
    const userId = await getUserId();
    const maxTopics = Math.min(Number.parseInt(req.nextUrl.searchParams.get("maxTopics") || "12", 10), 20);
    const maxDepth = Math.min(Number.parseInt(req.nextUrl.searchParams.get("maxDepth") || "3", 10), 4);

    return NextResponse.json(await generateMindMap(userId, { maxTopics, maxDepth }));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
