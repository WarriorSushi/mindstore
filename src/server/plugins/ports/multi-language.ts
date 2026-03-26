/**
 * Multi-Language Support — Portable Logic
 *
 * Language detection, script analysis, and cross-language support.
 * AI-dependent features (AI detection, translation) accept callAI as injection.
 * Script-based heuristic detection requires no external deps.
 *
 * DB-backed operations (stats, tagging, search) also live here
 * to keep the route thin.
 */

// ─── Types ──────────────────────────────────────────────────────

export interface LanguageResult {
  code: string;
  name: string;
  confidence: number;
  script?: string;
}

export interface ScriptResult {
  script: string;
  ratio: number;
}

// ─── Language Constants ─────────────────────────────────────────

export const LANGUAGES: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
  pt: 'Portuguese', nl: 'Dutch', sv: 'Swedish', da: 'Danish', no: 'Norwegian',
  fi: 'Finnish', pl: 'Polish', cs: 'Czech', sk: 'Slovak', hu: 'Hungarian',
  ro: 'Romanian', bg: 'Bulgarian', hr: 'Croatian', sl: 'Slovenian', sr: 'Serbian',
  uk: 'Ukrainian', ru: 'Russian', el: 'Greek', tr: 'Turkish', ar: 'Arabic',
  he: 'Hebrew', fa: 'Persian', hi: 'Hindi', bn: 'Bengali', ta: 'Tamil',
  te: 'Telugu', ml: 'Malayalam', th: 'Thai', vi: 'Vietnamese', id: 'Indonesian',
  ms: 'Malay', tl: 'Filipino', zh: 'Chinese', ja: 'Japanese', ko: 'Korean',
  la: 'Latin', af: 'Afrikaans', sw: 'Swahili', ca: 'Catalan', eu: 'Basque',
  gl: 'Galician', cy: 'Welsh', ga: 'Irish', is: 'Icelandic', lt: 'Lithuanian',
  lv: 'Latvian', et: 'Estonian', ka: 'Georgian', hy: 'Armenian', ur: 'Urdu',
};

// ─── Script Detection ───────────────────────────────────────────

/** Identify Unicode scripts present in text and their ratios */
export function detectScript(text: string): ScriptResult[] {
  const scripts: Record<string, number> = {};
  let total = 0;

  for (const char of text) {
    const code = char.codePointAt(0)!;
    let script = 'other';

    if (code >= 0x0041 && code <= 0x024f) script = 'Latin';
    else if (code >= 0x0400 && code <= 0x04ff) script = 'Cyrillic';
    else if (code >= 0x0370 && code <= 0x03ff) script = 'Greek';
    else if (code >= 0x0600 && code <= 0x06ff) script = 'Arabic';
    else if (code >= 0x0590 && code <= 0x05ff) script = 'Hebrew';
    else if (code >= 0x0900 && code <= 0x097f) script = 'Devanagari';
    else if (code >= 0x0980 && code <= 0x09ff) script = 'Bengali';
    else if (code >= 0x0b80 && code <= 0x0bff) script = 'Tamil';
    else if (code >= 0x0c00 && code <= 0x0c7f) script = 'Telugu';
    else if (code >= 0x0d00 && code <= 0x0d7f) script = 'Malayalam';
    else if (code >= 0x0e00 && code <= 0x0e7f) script = 'Thai';
    else if (code >= 0x3040 && code <= 0x309f) script = 'Hiragana';
    else if (code >= 0x30a0 && code <= 0x30ff) script = 'Katakana';
    else if (code >= 0x4e00 && code <= 0x9fff) script = 'CJK';
    else if (code >= 0xac00 && code <= 0xd7af) script = 'Hangul';
    else if (code >= 0x10a0 && code <= 0x10ff) script = 'Georgian';
    else if (code >= 0x0530 && code <= 0x058f) script = 'Armenian';
    else if (code >= 0x0a80 && code <= 0x0aff) script = 'Gujarati';
    else if (code >= 0x0a00 && code <= 0x0a7f) script = 'Gurmukhi';

    if (script !== 'other') {
      scripts[script] = (scripts[script] || 0) + 1;
      total++;
    }
  }

  return Object.entries(scripts)
    .map(([script, count]) => ({ script, ratio: count / Math.max(total, 1) }))
    .sort((a, b) => b.ratio - a.ratio);
}

