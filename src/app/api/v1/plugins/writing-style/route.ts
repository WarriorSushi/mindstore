import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

/**
 * Writing Style Analyzer Plugin — Analyzes writing patterns across all memories
 *
 * GET ?action=analyze   — Run analysis on all memories (cached in metadata)
 * GET ?action=results   — Get cached analysis results + aggregate stats
 * GET ?action=profile   — Get comprehensive writing profile/fingerprint
 *
 * Metrics computed:
 * - Vocabulary richness (type-token ratio, unique words, rare words)
 * - Readability (Flesch-Kincaid grade level, Flesch reading ease, avg sentence length)
 * - Tone distribution (formal/casual/technical/conversational)
 * - Complexity metrics (avg word length, syllable count, sentence variation)
 * - N-gram analysis (most used phrases — bigrams & trigrams)
 * - Writing patterns (questions asked, exclamations, hedging language, confident language)
 * - Evolution over time (how style changed month-by-month)
 */

const PLUGIN_SLUG = 'writing-style';

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
        'Writing Style Analyzer',
        'Analyze your writing patterns — vocabulary, readability, tone, and how your style evolves over time.',
        'extension',
        'active',
        'PenTool',
        'analysis'
      )
    `);
  }
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
    if (action === 'profile') return getProfile(userId);

    return NextResponse.json({ error: 'Unknown action. Use: results, analyze, profile' }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ──────────────────────────────────────────────────────────────
// Run analysis — analyze memories without writing_style metadata
// ──────────────────────────────────────────────────────────────

async function runAnalysis(userId: string) {
  // Get unanalyzed memories (no writing_style_grade in metadata)
  const unanalyzed = await db.execute(sql`
    SELECT id, content, source_type, source_title, created_at
    FROM memories
    WHERE user_id = ${userId}::uuid
      AND (metadata->>'writing_style_grade' IS NULL)
      AND LENGTH(content) > 50
    ORDER BY created_at DESC
    LIMIT 500
  `);

  const memories = unanalyzed as any[];
  if (memories.length === 0) {
    return NextResponse.json({
      analyzed: 0,
      message: 'All memories have been analyzed already.',
    });
  }

  let analyzed = 0;

  for (const m of memories) {
    const metrics = analyzeText(m.content);

    await db.execute(sql`
      UPDATE memories
      SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'writing_style_grade', ${metrics.gradeLevel.toString()},
        'writing_style_ease', ${metrics.readingEase.toString()},
        'writing_style_avgSentLen', ${metrics.avgSentenceLength.toString()},
        'writing_style_avgWordLen', ${metrics.avgWordLength.toString()},
        'writing_style_vocabRichness', ${metrics.typeTokenRatio.toString()},
        'writing_style_tone', ${metrics.tone},
        'writing_style_wordCount', ${metrics.wordCount.toString()},
        'writing_style_sentenceCount', ${metrics.sentenceCount.toString()},
        'writing_style_questionRate', ${metrics.questionRate.toString()},
        'writing_style_exclamationRate', ${metrics.exclamationRate.toString()},
        'writing_style_hedgingRate', ${metrics.hedgingRate.toString()},
        'writing_style_confidenceRate', ${metrics.confidenceRate.toString()}
      )
      WHERE id = ${m.id}::uuid AND user_id = ${userId}::uuid
    `);
    analyzed++;
  }

  // Get total count
  const totalResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM memories
    WHERE user_id = ${userId}::uuid AND metadata->>'writing_style_grade' IS NOT NULL
  `);
  const totalAnalyzed = parseInt((totalResult as any[])[0]?.count || '0');

  return NextResponse.json({
    analyzed,
    totalAnalyzed,
    message: `Analyzed ${analyzed} memories for writing style.`,
  });
}

// ──────────────────────────────────────────────────────────────
// Get results — all analyzed memories with metrics
// ──────────────────────────────────────────────────────────────

