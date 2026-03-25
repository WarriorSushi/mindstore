/**
 * Sentiment Timeline Plugin — Route (thin wrapper)
 *
 * GET ?action=analyze  — Run sentiment analysis on unscored memories (AI + lexicon fallback)
 * GET ?action=results  — Get cached sentiment data + daily/weekly aggregates
 * GET ?action=summary  — Get aggregate mood summary (trends, happiest topics, etc.)
 *
 * Logic delegated to src/server/plugins/ports/sentiment-timeline.ts
 */

import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import {
  analyzeSentiment,
  classifyScore,
  buildSentimentPrompt,
  aggregateWeekly,
  detectMoodTrend,
  safeParseJSON,
  type SentimentMemoryResult,
} from '@/server/plugins/ports/sentiment-timeline';

const PLUGIN_SLUG = 'sentiment-timeline';

// ──────────────────────────────────────────────────────────────
// Auto-install plugin
// ──────────────────────────────────────────────────────────────

async function ensurePluginInstalled() {
  const existing = await db.execute(sql`SELECT id FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
  if ((existing as any[]).length === 0) {
    await db.execute(sql`
      INSERT INTO plugins (slug, name, description, type, status, icon, category)
      VALUES (
        ${PLUGIN_SLUG},
        'Sentiment Timeline',
        'Visualize the emotional arc of your knowledge. Calendar heatmap, mood trends, and emotional insights.',
        'extension',
        'active',
        'Heart',
        'analysis'
      )
    `);
  }
}

// ──────────────────────────────────────────────────────────────
// AI Config
// ──────────────────────────────────────────────────────────────

interface AIConfig {
  type: 'openai-compatible' | 'gemini' | 'ollama';
  url: string;
  key?: string;
  model: string;
  extraHeaders?: Record<string, string>;
}

function getAIConfig(config: Record<string, string>): AIConfig | null {
  const preferred = config.chat_provider;
  const openaiKey = config.openai_api_key || process.env.OPENAI_API_KEY;
  const geminiKey = config.gemini_api_key || process.env.GEMINI_API_KEY;
  const ollamaUrl = config.ollama_url || process.env.OLLAMA_URL;
  const openrouterKey = config.openrouter_api_key || process.env.OPENROUTER_API_KEY;
  const customKey = config.custom_api_key;
  const customUrl = config.custom_api_url;
  const customModel = config.custom_api_model;

  if (preferred === 'openrouter' && openrouterKey) return { type: 'openai-compatible', url: 'https://openrouter.ai/api/v1/chat/completions', key: openrouterKey, model: 'anthropic/claude-3.5-haiku', extraHeaders: { 'HTTP-Referer': 'https://mindstore.app', 'X-Title': 'MindStore' } };
  if (preferred === 'custom' && customKey && customUrl) return { type: 'openai-compatible', url: customUrl, key: customKey, model: customModel || 'default' };
  if (preferred === 'gemini' && geminiKey) return { type: 'gemini', url: '', key: geminiKey, model: 'gemini-2.0-flash-lite' };
  if (preferred === 'openai' && openaiKey) return { type: 'openai-compatible', url: 'https://api.openai.com/v1/chat/completions', key: openaiKey, model: 'gpt-4o-mini' };
  if (preferred === 'ollama' && ollamaUrl) return { type: 'ollama', url: ollamaUrl, model: 'llama3.2' };
  if (geminiKey) return { type: 'gemini', url: '', key: geminiKey, model: 'gemini-2.0-flash-lite' };
  if (openaiKey) return { type: 'openai-compatible', url: 'https://api.openai.com/v1/chat/completions', key: openaiKey, model: 'gpt-4o-mini' };
  if (openrouterKey) return { type: 'openai-compatible', url: 'https://openrouter.ai/api/v1/chat/completions', key: openrouterKey, model: 'anthropic/claude-3.5-haiku', extraHeaders: { 'HTTP-Referer': 'https://mindstore.app', 'X-Title': 'MindStore' } };
  if (customKey && customUrl) return { type: 'openai-compatible', url: customUrl, key: customKey, model: customModel || 'default' };
  if (ollamaUrl) return { type: 'ollama', url: ollamaUrl, model: 'llama3.2' };
  return null;
}

// ──────────────────────────────────────────────────────────────
// Route handler
// ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const action = req.nextUrl.searchParams.get('action') || 'results';

    await ensurePluginInstalled();

    if (action === 'results') return getResults(userId);
    if (action === 'analyze') return runAnalysis(userId);
    if (action === 'summary') return getSummary(userId);

    return NextResponse.json({ error: 'Unknown action. Use: results, analyze, summary' }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ──────────────────────────────────────────────────────────────
// Get cached results
// ──────────────────────────────────────────────────────────────

async function getResults(userId: string) {
  const results = await db.execute(sql`
    SELECT 
      id, content, source_type, source_title, created_at,
      metadata->>'sentiment_score' as sentiment_score,
      metadata->>'sentiment_label' as sentiment_label,
      metadata->>'sentiment_emotions' as sentiment_emotions
    FROM memories
    WHERE user_id = ${userId}::uuid
      AND metadata->>'sentiment_score' IS NOT NULL
    ORDER BY created_at ASC
  `);

  const memories: SentimentMemoryResult[] = (results as any[]).map(r => ({
    id: r.id,
    preview: r.content?.slice(0, 200),
    sourceType: r.source_type,
    sourceTitle: r.source_title || 'Untitled',
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    score: parseFloat(r.sentiment_score),
    label: r.sentiment_label || classifyScore(parseFloat(r.sentiment_score)),
    emotions: safeParseJSON(r.sentiment_emotions, []),
  }));

  // Build daily aggregates for heatmap
  const dailyMap: Record<string, { scores: number[]; count: number; labels: Record<string, number> }> = {};
  for (const m of memories) {
    const day = m.createdAt.split('T')[0]!;
    if (!dailyMap[day]) dailyMap[day] = { scores: [], count: 0, labels: {} };
    dailyMap[day]!.scores.push(m.score);
    dailyMap[day]!.count++;
    dailyMap[day]!.labels[m.label] = (dailyMap[day]!.labels[m.label] || 0) + 1;
  }

  const daily = Object.entries(dailyMap)
    .map(([date, data]) => ({
      date,
      avgScore: data.scores.reduce((s, v) => s + v, 0) / data.scores.length,
      count: data.count,
      dominantMood: Object.entries(data.labels).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral',
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Weekly aggregation via port
  const weekly = aggregateWeekly(memories);

  return NextResponse.json({
    memories,
    daily,
    weekly,
    totalAnalyzed: memories.length,
  });
}

// ──────────────────────────────────────────────────────────────
// Get summary
// ──────────────────────────────────────────────────────────────

async function getSummary(userId: string) {
  const results = await db.execute(sql`
    SELECT 
      id, content, source_type, source_title, created_at,
      metadata->>'sentiment_score' as sentiment_score,
      metadata->>'sentiment_label' as sentiment_label
    FROM memories
    WHERE user_id = ${userId}::uuid
      AND metadata->>'sentiment_score' IS NOT NULL
    ORDER BY created_at ASC
  `);

  const all = (results as any[]).map(r => ({
    id: r.id,
    content: r.content?.slice(0, 300),
    sourceType: r.source_type,
    sourceTitle: r.source_title || 'Untitled',
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    score: parseFloat(r.sentiment_score),
    label: r.sentiment_label || classifyScore(parseFloat(r.sentiment_score)),
  }));

  const totalMemories = await db.execute(sql`
    SELECT COUNT(*) as count FROM memories WHERE user_id = ${userId}::uuid
  `);
  const total = parseInt((totalMemories as any[])[0]?.count || '0');

  if (all.length === 0) {
    return NextResponse.json({
      analyzed: 0, total, overallMood: 'unknown', overallScore: 0,
      distribution: {}, happiest: null, saddest: null, moodBySource: {}, trends: [],
    });
  }

  const avgScore = all.reduce((s, m) => s + m.score, 0) / all.length;

  const distribution: Record<string, number> = {};
  for (const m of all) distribution[m.label] = (distribution[m.label] || 0) + 1;

  const bySource: Record<string, { total: number; sum: number }> = {};
  for (const m of all) {
    if (!bySource[m.sourceType]) bySource[m.sourceType] = { total: 0, sum: 0 };
    bySource[m.sourceType]!.total++;
    bySource[m.sourceType]!.sum += m.score;
  }
  const moodBySource: Record<string, { count: number; avgScore: number; label: string }> = {};
  for (const [src, data] of Object.entries(bySource)) {
    const avg = data.sum / data.total;
    moodBySource[src] = { count: data.total, avgScore: Math.round(avg * 100) / 100, label: classifyScore(avg) };
  }

  const sorted = [...all].sort((a, b) => b.score - a.score);
  const happiest = sorted.slice(0, 3).map(m => ({
    id: m.id, title: m.sourceTitle, content: m.content?.slice(0, 150),
    score: m.score, sourceType: m.sourceType, createdAt: m.createdAt,
  }));
  const saddest = sorted.slice(-3).reverse().map(m => ({
    id: m.id, title: m.sourceTitle, content: m.content?.slice(0, 150),
    score: m.score, sourceType: m.sourceType, createdAt: m.createdAt,
  }));

  const monthlyMap: Record<string, number[]> = {};
  for (const m of all) {
    if (!m.createdAt) continue;
    const month = m.createdAt.slice(0, 7);
    if (!monthlyMap[month]) monthlyMap[month] = [];
    monthlyMap[month]!.push(m.score);
  }
  const trends = Object.entries(monthlyMap)
    .map(([month, scores]) => ({
      month,
      avgScore: Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100,
      count: scores.length,
      label: classifyScore(scores.reduce((s, v) => s + v, 0) / scores.length),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return NextResponse.json({
    analyzed: all.length, total,
    overallMood: classifyScore(avgScore),
    overallScore: Math.round(avgScore * 100) / 100,
    distribution, happiest, saddest, moodBySource, trends,
  });
}

// ──────────────────────────────────────────────────────────────
// Run analysis — analyze unscored memories
// ──────────────────────────────────────────────────────────────

async function runAnalysis(userId: string) {
  const unscored = await db.execute(sql`
    SELECT id, content, source_type, source_title, created_at
    FROM memories
    WHERE user_id = ${userId}::uuid
      AND (metadata->>'sentiment_score' IS NULL)
      AND LENGTH(content) > 30
    ORDER BY created_at DESC
    LIMIT 200
  `);

  const memories = unscored as any[];
  if (memories.length === 0) {
    return NextResponse.json({ analyzed: 0, message: 'All memories have been analyzed already.', skipped: 0 });
  }

  // Get AI config
  const settings = await db.execute(
    sql`SELECT key, value FROM settings WHERE key IN (
      'openai_api_key', 'gemini_api_key', 'ollama_url',
      'openrouter_api_key', 'custom_api_key', 'custom_api_url', 'custom_api_model',
      'chat_provider'
    )`
  );
  const config: Record<string, string> = {};
  for (const row of settings as any[]) config[row.key] = row.value;

  const aiConfig = getAIConfig(config);
  let analyzed = 0;
  let failed = 0;

  if (aiConfig) {
    const BATCH_SIZE = 8;
    for (let i = 0; i < memories.length; i += BATCH_SIZE) {
      const batch = memories.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(m => analyzeSentimentAI(m, aiConfig))
      );
      for (let j = 0; j < results.length; j++) {
        const result = results[j]!;
        if (result.status === 'fulfilled' && result.value) {
          const { score, label, emotions } = result.value;
          await db.execute(sql`
            UPDATE memories
            SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
              'sentiment_score', ${score.toString()},
              'sentiment_label', ${label},
              'sentiment_emotions', ${JSON.stringify(emotions)}
            )
            WHERE id = ${batch[j].id}::uuid AND user_id = ${userId}::uuid
          `);
          analyzed++;
        } else { failed++; }
      }
    }
  } else {
    // Lexicon-based fallback via port
    for (const m of memories) {
      const { score, label, emotions } = analyzeSentiment(m.content);
      await db.execute(sql`
        UPDATE memories
        SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'sentiment_score', ${score.toString()},
          'sentiment_label', ${label},
          'sentiment_emotions', ${JSON.stringify(emotions)}
        )
        WHERE id = ${m.id}::uuid AND user_id = ${userId}::uuid
      `);
      analyzed++;
    }
  }

  const totalResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM memories
    WHERE user_id = ${userId}::uuid AND metadata->>'sentiment_score' IS NOT NULL
  `);
  const totalAnalyzed = parseInt((totalResult as any[])[0]?.count || '0');

  return NextResponse.json({
    analyzed, failed, totalAnalyzed, aiPowered: !!aiConfig,
    message: analyzed > 0
      ? `Analyzed ${analyzed} memories${aiConfig ? ' with AI' : ' using lexicon analysis'}. ${failed > 0 ? `${failed} failed.` : ''}`
      : 'No new memories to analyze.',
  });
}

