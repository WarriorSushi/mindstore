/**
 * Sentiment Timeline — Portable logic module
 * 
 * Extracted from the route for convergence with codex runtime.
 * Contains: AFINN-inspired lexicon (~200 words), negation handling,
 * emotion detection, sentiment scoring, AI prompt builder.
 * 
 * Core analysis is algorithmic (zero AI). AI is optional enhancement.
 */

// ─── Types ────────────────────────────────────────────────────

export interface SentimentResult {
  score: number;      // -1 to 1
  label: string;      // positive, negative, mixed, neutral
  emotions: string[]; // up to 3 detected emotions
}

export interface SentimentMemoryResult {
  id: string;
  score: number;
  label: string;
  emotions: string[];
  sourceType: string;
  sourceTitle: string;
  createdAt: string;
  preview: string;
}

export interface WeeklySentiment {
  week: string;
  avgScore: number;
  label: string;
  count: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  topEmotions: string[];
}

export interface SentimentSummary {
  overallScore: number;
  overallLabel: string;
  totalAnalyzed: number;
  positiveRatio: number;
  negativeRatio: number;
  neutralRatio: number;
  topEmotions: { emotion: string; count: number }[];
  weekly: WeeklySentiment[];
  moodTrend: 'improving' | 'declining' | 'stable';
}

// ─── AFINN-inspired Lexicon ───────────────────────────────────

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

  not: 0, no: 0, dont: 0, cannot: 0, neither: 0,
};

// ─── Emotion Keywords ─────────────────────────────────────────

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

const NEGATORS = new Set([
  'not', 'no', 'dont', "don't", 'cannot', "can't", 'never', 'neither', 'nor',
  "won't", "wouldn't", "shouldn't", "couldn't", "isn't", "aren't",
  "wasn't", "weren't", 'hardly', 'barely',
]);

// ─── Core Sentiment Analysis ─────────────────────────────────

export function analyzeSentiment(text: string): SentimentResult {
  const words = text.toLowerCase().replace(/[^\w\s']/g, '').split(/\s+/);
  let totalScore = 0;
  let scoredWords = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    if (LEXICON[word] !== undefined && LEXICON[word] !== 0) {
      let score = LEXICON[word]!;
      // Negation check in previous 2 words
      for (let j = Math.max(0, i - 2); j < i; j++) {
        if (NEGATORS.has(words[j]!)) {
          score = -score * 0.5;
          break;
        }
      }
      totalScore += score;
      scoredWords++;
    }
  }

  const rawScore = scoredWords > 0 ? totalScore / Math.sqrt(scoredWords) : 0;
  const normalizedScore = Math.max(-1, Math.min(1, rawScore / 3));

  const textLower = text.toLowerCase();
  const detectedEmotions: string[] = [];
  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    if (keywords.some(kw => textLower.includes(kw))) {
      detectedEmotions.push(emotion);
    }
  }

  return {
    score: Math.round(normalizedScore * 100) / 100,
    label: classifyScore(normalizedScore),
    emotions: detectedEmotions.slice(0, 3),
  };
}

// ─── Score Classification ─────────────────────────────────────

export function classifyScore(score: number): string {
  if (score >= 0.3) return 'positive';
  if (score <= -0.3) return 'negative';
  if (score >= 0.1 || score <= -0.1) return 'mixed';
  return 'neutral';
}

// ─── AI Sentiment Prompt ──────────────────────────────────────

export function buildSentimentPrompt(content: string, sourceTitle: string): {
  system: string;
  prompt: string;
} {
  return {
    system: 'You are a sentiment analysis expert. Analyze the emotional tone of text accurately.',
    prompt: `Analyze the sentiment of this text titled "${sourceTitle}":

"${content.slice(0, 1500)}"

Respond with ONLY valid JSON (no markdown):
{
  "score": <number from -1.0 to 1.0>,
  "label": "<positive|negative|neutral|mixed>",
  "emotions": ["<up to 3 emotions: joy, sadness, anger, fear, surprise, curiosity, gratitude, frustration, excitement, calm, determination, pride, nostalgia, anxiety, inspiration>"],
  "confidence": <0.0-1.0>
}`,
  };
}

// ─── Weekly Aggregation ───────────────────────────────────────

export function aggregateWeekly(
  results: SentimentMemoryResult[],
): WeeklySentiment[] {
  const weekMap = new Map<string, SentimentMemoryResult[]>();

  for (const r of results) {
    const week = getWeekStart(new Date(r.createdAt));
    if (!weekMap.has(week)) weekMap.set(week, []);
    weekMap.get(week)!.push(r);
  }

  return [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, items]) => {
      const scores = items.map(i => i.score);
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const emotionCounts = new Map<string, number>();
      for (const item of items) {
        for (const e of item.emotions) {
          emotionCounts.set(e, (emotionCounts.get(e) || 0) + 1);
        }
      }

      return {
        week,
        avgScore: Math.round(avgScore * 100) / 100,
        label: classifyScore(avgScore),
        count: items.length,
        positiveCount: items.filter(i => i.label === 'positive').length,
        negativeCount: items.filter(i => i.label === 'negative').length,
        neutralCount: items.filter(i => i.label === 'neutral' || i.label === 'mixed').length,
        topEmotions: [...emotionCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([e]) => e),
      };
    });
}

// ─── Mood Trend Detection ─────────────────────────────────────

export function detectMoodTrend(weekly: WeeklySentiment[]): 'improving' | 'declining' | 'stable' {
  if (weekly.length < 3) return 'stable';
  const mid = Math.floor(weekly.length / 2);
  const firstHalf = weekly.slice(0, mid).reduce((sum, w) => sum + w.avgScore, 0) / mid;
  const secondHalf = weekly.slice(mid).reduce((sum, w) => sum + w.avgScore, 0) / (weekly.length - mid);
  const diff = secondHalf - firstHalf;
  if (diff > 0.1) return 'improving';
  if (diff < -0.1) return 'declining';
  return 'stable';
}

// ─── Helpers ──────────────────────────────────────────────────

function getWeekStart(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split('T')[0]!;
}

export function safeParseJSON<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}
