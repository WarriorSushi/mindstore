import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

/**
 * Sentiment Timeline Plugin — Emotional arc of stored knowledge
 *
 * GET ?action=analyze  — Run sentiment analysis on all memories (AI + lexicon fallback)
 * GET ?action=results  — Get cached sentiment data
 * GET ?action=summary  — Get aggregate mood summary (trends, happiest topics, etc.)
 *
 * Stores results in memory metadata to avoid re-analysis.
 * Uses AI for accuracy, falls back to AFINN-style lexicon when no AI configured.
 */

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
// AI Config (reuse from contradiction finder pattern)
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

  if (preferred === 'openrouter' && openrouterKey) {
    return { type: 'openai-compatible', url: 'https://openrouter.ai/api/v1/chat/completions', key: openrouterKey, model: 'anthropic/claude-3.5-haiku', extraHeaders: { 'HTTP-Referer': 'https://mindstore.app', 'X-Title': 'MindStore' } };
  }
  if (preferred === 'custom' && customKey && customUrl) {
    return { type: 'openai-compatible', url: customUrl, key: customKey, model: customModel || 'default' };
  }
  if (preferred === 'gemini' && geminiKey) {
    return { type: 'gemini', url: '', key: geminiKey, model: 'gemini-2.0-flash-lite' };
  }
  if (preferred === 'openai' && openaiKey) {
    return { type: 'openai-compatible', url: 'https://api.openai.com/v1/chat/completions', key: openaiKey, model: 'gpt-4o-mini' };
  }
  if (preferred === 'ollama' && ollamaUrl) {
    return { type: 'ollama', url: ollamaUrl, model: 'llama3.2' };
  }

  // Auto-detect chain
  if (geminiKey) return { type: 'gemini', url: '', key: geminiKey, model: 'gemini-2.0-flash-lite' };
  if (openaiKey) return { type: 'openai-compatible', url: 'https://api.openai.com/v1/chat/completions', key: openaiKey, model: 'gpt-4o-mini' };
  if (openrouterKey) return { type: 'openai-compatible', url: 'https://openrouter.ai/api/v1/chat/completions', key: openrouterKey, model: 'anthropic/claude-3.5-haiku', extraHeaders: { 'HTTP-Referer': 'https://mindstore.app', 'X-Title': 'MindStore' } };
  if (customKey && customUrl) return { type: 'openai-compatible', url: customUrl, key: customKey, model: customModel || 'default' };
  if (ollamaUrl) return { type: 'ollama', url: ollamaUrl, model: 'llama3.2' };

  return null;
}

