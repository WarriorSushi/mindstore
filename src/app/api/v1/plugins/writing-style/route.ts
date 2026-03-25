/**
 * Writing Style Analyzer Plugin — Route (thin wrapper)
 *
 * GET ?action=analyze   — Run analysis on unanalyzed memories
 * GET ?action=results   — Get cached analysis results
 * GET ?action=profile   — Get comprehensive writing profile/fingerprint
 *
 * Logic delegated to src/server/plugins/ports/writing-style.ts
 */

import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import {
  analyzeText,
  analyzeVocabulary,
  classifyReadability,
  classifyEase,
  computeComplexityScore,
  buildSentenceLengthDistribution,
} from '@/server/plugins/ports/writing-style';

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
    return NextResponse.json({ analyzed: 0, message: 'All memories have been analyzed already.' });
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
    return NextResponse.json({ analyzed: 0, totalEligible, profile: null });
  }

  // ─── Aggregate metrics ───
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const median = (arr: number[]) => {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  };

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

  // ─── Tone distribution ───
  const toneDistribution: Record<string, number> = {};
  for (const m of memories) {
    const tone = m.tone || 'neutral';
    toneDistribution[tone] = (toneDistribution[tone] || 0) + 1;
  }

  // ─── Vocabulary analysis (delegated to port) ───
  const vocab = analyzeVocabulary(memories.map(m => m.content));

  // ─── Sentence length distribution (delegated to port) ───
  const sentenceLengthDistribution = buildSentenceLengthDistribution(
    memories.slice(0, 200).map(m => m.content),
  );

  // ─── Style by source type ───
  const bySource: Record<string, {
    count: number; avgGrade: number; avgEase: number; avgSentLen: number;
    tones: Record<string, number>;
  }> = {};
  for (const m of memories) {
    const src = m.source_type || 'unknown';
    if (!bySource[src]) bySource[src] = { count: 0, avgGrade: 0, avgEase: 0, avgSentLen: 0, tones: {} };
    bySource[src]!.count++;
    bySource[src]!.avgGrade += parseFloat(m.grade) || 0;
    bySource[src]!.avgEase += parseFloat(m.ease) || 0;
    bySource[src]!.avgSentLen += parseFloat(m.avg_sent_len) || 0;
    const tone = m.tone || 'neutral';
    bySource[src]!.tones[tone] = (bySource[src]!.tones[tone] || 0) + 1;
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
    const entry = monthlyMap[month]!;
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

  // ─── Compute aggregate values ───
  const avgGrade = avg(grades);
  const avgEase = avg(easeScores);
  const complexityScore = computeComplexityScore(avgGrade, avg(sentLens), avg(wordLens), avg(vocabScores));

  return NextResponse.json({
    analyzed: memories.length,
    totalEligible,
    profile: {
      avgGradeLevel: Math.round(avgGrade * 10) / 10,
      medianGradeLevel: Math.round(median(grades) * 10) / 10,
      readabilityLevel: classifyReadability(avgGrade),
      avgReadingEase: Math.round(avgEase * 10) / 10,
      easeLabel: classifyEase(avgEase),
      totalWords: vocab.totalWords,
      uniqueWordCount: vocab.uniqueWordCount,
      typeTokenRatio: Math.round((vocab.uniqueWordCount / Math.max(1, vocab.totalWords)) * 1000) / 1000,
      avgVocabRichness: Math.round(avg(vocabScores) * 1000) / 1000,
      rareWordCount: vocab.rareWordCount,
      topWords: vocab.topWords,
      topBigrams: vocab.topBigrams,
      topTrigrams: vocab.topTrigrams,
      avgSentenceLength: Math.round(avg(sentLens) * 10) / 10,
      medianSentenceLength: Math.round(median(sentLens) * 10) / 10,
      totalSentences: sentenceCounts.reduce((a, b) => a + b, 0),
      sentenceLengthDistribution,
      avgWordLength: Math.round(avg(wordLens) * 100) / 100,
      toneDistribution,
      dominantTone: Object.entries(toneDistribution).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral',
      avgQuestionRate: Math.round(avg(questionRates) * 1000) / 1000,
      avgExclamationRate: Math.round(avg(exclamationRates) * 1000) / 1000,
      avgHedgingRate: Math.round(avg(hedgingRates) * 1000) / 1000,
      avgConfidenceRate: Math.round(avg(confidenceRates) * 1000) / 1000,
      complexityScore,
      styleBySource,
      evolution,
    },
  });
}
