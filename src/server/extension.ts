import { promises as fs } from "node:fs";
import path from "node:path";

export const EXTENSION_SLUG = "mindstore-everywhere";
export const DEFAULT_EXTENSION_VERSION = "0.1.0";
export const EXTENSION_ROOT = path.join(process.cwd(), "extensions", EXTENSION_SLUG);
export const EXTENSION_MANIFEST_PATH = path.join(EXTENSION_ROOT, "manifest.json");
export const EXTENSION_FILES = [
  "manifest.json",
  "popup.html",
  "popup.css",
  "popup.js",
  "content.js",
  "README.md",
];

interface ExtensionSetupOptions {
  origin: string;
  apiKeyProvided: boolean;
  authenticated: boolean;
  extensionVersion?: string;
}

export async function getExtensionVersion() {
  try {
    const raw = await fs.readFile(EXTENSION_MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === "string" ? parsed.version : DEFAULT_EXTENSION_VERSION;
  } catch {
    return DEFAULT_EXTENSION_VERSION;
  }
}

export function buildExtensionConnection(origin: string) {
  const baseUrl = origin.replace(/\/$/, "");

  return {
    baseUrl,
    captureUrl: `${baseUrl}/api/v1/capture`,
    queryUrl: `${baseUrl}/api/v1/capture/query`,
    setupUrl: `${baseUrl}/api/v1/extension/setup`,
    mcpUrl: `${baseUrl}/api/mcp`,
    docsUrl: `${baseUrl}/docs/getting-started/mindstore-everywhere`,
    downloadUrl: `${baseUrl}/api/v1/extension/package`,
  };
}

export function createExtensionSetupPayload({
  origin,
  apiKeyProvided,
  authenticated,
  extensionVersion = DEFAULT_EXTENSION_VERSION,
}: ExtensionSetupOptions) {
  return {
    ok: true,
    product: {
      name: "MindStore",
      extensionName: "MindStore Everywhere",
      extensionVersion,
    },
    connection: buildExtensionConnection(origin),
    auth: {
      apiKeysSupported: true,
      apiKeyProvided,
      authenticated,
      mode: apiKeyProvided ? "bearer" : "optional",
    },
    capabilities: {
      capture: true,
      query: true,
      mcp: true,
    },
  };
}