// ─── Heuristic Language Detection ───────────────────────────────

const SCRIPT_TO_LANG: Record<string, { code: string; name: string }> = {
  Cyrillic: { code: 'ru', name: 'Russian' },
  Greek: { code: 'el', name: 'Greek' },
  Arabic: { code: 'ar', name: 'Arabic' },
  Hebrew: { code: 'he', name: 'Hebrew' },
  Devanagari: { code: 'hi', name: 'Hindi' },
  Bengali: { code: 'bn', name: 'Bengali' },
  Tamil: { code: 'ta', name: 'Tamil' },
  Telugu: { code: 'te', name: 'Telugu' },
  Malayalam: { code: 'ml', name: 'Malayalam' },
  Thai: { code: 'th', name: 'Thai' },
  Hangul: { code: 'ko', name: 'Korean' },
  Georgian: { code: 'ka', name: 'Georgian' },
  Armenian: { code: 'hy', name: 'Armenian' },
};

/**
 * Heuristic language detection from script analysis.
 * High confidence for non-Latin scripts; low confidence for Latin (needs AI).
 */
export function heuristicDetect(text: string): LanguageResult | null {
  const scripts = detectScript(text);
  if (scripts.length === 0) return null;

  const primary = scripts[0];

  // CJK / Japanese
  if (
    primary.script === 'CJK' ||
    primary.script === 'Hiragana' ||
    primary.script === 'Katakana'
  ) {
    const hasKana = scripts.some(
      (s) => s.script === 'Hiragana' || s.script === 'Katakana',
    );
    if (hasKana) return { code: 'ja', name: 'Japanese', confidence: 0.85, script: 'CJK' };
    return { code: 'zh', name: 'Chinese', confidence: 0.75, script: 'CJK' };
  }

  if (SCRIPT_TO_LANG[primary.script]) {
    const lang = SCRIPT_TO_LANG[primary.script];
    return { code: lang.code, name: lang.name, confidence: 0.7, script: primary.script };
  }

  // Latin — can't reliably distinguish en/es/fr/de without AI
  if (primary.script === 'Latin') {
    return { code: 'en', name: 'English', confidence: 0.3, script: 'Latin' };
  }

  return null;
}

// ─── AI-Assisted Detection ──────────────────────────────────────

export type CallAI = (prompt: string, systemPrompt?: string) => Promise<string>;

/** Detect language using AI (higher accuracy, especially for Latin scripts) */
export async function aiDetectLanguage(
  text: string,
  callAI: CallAI,
): Promise<LanguageResult> {
  const sample = text.slice(0, 500);
  const result = await callAI(
    `Detect the language of this text. Respond with ONLY a JSON object like {"code":"en","name":"English","confidence":0.95}\n\nText:\n${sample}`,
    'You are a language detection expert. Respond with ONLY valid JSON, nothing else.',
  );

  try {
    const match = result.match(/\{[^}]+\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        code: parsed.code || 'en',
        name: parsed.name || LANGUAGES[parsed.code] || 'Unknown',
        confidence: Math.min(parsed.confidence || 0.9, 1),
      };
    }
  } catch {}

  return { code: 'en', name: 'English', confidence: 0.5 };
}

/**
 * Best-effort language detection: heuristic first, then AI if needed.
 * `callAI` is optional — if null, only heuristic is used.
 */
export async function detectLanguage(
  text: string,
  callAI?: CallAI | null,
): Promise<{ language: LanguageResult; method: 'heuristic' | 'ai' | 'heuristic-fallback' }> {
  const heuristic = heuristicDetect(text);

  // If heuristic is confident (non-Latin script), use it
  if (heuristic && heuristic.confidence >= 0.7) {
    return { language: heuristic, method: 'heuristic' };
  }

  // Try AI
  if (callAI) {
    try {
      const aiResult = await aiDetectLanguage(text, callAI);
      return { language: aiResult, method: 'ai' };
    } catch {
      // Fallback
    }
  }

  return {
    language: heuristic || { code: 'en', name: 'English', confidence: 0.3 },
    method: 'heuristic-fallback',
  };
}

