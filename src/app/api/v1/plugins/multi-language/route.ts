/**
 * Multi-Language Support Plugin (#31)
 * 
 * Enables storing and searching memories in any language with:
 * - Auto language detection on import
 * - Cross-language semantic search (query in English, find Spanish memories)
 * - AI-powered translation for display
 * - Language distribution analytics
 * - Batch language tagging for existing memories
 * 
 * Technical approach:
 * - Language detection via AI (Gemini/OpenAI) + character analysis heuristic
 * - Cross-language search via query translation before embedding
 * - Translation via AI for on-demand display
 * - Language stored in memory metadata.language field
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/server/user';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

// ─── Language Detection ──────────────────────────────────────────

interface LanguageResult {
  code: string;       // ISO 639-1 (e.g., 'en', 'es', 'ja')
  name: string;       // English name (e.g., 'English', 'Spanish', 'Japanese')
  confidence: number; // 0-1
  script?: string;    // e.g., 'Latin', 'Cyrillic', 'CJK'
}

// Supported languages with their ISO codes and names
const LANGUAGES: Record<string, string> = {
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

// Script detection for heuristic language identification
function detectScript(text: string): { script: string; ratio: number }[] {
  const scripts: Record<string, number> = {};
  let total = 0;
  
  for (const char of text) {
    const code = char.codePointAt(0)!;
    let script = 'other';
    
    if (code >= 0x0041 && code <= 0x024F) script = 'Latin';
    else if (code >= 0x0400 && code <= 0x04FF) script = 'Cyrillic';
    else if (code >= 0x0370 && code <= 0x03FF) script = 'Greek';
    else if (code >= 0x0600 && code <= 0x06FF) script = 'Arabic';
    else if (code >= 0x0590 && code <= 0x05FF) script = 'Hebrew';
    else if (code >= 0x0900 && code <= 0x097F) script = 'Devanagari';
    else if (code >= 0x0980 && code <= 0x09FF) script = 'Bengali';
    else if (code >= 0x0B80 && code <= 0x0BFF) script = 'Tamil';
    else if (code >= 0x0C00 && code <= 0x0C7F) script = 'Telugu';
    else if (code >= 0x0D00 && code <= 0x0D7F) script = 'Malayalam';
    else if (code >= 0x0E00 && code <= 0x0E7F) script = 'Thai';
    else if (code >= 0x3040 && code <= 0x309F) script = 'Hiragana';
    else if (code >= 0x30A0 && code <= 0x30FF) script = 'Katakana';
    else if (code >= 0x4E00 && code <= 0x9FFF) script = 'CJK';
    else if (code >= 0xAC00 && code <= 0xD7AF) script = 'Hangul';
    else if (code >= 0x10A0 && code <= 0x10FF) script = 'Georgian';
    else if (code >= 0x0530 && code <= 0x058F) script = 'Armenian';
    else if (code >= 0x0A80 && code <= 0x0AFF) script = 'Gujarati';
    else if (code >= 0x0A00 && code <= 0x0A7F) script = 'Gurmukhi';
    
    if (script !== 'other') {
      scripts[script] = (scripts[script] || 0) + 1;
      total++;
    }
  }
  
  return Object.entries(scripts)
    .map(([script, count]) => ({ script, ratio: count / Math.max(total, 1) }))
    .sort((a, b) => b.ratio - a.ratio);
}

// Heuristic language detection from script
function heuristicDetect(text: string): LanguageResult | null {
  const scripts = detectScript(text);
  if (scripts.length === 0) return null;
  
  const primary = scripts[0];
  
  // Script → likely language mapping (for non-Latin scripts)
  const scriptToLang: Record<string, { code: string; name: string }> = {
    'Cyrillic': { code: 'ru', name: 'Russian' },
    'Greek': { code: 'el', name: 'Greek' },
    'Arabic': { code: 'ar', name: 'Arabic' },
    'Hebrew': { code: 'he', name: 'Hebrew' },
    'Devanagari': { code: 'hi', name: 'Hindi' },
    'Bengali': { code: 'bn', name: 'Bengali' },
    'Tamil': { code: 'ta', name: 'Tamil' },
    'Telugu': { code: 'te', name: 'Telugu' },
    'Malayalam': { code: 'ml', name: 'Malayalam' },
    'Thai': { code: 'th', name: 'Thai' },
    'Hangul': { code: 'ko', name: 'Korean' },
    'Georgian': { code: 'ka', name: 'Georgian' },
    'Armenian': { code: 'hy', name: 'Armenian' },
  };
  
  // CJK/Japanese detection
  if (primary.script === 'CJK' || primary.script === 'Hiragana' || primary.script === 'Katakana') {
    const hasKana = scripts.some(s => s.script === 'Hiragana' || s.script === 'Katakana');
    if (hasKana) return { code: 'ja', name: 'Japanese', confidence: 0.85, script: 'CJK' };
    return { code: 'zh', name: 'Chinese', confidence: 0.75, script: 'CJK' };
  }
  
  if (scriptToLang[primary.script]) {
    const lang = scriptToLang[primary.script];
    return { code: lang.code, name: lang.name, confidence: 0.7, script: primary.script };
  }
  
  // Latin script — can't reliably distinguish between en/es/fr/de etc. without AI
  if (primary.script === 'Latin') {
    return { code: 'en', name: 'English', confidence: 0.3, script: 'Latin' }; // Low confidence = needs AI
  }
  
  return null;
}

// ─── AI Helpers ──────────────────────────────────────────────────

async function getAIProvider(): Promise<{ provider: string; apiKey: string } | null> {
  const settings = await db.execute(sql`SELECT key, value FROM settings WHERE key IN ('openai_api_key', 'gemini_api_key', 'openrouter_api_key')`);
  const config: Record<string, string> = {};
  for (const row of settings as any[]) {
    config[row.key] = row.value;
  }
  
  if (config.gemini_api_key) return { provider: 'gemini', apiKey: config.gemini_api_key };
  if (config.openai_api_key) return { provider: 'openai', apiKey: config.openai_api_key };
  if (config.openrouter_api_key) return { provider: 'openrouter', apiKey: config.openrouter_api_key };
  if (process.env.GEMINI_API_KEY) return { provider: 'gemini', apiKey: process.env.GEMINI_API_KEY };
  if (process.env.OPENAI_API_KEY) return { provider: 'openai', apiKey: process.env.OPENAI_API_KEY };
  
  return null;
}

async function aiCall(prompt: string, systemPrompt?: string): Promise<string> {
  const ai = await getAIProvider();
  if (!ai) throw new Error('No AI provider configured');
  
  if (ai.provider === 'gemini') {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${ai.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini error: ${res.statusText}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
  
  if (ai.provider === 'openai' || ai.provider === 'openrouter') {
    const baseUrl = ai.provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1';
    const model = ai.provider === 'openrouter' ? 'google/gemini-2.0-flash-lite-001' : 'gpt-4o-mini';
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ai.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });
    if (!res.ok) throw new Error(`AI error: ${res.statusText}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }
  
  throw new Error('Unknown AI provider');
}

// AI-based language detection with higher accuracy
async function aiDetectLanguage(text: string): Promise<LanguageResult> {
  const sample = text.slice(0, 500); // Use first 500 chars for detection
  const result = await aiCall(
    `Detect the language of this text. Respond with ONLY a JSON object like {"code":"en","name":"English","confidence":0.95}\n\nText:\n${sample}`,
    'You are a language detection expert. Detect the primary language of the provided text. Respond with ONLY valid JSON, nothing else.'
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

// AI-based translation
async function aiTranslate(text: string, fromLang: string, toLang: string): Promise<string> {
  const fromName = LANGUAGES[fromLang] || fromLang;
  const toName = LANGUAGES[toLang] || toLang;
  
  return aiCall(
    `Translate the following text from ${fromName} to ${toName}. Provide ONLY the translation, nothing else.\n\nText:\n${text}`,
    `You are a professional translator. Translate accurately while preserving meaning, tone, and formatting. Output ONLY the translation.`
  );
}

// Translate a query into target language for cross-language search
async function translateQuery(query: string, targetLang: string): Promise<string> {
  const targetName = LANGUAGES[targetLang] || targetLang;
  return aiCall(
    `Translate this search query to ${targetName}. Output ONLY the translated query, nothing else: "${query}"`,
    'You are a search query translator. Preserve search intent. Output ONLY the translation.'
  );
}

// ─── Route Handler ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'stats';
    const userId = await getUserId();
    
    switch (action) {
      case 'stats': {
        // Language distribution across memories
        const result = await db.execute(sql`
          SELECT 
            COALESCE(metadata->>'language', 'unknown') as language,
            COUNT(*) as count
          FROM memories 
          WHERE user_id = ${userId}
          GROUP BY metadata->>'language'
          ORDER BY count DESC
        `);
        
        const total = await db.execute(sql`
          SELECT COUNT(*) as count FROM memories WHERE user_id = ${userId}
        `);
        
        const tagged = await db.execute(sql`
          SELECT COUNT(*) as count FROM memories 
          WHERE user_id = ${userId} 
          AND metadata->>'language' IS NOT NULL
          AND metadata->>'language' != ''
        `);
        
        const languages = (result as any[]).map(r => ({
          code: r.language,
          name: LANGUAGES[r.language] || (r.language === 'unknown' ? 'Undetected' : r.language),
          count: parseInt(r.count),
        }));
        
        return NextResponse.json({
          totalMemories: parseInt((total as any[])[0]?.count || '0'),
          taggedMemories: parseInt((tagged as any[])[0]?.count || '0'),
          languages,
          supportedLanguages: Object.entries(LANGUAGES).map(([code, name]) => ({ code, name })),
        });
      }
      
      case 'check': {
        const ai = await getAIProvider();
        return NextResponse.json({
          aiAvailable: !!ai,
          provider: ai?.provider || null,
          supportedLanguages: Object.keys(LANGUAGES).length,
          features: {
            detection: !!ai,
            translation: !!ai,
            crossLanguageSearch: !!ai,
            heuristicDetection: true, // Always available (script-based)
          },
        });
      }
      
      case 'detect': {
        const text = searchParams.get('text');
        if (!text) return NextResponse.json({ error: 'Missing text parameter' }, { status: 400 });
        
        // Try heuristic first
        const heuristic = heuristicDetect(text);
        
        // If heuristic is confident enough (non-Latin script), return it
        if (heuristic && heuristic.confidence >= 0.7) {
          return NextResponse.json({ language: heuristic, method: 'heuristic' });
        }
        
        // Otherwise, use AI for higher accuracy
        try {
          const aiResult = await aiDetectLanguage(text);
          return NextResponse.json({ language: aiResult, method: 'ai' });
        } catch {
          // Fallback to heuristic
          return NextResponse.json({ 
            language: heuristic || { code: 'en', name: 'English', confidence: 0.3 }, 
            method: 'heuristic-fallback' 
          });
        }
      }
      
      case 'translate': {
        const text = searchParams.get('text');
        const from = searchParams.get('from') || 'auto';
        const to = searchParams.get('to') || 'en';
        
        if (!text) return NextResponse.json({ error: 'Missing text parameter' }, { status: 400 });
        
        // Detect source language if auto
        let fromLang = from;
        if (from === 'auto') {
          try {
            const detected = await aiDetectLanguage(text);
            fromLang = detected.code;
          } catch {
            fromLang = 'unknown';
          }
        }
        
        if (fromLang === to) {
          return NextResponse.json({ translation: text, from: fromLang, to, note: 'Same language, no translation needed' });
        }
        
        const translation = await aiTranslate(text, fromLang, to);
        return NextResponse.json({ translation, from: fromLang, to });
      }
      
      case 'search': {
        // Cross-language search: translate query to all detected languages, search each
        const query = searchParams.get('q');
        const limit = parseInt(searchParams.get('limit') || '10');
        
        if (!query) return NextResponse.json({ error: 'Missing query parameter ?q=' }, { status: 400 });
        
        // Get unique languages in the knowledge base
        const langResult = await db.execute(sql`
          SELECT DISTINCT metadata->>'language' as language
          FROM memories 
          WHERE user_id = ${userId}
          AND metadata->>'language' IS NOT NULL
          AND metadata->>'language' != ''
          AND metadata->>'language' != 'en'
        `);
        
        const targetLanguages = (langResult as any[])
          .map(r => r.language)
          .filter(Boolean);
        
        // Detect query language
        let queryLang = 'en';
        try {
          const detected = await aiDetectLanguage(query);
          queryLang = detected.code;
        } catch {}
        
        // Translate query to each target language
        const translations: { language: string; query: string }[] = [
          { language: queryLang, query },
        ];
        
        for (const lang of targetLanguages) {
          if (lang === queryLang) continue;
          try {
            const translated = await translateQuery(query, lang);
            translations.push({ language: lang, query: translated });
          } catch {
            // Skip failed translations
          }
        }
        
        // Search with each translated query using BM25
        const allResults: any[] = [];
        
        for (const t of translations) {
          const tsQuery = t.query
            .split(/\s+/)
            .filter(w => w.length > 1)
            .map(w => w.replace(/[^\w\p{L}]/gu, ''))
            .filter(Boolean)
            .join(' | ');
          
          if (!tsQuery) continue;
          
          try {
            const results = await db.execute(sql`
              SELECT 
                id, content, source_type, source_title, metadata, created_at,
                ts_rank_cd(to_tsvector('simple', content), to_tsquery('simple', ${tsQuery})) as rank
              FROM memories
              WHERE user_id = ${userId}
              AND to_tsvector('simple', content) @@ to_tsquery('simple', ${tsQuery})
              ORDER BY rank DESC
              LIMIT ${limit}
            `);
            
            for (const r of results as any[]) {
              allResults.push({
                id: r.id,
                content: r.content?.slice(0, 300),
                sourceType: r.source_type,
                sourceTitle: r.source_title,
                language: r.metadata?.language || 'unknown',
                matchedQuery: t.query,
                matchedLanguage: t.language,
                score: r.rank,
                createdAt: r.created_at,
              });
            }
          } catch {}
        }
        
        // Deduplicate by memory ID, keeping highest score
        const deduped = new Map<string, typeof allResults[0]>();
        for (const r of allResults) {
          const existing = deduped.get(r.id);
          if (!existing || r.score > existing.score) {
            deduped.set(r.id, r);
          }
        }
        
        const finalResults = Array.from(deduped.values())
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
        
        return NextResponse.json({
          query,
          queryLanguage: queryLang,
          translations: translations.filter(t => t.language !== queryLang),
          results: finalResults,
          totalResults: finalResults.length,
        });
      }
      
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('[multi-language GET]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'tag';
    const userId = await getUserId();
    
    switch (action) {
      case 'tag': {
        // Tag a single memory with its language
        const body = await req.json();
        const { memoryId } = body;
        
        if (!memoryId) return NextResponse.json({ error: 'Missing memoryId' }, { status: 400 });
        
        // Get memory content
        const memory = await db.execute(sql`
          SELECT id, content, metadata FROM memories 
          WHERE id = ${memoryId} AND user_id = ${userId}
        `);
        
        if (!(memory as any[]).length) {
          return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
        }
        
        const mem = (memory as any[])[0];
        const content = mem.content || '';
        
        // Detect language
        let language: LanguageResult;
        const heuristic = heuristicDetect(content);
        
        if (heuristic && heuristic.confidence >= 0.7) {
          language = heuristic;
        } else {
          try {
            language = await aiDetectLanguage(content);
          } catch {
            language = heuristic || { code: 'en', name: 'English', confidence: 0.3 };
          }
        }
        
        // Update metadata
        const existingMeta = mem.metadata || {};
        const newMeta = {
          ...existingMeta,
          language: language.code,
          languageName: language.name,
          languageConfidence: language.confidence,
          languageScript: language.script,
        };
        
        await db.execute(sql`
          UPDATE memories SET metadata = ${JSON.stringify(newMeta)}::jsonb
          WHERE id = ${memoryId} AND user_id = ${userId}
        `);
        
        return NextResponse.json({ language, memoryId });
      }
      
      case 'batch-tag': {
        // Batch tag all untagged memories
        const body = await req.json().catch(() => ({}));
        const batchSize = body.batchSize || 50;
        
        // Get untagged memories
        const untagged = await db.execute(sql`
          SELECT id, content, metadata FROM memories 
          WHERE user_id = ${userId}
          AND (metadata->>'language' IS NULL OR metadata->>'language' = '')
          ORDER BY created_at DESC
          LIMIT ${batchSize}
        `);
        
        const memories = untagged as any[];
        let tagged = 0;
        let errors = 0;
        const languageCounts: Record<string, number> = {};
        
        for (const mem of memories) {
          try {
            const content = mem.content || '';
            if (content.length < 10) {
              // Too short to detect — default to unknown
              continue;
            }
            
            let language: LanguageResult;
            const heuristic = heuristicDetect(content);
            
            if (heuristic && heuristic.confidence >= 0.7) {
              language = heuristic;
            } else {
              try {
                language = await aiDetectLanguage(content);
              } catch {
                language = heuristic || { code: 'en', name: 'English', confidence: 0.3 };
              }
            }
            
            const existingMeta = mem.metadata || {};
            const newMeta = {
              ...existingMeta,
              language: language.code,
              languageName: language.name,
              languageConfidence: language.confidence,
            };
            
            await db.execute(sql`
              UPDATE memories SET metadata = ${JSON.stringify(newMeta)}::jsonb
              WHERE id = ${mem.id} AND user_id = ${userId}
            `);
            
            tagged++;
            languageCounts[language.code] = (languageCounts[language.code] || 0) + 1;
          } catch {
            errors++;
          }
        }
        
        // Get remaining count
        const remaining = await db.execute(sql`
          SELECT COUNT(*) as count FROM memories 
          WHERE user_id = ${userId}
          AND (metadata->>'language' IS NULL OR metadata->>'language' = '')
        `);
        
        return NextResponse.json({
          tagged,
          errors,
          remaining: parseInt((remaining as any[])[0]?.count || '0'),
          languageCounts,
          totalProcessed: memories.length,
        });
      }
      
      case 'translate': {
        // Translate memory content
        const body = await req.json();
        const { memoryId, targetLang = 'en' } = body;
        
        if (!memoryId) return NextResponse.json({ error: 'Missing memoryId' }, { status: 400 });
        
        const memory = await db.execute(sql`
          SELECT content, metadata FROM memories 
          WHERE id = ${memoryId} AND user_id = ${userId}
        `);
        
        if (!(memory as any[]).length) {
          return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
        }
        
        const mem = (memory as any[])[0];
        const sourceLang = mem.metadata?.language || 'auto';
        
        if (sourceLang === targetLang) {
          return NextResponse.json({ translation: mem.content, from: sourceLang, to: targetLang });
        }
        
        const translation = await aiTranslate(mem.content, sourceLang, targetLang);
        return NextResponse.json({ translation, from: sourceLang, to: targetLang });
      }
      
      case 'save-config': {
        const body = await req.json();
        const { autoDetect = true, preferredLanguage = 'en', crossLanguageSearch = true } = body;
        
        // Save to plugins table config
        await db.execute(sql`
          UPDATE plugins SET config = config || ${JSON.stringify({
            autoDetect,
            preferredLanguage,
            crossLanguageSearch,
          })}::jsonb
          WHERE slug = 'multi-language' AND user_id = ${userId}
        `);
        
        return NextResponse.json({ saved: true, config: { autoDetect, preferredLanguage, crossLanguageSearch } });
      }
      
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('[multi-language POST]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal error' }, { status: 500 });
  }
}
