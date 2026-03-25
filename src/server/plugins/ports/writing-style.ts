/**
 * Writing Style Analyzer — Portable logic module
 * 
 * Extracted from the route for convergence with codex runtime.
 * Contains: pure text analysis engine (zero external dependencies),
 * readability scoring, tone classification, vocabulary analysis,
 * n-gram extraction, profile aggregation.
 * 
 * This module has ZERO AI dependency — all analysis is algorithmic.
 */

// ─── Types ────────────────────────────────────────────────────

export interface TextMetrics {
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

export interface WritingProfile {
  avgGradeLevel: number;
  medianGradeLevel: number;
  readabilityLevel: string;
  avgReadingEase: number;
  easeLabel: string;
  totalWords: number;
  uniqueWordCount: number;
  typeTokenRatio: number;
  avgVocabRichness: number;
  rareWordCount: number;
  topWords: { word: string; count: number; pct: number }[];
  topBigrams: { phrase: string; count: number }[];
  topTrigrams: { phrase: string; count: number }[];
  avgSentenceLength: number;
  medianSentenceLength: number;
  totalSentences: number;
  sentenceLengthDistribution: Record<string, number>;
  avgWordLength: number;
  toneDistribution: Record<string, number>;
  dominantTone: string;
  avgQuestionRate: number;
  avgExclamationRate: number;
  avgHedgingRate: number;
  avgConfidenceRate: number;
  complexityScore: number;
  styleBySource: SourceStyle[];
  evolution: MonthlyEvolution[];
}

export interface SourceStyle {
  source: string;
  count: number;
  avgGrade: number;
  avgEase: number;
  avgSentenceLength: number;
  dominantTone: string;
}

export interface MonthlyEvolution {
  month: string;
  count: number;
  avgGrade: number;
  avgEase: number;
  avgSentenceLength: number;
  avgWordLength: number;
  vocabRichness: number;
  questionRate: number;
  confidenceRate: number;
  dominantTone: string;
}

// ─── Core Text Analysis ──────────────────────────────────────

export function analyzeText(text: string): TextMetrics {
  const words = extractWords(text);
  const sentences = splitSentences(text);
  const wordCount = words.length;
  const sentenceCount = Math.max(1, sentences.length);

  if (wordCount < 5) {
    return {
      gradeLevel: 0, readingEase: 100, avgSentenceLength: wordCount,
      avgWordLength: avg(words.map(w => w.length)), typeTokenRatio: 1,
      tone: 'neutral', wordCount, sentenceCount,
      questionRate: 0, exclamationRate: 0, hedgingRate: 0, confidenceRate: 0,
    };
  }

  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const avgSentLen = wordCount / sentenceCount;
  const avgSylPerWord = totalSyllables / wordCount;

  // Flesch-Kincaid Grade Level
  const gradeLevel = Math.max(0, 0.39 * avgSentLen + 11.8 * avgSylPerWord - 15.59);

  // Flesch Reading Ease
  const readingEase = Math.max(0, Math.min(100,
    206.835 - 1.015 * avgSentLen - 84.6 * avgSylPerWord
  ));

  // Type-token ratio (normalized to first 200 words)
  const sampleWords = words.slice(0, 200).map(w => w.toLowerCase());
  const uniqueSample = new Set(sampleWords);
  const typeTokenRatio = sampleWords.length > 0 ? uniqueSample.size / sampleWords.length : 0;

  const avgWordLength = avg(words.map(w => w.length));
  const tone = classifyTone(text, words, avgSentLen, avgWordLength, avgSylPerWord);

  const questionCount = (text.match(/\?/g) || []).length;
  const exclamationCount = (text.match(/!/g) || []).length;

  return {
    gradeLevel: round(gradeLevel, 1),
    readingEase: round(readingEase, 1),
    avgSentenceLength: round(avgSentLen, 1),
    avgWordLength: round(avgWordLength, 2),
    typeTokenRatio: round(typeTokenRatio, 3),
    tone,
    wordCount,
    sentenceCount,
    questionRate: round(questionCount / sentenceCount, 3),
    exclamationRate: round(exclamationCount / sentenceCount, 3),
    hedgingRate: round(countPatterns(text, HEDGING_PATTERNS) / sentenceCount, 3),
    confidenceRate: round(countPatterns(text, CONFIDENCE_PATTERNS) / sentenceCount, 3),
  };
}

// ─── Word Extraction ──────────────────────────────────────────

export function extractWords(text: string): string[] {
  const cleaned = text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\S+@\S+\.\S+/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/[#*_~>\[\]\(\){}|]/g, ' ');
  return cleaned.split(/\s+/).filter(w => /^[a-zA-Z'-]+$/.test(w) && w.length > 0);
}

// ─── Sentence Splitting ──────────────────────────────────────

export function splitSentences(text: string): string[] {
  const sentences = text
    .replace(/\n\n+/g, '. ')
    .split(/(?<=[.!?])\s+(?=[A-Z])|(?<=[.!?])$|\n/)
    .filter(s => s.trim().length > 5);
  return sentences.length > 0 ? sentences : [text];
}

// ─── Syllable Counter ─────────────────────────────────────────

export function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 2) return 1;

  let w = word.replace(/e$/, '');
  if (w.length === 0) w = word;

  const matches = w.match(/[aeiouy]+/g);
  let count = matches ? matches.length : 1;

  if (/le$/.test(word) && word.length > 3) count++;
  if (/(?:ia|io|iu|ua|ue|uo)/.test(word)) count++;

  return Math.max(1, count);
}

// ─── Tone Classification ─────────────────────────────────────

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

export function classifyTone(
  text: string,
  words: string[],
  avgSentLen: number,
  avgWordLen: number,
  avgSyl: number,
): string {
  const lowerWords = words.map(w => w.toLowerCase());

  let formalScore = 0;
  let casualScore = 0;
  let technicalScore = 0;

  for (const w of lowerWords) {
    if (FORMAL_WORDS.has(w)) formalScore += 2;
    if (CASUAL_WORDS.has(w)) casualScore += 2;
    if (TECHNICAL_WORDS.has(w)) technicalScore += 2;
  }

  if (avgSentLen > 20) formalScore += 3;
  if (avgSentLen < 10) casualScore += 3;
  if (avgWordLen > 5.5) formalScore += 2;
  if (avgSyl > 1.7) formalScore += 2;

  const exclamations = (text.match(/!/g) || []).length;
  if (exclamations > 2) casualScore += 2;
  if ((text.match(/\?/g) || []).length > 3) casualScore += 1;

  if (/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}]/u.test(text)) casualScore += 3;
  if (/\b(don't|can't|won't|i'm|you're|they're|we're|it's|that's|what's|there's|here's|let's)\b/i.test(text)) casualScore += 2;
  if (/[{}\[\]<>]|=>|===|&&|\|\|/.test(text)) technicalScore += 3;
  if (/```/.test(text)) technicalScore += 4;

  const scores: [string, number][] = [
    ['formal', formalScore],
    ['casual', casualScore],
    ['technical', technicalScore],
  ];
  scores.sort((a, b) => b[1] - a[1]);

  if (scores[0]![1] < 3) return 'neutral';
  if (scores[0]![1] - scores[1]![1] < 2 && scores[0]![1] > 3) {
    if ((scores[0]![0] === 'formal' && scores[1]![0] === 'casual') ||
        (scores[0]![0] === 'casual' && scores[1]![0] === 'formal')) {
      return 'conversational';
    }
  }
  return scores[0]![0];
}

// ─── Pattern Counting ─────────────────────────────────────────

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

export function countPatterns(text: string, patterns: RegExp[]): number {
  let count = 0;
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) count += matches.length;
  }
  return count;
}

// ─── Vocabulary Analysis ──────────────────────────────────────

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
  'way', 'now', 'get', 'make', 'made', 'one', 'two', 'know', 'think',
  'see', 'come', 'say', 'said', 'go', 'going', 'take', 'thing', 'things',
  'time', 'want', 'use', 'used', 'using', 'need', 'work', 'part', 'really',
]);

export function analyzeVocabulary(texts: string[]): {
  totalWords: number;
  uniqueWordCount: number;
  topWords: { word: string; count: number; pct: number }[];
  topBigrams: { phrase: string; count: number }[];
  topTrigrams: { phrase: string; count: number }[];
  rareWordCount: number;
} {
  const allWords: string[] = [];
  const bigramMap: Record<string, number> = {};
  const trigramMap: Record<string, number> = {};

  for (const text of texts) {
    const words = extractWords(text);
    allWords.push(...words);

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

  const topWords = Object.entries(wordFreq)
    .filter(([w]) => !STOPWORDS.has(w) && w.length > 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([word, count]) => ({ word, count, pct: round((count / totalWords) * 100, 2) }));

  const topBigrams = Object.entries(bigramMap)
    .filter(([phrase]) => phrase.split(' ').some(p => !STOPWORDS.has(p) && p.length > 2))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([phrase, count]) => ({ phrase, count }));

  const topTrigrams = Object.entries(trigramMap)
    .filter(([phrase]) => phrase.split(' ').filter(p => !STOPWORDS.has(p) && p.length > 2).length >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase, count]) => ({ phrase, count }));

  const rareWordCount = Object.entries(wordFreq)
    .filter(([w, c]) => c <= 2 && w.length >= 6 && !STOPWORDS.has(w))
    .length;

  return { totalWords, uniqueWordCount: uniqueWords.size, topWords, topBigrams, topTrigrams, rareWordCount };
}

// ─── Readability Classification ───────────────────────────────

export function classifyReadability(avgGrade: number): string {
  if (avgGrade <= 6) return 'Elementary';
  if (avgGrade <= 8) return 'Middle School';
  if (avgGrade <= 10) return 'High School';
  if (avgGrade <= 12) return 'College';
  if (avgGrade <= 14) return 'College Graduate';
  return 'Graduate/Professional';
}

export function classifyEase(avgEase: number): string {
  if (avgEase >= 80) return 'Very Easy';
  if (avgEase >= 60) return 'Standard';
  if (avgEase >= 40) return 'Fairly Difficult';
  if (avgEase >= 20) return 'Difficult';
  return 'Very Difficult';
}

// ─── Complexity Score ─────────────────────────────────────────

export function computeComplexityScore(
  avgGrade: number,
  avgSentLen: number,
  avgWordLen: number,
  avgVocab: number,
): number {
  const gradeScore = Math.min(100, (avgGrade / 16) * 100);
  const sentLenScore = Math.min(100, (avgSentLen / 30) * 100);
  const wordLenScore = Math.min(100, ((avgWordLen - 3) / 3) * 100);
  const vocabScore = Math.min(100, avgVocab * 100);

  const composite = gradeScore * 0.35 + sentLenScore * 0.25 + wordLenScore * 0.15 + vocabScore * 0.25;
  return Math.round(Math.max(0, Math.min(100, composite)));
}

// ─── Sentence Length Distribution ─────────────────────────────

export function buildSentenceLengthDistribution(texts: string[]): Record<string, number> {
  const buckets: Record<string, number> = {
    '1-5': 0, '6-10': 0, '11-15': 0, '16-20': 0,
    '21-25': 0, '26-30': 0, '31-40': 0, '41+': 0,
  };

  for (const text of texts) {
    const sentences = splitSentences(text);
    for (const s of sentences) {
      const wc = s.split(/\s+/).filter(w => w.length > 0).length;
      if (wc === 0) continue;
      if (wc <= 5) buckets['1-5']!++;
      else if (wc <= 10) buckets['6-10']!++;
      else if (wc <= 15) buckets['11-15']!++;
      else if (wc <= 20) buckets['16-20']!++;
      else if (wc <= 25) buckets['21-25']!++;
      else if (wc <= 30) buckets['26-30']!++;
      else if (wc <= 40) buckets['31-40']!++;
      else buckets['41+']!++;
    }
  }

  return buckets;
}

// ─── Helpers ──────────────────────────────────────────────────

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function round(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}
