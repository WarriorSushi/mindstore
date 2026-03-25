import { describe, expect, it } from "vitest";
import { normalizeCapturePayload, normalizeCaptureQuery } from "@/server/capture";

describe("capture normalization", () => {
  it("normalizes smart conversation captures into conversation memories", () => {
    const document = normalizeCapturePayload({
      title: "Conversation",
      url: "https://chatgpt.com/c/123",
      captureMode: "smart",
      conversationText: "user: Explain embeddings\n\nassistant: Embeddings map text into vectors.",
    });

    expect(document.captureMode).toBe("conversation");
    expect(document.sourceApp).toBe("chatgpt");
    expect(document.sourceType).toBe("chatgpt");
    expect(document.contentType).toBe("conversation");
    expect(document.metadata?.["url"]).toBe("https://chatgpt.com/c/123");
  });

  it("prefers explicit selection mode when highlighted text is present", () => {
    const document = normalizeCapturePayload({
      title: "Article",
      url: "https://example.com/post",
      captureMode: "selection",
      selection: "Highlighted section",
      pageText: "Full page fallback",
    });

    expect(document.captureMode).toBe("selection");
    expect(document.sourceType).toBe("url");
    expect(document.content).toContain("Highlighted section");
    expect(document.content).not.toContain("Full page fallback");
  });

  it("normalizes query limits for popup search", () => {
    expect(normalizeCaptureQuery("embeddings", "99")).toEqual({
      query: "embeddings",
      limit: 10,
    });
    expect(normalizeCaptureQuery("   vectors   ", undefined)).toEqual({
      query: "vectors",
      limit: 5,
    });
  });
});
