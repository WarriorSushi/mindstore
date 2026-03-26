/**
 * Multi-Language Support Plugin — Route (thin wrapper)
 *
 * GET  ?action=stats|check|detect|translate|search
 * POST ?action=tag|batch-tag|translate|save-config
 *
 * Logic delegated to src/server/plugins/ports/multi-language.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/server/user';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { getTextGenerationConfig, callTextPrompt, type AITextConfig } from '@/server/ai-client';
import {
  LANGUAGES,
  detectLanguage,
  aiDetectLanguage,
  translate,
  translateQuery,
  supportedLanguages,
  type CallAI,
} from '@/server/plugins/ports/multi-language';

// ─── AI Provider (shared ai-client) ─────────────────────────

function makeCallAI(config: AITextConfig): CallAI {
  return async (prompt, systemPrompt) => {
    const result = await callTextPrompt(config, prompt, systemPrompt, { temperature: 0.1, maxTokens: 2000 });
    return result || '';
  };
}

// ─── GET Handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'stats';
    const userId = await getUserId();

    if (action === 'stats') {
      const result = await db.execute(sql`SELECT COALESCE(metadata->>'language', 'unknown') as language, COUNT(*) as count FROM memories WHERE user_id = ${userId} GROUP BY metadata->>'language' ORDER BY count DESC`);
      const total = await db.execute(sql`SELECT COUNT(*) as count FROM memories WHERE user_id = ${userId}`);
      const tagged = await db.execute(sql`SELECT COUNT(*) as count FROM memories WHERE user_id = ${userId} AND metadata->>'language' IS NOT NULL AND metadata->>'language' != ''`);
      return NextResponse.json({
        totalMemories: parseInt((total as any[])[0]?.count || '0'),
        taggedMemories: parseInt((tagged as any[])[0]?.count || '0'),
        languages: (result as any[]).map(r => ({ code: r.language, name: LANGUAGES[r.language] || (r.language === 'unknown' ? 'Undetected' : r.language), count: parseInt(r.count) })),
        supportedLanguages: supportedLanguages(),
      });
    }

    if (action === 'check') {
      const ai = await getTextGenerationConfig();
      return NextResponse.json({
        aiAvailable: !!ai, provider: ai?.providerLabel || null,
        supportedLanguages: Object.keys(LANGUAGES).length,
        features: { detection: !!ai, translation: !!ai, crossLanguageSearch: !!ai, heuristicDetection: true },
      });
    }

    if (action === 'detect') {
      const text = searchParams.get('text');
      if (!text) return NextResponse.json({ error: 'Missing text parameter' }, { status: 400 });
      const ai = await getTextGenerationConfig();
      const callAI = ai ? makeCallAI(ai) : null;
      const { language, method } = await detectLanguage(text, callAI);
      return NextResponse.json({ language, method });
    }

    if (action === 'translate') {
      const text = searchParams.get('text'), from = searchParams.get('from') || 'auto', to = searchParams.get('to') || 'en';
      if (!text) return NextResponse.json({ error: 'Missing text parameter' }, { status: 400 });
      const ai = await getTextGenerationConfig();
      if (!ai) return NextResponse.json({ error: 'No AI provider configured' }, { status: 400 });
      const callAI = makeCallAI(ai!);
      let fromLang = from;
      if (from === 'auto') {
        try { fromLang = (await aiDetectLanguage(text, callAI)).code; } catch { fromLang = 'unknown'; }
      }
      if (fromLang === to) return NextResponse.json({ translation: text, from: fromLang, to, note: 'Same language' });
      const translation = await translate(text, fromLang, to, callAI);
      return NextResponse.json({ translation, from: fromLang, to });
    }

    if (action === 'search') {
      const query = searchParams.get('q'), limit = parseInt(searchParams.get('limit') || '10');
      if (!query) return NextResponse.json({ error: 'Missing query parameter ?q=' }, { status: 400 });
      const ai = await getTextGenerationConfig();
      if (!ai) return NextResponse.json({ error: 'No AI provider for cross-language search' }, { status: 400 });
      const callAI = makeCallAI(ai!);

      const langResult = await db.execute(sql`SELECT DISTINCT metadata->>'language' as language FROM memories WHERE user_id = ${userId} AND metadata->>'language' IS NOT NULL AND metadata->>'language' != '' AND metadata->>'language' != 'en'`);
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
          const results = await db.execute(sql`SELECT id, content, source_type, source_title, metadata, created_at, ts_rank_cd(to_tsvector('simple', content), to_tsquery('simple', ${tsQuery})) as rank FROM memories WHERE user_id = ${userId} AND to_tsvector('simple', content) @@ to_tsquery('simple', ${tsQuery}) ORDER BY rank DESC LIMIT ${limit}`);
          for (const r of results as any[]) {
            allResults.push({ id: r.id, content: r.content?.slice(0, 300), sourceType: r.source_type, sourceTitle: r.source_title, language: r.metadata?.language || 'unknown', matchedQuery: t.query, matchedLanguage: t.language, score: r.rank, createdAt: r.created_at });
          }
        } catch {}
      }

      const deduped = new Map<string, typeof allResults[0]>();
      for (const r of allResults) { const ex = deduped.get(r.id); if (!ex || r.score > ex.score) deduped.set(r.id, r); }
      const finalResults = Array.from(deduped.values()).sort((a, b) => b.score - a.score).slice(0, limit);
      return NextResponse.json({ query, queryLanguage: queryLang, translations: translations.filter(t => t.language !== queryLang), results: finalResults, totalResults: finalResults.length });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    console.error('[multi-language GET]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal error' }, { status: 500 });
  }
}

// ─── POST Handler ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'tag';
    const userId = await getUserId();

    if (action === 'tag') {
      const { memoryId } = await req.json();
      if (!memoryId) return NextResponse.json({ error: 'Missing memoryId' }, { status: 400 });
      const memory = await db.execute(sql`SELECT id, content, metadata FROM memories WHERE id = ${memoryId} AND user_id = ${userId}`);
      if (!(memory as any[]).length) return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
      const mem = (memory as any[])[0];
      const ai = await getTextGenerationConfig();
      const callAI = ai ? makeCallAI(ai) : null;
      const { language } = await detectLanguage(mem.content || '', callAI);
      const newMeta = { ...(mem.metadata || {}), language: language.code, languageName: language.name, languageConfidence: language.confidence, languageScript: language.script };
      await db.execute(sql`UPDATE memories SET metadata = ${JSON.stringify(newMeta)}::jsonb WHERE id = ${memoryId} AND user_id = ${userId}`);
      return NextResponse.json({ language, memoryId });
    }

    if (action === 'batch-tag') {
      const body = await req.json().catch(() => ({}));
      const batchSize = body.batchSize || 50;
      const untagged = await db.execute(sql`SELECT id, content, metadata FROM memories WHERE user_id = ${userId} AND (metadata->>'language' IS NULL OR metadata->>'language' = '') ORDER BY created_at DESC LIMIT ${batchSize}`);
      const ai = await getTextGenerationConfig();
      const callAI = ai ? makeCallAI(ai) : null;
      let tagged = 0, errors = 0;
      const languageCounts: Record<string, number> = {};
      for (const mem of untagged as any[]) {
        try {
          if ((mem.content || '').length < 10) continue;
          const { language } = await detectLanguage(mem.content, callAI);
          const newMeta = { ...(mem.metadata || {}), language: language.code, languageName: language.name, languageConfidence: language.confidence };
          await db.execute(sql`UPDATE memories SET metadata = ${JSON.stringify(newMeta)}::jsonb WHERE id = ${mem.id} AND user_id = ${userId}`);
          tagged++;
          languageCounts[language.code] = (languageCounts[language.code] || 0) + 1;
        } catch { errors++; }
      }
      const remaining = await db.execute(sql`SELECT COUNT(*) as count FROM memories WHERE user_id = ${userId} AND (metadata->>'language' IS NULL OR metadata->>'language' = '')`);
      return NextResponse.json({ tagged, errors, remaining: parseInt((remaining as any[])[0]?.count || '0'), languageCounts, totalProcessed: (untagged as any[]).length });
    }

    if (action === 'translate') {
      const { memoryId, targetLang = 'en' } = await req.json();
      if (!memoryId) return NextResponse.json({ error: 'Missing memoryId' }, { status: 400 });
      const memory = await db.execute(sql`SELECT content, metadata FROM memories WHERE id = ${memoryId} AND user_id = ${userId}`);
      if (!(memory as any[]).length) return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
      const mem = (memory as any[])[0];
      const sourceLang = mem.metadata?.language || 'auto';
      if (sourceLang === targetLang) return NextResponse.json({ translation: mem.content, from: sourceLang, to: targetLang });
      const ai = await getTextGenerationConfig();
      if (!ai) return NextResponse.json({ error: 'No AI provider configured' }, { status: 400 });
      const translation = await translate(mem.content, sourceLang, targetLang, makeCallAI(ai!));
      return NextResponse.json({ translation, from: sourceLang, to: targetLang });
    }

    if (action === 'save-config') {
      const { autoDetect = true, preferredLanguage = 'en', crossLanguageSearch = true } = await req.json();
      await db.execute(sql`UPDATE plugins SET config = config || ${JSON.stringify({ autoDetect, preferredLanguage, crossLanguageSearch })}::jsonb WHERE slug = 'multi-language' AND user_id = ${userId}`);
      return NextResponse.json({ saved: true, config: { autoDetect, preferredLanguage, crossLanguageSearch } });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    console.error('[multi-language POST]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal error' }, { status: 500 });
  }
}