// ──────────────────────────────────────────────────────────────
// Route handlers
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
// Get cached results — all memories with sentiment scores
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

  const memories = (results as any[]).map(r => ({
    id: r.id,
    content: r.content?.slice(0, 200),
    sourceType: r.source_type,
    sourceTitle: r.source_title || 'Untitled',
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    score: parseFloat(r.sentiment_score),
    label: r.sentiment_label || classifyScore(parseFloat(r.sentiment_score)),
    emotions: safeParseJSON(r.sentiment_emotions, []),
  }));

  // Build daily aggregates for heatmap
  const dailyMap: Record<string, { scores: number[]; count: number; labels: Record<string, number> }> = {};
  for (const m of memories) {
    if (!m.createdAt) continue;
    const day = m.createdAt.split('T')[0]; // YYYY-MM-DD
    if (!dailyMap[day]) dailyMap[day] = { scores: [], count: 0, labels: {} };
    dailyMap[day].scores.push(m.score);
    dailyMap[day].count++;
    dailyMap[day].labels[m.label] = (dailyMap[day].labels[m.label] || 0) + 1;
  }

  const daily = Object.entries(dailyMap)
    .map(([date, data]) => ({
      date,
      avgScore: data.scores.reduce((s, v) => s + v, 0) / data.scores.length,
      count: data.count,
      dominantMood: Object.entries(data.labels).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral',
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Build weekly aggregates for trend chart
  const weeklyMap: Record<string, number[]> = {};
  for (const m of memories) {
    if (!m.createdAt) continue;
    const d = new Date(m.createdAt);
    const weekStart = getWeekStart(d);
    if (!weeklyMap[weekStart]) weeklyMap[weekStart] = [];
    weeklyMap[weekStart].push(m.score);
  }

  const weekly = Object.entries(weeklyMap)
    .map(([week, scores]) => ({
      week,
      avgScore: scores.reduce((s, v) => s + v, 0) / scores.length,
      count: scores.length,
    }))
    .sort((a, b) => a.week.localeCompare(b.week));

  return NextResponse.json({
    memories,
    daily,
    weekly,
    totalAnalyzed: memories.length,
  });
}

// ──────────────────────────────────────────────────────────────
// Get summary — aggregate insights
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
      analyzed: 0,
      total,
      overallMood: 'unknown',
      overallScore: 0,
      distribution: {},
      happiest: null,
      saddest: null,
      moodBySource: {},
      trends: [],
    });
  }

  const avgScore = all.reduce((s, m) => s + m.score, 0) / all.length;

  // Distribution
  const distribution: Record<string, number> = {};
  for (const m of all) {
    distribution[m.label] = (distribution[m.label] || 0) + 1;
  }

  // By source type
  const bySource: Record<string, { total: number; sum: number }> = {};
  for (const m of all) {
    if (!bySource[m.sourceType]) bySource[m.sourceType] = { total: 0, sum: 0 };
    bySource[m.sourceType].total++;
    bySource[m.sourceType].sum += m.score;
  }
  const moodBySource: Record<string, { count: number; avgScore: number; label: string }> = {};
  for (const [src, data] of Object.entries(bySource)) {
    const avg = data.sum / data.total;
    moodBySource[src] = {
      count: data.total,
      avgScore: Math.round(avg * 100) / 100,
      label: classifyScore(avg),
    };
  }

  // Happiest / saddest memories
  const sorted = [...all].sort((a, b) => b.score - a.score);
  const happiest = sorted.slice(0, 3).map(m => ({
    id: m.id,
    title: m.sourceTitle,
    content: m.content?.slice(0, 150),
    score: m.score,
    sourceType: m.sourceType,
    createdAt: m.createdAt,
  }));
  const saddest = sorted.slice(-3).reverse().map(m => ({
    id: m.id,
    title: m.sourceTitle,
    content: m.content?.slice(0, 150),
    score: m.score,
    sourceType: m.sourceType,
    createdAt: m.createdAt,
  }));

  // Monthly trends
  const monthlyMap: Record<string, number[]> = {};
  for (const m of all) {
    if (!m.createdAt) continue;
    const month = m.createdAt.slice(0, 7); // YYYY-MM
    if (!monthlyMap[month]) monthlyMap[month] = [];
    monthlyMap[month].push(m.score);
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
    analyzed: all.length,
    total,
    overallMood: classifyScore(avgScore),
    overallScore: Math.round(avgScore * 100) / 100,
    distribution,
    happiest,
    saddest,
    moodBySource,
    trends,
  });
}

// ──────────────────────────────────────────────────────────────
// Run analysis — analyze unscored memories
// ──────────────────────────────────────────────────────────────

