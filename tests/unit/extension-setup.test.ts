import { describe, expect, it } from "vitest";
import { buildExtensionConnection, createExtensionSetupPayload } from "@/server/extension";

describe("extension setup helpers", () => {
  it("builds stable connection URLs from the deployment origin", () => {
    expect(buildExtensionConnection("https://mindstore.example.com/")).toEqual({
      baseUrl: "https://mindstore.example.com",
      captureUrl: "https://mindstore.example.com/api/v1/capture",
      queryUrl: "https://mindstore.example.com/api/v1/capture/query",
      setupUrl: "https://mindstore.example.com/api/v1/extension/setup",
      mcpUrl: "https://mindstore.example.com/api/mcp",
      docsUrl: "https://mindstore.example.com/docs/getting-started/mindstore-everywhere",
      downloadUrl: "https://mindstore.example.com/api/v1/extension/package",
    });
  });

  it("creates a setup payload with auth state and capabilities", () => {
    expect(
      createExtensionSetupPayload({
        origin: "http://localhost:3000",
        apiKeyProvided: true,
        authenticated: true,
        extensionVersion: "0.9.0",
      })
    ).toMatchObject({
      ok: true,
      product: {
        name: "MindStore",
        extensionName: "MindStore Everywhere",
        extensionVersion: "0.9.0",
      },
      auth: {
        apiKeysSupported: true,
        apiKeyProvided: true,
        authenticated: true,
        mode: "bearer",
      },
      capabilities: {
        capture: true,
        query: true,
        mcp: true,
      },
    });
  });
});