async function getResults(userId: string) {
  const results = await db.execute(sql`
    SELECT 
      id, content, source_type, source_title, created_at,
      metadata->>'writing_style_grade' as grade,
      metadata->>'writing_style_ease' as ease,
      metadata->>'writing_style_avgSentLen' as avg_sent_len,
      metadata->>'writing_style_avgWordLen' as avg_word_len,
      metadata->>'writing_style_vocabRichness' as vocab_richness,
      metadata->>'writing_style_tone' as tone,
      metadata->>'writing_style_wordCount' as word_count,
      metadata->>'writing_style_sentenceCount' as sentence_count,
      metadata->>'writing_style_questionRate' as question_rate,
      metadata->>'writing_style_exclamationRate' as exclamation_rate,
      metadata->>'writing_style_hedgingRate' as hedging_rate,
      metadata->>'writing_style_confidenceRate' as confidence_rate
    FROM memories
    WHERE user_id = ${userId}::uuid
      AND metadata->>'writing_style_grade' IS NOT NULL
    ORDER BY created_at ASC
  `);

  const totalResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM memories WHERE user_id = ${userId}::uuid AND LENGTH(content) > 50
  `);
  const totalEligible = parseInt((totalResult as any[])[0]?.count || '0');

  const memories = (results as any[]).map(r => ({
    id: r.id,
    content: r.content?.slice(0, 200),
    sourceType: r.source_type,
    sourceTitle: r.source_title || 'Untitled',
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    grade: parseFloat(r.grade),
    ease: parseFloat(r.ease),
    avgSentenceLength: parseFloat(r.avg_sent_len),
    avgWordLength: parseFloat(r.avg_word_len),
    vocabRichness: parseFloat(r.vocab_richness),
    tone: r.tone,
    wordCount: parseInt(r.word_count),
    sentenceCount: parseInt(r.sentence_count),
    questionRate: parseFloat(r.question_rate),
    exclamationRate: parseFloat(r.exclamation_rate),
    hedgingRate: parseFloat(r.hedging_rate),
    confidenceRate: parseFloat(r.confidence_rate),
  }));

  return NextResponse.json({ memories, totalAnalyzed: memories.length, totalEligible });
}

// ──────────────────────────────────────────────────────────────
// Get profile — comprehensive writing fingerprint
// ──────────────────────────────────────────────────────────────

async function getProfile(userId: string) {
  // Fetch all analyzed memories with full content for vocabulary analysis
  const results = await db.execute(sql`
    SELECT 
      id, content, source_type, source_title, created_at,
      metadata->>'writing_style_grade' as grade,
      metadata->>'writing_style_ease' as ease,
      metadata->>'writing_style_avgSentLen' as avg_sent_len,
      metadata->>'writing_style_avgWordLen' as avg_word_len,
      metadata->>'writing_style_vocabRichness' as vocab_richness,
      metadata->>'writing_style_tone' as tone,
      metadata->>'writing_style_wordCount' as word_count,
      metadata->>'writing_style_sentenceCount' as sentence_count,
      metadata->>'writing_style_questionRate' as question_rate,
      metadata->>'writing_style_exclamationRate' as exclamation_rate,
      metadata->>'writing_style_hedgingRate' as hedging_rate,
      metadata->>'writing_style_confidenceRate' as confidence_rate
    FROM memories
    WHERE user_id = ${userId}::uuid
      AND metadata->>'writing_style_grade' IS NOT NULL
    ORDER BY created_at ASC
  `);

  const totalResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM memories WHERE user_id = ${userId}::uuid AND LENGTH(content) > 50
  `);
  const totalEligible = parseInt((totalResult as any[])[0]?.count || '0');

  const memories = results as any[];

  if (memories.length === 0) {
    return NextResponse.json({
      analyzed: 0,
      totalEligible,
      profile: null,
    });
  }

  // ─── Aggregate metrics ───

  const grades = memories.map(m => parseFloat(m.grade)).filter(g => !isNaN(g));
  const easeScores = memories.map(m => parseFloat(m.ease)).filter(e => !isNaN(e));
  const sentLens = memories.map(m => parseFloat(m.avg_sent_len)).filter(n => !isNaN(n));
  const wordLens = memories.map(m => parseFloat(m.avg_word_len)).filter(n => !isNaN(n));
  const vocabScores = memories.map(m => parseFloat(m.vocab_richness)).filter(n => !isNaN(n));
  const wordCounts = memories.map(m => parseInt(m.word_count)).filter(n => !isNaN(n));
  const sentenceCounts = memories.map(m => parseInt(m.sentence_count)).filter(n => !isNaN(n));
  const questionRates = memories.map(m => parseFloat(m.question_rate)).filter(n => !isNaN(n));
  const exclamationRates = memories.map(m => parseFloat(m.exclamation_rate)).filter(n => !isNaN(n));
  const hedgingRates = memories.map(m => parseFloat(m.hedging_rate)).filter(n => !isNaN(n));
  const confidenceRates = memories.map(m => parseFloat(m.confidence_rate)).filter(n => !isNaN(n));

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const median = (arr: number[]) => {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  // ─── Tone distribution ───

  const toneDistribution: Record<string, number> = {};
  for (const m of memories) {
    const tone = m.tone || 'neutral';
    toneDistribution[tone] = (toneDistribution[tone] || 0) + 1;
  }

  // ─── Vocabulary analysis (across all content) ───

  const allWords: string[] = [];
  const bigramMap: Record<string, number> = {};
  const trigramMap: Record<string, number> = {};

  for (const m of memories) {
    const words = extractWords(m.content);
    allWords.push(...words);

    // Bigrams & trigrams
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      bigramMap[bigram] = (bigramMap[bigram] || 0) + 1;
    }
    for (let i = 0; i < words.length - 2; i++) {
      const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      trigramMap[trigram] = (trigramMap[trigram] || 0) + 1;
    }
  }

  const totalWords = allWords.length;
  const uniqueWords = new Set(allWords.map(w => w.toLowerCase()));
  const wordFreq: Record<string, number> = {};
  for (const w of allWords) {
    const lower = w.toLowerCase();
    wordFreq[lower] = (wordFreq[lower] || 0) + 1;
  }

  // Most used words (excluding stopwords)
  const STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
    'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'can', 'shall', 'it', 'its', 'this', 'that', 'these', 'those',
    'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'they', 'them',
    'his', 'her', 'their', 'what', 'which', 'who', 'when', 'where', 'how', 'why',
    'not', 'no', 'so', 'if', 'then', 'than', 'just', 'about', 'also', 'into',
    'all', 'more', 'some', 'any', 'each', 'there', 'here', 'up', 'out', 'like',
    'very', 'most', 'only', 'over', 'such', 'after', 'before', 'between', 'through',
    'during', 'while', 'because', 'since', 'until', 'both', 'other', 'same',
    'well', 'still', 'even', 'new', 'first', 'last', 'many', 'much', 'own',
    'way', 'much', 'now', 'get', 'make', 'made', 'one', 'two', 'know', 'think',
    'see', 'come', 'say', 'said', 'go', 'going', 'take', 'thing', 'things',
    'time', 'want', 'use', 'used', 'using', 'need', 'work', 'part', 'really',
  ]);

  const significantWords = Object.entries(wordFreq)
    .filter(([w]) => !STOPWORDS.has(w) && w.length > 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([word, count]) => ({ word, count, pct: Math.round((count / totalWords) * 10000) / 100 }));

  // Top bigrams & trigrams (filter stopword-only phrases)
  const topBigrams = Object.entries(bigramMap)
    .filter(([phrase]) => {
      const parts = phrase.split(' ');
      return parts.some(p => !STOPWORDS.has(p) && p.length > 2);
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([phrase, count]) => ({ phrase, count }));

  const topTrigrams = Object.entries(trigramMap)
    .filter(([phrase]) => {
      const parts = phrase.split(' ');
      return parts.filter(p => !STOPWORDS.has(p) && p.length > 2).length >= 2;
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase, count]) => ({ phrase, count }));

  // ─── Rare words (used only 1-2 times and 6+ chars) ───

  const rareWords = Object.entries(wordFreq)
    .filter(([w, c]) => c <= 2 && w.length >= 6 && !STOPWORDS.has(w))
    .map(([w]) => w);

  // ─── Readability level classification ───

  const avgGrade = avg(grades);
  const readabilityLevel =
    avgGrade <= 6 ? 'Elementary' :
    avgGrade <= 8 ? 'Middle School' :
    avgGrade <= 10 ? 'High School' :
    avgGrade <= 12 ? 'College' :
    avgGrade <= 14 ? 'College Graduate' :
    'Graduate/Professional';

  const avgEase = avg(easeScores);
  const easeLabel =
    avgEase >= 80 ? 'Very Easy' :
    avgEase >= 60 ? 'Standard' :
    avgEase >= 40 ? 'Fairly Difficult' :
    avgEase >= 20 ? 'Difficult' :
    'Very Difficult';

  // ─── Style by source type ───

  const bySource: Record<string, {
    count: number; avgGrade: number; avgEase: number; avgSentLen: number;
    tones: Record<string, number>;
  }> = {};
  for (const m of memories) {
    const src = m.source_type || 'unknown';
    if (!bySource[src]) bySource[src] = { count: 0, avgGrade: 0, avgEase: 0, avgSentLen: 0, tones: {} };
    bySource[src].count++;
    bySource[src].avgGrade += parseFloat(m.grade) || 0;
    bySource[src].avgEase += parseFloat(m.ease) || 0;
    bySource[src].avgSentLen += parseFloat(m.avg_sent_len) || 0;
    const tone = m.tone || 'neutral';
    bySource[src].tones[tone] = (bySource[src].tones[tone] || 0) + 1;
  }
  const styleBySource = Object.entries(bySource).map(([src, data]) => ({
    source: src,
    count: data.count,
    avgGrade: Math.round((data.avgGrade / data.count) * 10) / 10,
    avgEase: Math.round((data.avgEase / data.count) * 10) / 10,
    avgSentenceLength: Math.round((data.avgSentLen / data.count) * 10) / 10,
    dominantTone: Object.entries(data.tones).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral',
  }));

  // ─── Monthly evolution ───

  const monthlyMap: Record<string, {
    grades: number[]; eases: number[]; sentLens: number[];
    wordLens: number[]; vocabs: number[]; count: number;
    tones: Record<string, number>;
    questionRates: number[]; confidenceRates: number[];
  }> = {};

  for (const m of memories) {
    if (!m.created_at) continue;
    const month = new Date(m.created_at).toISOString().slice(0, 7);
    if (!monthlyMap[month]) monthlyMap[month] = {
      grades: [], eases: [], sentLens: [], wordLens: [], vocabs: [], count: 0,
      tones: {}, questionRates: [], confidenceRates: [],
    };
    const entry = monthlyMap[month];
    entry.count++;
    if (!isNaN(parseFloat(m.grade))) entry.grades.push(parseFloat(m.grade));
    if (!isNaN(parseFloat(m.ease))) entry.eases.push(parseFloat(m.ease));
    if (!isNaN(parseFloat(m.avg_sent_len))) entry.sentLens.push(parseFloat(m.avg_sent_len));
    if (!isNaN(parseFloat(m.avg_word_len))) entry.wordLens.push(parseFloat(m.avg_word_len));
    if (!isNaN(parseFloat(m.vocab_richness))) entry.vocabs.push(parseFloat(m.vocab_richness));
    if (!isNaN(parseFloat(m.question_rate))) entry.questionRates.push(parseFloat(m.question_rate));
    if (!isNaN(parseFloat(m.confidence_rate))) entry.confidenceRates.push(parseFloat(m.confidence_rate));
    const tone = m.tone || 'neutral';
    entry.tones[tone] = (entry.tones[tone] || 0) + 1;
  }

  const evolution = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      count: data.count,
      avgGrade: Math.round(avg(data.grades) * 10) / 10,
      avgEase: Math.round(avg(data.eases) * 10) / 10,
      avgSentenceLength: Math.round(avg(data.sentLens) * 10) / 10,
      avgWordLength: Math.round(avg(data.wordLens) * 100) / 100,
      vocabRichness: Math.round(avg(data.vocabs) * 1000) / 1000,
      questionRate: Math.round(avg(data.questionRates) * 1000) / 1000,
      confidenceRate: Math.round(avg(data.confidenceRates) * 1000) / 1000,
      dominantTone: Object.entries(data.tones).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral',
    }));

  // ─── Sentence length distribution (for histogram) ───

  const sentLenBuckets: Record<string, number> = {
    '1-5': 0, '6-10': 0, '11-15': 0, '16-20': 0,
    '21-25': 0, '26-30': 0, '31-40': 0, '41+': 0,
  };
  // Re-parse content to get actual sentence lengths for distribution
  let sentenceLengthSample = 0;
  for (const m of memories.slice(0, 200)) {
    const sentences = splitSentences(m.content);
    for (const s of sentences) {
      const wc = s.split(/\s+/).filter(w => w.length > 0).length;
      if (wc === 0) continue;
      sentenceLengthSample++;
      if (wc <= 5) sentLenBuckets['1-5']++;
      else if (wc <= 10) sentLenBuckets['6-10']++;
      else if (wc <= 15) sentLenBuckets['11-15']++;
      else if (wc <= 20) sentLenBuckets['16-20']++;
      else if (wc <= 25) sentLenBuckets['21-25']++;
      else if (wc <= 30) sentLenBuckets['26-30']++;
      else if (wc <= 40) sentLenBuckets['31-40']++;
      else sentLenBuckets['41+']++;
    }
  }

  // ─── Complexity comparison benchmarks ───

  const complexityScore = computeComplexityScore(avgGrade, avg(sentLens), avg(wordLens), avg(vocabScores));

  return NextResponse.json({
    analyzed: memories.length,
    totalEligible,
    profile: {
      // Core readability
      avgGradeLevel: Math.round(avgGrade * 10) / 10,
      medianGradeLevel: Math.round(median(grades) * 10) / 10,
      readabilityLevel,
      avgReadingEase: Math.round(avgEase * 10) / 10,
      easeLabel,

      // Vocabulary
      totalWords,
      uniqueWordCount: uniqueWords.size,
      typeTokenRatio: Math.round((uniqueWords.size / Math.max(1, totalWords)) * 1000) / 1000,
      avgVocabRichness: Math.round(avg(vocabScores) * 1000) / 1000,
      rareWordCount: rareWords.length,
      topWords: significantWords,
      topBigrams,
      topTrigrams,

      // Sentence structure
      avgSentenceLength: Math.round(avg(sentLens) * 10) / 10,
      medianSentenceLength: Math.round(median(sentLens) * 10) / 10,
      totalSentences: sentenceCounts.reduce((a, b) => a + b, 0),
      sentenceLengthDistribution: sentLenBuckets,

      // Word level
      avgWordLength: Math.round(avg(wordLens) * 100) / 100,

      // Tone
      toneDistribution,
      dominantTone: Object.entries(toneDistribution).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral',

      // Writing patterns
      avgQuestionRate: Math.round(avg(questionRates) * 1000) / 1000,
      avgExclamationRate: Math.round(avg(exclamationRates) * 1000) / 1000,
      avgHedgingRate: Math.round(avg(hedgingRates) * 1000) / 1000,
      avgConfidenceRate: Math.round(avg(confidenceRates) * 1000) / 1000,

      // Complexity
      complexityScore,

      // Style by source
      styleBySource,

      // Evolution
      evolution,
    },
  });
}

