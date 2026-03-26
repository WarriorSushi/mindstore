import { eq, sql } from "drizzle-orm";
import { callTextPrompt, getTextGenerationConfig } from "@/server/ai-client";
import { db, schema } from "@/server/db";
import { PLUGIN_MANIFESTS } from "@/server/plugins/registry";

const PLUGIN_SLUG = "sentiment-timeline";
const ANALYSIS_BATCH_SIZE = 8;

const LEXICON: Record<string, number> = {
  amazing: 4, awesome: 4, beautiful: 3, best: 3, brilliant: 4, celebrate: 3,
  excellent: 4, excited: 3, fantastic: 4, great: 3, happy: 3, incredible: 4,
  inspire: 3, inspired: 3, inspiring: 3, joy: 3, love: 3, loved: 3,
  outstanding: 4, perfect: 3, superb: 4, terrific: 4, thrilled: 4,
  wonderful: 4, grateful: 3, thankful: 3, blessed: 3, delightful: 3,
  magnificent: 4, remarkable: 3, exceptional: 4, passion: 3, passionate: 3,
  accomplish: 2, agree: 1, benefit: 2, better: 2, calm: 2, comfortable: 2,
  confident: 2, creative: 2, curious: 1, effective: 2, efficient: 2,
  enjoy: 2, enjoyed: 2, favorite: 2, fun: 2, glad: 2, good: 2, growth: 2,
  helpful: 2, hope: 2, hopeful: 2, improve: 2, improved: 2, interest: 1,
  interesting: 1, kind: 2, learn: 1, learned: 1, like: 1, nice: 1,
  opportunity: 2, pleased: 2, positive: 2, productive: 2, progress: 2,
  proud: 2, recommend: 2, relief: 2, satisfy: 2, satisfied: 2, smart: 2,
  solve: 2, solved: 2, strong: 2, succeed: 2, success: 2, successful: 2,
  support: 1, thank: 2, useful: 2, valuable: 2, win: 2, worth: 2,
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
  abandon: -3, abuse: -4, afraid: -3, agony: -4, anger: -3, angry: -3,
  awful: -3, catastrophe: -4, cruel: -3, danger: -3, dangerous: -3,
  dead: -3, death: -3, destroy: -3, destroyed: -3, devastating: -4,
  disaster: -4, dreadful: -3, fear: -3, hate: -4, hatred: -4,
  horrible: -3, hostile: -3, miserable: -3, nightmare: -3, panic: -3,
  rage: -4, reject: -3, rejected: -3, scam: -3, terrible: -3,
  terrified: -3, threat: -3, toxic: -3, tragic: -3, trauma: -3,
  victim: -3, violence: -3, violent: -3, worst: -4,
  not: 0, no: 0, dont: 0, cannot: 0, neither: 0,
};

const EMOTION_KEYWORDS: Record<string, string[]> = {
  joy: ["happy", "joy", "delighted", "cheerful", "fun", "celebrate", "glad", "enjoy"],
  curiosity: ["curious", "wonder", "interesting", "explore", "learn", "discover", "research", "question"],
  excitement: ["excited", "thrilled", "amazing", "incredible", "awesome", "fantastic", "wow"],
  gratitude: ["grateful", "thankful", "blessed", "appreciate", "thank"],
  inspiration: ["inspire", "inspired", "inspiring", "motivate", "vision", "dream", "aspire"],
  frustration: ["frustrated", "annoyed", "irritated", "difficult", "struggle", "stuck"],
  anxiety: ["anxious", "worried", "nervous", "stress", "overwhelm", "panic", "fear"],
  sadness: ["sad", "unhappy", "disappointed", "loss", "miss", "lonely", "grief"],
  determination: ["determined", "resolve", "commit", "focus", "goal", "persist", "achieve"],
  pride: ["proud", "accomplish", "succeed", "achievement", "milestone", "win"],
  calm: ["calm", "peace", "serene", "relax", "quiet", "mindful", "zen"],
  nostalgia: ["remember", "memory", "past", "childhood", "nostalgia", "reminisce"],
};

