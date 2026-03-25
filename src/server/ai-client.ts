import { sql } from "drizzle-orm";
import { db } from "@/server/db";

const TEXT_SETTING_KEYS = [
  "openai_api_key",
  "gemini_api_key",
  "ollama_url",
  "openrouter_api_key",
  "custom_api_key",
  "custom_api_url",
  "custom_api_model",
  "chat_provider",
  "chat_model",
] as const;

const TRANSCRIPTION_SETTING_KEYS = [
  "openai_api_key",
  "gemini_api_key",
  "chat_provider",
] as const;

export type AITextProvider = "openai-compatible" | "gemini" | "ollama";
export type AITranscriptionProvider = "openai" | "gemini";
export type AIMessageRole = "system" | "user" | "assistant";

export interface AIMessage {
  role: AIMessageRole;
  content: string;
}

export interface AITextConfig {
  type: AITextProvider;
  url: string;
  key?: string;
  model: string;
  extraHeaders?: Record<string, string>;
  providerLabel: "openai" | "openrouter" | "custom" | "gemini" | "ollama";
}

export interface AITranscriptionConfig {
  type: AITranscriptionProvider;
  key: string;
  model: string;
}

export interface AITextRequest {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface AITextDefaults {
  openai?: string;
  openrouter?: string;
  gemini?: string;
  ollama?: string;
  custom?: string;
}

export interface AITranscriptionRequest {
  audioBuffer: Buffer;
  mimeType?: string;
  language?: string;
}

export interface AITranscriptionResult {
  text: string;
  language: string;
  duration: number;
  segments?: unknown[];
  provider: AITranscriptionProvider;
  model: string;
}

export async function loadAISettings(
  keys: readonly string[] = TEXT_SETTING_KEYS,
): Promise<Record<string, string>> {
  const rows = await db.execute(sql`
    SELECT key, value
    FROM settings
    WHERE key = ANY(${keys}::text[])
  `);

  const settings: Record<string, string> = {};
  for (const row of rows as unknown as Array<{ key: string; value: string }>) {
    settings[row.key] = row.value;
  }
  return settings;
}

export function resolveTextGenerationConfigFromSettings(
  settings: Record<string, string>,
  defaults: AITextDefaults = {},
): AITextConfig | null {
  const preferred = settings.chat_provider;
  const selectedModel = settings.chat_model;
  const openaiKey = settings.openai_api_key || process.env.OPENAI_API_KEY;
  const geminiKey = settings.gemini_api_key || process.env.GEMINI_API_KEY;
  const ollamaUrl = settings.ollama_url || process.env.OLLAMA_URL;
  const openrouterKey = settings.openrouter_api_key || process.env.OPENROUTER_API_KEY;
  const customKey = settings.custom_api_key;
  const customUrl = settings.custom_api_url;
  const customModel = settings.custom_api_model;

  if (preferred === "openrouter" && openrouterKey) {
    return {
      type: "openai-compatible",
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: openrouterKey,
      model: selectedModel || defaults.openrouter || "anthropic/claude-3.5-haiku",
      extraHeaders: {
        "HTTP-Referer": "https://mindstore.app",
        "X-Title": "MindStore",
      },
      providerLabel: "openrouter",
    };
  }

  if (preferred === "custom" && customKey && customUrl) {
    return {
      type: "openai-compatible",
      url: customUrl,
      key: customKey,
      model: selectedModel || customModel || defaults.custom || "default",
      providerLabel: "custom",
    };
  }

  if (preferred === "gemini" && geminiKey) {
    return {
      type: "gemini",
      url: "",
      key: geminiKey,
      model: selectedModel || defaults.gemini || "gemini-2.0-flash-lite",
      providerLabel: "gemini",
    };
  }

  if (preferred === "openai" && openaiKey) {
    return {
      type: "openai-compatible",
      url: "https://api.openai.com/v1/chat/completions",
      key: openaiKey,
      model: selectedModel || defaults.openai || "gpt-4o-mini",
      providerLabel: "openai",
    };
  }

  if (preferred === "ollama" && ollamaUrl) {
    return {
      type: "ollama",
      url: ollamaUrl,
      model: selectedModel || defaults.ollama || "llama3.2",
      providerLabel: "ollama",
    };
  }

  if (geminiKey) {
    return {
      type: "gemini",
      url: "",
      key: geminiKey,
      model: selectedModel || defaults.gemini || "gemini-2.0-flash-lite",
      providerLabel: "gemini",
    };
  }

  if (openaiKey) {
    return {
      type: "openai-compatible",
      url: "https://api.openai.com/v1/chat/completions",
      key: openaiKey,
      model: selectedModel || defaults.openai || "gpt-4o-mini",
      providerLabel: "openai",
    };
  }

  if (openrouterKey) {
    return {
      type: "openai-compatible",
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: openrouterKey,
      model: selectedModel || defaults.openrouter || "anthropic/claude-3.5-haiku",
      extraHeaders: {
        "HTTP-Referer": "https://mindstore.app",
        "X-Title": "MindStore",
      },
      providerLabel: "openrouter",
    };
  }

  if (customKey && customUrl) {
    return {
      type: "openai-compatible",
      url: customUrl,
      key: customKey,
      model: selectedModel || customModel || defaults.custom || "default",
      providerLabel: "custom",
    };
  }

  if (ollamaUrl) {
    return {
      type: "ollama",
      url: ollamaUrl,
      model: selectedModel || defaults.ollama || "llama3.2",
      providerLabel: "ollama",
    };
  }

  return null;
}

export async function getTextGenerationConfig(defaults: AITextDefaults = {}) {
  return resolveTextGenerationConfigFromSettings(await loadAISettings(TEXT_SETTING_KEYS), defaults);
}

export async function callTextGeneration(
  config: AITextConfig,
  request: AITextRequest,
): Promise<string | null> {
  try {
    if (config.type === "gemini") {
      return await callGeminiText(config, request);
    }

    if (config.type === "ollama") {
      return await callOllamaText(config, request);
    }

    return await callOpenAICompatibleText(config, request);
  } catch {
    return null;
  }
}

export async function callTextPrompt(
  config: AITextConfig,
  prompt: string,
  system?: string,
  options: Omit<AITextRequest, "messages"> = {},
): Promise<string | null> {
  const messages: AIMessage[] = [];
  if (system) {
    messages.push({ role: "system", content: system });
  }
  messages.push({ role: "user", content: prompt });
  return callTextGeneration(config, {
    messages,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });
}

export function resolveTranscriptionConfigFromSettings(
  settings: Record<string, string>,
): AITranscriptionConfig | null {
  const preferred = settings.chat_provider;
  const openaiKey = settings.openai_api_key || process.env.OPENAI_API_KEY;
  const geminiKey = settings.gemini_api_key || process.env.GEMINI_API_KEY;

  if (preferred === "gemini" && geminiKey) {
    return { type: "gemini", key: geminiKey, model: "gemini-2.0-flash" };
  }

  if (preferred === "openai" && openaiKey) {
    return { type: "openai", key: openaiKey, model: "whisper-1" };
  }

  if (openaiKey) {
    return { type: "openai", key: openaiKey, model: "whisper-1" };
  }

  if (geminiKey) {
    return { type: "gemini", key: geminiKey, model: "gemini-2.0-flash" };
  }

  return null;
}

export async function getTranscriptionConfig() {
  return resolveTranscriptionConfigFromSettings(await loadAISettings(TRANSCRIPTION_SETTING_KEYS));
}

export async function transcribeAudio(
  config: AITranscriptionConfig,
  request: AITranscriptionRequest,
): Promise<AITranscriptionResult> {
  if (config.type === "openai") {
    const result = await transcribeWithWhisper(config, request);
    return {
      ...result,
      provider: "openai",
      model: config.model,
    };
  }

  const result = await transcribeWithGemini(config, request);
  return {
    ...result,
    provider: "gemini",
    model: config.model,
  };
}

async function callOpenAICompatibleText(
  config: AITextConfig,
  request: AITextRequest,
): Promise<string | null> {
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.key}`,
      ...(config.extraHeaders || {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.3,
      max_tokens: request.maxTokens ?? 4096,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  return data.choices?.[0]?.message?.content || null;
}

async function callGeminiText(
  config: AITextConfig,
  request: AITextRequest,
): Promise<string | null> {
  const systemMessage = request.messages.find((message) => message.role === "system");
  const contents = request.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: systemMessage
          ? { parts: [{ text: systemMessage.content }] }
          : undefined,
        generationConfig: {
          temperature: request.temperature ?? 0.3,
          maxOutputTokens: request.maxTokens ?? 4096,
        },
      }),
    },
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json() as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string | null }> };
    }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function callOllamaText(
  config: AITextConfig,
  request: AITextRequest,
): Promise<string | null> {
  const response = await fetch(`${config.url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      messages: request.messages,
      stream: false,
      options: {
        temperature: request.temperature ?? 0.3,
      },
    }),
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json() as {
    message?: { content?: string | null };
  };
  return data.message?.content || null;
}