// ──────────────────────────────────────────────────────────────
// Text analysis engine (pure TypeScript, zero dependencies)
// ──────────────────────────────────────────────────────────────

interface TextMetrics {
  gradeLevel: number;
  readingEase: number;
  avgSentenceLength: number;
  avgWordLength: number;
  typeTokenRatio: number;
  tone: string;
  wordCount: number;
  sentenceCount: number;
  questionRate: number;
  exclamationRate: number;
  hedgingRate: number;
  confidenceRate: number;
}

function analyzeText(text: string): TextMetrics {
  const words = extractWords(text);
  const sentences = splitSentences(text);
  const wordCount = words.length;
  const sentenceCount = Math.max(1, sentences.length);

  if (wordCount < 5) {
    return {
      gradeLevel: 0, readingEase: 100, avgSentenceLength: wordCount,
      avgWordLength: avg2(words.map(w => w.length)), typeTokenRatio: 1,
      tone: 'neutral', wordCount, sentenceCount,
      questionRate: 0, exclamationRate: 0, hedgingRate: 0, confidenceRate: 0,
    };
  }

  // Syllable count
  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);

  // Flesch-Kincaid Grade Level
  const avgSentLen = wordCount / sentenceCount;
  const avgSylPerWord = totalSyllables / wordCount;
  const gradeLevel = Math.max(0, 0.39 * avgSentLen + 11.8 * avgSylPerWord - 15.59);

  // Flesch Reading Ease
  const readingEase = Math.max(0, Math.min(100,
    206.835 - 1.015 * avgSentLen - 84.6 * avgSylPerWord
  ));

  // Vocabulary richness (type-token ratio on first 200 words to normalize for length)
  const sampleWords = words.slice(0, 200).map(w => w.toLowerCase());
  const uniqueSample = new Set(sampleWords);
  const typeTokenRatio = sampleWords.length > 0 ? uniqueSample.size / sampleWords.length : 0;

  // Average word length
  const avgWordLength = avg2(words.map(w => w.length));

  // Tone classification
  const tone = classifyTone(text, words, avgSentLen, avgWordLength, avgSylPerWord);

  // Question & exclamation rates
  const questionCount = (text.match(/\?/g) || []).length;
  const exclamationCount = (text.match(/!/g) || []).length;
  const questionRate = questionCount / sentenceCount;
  const exclamationRate = exclamationCount / sentenceCount;

  // Hedging language rate
  const hedgingRate = countPatterns(text, HEDGING_PATTERNS) / sentenceCount;

  // Confident language rate
  const confidenceRate = countPatterns(text, CONFIDENCE_PATTERNS) / sentenceCount;

  return {
    gradeLevel: Math.round(gradeLevel * 10) / 10,
    readingEase: Math.round(readingEase * 10) / 10,
    avgSentenceLength: Math.round(avgSentLen * 10) / 10,
    avgWordLength: Math.round(avgWordLength * 100) / 100,
    typeTokenRatio: Math.round(typeTokenRatio * 1000) / 1000,
    tone,
    wordCount,
    sentenceCount,
    questionRate: Math.round(questionRate * 1000) / 1000,
    exclamationRate: Math.round(exclamationRate * 1000) / 1000,
    hedgingRate: Math.round(hedgingRate * 1000) / 1000,
    confidenceRate: Math.round(confidenceRate * 1000) / 1000,
  };
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function extractWords(text: string): string[] {
  // Remove URLs, emails, code blocks
  const cleaned = text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\S+@\S+\.\S+/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/[#*_~>\[\]\(\){}|]/g, ' ');
  return cleaned.split(/\s+/).filter(w => /^[a-zA-Z'-]+$/.test(w) && w.length > 0);
}

function splitSentences(text: string): string[] {
  // Split on sentence boundaries: period, !, ?, but not abbreviations/decimals
  const sentences = text
    .replace(/\n\n+/g, '. ')  // paragraph breaks as sentence breaks
    .split(/(?<=[.!?])\s+(?=[A-Z])|(?<=[.!?])$|\n/)
    .filter(s => s.trim().length > 5);
  return sentences.length > 0 ? sentences : [text];
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 2) return 1;

  // Remove trailing 'e' (silent e)
  let w = word.replace(/e$/, '');
  if (w.length === 0) w = word;

  // Count vowel groups
  const matches = w.match(/[aeiouy]+/g);
  let count = matches ? matches.length : 1;

  // Adjustments for common patterns
  if (/le$/.test(word) && word.length > 3) count++;
  if (/(?:ia|io|iu|ua|ue|uo)/.test(word)) count++;

  return Math.max(1, count);
}

// ─── Tone classification ───

const FORMAL_WORDS = new Set([
  'therefore', 'furthermore', 'consequently', 'nevertheless', 'accordingly',
  'notwithstanding', 'henceforth', 'moreover', 'albeit', 'whereby', 'herein',
  'regarding', 'pertaining', 'facilitate', 'subsequent', 'preliminary',
  'comprehensive', 'demonstrate', 'implement', 'methodology', 'framework',
  'paradigm', 'respective', 'constitute', 'substantial', 'sufficient',
]);

const CASUAL_WORDS = new Set([
  'yeah', 'yep', 'nope', 'gonna', 'wanna', 'kinda', 'sorta', 'gotta',
  'hey', 'cool', 'awesome', 'stuff', 'thing', 'basically', 'literally',
  'lol', 'btw', 'tbh', 'imo', 'imho', 'omg', 'haha', 'ok', 'okay',
  'pretty', 'super', 'totally', 'actually', 'just', 'really', 'crazy',
  'dude', 'folks', 'guys', 'def', 'legit', 'nah', 'yea',
]);

const TECHNICAL_WORDS = new Set([
  'algorithm', 'api', 'async', 'backend', 'binary', 'boolean', 'buffer',
  'cache', 'callback', 'class', 'compiler', 'component', 'config', 'cpu',
  'database', 'debug', 'deploy', 'docker', 'endpoint', 'function', 'git',
  'graphql', 'http', 'index', 'instance', 'interface', 'iteration', 'json',
  'kernel', 'lambda', 'library', 'linux', 'loop', 'memory', 'module',
  'mutex', 'node', 'object', 'parameter', 'parser', 'pipeline', 'plugin',
  'pointer', 'protocol', 'query', 'queue', 'react', 'recursive', 'regex',
  'render', 'repository', 'rest', 'runtime', 'schema', 'server', 'socket',
  'sql', 'stack', 'state', 'string', 'syntax', 'thread', 'token', 'type',
  'typescript', 'variable', 'vector', 'webhook', 'yaml',
]);

function classifyTone(text: string, words: string[], avgSentLen: number, avgWordLen: number, avgSyl: number): string {
  const lowerWords = words.map(w => w.toLowerCase());
  const wordSet = new Set(lowerWords);

  let formalScore = 0;
  let casualScore = 0;
  let technicalScore = 0;

  for (const w of lowerWords) {
    if (FORMAL_WORDS.has(w)) formalScore += 2;
    if (CASUAL_WORDS.has(w)) casualScore += 2;
    if (TECHNICAL_WORDS.has(w)) technicalScore += 2;
  }

  // Structural indicators
  if (avgSentLen > 20) formalScore += 3;
  if (avgSentLen < 10) casualScore += 3;
  if (avgWordLen > 5.5) formalScore += 2;
  if (avgSyl > 1.7) formalScore += 2;

  // Punctuation signals
  const exclamations = (text.match(/!/g) || []).length;
  const questions = (text.match(/\?/g) || []).length;
  if (exclamations > 2) casualScore += 2;
  if (questions > 3) casualScore += 1;

  // Emoji/emoticon presence
  if (/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}]/u.test(text)) {
    casualScore += 3;
  }

  // Contractions → casual
  if (/\b(don't|can't|won't|i'm|you're|they're|we're|it's|that's|what's|there's|here's|let's)\b/i.test(text)) {
    casualScore += 2;
  }

  // Technical artifacts
  if (/[{}\[\]<>]|=>|===|&&|\|\|/.test(text)) technicalScore += 3;
  if (/```/.test(text)) technicalScore += 4;

  const scores: [string, number][] = [
    ['formal', formalScore],
    ['casual', casualScore],
    ['technical', technicalScore],
  ];

  scores.sort((a, b) => b[1] - a[1]);

  if (scores[0][1] < 3) return 'neutral';
  if (scores[0][1] - scores[1][1] < 2 && scores[0][1] > 3) {
    // Close scores → conversational (mix of formal and casual)
    if ((scores[0][0] === 'formal' && scores[1][0] === 'casual') ||
        (scores[0][0] === 'casual' && scores[1][0] === 'formal')) {
      return 'conversational';
    }
  }

  return scores[0][0];
}

// ─── Hedging & Confidence patterns ───

const HEDGING_PATTERNS = [
  /\b(maybe|perhaps|possibly|might|could be|seems like|sort of|kind of)\b/gi,
  /\b(i think|i guess|i suppose|i believe|i feel like)\b/gi,
  /\b(probably|likely|apparently|roughly|approximately|somewhat)\b/gi,
  /\b(tend to|in my opinion|as far as i know|it appears|it seems)\b/gi,
];

const CONFIDENCE_PATTERNS = [
  /\b(definitely|certainly|absolutely|clearly|obviously|undoubtedly)\b/gi,
  /\b(i know|i'm sure|i'm certain|without doubt|no question)\b/gi,
  /\b(always|never|must|exactly|precisely|guaranteed)\b/gi,
  /\b(the fact is|it's clear that|there's no doubt|conclusively)\b/gi,
];

function countPatterns(text: string, patterns: RegExp[]): number {
  let count = 0;
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) count += matches.length;
  }
  return count;
}

function avg2(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function computeComplexityScore(
  avgGrade: number, avgSentLen: number, avgWordLen: number, avgVocab: number
): number {
  // Normalize each factor to 0-100 scale
  const gradeScore = Math.min(100, (avgGrade / 16) * 100);  // 16 = PhD level
  const sentLenScore = Math.min(100, (avgSentLen / 30) * 100);
  const wordLenScore = Math.min(100, ((avgWordLen - 3) / 3) * 100);  // 3-6 char range
  const vocabScore = Math.min(100, avgVocab * 100);

  // Weighted composite
  const composite = gradeScore * 0.35 + sentLenScore * 0.25 + wordLenScore * 0.15 + vocabScore * 0.25;
  return Math.round(Math.max(0, Math.min(100, composite)));
}
