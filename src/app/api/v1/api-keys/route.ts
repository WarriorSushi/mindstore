import { NextRequest, NextResponse } from "next/server";
import { createApiKey, listApiKeys, revokeApiKey } from "@/server/api-keys";
import { getUserId } from "@/server/user";

export async function GET() {
  try {
    const userId = await getUserId();
    const keys = await listApiKeys(userId);
    return NextResponse.json({ keys });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    const body = await req.json().catch(() => ({}));
    const rawName = typeof body.name === "string" ? body.name.trim() : "";
    const name = rawName || "MindStore Everywhere";

    if (name.length < 3 || name.length > 64) {
      return NextResponse.json(
        { error: "Key name must be between 3 and 64 characters." },
        { status: 400 }
      );
    }

    const apiKey = await createApiKey(userId, name);
    return NextResponse.json(apiKey);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserId();
    const id = new URL(req.url).searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing api key id." }, { status: 400 });
    }

    await revokeApiKey(userId, id);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