async function runAnalysis(userId: string) {
  // Get memories without sentiment scores
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
    return NextResponse.json({
      analyzed: 0,
      message: 'All memories have been analyzed already.',
      skipped: 0,
    });
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
  for (const row of settings as any[]) {
    config[row.key] = row.value;
  }

  const aiConfig = getAIConfig(config);
  let analyzed = 0;
  let failed = 0;

  if (aiConfig) {
    // AI-powered batch analysis — process in batches of 8
    const BATCH_SIZE = 8;
    for (let i = 0; i < memories.length; i += BATCH_SIZE) {
      const batch = memories.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(m => analyzeSentimentAI(m, aiConfig))
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
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
        } else {
          failed++;
        }
      }
    }
  } else {
    // Lexicon-based fallback — no AI needed
    for (const m of memories) {
      const { score, label, emotions } = analyzeSentimentLexicon(m.content);
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

  // Get total analyzed count
  const totalResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM memories
    WHERE user_id = ${userId}::uuid AND metadata->>'sentiment_score' IS NOT NULL
  `);
  const totalAnalyzed = parseInt((totalResult as any[])[0]?.count || '0');

  return NextResponse.json({
    analyzed,
    failed,
    totalAnalyzed,
    aiPowered: !!aiConfig,
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
  const prompt = `Analyze the emotional tone/sentiment of this text from a personal knowledge base. The text may be a note, highlight, article excerpt, or conversation.

TEXT:
"${memory.content.slice(0, 800)}"

Rate the sentiment on a scale from -1.0 (very negative) to +1.0 (very positive), where 0 is neutral.
Also classify the primary emotion(s) present.

Respond with ONLY valid JSON (no markdown, no explanation):
{"score": <float -1 to 1>, "label": "<positive|negative|neutral|mixed>", "emotions": ["<emotion1>", "<emotion2>"]}

Emotion examples: joy, curiosity, excitement, gratitude, hope, calm, frustration, anxiety, sadness, anger, confusion, determination, nostalgia, surprise, pride, skepticism, inspiration, fear, relief, amusement

Be nuanced — factual/informational content is "neutral" (score ~0), enthusiastic content is positive, critical/negative content is negative. Consider context.`;

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
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────
// AI call helpers (same as contradiction finder)
// ──────────────────────────────────────────────────────────────

async function callAI(config: AIConfig, prompt: string): Promise<string | null> {
  try {
    if (config.type === 'gemini') return callGemini(config, prompt);
    if (config.type === 'ollama') return callOllama(config, prompt);
    return callOpenAICompatible(config, prompt);
  } catch {
    return null;
  }
}

async function callOpenAICompatible(config: AIConfig, prompt: string): Promise<string | null> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.key}`,
    ...(config.extraHeaders || {}),
  };
  const res = await fetch(config.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 200,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}

async function callGemini(config: AIConfig, prompt: string): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function callOllama(config: AIConfig, prompt: string): Promise<string | null> {
  const res = await fetch(`${config.url}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      prompt,
      stream: false,
      options: { temperature: 0.1 },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.response || null;
}

// ──────────────────────────────────────────────────────────────
// Lexicon-based fallback sentiment analysis
// ──────────────────────────────────────────────────────────────

// Simplified AFINN-inspired lexicon with ~200 common words
const LEXICON: Record<string, number> = {
  // Strong positive (+3 to +5)
  amazing: 4, awesome: 4, beautiful: 3, best: 3, brilliant: 4, celebrate: 3,
  excellent: 4, excited: 3, fantastic: 4, great: 3, happy: 3, incredible: 4,
  inspire: 3, inspired: 3, inspiring: 3, joy: 3, love: 3, loved: 3,
  outstanding: 4, perfect: 3, superb: 4, terrific: 4, thrilled: 4,
  wonderful: 4, grateful: 3, thankful: 3, blessed: 3, delightful: 3,
  magnificent: 4, remarkable: 3, exceptional: 4, passion: 3, passionate: 3,

  // Moderate positive (+1 to +2)
  accomplish: 2, agree: 1, benefit: 2, better: 2, calm: 2, comfortable: 2,
  confident: 2, creative: 2, curious: 1, effective: 2, efficient: 2,
  enjoy: 2, enjoyed: 2, favorite: 2, fun: 2, glad: 2, good: 2, growth: 2,
  helpful: 2, hope: 2, hopeful: 2, improve: 2, improved: 2, interest: 1,
  interesting: 1, kind: 2, learn: 1, learned: 1, like: 1, nice: 1,
  opportunity: 2, pleased: 2, positive: 2, productive: 2, progress: 2,
  proud: 2, recommend: 2, relief: 2, satisfy: 2, satisfied: 2, smart: 2,
  solve: 2, solved: 2, strong: 2, succeed: 2, success: 2, successful: 2,
  support: 1, thank: 2, useful: 2, valuable: 2, win: 2, worth: 2,

  // Moderate negative (-1 to -2)
  annoyed: -2, anxious: -2, bad: -2, bored: -2, boring: -2, busy: -1,
  challenge: -1, challenging: -1, complex: -1, concern: -1, concerned: -1,
  confused: -2, confusing: -2, cost: -1, critical: -1, delay: -1,
  difficult: -2, difficulty: -2, disappoint: -2, disappointed: -2,
  doubt: -2, error: -2, exhausted: -2, fail: -2, failure: -2,
  flawed: -2, forget: -1, frustrate: -2, frustrated: -2, frustrating: -2,
  hard: -1, hurt: -2, ignore: -1, issue: -1, lack: -1, late: -1,
  limit: -1, limited: -1, lose: -2, loss: -2, lost: -2, miss: -1,
  mistake: -2, negative: -2, never: -1, poor: -2, problem: -2,
  risk: -1, sad: -2, slow: -1, sorry: -1, stress: -2, stressed: -2,
  stuck: -2, struggle: -2, suffering: -2, tired: -2, trouble: -2,
  ugly: -2, unhappy: -2, unfortunately: -1, upset: -2, weak: -2,
  worried: -2, worry: -2, worse: -2, wrong: -2,

  // Strong negative (-3 to -5)
  abandon: -3, abuse: -4, afraid: -3, agony: -4, anger: -3, angry: -3,
  awful: -3, catastrophe: -4, cruel: -3, danger: -3, dangerous: -3,
  dead: -3, death: -3, destroy: -3, destroyed: -3, devastating: -4,
  disaster: -4, dreadful: -3, fear: -3, hate: -4, hatred: -4,
  horrible: -3, hostile: -3, miserable: -3, nightmare: -3, panic: -3,
  rage: -4, reject: -3, rejected: -3, scam: -3, terrible: -3,
  terrified: -3, threat: -3, toxic: -3, tragic: -3, trauma: -3,
  victim: -3, violence: -3, violent: -3, worst: -4,

  // Negation words (handled separately — 'never' already listed above)
  not: 0, no: 0, dont: 0, cannot: 0, neither: 0,
};

// Emotion keywords for lexicon-based detection
const EMOTION_KEYWORDS: Record<string, string[]> = {
  joy: ['happy', 'joy', 'delighted', 'cheerful', 'fun', 'celebrate', 'glad', 'enjoy'],
  curiosity: ['curious', 'wonder', 'interesting', 'explore', 'learn', 'discover', 'research', 'question'],
  excitement: ['excited', 'thrilled', 'amazing', 'incredible', 'awesome', 'fantastic', 'wow'],
  gratitude: ['grateful', 'thankful', 'blessed', 'appreciate', 'thank'],
  inspiration: ['inspire', 'inspired', 'inspiring', 'motivate', 'vision', 'dream', 'aspire'],
  frustration: ['frustrated', 'annoyed', 'irritated', 'difficult', 'struggle', 'stuck'],
  anxiety: ['anxious', 'worried', 'nervous', 'stress', 'overwhelm', 'panic', 'fear'],
  sadness: ['sad', 'unhappy', 'disappointed', 'loss', 'miss', 'lonely', 'grief'],
  determination: ['determined', 'resolve', 'commit', 'focus', 'goal', 'persist', 'achieve'],
  pride: ['proud', 'accomplish', 'succeed', 'achievement', 'milestone', 'win'],
  calm: ['calm', 'peace', 'serene', 'relax', 'quiet', 'mindful', 'zen'],
  nostalgia: ['remember', 'memory', 'past', 'childhood', 'nostalgia', 'reminisce'],
};

function analyzeSentimentLexicon(text: string): { score: number; label: string; emotions: string[] } {
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
  let totalScore = 0;
  let scoredWords = 0;
  const negators = new Set(['not', 'no', 'dont', "don't", 'cannot', "can't", 'never', 'neither', 'nor', "won't", "wouldn't", "shouldn't", "couldn't", "isn't", "aren't", "wasn't", "weren't", 'hardly', 'barely']);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (LEXICON[word] !== undefined && LEXICON[word] !== 0) {
      let score = LEXICON[word];
      // Check for negation in previous 2 words
      for (let j = Math.max(0, i - 2); j < i; j++) {
        if (negators.has(words[j])) {
          score = -score * 0.5; // Negation flips and weakens
          break;
        }
      }
      totalScore += score;
      scoredWords++;
    }
  }

  // Normalize to -1 to 1 range
  // Use log scaling to prevent long texts from overwhelming
  const rawScore = scoredWords > 0 ? totalScore / Math.sqrt(scoredWords) : 0;
  const normalizedScore = Math.max(-1, Math.min(1, rawScore / 3)); // Divide by 3 to keep in range

  // Detect emotions
  const textLower = text.toLowerCase();
  const detectedEmotions: string[] = [];
  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    const matches = keywords.filter(kw => textLower.includes(kw));
    if (matches.length >= 1) {
      detectedEmotions.push(emotion);
    }
  }

  return {
    score: Math.round(normalizedScore * 100) / 100,
    label: classifyScore(normalizedScore),
    emotions: detectedEmotions.slice(0, 3),
  };
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function classifyScore(score: number): string {
  if (score >= 0.3) return 'positive';
  if (score <= -0.3) return 'negative';
  if (score >= 0.1 || score <= -0.1) return 'mixed';
  return 'neutral';
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day); // Sunday start
  return d.toISOString().split('T')[0];
}

function safeParseJSON(str: string | null | undefined, fallback: any): any {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}
