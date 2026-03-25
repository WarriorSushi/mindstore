import type {
  CaptureOrImportDocument,
  PluginDocumentTransform,
  PluginHookName,
} from "@mindstore/plugin-sdk";
import type { InstalledPluginState } from "@mindstore/plugin-runtime";
import type { createPluginRuntime } from "@mindstore/plugin-runtime";
import { sanitizeImportDocuments, type ImportDocument } from "@/server/import-service";
import { pluginRuntime } from "@/server/plugins/runtime";

export interface DocumentHookApplicationResult {
  documents: ImportDocument[];
  hooksTriggered: number;
  transformsApplied: number;
}

export async function applyDocumentHookTransforms({
  hookName,
  installedPlugins,
  userId,
  documents,
  event,
  metadata,
  runtime = pluginRuntime,
}: {
  hookName: Extract<PluginHookName, "onCapture" | "onImport">;
  installedPlugins: Map<string, InstalledPluginState>;
  userId: string;
  documents: ImportDocument[];
  event: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  runtime?: ReturnType<typeof createPluginRuntime>;
}): Promise<DocumentHookApplicationResult> {
  let currentDocuments = sanitizeImportDocuments(documents);

  const hookResults = await runtime.runHookForActivePlugins(installedPlugins, hookName, {
    userId,
    event: {
      ...event,
      documents: currentDocuments,
    },
    metadata,
  });

  let transformsApplied = 0;

  for (const hookResult of hookResults) {
    const transform = extractDocumentTransform(hookResult.result);
    if (!transform) {
      continue;
    }

    let nextDocuments = currentDocuments;

    if (transform.documents) {
      nextDocuments = toImportDocuments(transform.documents);
      transformsApplied += 1;
    }

    if (transform.appendDocuments?.length) {
      nextDocuments = nextDocuments.concat(toImportDocuments(transform.appendDocuments));
      transformsApplied += 1;
    }

    if (transform.metadataPatch && Object.keys(transform.metadataPatch).length > 0) {
      nextDocuments = nextDocuments.map((document) => ({
        ...document,
        metadata: {
          ...(document.metadata ?? {}),
          ...transform.metadataPatch,
        },
      }));
      transformsApplied += 1;
    }

    currentDocuments = sanitizeImportDocuments(nextDocuments);
  }

  return {
    documents: currentDocuments,
    hooksTriggered: hookResults.length,
    transformsApplied,
  };
}

function extractDocumentTransform(result: unknown): PluginDocumentTransform | null {
  if (!isRecord(result)) {
    return null;
  }

  const data = isRecord(result.data) ? result.data : null;
  if (!data) {
    return null;
  }

  const transform: PluginDocumentTransform = {};

  if (Array.isArray(data.documents)) {
    transform.documents = data.documents.filter(isDocumentLike) as CaptureOrImportDocument[];
  }

  if (Array.isArray(data.appendDocuments)) {
    transform.appendDocuments = data.appendDocuments.filter(isDocumentLike) as CaptureOrImportDocument[];
  }

  if (isRecord(data.metadataPatch)) {
    transform.metadataPatch = data.metadataPatch;
  }

  if (!transform.documents && !transform.appendDocuments && !transform.metadataPatch) {
    return null;
  }

  return transform;
}

function toImportDocuments(documents: CaptureOrImportDocument[]): ImportDocument[] {
  return sanitizeImportDocuments(
    documents.map((document) => ({
      title: typeof document.title === "string" ? document.title : "Untitled",
      content: typeof document.content === "string" ? document.content : "",
      sourceType: typeof document.sourceType === "string" ? document.sourceType : "text",
      sourceId:
        typeof document.sourceId === "string" || document.sourceId === null
          ? document.sourceId
          : undefined,
      metadata: isRecord(document.metadata) ? document.metadata : {},
      contentType: normalizeContentType(document.contentType),
      timestamp: normalizeTimestamp(document.timestamp),
    }))
  );
}

function normalizeTimestamp(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return undefined;
}

function normalizeContentType(value: unknown): ImportDocument["contentType"] {
  switch (value) {
    case "text":
    case "image":
    case "audio":
    case "video":
    case "code":
    case "conversation":
    case "webpage":
    case "document":
      return value;
    default:
      return undefined;
  }
}

function isDocumentLike(value: unknown): value is CaptureOrImportDocument {
  return isRecord(value) && typeof value.title === "string" && typeof value.content === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