// ──────────────────────────────────────────────────────────────
// AI-powered sentiment analysis
// ──────────────────────────────────────────────────────────────

async function analyzeSentimentAI(memory: any, aiConfig: AIConfig): Promise<{
  score: number; label: string; emotions: string[];
} | null> {
  const { system, prompt } = buildSentimentPrompt(memory.content, memory.source_title || 'Untitled');

  try {
    const response = await callAI(aiConfig, prompt);
    if (!response) return null;

    let cleaned = response.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    const parsed = JSON.parse(cleaned);
    const score = Math.max(-1, Math.min(1, parseFloat(parsed.score) || 0));
    const label = ['positive', 'negative', 'neutral', 'mixed'].includes(parsed.label) ? parsed.label : classifyScore(score);
    const emotions = Array.isArray(parsed.emotions) ? parsed.emotions.slice(0, 3) : [];
    return { score, label, emotions };
  } catch { return null; }
}

// ──────────────────────────────────────────────────────────────
// AI call helpers
// ──────────────────────────────────────────────────────────────

async function callAI(config: AIConfig, prompt: string): Promise<string | null> {
  try {
    if (config.type === 'gemini') return callGemini(config, prompt);
    if (config.type === 'ollama') return callOllama(config, prompt);
    return callOpenAICompatible(config, prompt);
  } catch { return null; }
}

async function callOpenAICompatible(config: AIConfig, prompt: string): Promise<string | null> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json', 'Authorization': `Bearer ${config.key}`,
    ...(config.extraHeaders || {}),
  };
  const res = await fetch(config.url, {
    method: 'POST', headers,
    body: JSON.stringify({ model: config.model, messages: [{ role: 'user', content: prompt }], temperature: 0.1, max_tokens: 200 }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}

async function callGemini(config: AIConfig, prompt: string): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.key}`;
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 200 } }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function callOllama(config: AIConfig, prompt: string): Promise<string | null> {
  const res = await fetch(`${config.url}/api/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.model, prompt, stream: false, options: { temperature: 0.1 } }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.response || null;
}
