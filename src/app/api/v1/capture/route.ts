import { NextRequest, NextResponse } from "next/server";
import type { CapturePayload } from "@mindstore/plugin-sdk";
import { importDocuments } from "@/server/import-service";
import { getUserId } from "@/server/user";
import { normalizeCaptureBatch } from "@/server/capture";
import { pluginRuntime } from "@/server/plugins/runtime";
import { getInstalledPluginMap } from "@/server/plugins/state";

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    const body = await req.json();
    const captures = extractCapturePayloads(body);
    const documents = normalizeCaptureBatch(captures);
    const installedPlugins = await getInstalledPluginMap();

    const hookResults = await pluginRuntime.runHookForActivePlugins(installedPlugins, "onCapture", {
      userId,
      event: {
        surface: "api:v1:capture",
        captures,
        documents,
      },
      metadata: {
        source: "browser-extension",
      },
    });

    const imported = await importDocuments({ userId, documents });

    return NextResponse.json({
      imported,
      captures: documents.map((document) => ({
        title: document.title,
        sourceType: document.sourceType,
        captureMode: document.captureMode,
        sourceApp: document.sourceApp,
        url: document.url ?? null,
      })),
      hooksTriggered: hookResults.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Capture failed";
    const status = message === "No capture content was provided" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

function extractCapturePayloads(body: unknown): CapturePayload[] {
  if (Array.isArray(body)) {
    return body as CapturePayload[];
  }

  if (isRecord(body) && isRecord(body.capture)) {
    return [body.capture as CapturePayload];
  }

  if (isRecord(body) && Array.isArray(body.captures)) {
    return body.captures as CapturePayload[];
  }

  if (isRecord(body)) {
    return [body as CapturePayload];
  }

  throw new Error("Invalid capture payload");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