type SentimentLabel = "positive" | "negative" | "neutral" | "mixed";

interface SentimentDbRow {
  id: unknown;
  content: unknown;
  source_type: unknown;
  source_title: unknown;
  created_at: unknown;
  sentiment_score?: unknown;
  sentiment_label?: unknown;
  sentiment_emotions?: unknown;
}

interface AnalyzeRow {
  id: unknown;
  content: unknown;
}

export interface SentimentMemory {
  id: string;
  content: string;
  sourceType: string;
  sourceTitle: string;
  createdAt: string | null;
  score: number;
  label: SentimentLabel;
  emotions: string[];
}

export interface DailyMood {
  date: string;
  avgScore: number;
  count: number;
  dominantMood: SentimentLabel;
}

export interface WeeklyMood {
  week: string;
  avgScore: number;
  count: number;
}

export interface MonthlyTrend {
  month: string;
  avgScore: number;
  count: number;
  label: SentimentLabel;
}

export interface SentimentResultsResponse {
  memories: SentimentMemory[];
  daily: DailyMood[];
  weekly: WeeklyMood[];
  totalAnalyzed: number;
}

export interface SentimentSummaryResponse {
  analyzed: number;
  total: number;
  overallMood: SentimentLabel | "unknown";
  overallScore: number;
  distribution: Record<string, number>;
  happiest: Array<{
    id: string;
    title: string;
    content: string;
    score: number;
    sourceType: string;
    createdAt: string | null;
  }>;
  saddest: Array<{
    id: string;
    title: string;
    content: string;
    score: number;
    sourceType: string;
    createdAt: string | null;
  }>;
  moodBySource: Record<string, { count: number; avgScore: number; label: SentimentLabel }>;
  trends: MonthlyTrend[];
}

export interface SentimentAnalysisResult {
  score: number;
  label: SentimentLabel;
  emotions: string[];
}

export async function ensureSentimentTimelineInstalled() {
  const manifest = PLUGIN_MANIFESTS[PLUGIN_SLUG];
  const [existing] = await db
    .select()
    .from(schema.plugins)
    .where(eq(schema.plugins.slug, PLUGIN_SLUG))
    .limit(1);

  if (existing || !manifest) {
    return;
  }

  await db.insert(schema.plugins).values({
    slug: manifest.slug,
    name: manifest.name,
    description: manifest.description,
    version: manifest.version,
    type: manifest.type,
    status: "active",
    icon: manifest.icon,
    category: manifest.category,
    author: manifest.author,
    metadata: {
      capabilities: manifest.capabilities,
      hooks: manifest.hooks,
      routes: manifest.routes,
      aliases: manifest.aliases || [],
      dashboardWidgets: manifest.ui?.dashboardWidgets || [],
      pages: manifest.ui?.pages || [],
    },
  });
}

export async function getSentimentResults(userId: string): Promise<SentimentResultsResponse> {
  const rows = await loadAnalyzedRows(userId);
  const memories = rows.map(normalizeSentimentMemory);
  return {
    memories,
    daily: buildDailySentiment(memories),
    weekly: buildWeeklySentiment(memories),
    totalAnalyzed: memories.length,
  };
}