// ─── AI Translation ─────────────────────────────────────────────

/** Translate text between languages */
export async function translate(
  text: string,
  fromLang: string,
  toLang: string,
  callAI: CallAI,
): Promise<string> {
  const fromName = LANGUAGES[fromLang] || fromLang;
  const toName = LANGUAGES[toLang] || toLang;
  return callAI(
    `Translate the following text from ${fromName} to ${toName}. Provide ONLY the translation, nothing else.\n\nText:\n${text}`,
    'You are a professional translator. Preserve meaning, tone, and formatting. Output ONLY the translation.',
  );
}

/** Translate a search query to a target language (for cross-language search) */
export async function translateQuery(
  query: string,
  targetLang: string,
  callAI: CallAI,
): Promise<string> {
  const targetName = LANGUAGES[targetLang] || targetLang;
  return callAI(
    `Translate this search query to ${targetName}. Output ONLY the translated query: "${query}"`,
    'You are a search query translator. Preserve search intent. Output ONLY the translation.',
  );
}

/**
 * Get language name from ISO code.
 */
export function languageName(code: string): string {
  return LANGUAGES[code] || code;
}

/**
 * Get all supported language entries.
 */
export function supportedLanguages(): Array<{ code: string; name: string }> {
  return Object.entries(LANGUAGES).map(([code, name]) => ({ code, name }));
}

// ─── DB-Backed Operations ───────────────────────────────────────

import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

export async function getLanguageStats(userId: string) {
  const result = await db.execute(
    sql`SELECT COALESCE(metadata->>'language', 'unknown') as language, COUNT(*) as count
        FROM memories WHERE user_id = ${userId}
        GROUP BY metadata->>'language' ORDER BY count DESC`,
  );
  const total = await db.execute(
    sql`SELECT COUNT(*) as count FROM memories WHERE user_id = ${userId}`,
  );
  const tagged = await db.execute(
    sql`SELECT COUNT(*) as count FROM memories WHERE user_id = ${userId}
        AND metadata->>'language' IS NOT NULL AND metadata->>'language' != ''`,
  );
  return {
    totalMemories: parseInt((total as any[])[0]?.count || '0'),
    taggedMemories: parseInt((tagged as any[])[0]?.count || '0'),
    languages: (result as any[]).map(r => ({
      code: r.language,
      name: LANGUAGES[r.language] || (r.language === 'unknown' ? 'Undetected' : r.language),
      count: parseInt(r.count),
    })),
    supportedLanguages: supportedLanguages(),
  };
}

export async function tagMemoryLanguage(
  memoryId: string,
  userId: string,
  callAI: CallAI | null,
) {
  const memory = await db.execute(
    sql`SELECT id, content, metadata FROM memories WHERE id = ${memoryId} AND user_id = ${userId}`,
  );
  if (!(memory as any[]).length) return { error: 'Memory not found', status: 404 } as const;
  const mem = (memory as any[])[0];
  const { language } = await detectLanguage(mem.content || '', callAI);
  const newMeta = {
    ...(mem.metadata || {}),
    language: language.code,
    languageName: language.name,
    languageConfidence: language.confidence,
    languageScript: language.script,
  };
  await db.execute(
    sql`UPDATE memories SET metadata = ${JSON.stringify(newMeta)}::jsonb
        WHERE id = ${memoryId} AND user_id = ${userId}`,
  );
  return { language, memoryId };
}

export async function batchTagLanguages(
  userId: string,
  batchSize: number,
  callAI: CallAI | null,
) {
  const untagged = await db.execute(
    sql`SELECT id, content, metadata FROM memories WHERE user_id = ${userId}
        AND (metadata->>'language' IS NULL OR metadata->>'language' = '')
        ORDER BY created_at DESC LIMIT ${batchSize}`,
  );
  let tagged = 0;
  let errors = 0;
  const languageCounts: Record<string, number> = {};
  for (const mem of untagged as any[]) {
    try {
      if ((mem.content || '').length < 10) continue;
      const { language } = await detectLanguage(mem.content, callAI);
      const newMeta = { ...(mem.metadata || {}), language: language.code, languageName: language.name, languageConfidence: language.confidence };
      await db.execute(
        sql`UPDATE memories SET metadata = ${JSON.stringify(newMeta)}::jsonb
            WHERE id = ${mem.id} AND user_id = ${userId}`,
      );
      tagged++;
      languageCounts[language.code] = (languageCounts[language.code] || 0) + 1;
    } catch {
      errors++;
    }
  }
  const remaining = await db.execute(
    sql`SELECT COUNT(*) as count FROM memories WHERE user_id = ${userId}
        AND (metadata->>'language' IS NULL OR metadata->>'language' = '')`,
  );
  return {
    tagged,
    errors,
    remaining: parseInt((remaining as any[])[0]?.count || '0'),
    languageCounts,
    totalProcessed: (untagged as any[]).length,
  };
}