async function transcribeWithWhisper(
  config: AITranscriptionConfig,
  request: AITranscriptionRequest,
) {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(request.audioBuffer)], {
    type: request.mimeType || "audio/webm",
  });
  formData.append("file", blob, "recording.webm");
  formData.append("model", config.model);
  formData.append("response_format", "verbose_json");
  if (request.language) {
    formData.append("language", request.language);
  }

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.key}` },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Whisper API error (${response.status}): ${errorText}`);
  }

  const data = await response.json() as {
    text?: string;
    language?: string;
    duration?: number;
    segments?: unknown[];
  };

  return {
    text: data.text || "",
    language: data.language || request.language || "en",
    duration: data.duration || 0,
    segments: data.segments,
  };
}

async function transcribeWithGemini(
  config: AITranscriptionConfig,
  request: AITranscriptionRequest,
) {
  const base64Audio = request.audioBuffer.toString("base64");
  const languageHint = request.language
    ? ` The audio is in ${request.language}.`
    : "";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType: request.mimeType || "audio/webm",
                data: base64Audio,
              },
            },
            {
              text: `Transcribe this audio recording accurately and completely. Return ONLY the transcription text, nothing else. Preserve the speaker's exact words.${languageHint} If the audio is unclear or silent, respond with "[inaudible]".`,
            },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json() as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string | null }> };
    }>;
  };

  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "",
    language: request.language || "auto",
    duration: 0,
  };
}