export async function getSentimentSummary(userId: string): Promise<SentimentSummaryResponse> {
  const rows = await loadAnalyzedRows(userId);
  const memories = rows.map(normalizeSentimentMemory);
  const total = await getTotalMemoryCount(userId);

  if (!memories.length) {
    return {
      analyzed: 0,
      total,
      overallMood: "unknown",
      overallScore: 0,
      distribution: {},
      happiest: [],
      saddest: [],
      moodBySource: {},
      trends: [],
    };
  }

  const overallScore = average(memories.map((memory) => memory.score));
  const distribution = memories.reduce<Record<string, number>>((acc, memory) => {
    acc[memory.label] = (acc[memory.label] || 0) + 1;
    return acc;
  }, {});

  const bySource = memories.reduce<Record<string, { count: number; totalScore: number }>>((acc, memory) => {
    const entry = acc[memory.sourceType] || { count: 0, totalScore: 0 };
    entry.count += 1;
    entry.totalScore += memory.score;
    acc[memory.sourceType] = entry;
    return acc;
  }, {});

  const moodBySource = Object.fromEntries(
    Object.entries(bySource).map(([source, entry]) => {
      const avgScore = round(entry.totalScore / entry.count, 2);
      return [
        source,
        {
          count: entry.count,
          avgScore,
          label: classifySentimentScore(avgScore),
        },
      ];
    }),
  );

  const sorted = [...memories].sort((left, right) => right.score - left.score);

  return {
    analyzed: memories.length,
    total,
    overallMood: classifySentimentScore(overallScore),
    overallScore: round(overallScore, 2),
    distribution,
    happiest: sorted.slice(0, 3).map(toMemoryHighlight),
    saddest: sorted.slice(-3).reverse().map(toMemoryHighlight),
    moodBySource,
    trends: buildMonthlySentimentTrends(memories),
  };
}

export async function runSentimentAnalysis(userId: string) {
  const rows = await db.execute(sql`
    SELECT id, content
    FROM memories
    WHERE user_id = ${userId}::uuid
      AND metadata->>'sentiment_score' IS NULL
      AND LENGTH(content) > 30
    ORDER BY created_at DESC
    LIMIT 200
  `) as unknown as AnalyzeRow[];

  if (!rows.length) {
    return {
      analyzed: 0,
      failed: 0,
      totalAnalyzed: await getAnalyzedMemoryCount(userId),
      aiPowered: false,
      message: "All memories have been analyzed already.",
    };
  }

  const aiConfig = await getTextGenerationConfig({
    openai: "gpt-4o-mini",
    openrouter: "anthropic/claude-3.5-haiku",
    gemini: "gemini-2.0-flash-lite",
    ollama: "llama3.2",
    custom: "default",
  });

  let analyzed = 0;
  let failed = 0;

  if (aiConfig) {
    for (let index = 0; index < rows.length; index += ANALYSIS_BATCH_SIZE) {
      const batch = rows.slice(index, index + ANALYSIS_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((row) => analyzeSentimentWithAI(String(row.content || ""), aiConfig)),
      );

      for (let batchIndex = 0; batchIndex < results.length; batchIndex += 1) {
        const result = results[batchIndex];
        const row = batch[batchIndex];
        if (result?.status === "fulfilled" && result.value && row?.id) {
          await saveSentimentResult(userId, String(row.id), result.value);
          analyzed += 1;
        } else {
          failed += 1;
        }
      }
    }
  } else {
    for (const row of rows) {
      const result = analyzeSentimentLexicon(String(row.content || ""));
      await saveSentimentResult(userId, String(row.id), result);
      analyzed += 1;
    }
  }

  return {
    analyzed,
    failed,
    totalAnalyzed: await getAnalyzedMemoryCount(userId),
    aiPowered: Boolean(aiConfig),
    message: analyzed > 0
      ? `Analyzed ${analyzed} memories${aiConfig ? " with AI" : " using lexicon analysis"}.${failed ? ` ${failed} failed.` : ""}`
      : "No new memories to analyze.",
  };
}