export async function crossLanguageSearch(
  query: string,
  userId: string,
  limit: number,
  callAI: CallAI,
) {
  const langResult = await db.execute(
    sql`SELECT DISTINCT metadata->>'language' as language FROM memories
        WHERE user_id = ${userId} AND metadata->>'language' IS NOT NULL
        AND metadata->>'language' != '' AND metadata->>'language' != 'en'`,
  );
  const targetLanguages = (langResult as any[]).map(r => r.language).filter(Boolean);

  let queryLang = 'en';
  try { queryLang = (await aiDetectLanguage(query, callAI)).code; } catch {}

  const translations: { language: string; query: string }[] = [{ language: queryLang, query }];
  for (const lang of targetLanguages) {
    if (lang === queryLang) continue;
    try { translations.push({ language: lang, query: await translateQuery(query, lang, callAI) }); } catch {}
  }

  const allResults: any[] = [];
  for (const t of translations) {
    const tsQuery = t.query.split(/\s+/).filter(w => w.length > 1).map(w => w.replace(/[^\w\p{L}]/gu, '')).filter(Boolean).join(' | ');
    if (!tsQuery) continue;
    try {
      const results = await db.execute(
        sql`SELECT id, content, source_type, source_title, metadata, created_at,
            ts_rank_cd(to_tsvector('simple', content), to_tsquery('simple', ${tsQuery})) as rank
            FROM memories WHERE user_id = ${userId}
            AND to_tsvector('simple', content) @@ to_tsquery('simple', ${tsQuery})
            ORDER BY rank DESC LIMIT ${limit}`,
      );
      for (const r of results as any[]) {
        allResults.push({
          id: r.id, content: r.content?.slice(0, 300), sourceType: r.source_type,
          sourceTitle: r.source_title, language: r.metadata?.language || 'unknown',
          matchedQuery: t.query, matchedLanguage: t.language, score: r.rank, createdAt: r.created_at,
        });
      }
    } catch {}
  }

  const deduped = new Map<string, typeof allResults[0]>();
  for (const r of allResults) { const ex = deduped.get(r.id); if (!ex || r.score > ex.score) deduped.set(r.id, r); }
  const finalResults = Array.from(deduped.values()).sort((a, b) => b.score - a.score).slice(0, limit);

  return {
    query,
    queryLanguage: queryLang,
    translations: translations.filter(t => t.language !== queryLang),
    results: finalResults,
    totalResults: finalResults.length,
  };
}

export async function translateMemory(
  memoryId: string,
  userId: string,
  targetLang: string,
  callAI: CallAI,
) {
  const memory = await db.execute(
    sql`SELECT content, metadata FROM memories WHERE id = ${memoryId} AND user_id = ${userId}`,
  );
  if (!(memory as any[]).length) return { error: 'Memory not found', status: 404 } as const;
  const mem = (memory as any[])[0];
  const sourceLang = mem.metadata?.language || 'auto';
  if (sourceLang === targetLang) return { translation: mem.content, from: sourceLang, to: targetLang };
  const translation = await translate(mem.content, sourceLang, targetLang, callAI);
  return { translation, from: sourceLang, to: targetLang };
}

export async function saveLanguageConfig(
  userId: string,
  config: { autoDetect?: boolean; preferredLanguage?: string; crossLanguageSearch?: boolean },
) {
  await db.execute(
    sql`UPDATE plugins SET config = config || ${JSON.stringify(config)}::jsonb
        WHERE slug = 'multi-language' AND user_id = ${userId}`,
  );
  return config;
}
