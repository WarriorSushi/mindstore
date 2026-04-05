import { describe, expect, it } from "vitest";
import {
  decodeAISettingValue,
  resolveTextGenerationConfigFromSettings,
  resolveTranscriptionConfigFromSettings,
} from "@/server/ai-client";
import { encrypt } from "@/server/encryption";

describe("ai client config resolution", () => {
  it("prefers explicit openrouter text configuration", () => {
    const config = resolveTextGenerationConfigFromSettings({
      chat_provider: "openrouter",
      openrouter_api_key: "test-key",
    });

    expect(config?.providerLabel).toBe("openrouter");
    expect(config?.model).toBe("google/gemini-2.0-flash-lite:free");
  });

  it("falls back to gemini text generation when available", () => {
    const config = resolveTextGenerationConfigFromSettings({
      gemini_api_key: "gem-key",
    });

    expect(config?.providerLabel).toBe("gemini");
    expect(config?.model).toBe("gemini-2.0-flash-lite");
  });

  it("allows a request-scoped model override", () => {
    const config = resolveTextGenerationConfigFromSettings(
      {
        openai_api_key: "openai-key",
        chat_model: "saved-model",
      },
      {},
      "override-model",
    );

    expect(config?.providerLabel).toBe("openai");
    expect(config?.model).toBe("override-model");
  });

  it("prefers openai for transcription when both providers exist", () => {
    const config = resolveTranscriptionConfigFromSettings({
      openai_api_key: "openai-key",
      gemini_api_key: "gemini-key",
    });

    expect(config?.type).toBe("openai");
    expect(config?.model).toBe("whisper-1");
  });

  it("decrypts encrypted API key values from settings rows", () => {
    const encrypted = encrypt("secret-api-key");

    expect(decodeAISettingValue("openai_api_key", encrypted)).toBe("secret-api-key");
    expect(decodeAISettingValue("chat_provider", "openai")).toBe("openai");
  });
});