export async function analyzeSentimentWithAI(
  text: string,
  aiConfig: NonNullable<Awaited<ReturnType<typeof getTextGenerationConfig>>>,
): Promise<SentimentAnalysisResult | null> {
  const prompt = `Analyze the emotional tone and sentiment of this text from a personal knowledge base. The text may be a note, highlight, article excerpt, or conversation.

TEXT:
"${text.slice(0, 800)}"

Rate the sentiment on a scale from -1.0 (very negative) to +1.0 (very positive), where 0 is neutral.
Also classify the primary emotions present.

Respond with ONLY valid JSON:
{"score": <float -1 to 1>, "label": "<positive|negative|neutral|mixed>", "emotions": ["<emotion1>", "<emotion2>"]}

Emotion examples: joy, curiosity, excitement, gratitude, hope, calm, frustration, anxiety, sadness, anger, confusion, determination, nostalgia, surprise, pride, skepticism, inspiration, fear, relief, amusement

Be nuanced. Factual or informational content should usually be neutral.`;

  const response = await callTextPrompt(aiConfig, prompt, undefined, {
    temperature: 0.1,
    maxTokens: 220,
  });

  if (!response) {
    return null;
  }

  try {
    const parsed = JSON.parse(stripJsonFence(response)) as {
      score?: unknown;
      label?: unknown;
      emotions?: unknown;
    };
    const score = clampScore(toNumber(parsed.score));
    const label = isSentimentLabel(parsed.label)
      ? parsed.label
      : classifySentimentScore(score);
    const emotions = Array.isArray(parsed.emotions)
      ? parsed.emotions.filter((value): value is string => typeof value === "string").slice(0, 3)
      : [];

    return { score, label, emotions };
  } catch {
    return null;
  }
}

export function analyzeSentimentLexicon(text: string): SentimentAnalysisResult {
  const normalized = text.toLowerCase().replace(/[^\w\s']/g, " ");
  const words = normalized.split(/\s+/).filter(Boolean);
  const negators = new Set([
    "not", "no", "dont", "don't", "cannot", "can't", "never", "neither", "nor",
    "won't", "wouldn't", "shouldn't", "couldn't", "isn't", "aren't", "wasn't", "weren't",
    "hardly", "barely",
  ]);

  let totalScore = 0;
  let scoredWords = 0;

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (LEXICON[word] === undefined || LEXICON[word] === 0) {
      continue;
    }

    let score = LEXICON[word] || 0;
    for (let check = Math.max(0, index - 2); check < index; check += 1) {
      if (negators.has(words[check] || "")) {
        score = -score * 0.5;
        break;
      }
    }
    totalScore += score;
    scoredWords += 1;
  }

  const rawScore = scoredWords > 0 ? totalScore / Math.sqrt(scoredWords) : 0;
  const score = clampScore(rawScore / 3);
  const textLower = text.toLowerCase();
  const emotions = Object.entries(EMOTION_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => textLower.includes(keyword)))
    .map(([emotion]) => emotion)
    .slice(0, 3);

  return {
    score,
    label: classifySentimentScore(score),
    emotions,
  };
}

export function classifySentimentScore(score: number): SentimentLabel {
  if (score >= 0.3) return "positive";
  if (score <= -0.3) return "negative";
  if (score >= 0.1 || score <= -0.1) return "mixed";
  return "neutral";
}

