import { NextRequest, NextResponse } from "next/server";
import { getApiKeyFromHeaders, resolveApiKeyUserId } from "@/server/api-keys";
import { createExtensionSetupPayload, getExtensionVersion } from "@/server/extension";

export async function GET(req: NextRequest) {
  try {
    const origin = req.nextUrl.origin;
    const rawApiKey = getApiKeyFromHeaders(req.headers);
    const resolvedUserId = rawApiKey ? await resolveApiKeyUserId(rawApiKey) : null;

    if (rawApiKey && !resolvedUserId) {
      return NextResponse.json(
        {
          error: "The provided MindStore API key is invalid.",
          authenticated: false,
        },
        { status: 401 }
      );
    }

    const extensionVersion = await getExtensionVersion();

    return NextResponse.json(
      createExtensionSetupPayload({
        origin,
        apiKeyProvided: Boolean(rawApiKey),
        authenticated: Boolean(resolvedUserId),
        extensionVersion,
      })
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to inspect extension setup";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
