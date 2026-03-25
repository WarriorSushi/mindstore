/**
 * Shared AI Caller — single source of truth for AI provider config + calls.
 *
 * Replaces ~9 duplicated getAIConfig/callAI/callOpenAICompatible/callGemini/callOllama
 * functions scattered across plugin route files.
 *
 * Usage:
 *   import { resolveAIConfig, callAI } from '@/server/plugins/ai-caller';
 *   const config = await resolveAIConfig();          // reads DB settings
 *   const config = resolveAIConfigFromMap(settingsMap); // from pre-fetched map
 *   const response = await callAI(config, prompt, { temperature: 0.1, maxTokens: 300 });
 */

import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

// ─── Types ──────────────────────────────────────────────────────

export interface AIConfig {
  type: 'openai-compatible' | 'gemini' | 'ollama';
  url: string;
  key?: string;
  model: string;
  extraHeaders?: Record<string, string>;
}

export interface CallOptions {
  temperature?: number;
  maxTokens?: number;
  /** System message (OpenAI-compatible only) */
  system?: string;
}

// ─── Settings keys we need ──────────────────────────────────────

const AI_SETTING_KEYS = [
  'openai_api_key',
  'gemini_api_key',
  'ollama_url',
  'openrouter_api_key',
  'custom_api_key',
  'custom_api_url',
  'custom_api_model',
  'chat_provider',
] as const;

// ─── Resolve AI config from DB ──────────────────────────────────

/**
 * Reads AI provider settings from the DB and returns the best available config.
 * Returns null if no provider is configured.
 */
export async function resolveAIConfig(): Promise<AIConfig | null> {
  const rows = await db.execute(
    sql`SELECT key, value FROM settings WHERE key IN (
      'openai_api_key', 'gemini_api_key', 'ollama_url',
      'openrouter_api_key', 'custom_api_key', 'custom_api_url', 'custom_api_model',
      'chat_provider'
    )`
  );

  const map: Record<string, string> = {};
  for (const row of rows as any[]) {
    map[row.key] = row.value;
  }

  return resolveAIConfigFromMap(map);
}

/**
 * Resolves AI config from a pre-fetched settings map (avoids extra DB call
 * when the caller already has settings loaded).
 */
export function resolveAIConfigFromMap(config: Record<string, string>): AIConfig | null {
  const preferred = config.chat_provider;
  const openaiKey = config.openai_api_key || process.env.OPENAI_API_KEY;
  const geminiKey = config.gemini_api_key || process.env.GEMINI_API_KEY;
  const ollamaUrl = config.ollama_url || process.env.OLLAMA_URL;
  const openrouterKey = config.openrouter_api_key || process.env.OPENROUTER_API_KEY;
  const customKey = config.custom_api_key;
  const customUrl = config.custom_api_url;
  const customModel = config.custom_api_model;

  // Check preferred provider first
  if (preferred === 'openrouter' && openrouterKey) {
    return {
      type: 'openai-compatible',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: openrouterKey,
      model: 'anthropic/claude-3.5-haiku',
      extraHeaders: { 'HTTP-Referer': 'https://mindstore.app', 'X-Title': 'MindStore' },
    };
  }
  if (preferred === 'custom' && customKey && customUrl) {
    return {
      type: 'openai-compatible',
      url: customUrl,
      key: customKey,
      model: customModel || 'default',
    };
  }
  if (preferred === 'gemini' && geminiKey) {
    return { type: 'gemini', url: '', key: geminiKey, model: 'gemini-2.0-flash-lite' };
  }
  if (preferred === 'openai' && openaiKey) {
    return {
      type: 'openai-compatible',
      url: 'https://api.openai.com/v1/chat/completions',
      key: openaiKey,
      model: 'gpt-4o-mini',
    };
  }
  if (preferred === 'ollama' && ollamaUrl) {
    return { type: 'ollama', url: ollamaUrl, model: 'llama3.2' };
  }

  // Auto-detect chain (cheapest first)
  if (geminiKey) return { type: 'gemini', url: '', key: geminiKey, model: 'gemini-2.0-flash-lite' };
  if (openaiKey) return { type: 'openai-compatible', url: 'https://api.openai.com/v1/chat/completions', key: openaiKey, model: 'gpt-4o-mini' };
  if (openrouterKey) return { type: 'openai-compatible', url: 'https://openrouter.ai/api/v1/chat/completions', key: openrouterKey, model: 'anthropic/claude-3.5-haiku', extraHeaders: { 'HTTP-Referer': 'https://mindstore.app', 'X-Title': 'MindStore' } };
  if (customKey && customUrl) return { type: 'openai-compatible', url: customUrl, key: customKey, model: customModel || 'default' };
  if (ollamaUrl) return { type: 'ollama', url: ollamaUrl, model: 'llama3.2' };

  return null;
}

// ─── Call AI ────────────────────────────────────────────────────

/**
 * Calls the AI provider and returns the text response.
 * Returns null on any failure (never throws).
 */
export async function callAI(
  config: AIConfig,
  prompt: string,
  opts: CallOptions = {},
): Promise<string | null> {
  const { temperature = 0.3, maxTokens = 1000, system } = opts;

  try {
    switch (config.type) {
      case 'gemini':
        return await callGemini(config, prompt, temperature, maxTokens);
      case 'ollama':
        return await callOllama(config, prompt, temperature, maxTokens);
      default:
        return await callOpenAICompatible(config, prompt, temperature, maxTokens, system);
    }
  } catch (e) {
    console.error('[ai-caller] Call failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

// ─── Provider implementations ───────────────────────────────────

async function callOpenAICompatible(
  config: AIConfig,
  prompt: string,
  temperature: number,
  maxTokens: number,
  system?: string,
): Promise<string | null> {
  const messages: { role: string; content: string }[] = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.key}`,
    ...(config.extraHeaders || {}),
  };

  const res = await fetch(config.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}

async function callGemini(
  config: AIConfig,
  prompt: string,
  temperature: number,
  maxTokens: number,
): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function callOllama(
  config: AIConfig,
  prompt: string,
  temperature: number,
  maxTokens: number,
): Promise<string | null> {
  const res = await fetch(`${config.url}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      prompt,
      stream: false,
      options: { temperature, num_predict: maxTokens },
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.response || null;
}