export function buildDailySentiment(memories: SentimentMemory[]): DailyMood[] {
  const grouped: Record<string, { scores: number[]; labels: Record<string, number> }> = {};

  for (const memory of memories) {
    if (!memory.createdAt) continue;
    const day = memory.createdAt.slice(0, 10);
    const entry = grouped[day] || { scores: [], labels: {} };
    entry.scores.push(memory.score);
    entry.labels[memory.label] = (entry.labels[memory.label] || 0) + 1;
    grouped[day] = entry;
  }

  return Object.entries(grouped)
    .map(([date, entry]) => ({
      date,
      avgScore: round(average(entry.scores), 2),
      count: entry.scores.length,
      dominantMood: (Object.entries(entry.labels).sort((left, right) => right[1] - left[1])[0]?.[0] || "neutral") as SentimentLabel,
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function buildWeeklySentiment(memories: SentimentMemory[]): WeeklyMood[] {
  const grouped: Record<string, number[]> = {};

  for (const memory of memories) {
    if (!memory.createdAt) continue;
    const week = getWeekStart(memory.createdAt);
    grouped[week] = grouped[week] || [];
    grouped[week]?.push(memory.score);
  }

  return Object.entries(grouped)
    .map(([week, scores]) => ({
      week,
      avgScore: round(average(scores), 2),
      count: scores.length,
    }))
    .sort((left, right) => left.week.localeCompare(right.week));
}

export function buildMonthlySentimentTrends(memories: SentimentMemory[]): MonthlyTrend[] {
  const grouped: Record<string, number[]> = {};

  for (const memory of memories) {
    if (!memory.createdAt) continue;
    const month = memory.createdAt.slice(0, 7);
    grouped[month] = grouped[month] || [];
    grouped[month]?.push(memory.score);
  }

  return Object.entries(grouped)
    .map(([month, scores]) => {
      const avgScore = round(average(scores), 2);
      return {
        month,
        avgScore,
        count: scores.length,
        label: classifySentimentScore(avgScore),
      };
    })
    .sort((left, right) => left.month.localeCompare(right.month));
}

async function loadAnalyzedRows(userId: string) {
  return await db.execute(sql`
    SELECT
      id,
      content,
      source_type,
      source_title,
      created_at,
      metadata->>'sentiment_score' AS sentiment_score,
      metadata->>'sentiment_label' AS sentiment_label,
      metadata->>'sentiment_emotions' AS sentiment_emotions
    FROM memories
    WHERE user_id = ${userId}::uuid
      AND metadata->>'sentiment_score' IS NOT NULL
    ORDER BY created_at ASC
  `) as unknown as SentimentDbRow[];
}

async function saveSentimentResult(userId: string, memoryId: string, result: SentimentAnalysisResult) {
  await db.execute(sql`
    UPDATE memories
    SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'sentiment_score', ${result.score.toString()},
      'sentiment_label', ${result.label},
      'sentiment_emotions', ${JSON.stringify(result.emotions)}
    )
    WHERE id = ${memoryId}::uuid AND user_id = ${userId}::uuid
  `);
}

async function getAnalyzedMemoryCount(userId: string) {
  const [row] = await db.execute(sql`
    SELECT COUNT(*) AS count
    FROM memories
    WHERE user_id = ${userId}::uuid
      AND metadata->>'sentiment_score' IS NOT NULL
  `) as unknown as Array<{ count?: unknown }>;
  return toInt(row?.count);
}

async function getTotalMemoryCount(userId: string) {
  const [row] = await db.execute(sql`
    SELECT COUNT(*) AS count
    FROM memories
    WHERE user_id = ${userId}::uuid
  `) as unknown as Array<{ count?: unknown }>;
  return toInt(row?.count);
}

function normalizeSentimentMemory(row: SentimentDbRow): SentimentMemory {
  const score = clampScore(toNumber(row.sentiment_score));
  return {
    id: String(row.id),
    content: String(row.content || "").slice(0, 200),
    sourceType: toStringValue(row.source_type) || "unknown",
    sourceTitle: toStringValue(row.source_title) || "Untitled",
    createdAt: toDate(row.created_at)?.toISOString() || null,
    score,
    label: isSentimentLabel(row.sentiment_label)
      ? row.sentiment_label
      : classifySentimentScore(score),
    emotions: parseStringArray(row.sentiment_emotions),
  };
}

function toMemoryHighlight(memory: SentimentMemory) {
  return {
    id: memory.id,
    title: memory.sourceTitle,
    content: memory.content.slice(0, 150),
    score: memory.score,
    sourceType: memory.sourceType,
    createdAt: memory.createdAt,
  };
}

function getWeekStart(dateString: string) {
  const date = new Date(dateString);
  const clone = new Date(date);
  clone.setUTCHours(0, 0, 0, 0);
  clone.setUTCDate(clone.getUTCDate() - clone.getUTCDay());
  return clone.toISOString().slice(0, 10);
}

function parseStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }

  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function stripJsonFence(value: string) {
  return value.trim().replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
}

function clampScore(score: number) {
  return round(Math.max(-1, Math.min(1, score)), 2);
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function toNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toInt(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toStringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function toDate(value: unknown) {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function isSentimentLabel(value: unknown): value is SentimentLabel {
  return value === "positive" || value === "negative" || value === "neutral" || value === "mixed";
}
