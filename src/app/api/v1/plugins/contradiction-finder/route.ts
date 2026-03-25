import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/server/user";
import {
  ensureContradictionFinderInstalled,
  listContradictions,
  resolveContradiction,
  runContradictionScan,
} from "@/server/plugins/ports/contradiction-finder";

export async function GET(req: NextRequest) {
  try {
    await ensureContradictionFinderInstalled();
    const userId = await getUserId();
    const action = req.nextUrl.searchParams.get("action") || "results";

    if (action === "results") {
      return NextResponse.json(await listContradictions(userId));
    }

    if (action === "scan") {
      return NextResponse.json(await runContradictionScan(userId));
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureContradictionFinderInstalled();
    const userId = await getUserId();
    const action = req.nextUrl.searchParams.get("action") || "resolve";

    if (action === "scan") {
      return NextResponse.json(await runContradictionScan(userId));
    }

    if (action === "resolve") {
      const body = await req.json() as {
        contradictionId?: string;
        resolution?: "dismiss" | "keep-a" | "keep-b";
      };

      return NextResponse.json(await resolveContradiction(userId, body));
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("required")
      ? 400
      : message.includes("not found")
        ? 404
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
