import type {
  CaptureMode,
  CapturePayload,
  CaptureSourceApp,
} from "@mindstore/plugin-sdk";
import type { ImportDocument } from "@/server/import-service";

export interface NormalizedCaptureDocument extends ImportDocument {
  captureMode: Exclude<CaptureMode, "auto">;
  sourceApp: CaptureSourceApp;
  url?: string;
}

export function normalizeCapturePayload(payload: CapturePayload): NormalizedCaptureDocument {
  const url = sanitizeUrl(payload.url);
  const sourceApp = payload.sourceApp ?? inferSourceAppFromUrl(url);
  const captureMode = resolveCaptureMode(payload, sourceApp);
  const rawContent = selectCaptureContent(payload, captureMode);
  const content = clampText(rawContent, 24000);

  if (!content) {
    throw new Error("No capture content was provided");
  }

  const title = sanitizeText(payload.title) || inferTitleFromUrl(url) || "Web capture";
  const siteName = sanitizeText(payload.siteName) || inferSiteName(sourceApp, url);
  const metadata = {
    ...normalizeMetadata(payload.metadata),
    captureMode,
    sourceApp,
    siteName,
    url: url ?? null,
  };

  return {
    title,
    content: buildCaptureBody({
      content,
      url,
      siteName,
      sourceApp,
      captureMode,
    }),
    sourceType: sanitizeText(payload.sourceType) || resolveSourceType(sourceApp),
    sourceId: url ?? null,
    contentType: captureMode === "conversation" ? "conversation" : "webpage",
    metadata,
    captureMode,
    sourceApp,
    url: url ?? undefined,
  };
}

export function normalizeCaptureBatch(payloads: CapturePayload[]): NormalizedCaptureDocument[] {
  return payloads.map((payload) => normalizeCapturePayload(payload));
}

export function normalizeCaptureQuery(rawQuery: unknown, rawLimit: unknown) {
  return {
    query: sanitizeText(typeof rawQuery === "string" ? rawQuery : ""),
    limit: normalizeCaptureLimit(rawLimit),
  };
}

function resolveCaptureMode(
  payload: CapturePayload,
  sourceApp: CaptureSourceApp
): Exclude<CaptureMode, "auto"> {
  const requestedMode = payload.captureMode ?? payload.mode;
  if (requestedMode && requestedMode !== "auto" && requestedMode !== "smart") {
    return requestedMode;
  }

  if (sanitizeText(payload.selection)) {
    return "selection";
  }

  if (sanitizeText(payload.conversationText) && sourceApp !== "web") {
    return "conversation";
  }

  return "page";
}

function selectCaptureContent(
  payload: CapturePayload,
  captureMode: Exclude<CaptureMode, "auto">
): string {
  if (captureMode === "selection") {
    return (
      sanitizeText(payload.selection) ||
      sanitizeText(payload.content) ||
      sanitizeText(payload.conversationText) ||
      sanitizeText(payload.pageText)
    );
  }

  if (captureMode === "conversation") {
    return (
      sanitizeText(payload.conversationText) ||
      sanitizeText(payload.content) ||
      sanitizeText(payload.pageText) ||
      sanitizeText(payload.selection)
    );
  }

  return (
    sanitizeText(payload.pageText) ||
    sanitizeText(payload.content) ||
    sanitizeText(payload.selection) ||
    sanitizeText(payload.conversationText)
  );
}

function buildCaptureBody({
  content,
  url,
  siteName,
  sourceApp,
  captureMode,
}: {
  content: string;
  url: string | null;
  siteName: string | null;
  sourceApp: CaptureSourceApp;
  captureMode: Exclude<CaptureMode, "auto">;
}): string {
  const headerLines = [
    url ? `Source URL: ${url}` : null,
    siteName ? `Site: ${siteName}` : null,
    sourceApp !== "web" ? `Source App: ${formatSourceApp(sourceApp)}` : null,
    `Capture Mode: ${captureMode}`,
  ].filter((line): line is string => !!line);

  return headerLines.length > 0 ? `${headerLines.join("\n")}\n\n${content}` : content;
}

function resolveSourceType(sourceApp: CaptureSourceApp): string {
  switch (sourceApp) {
    case "chatgpt":
      return "chatgpt";
    case "claude":
      return "claude";
    case "openclaw":
      return "openclaw";
    default:
      return "url";
  }
}

function inferSourceAppFromUrl(url: string | null): CaptureSourceApp {
  if (!url) {
    return "unknown";
  }

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname === "chatgpt.com" || hostname === "chat.openai.com") {
      return "chatgpt";
    }

    if (hostname === "claude.ai") {
      return "claude";
    }

    if (hostname.includes("openclaw")) {
      return "openclaw";
    }

    return "web";
  } catch {
    return "unknown";
  }
}

function inferTitleFromUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname.split("/").filter(Boolean).at(-1);
    return lastSegment ? decodeURIComponent(lastSegment) : parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function inferSiteName(sourceApp: CaptureSourceApp, url: string | null): string | null {
  if (sourceApp !== "unknown" && sourceApp !== "web") {
    return formatSourceApp(sourceApp);
  }

  if (!url) {
    return null;
  }

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function formatSourceApp(sourceApp: CaptureSourceApp): string {
  switch (sourceApp) {
    case "chatgpt":
      return "ChatGPT";
    case "claude":
      return "Claude";
    case "openclaw":
      return "OpenClaw";
    case "web":
      return "Web";
    default:
      return "Unknown";
  }
}

function sanitizeUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function normalizeCaptureLimit(value: unknown): number {
  const limit =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(limit)) {
    return 5;
  }

  return Math.min(Math.max(limit, 1), 10);
}

function sanitizeText(value: string | undefined): string {
  if (!value) {
    return "";
  }

  return value.replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();
}

function clampText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}\n\n[Truncated by MindStore capture]` : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
