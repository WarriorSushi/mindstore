import { describe, expect, it } from "vitest";
import {
  resolveTextGenerationConfigFromSettings,
  resolveTranscriptionConfigFromSettings,
} from "@/server/ai-client";

describe("ai client config resolution", () => {
  it("prefers explicit openrouter text configuration", () => {
    const config = resolveTextGenerationConfigFromSettings({
      chat_provider: "openrouter",
      openrouter_api_key: "test-key",
    });

    expect(config?.providerLabel).toBe("openrouter");
    expect(config?.model).toBe("anthropic/claude-3.5-haiku");
  });

  it("falls back to gemini text generation when available", () => {
    const config = resolveTextGenerationConfigFromSettings({
      gemini_api_key: "gem-key",
    });

    expect(config?.providerLabel).toBe("gemini");
    expect(config?.model).toBe("gemini-2.0-flash-lite");
  });

  it("prefers openai for transcription when both providers exist", () => {
    const config = resolveTranscriptionConfigFromSettings({
      openai_api_key: "openai-key",
      gemini_api_key: "gemini-key",
    });

    expect(config?.type).toBe("openai");
    expect(config?.model).toBe("whisper-1");
  });
});
