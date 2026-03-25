/**
 * Contradiction Finder — Ported Plugin Logic
 *
 * Extracted from: src/app/api/v1/plugins/contradiction-finder/route.ts
 *
 * AI-powered contradiction detection: finds semantically similar memories
 * that express conflicting views, then verifies via AI or keyword fallback.
 */

import type { AIConfig } from '@/server/plugins/ai-caller';
import { callAI } from '@/server/plugins/ai-caller';

// ─── Types ──────────────────────────────────────────────────────

export interface MemorySnippet {
  id: string;
  content: string;
  source: string;
  sourceTitle?: string;
  createdAt?: string;
}

export interface ContradictionCandidate {
  a_id: string;
  a_content: string;
  a_source: string;
  a_title?: string;
  a_created?: string;
  b_id: string;
  b_content: string;
  b_source: string;
  b_title?: string;
  b_created?: string;
  similarity: number;
}

export interface VerifiedContradiction {
  topic: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
}

export interface DetectedContradiction {
  memoryA: MemorySnippet;
  memoryB: MemorySnippet;
  topic: string;
  description: string;
}

// ─── AI verification ────────────────────────────────────────────

/**
 * Ask AI whether two texts actually contradict each other.
 * Returns null if no contradiction or on failure.
 */
export async function verifyContradiction(
  candidate: ContradictionCandidate,
  aiConfig: AIConfig,
): Promise<VerifiedContradiction | null> {
  const prompt = `You are a contradiction analyzer. Given two text passages from the same person's knowledge base, determine if they contain a genuine contradiction, conflicting belief, or inconsistency.

TEXT A (from "${candidate.a_title || candidate.a_source}"):
"${candidate.a_content.slice(0, 600)}"

TEXT B (from "${candidate.b_title || candidate.b_source}"):
"${candidate.b_content.slice(0, 600)}"

Analyze carefully:
1. Do these passages express genuinely conflicting views, contradictory facts, or inconsistent beliefs?
2. Is this a real contradiction or just different aspects/contexts of the same topic?
3. Evolution of thought over time is NOT a contradiction — if one clearly supersedes the other, that's growth.

Respond with ONLY valid JSON (no markdown, no explanation):
- If a genuine contradiction exists:
  {"contradiction": true, "topic": "brief topic (3-5 words)", "description": "Clear description of what conflicts", "severity": "high|medium|low"}
- If no real contradiction:
  {"contradiction": false}`;

  try {
    const response = await callAI(aiConfig, prompt, { temperature: 0.1, maxTokens: 300 });
    if (!response) return null;

    // Handle markdown code fences
    let cleaned = response.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    const parsed = JSON.parse(cleaned);
    if (!parsed.contradiction) return null;

    return {
      topic: parsed.topic || 'Unknown topic',
      description: parsed.description || 'Potential contradiction detected',
      severity: parsed.severity || 'medium',
    };
  } catch {
    return null;
  }
}

/**
 * Batch-verify candidates via AI, stopping at maxResults.
 */
export async function batchVerify(
  candidates: ContradictionCandidate[],
  aiConfig: AIConfig,
  opts: { batchSize?: number; maxResults?: number } = {},
): Promise<{ verified: (VerifiedContradiction & { candidate: ContradictionCandidate })[] }> {
  const { batchSize = 5, maxResults = 20 } = opts;
  const verified: (VerifiedContradiction & { candidate: ContradictionCandidate })[] = [];

  for (let i = 0; i < candidates.length && verified.length < maxResults; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((c) => verifyContradiction(c, aiConfig)),
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled' && result.value) {
        verified.push({ ...result.value, candidate: batch[j] });
      }
    }
  }

  return { verified };
}

// ─── Keyword fallback ───────────────────────────────────────────

const CONTRADICTION_SIGNALS: [string, string][] = [
  ['always', 'never'], ['best', 'worst'], ['love', 'hate'],
  ['agree', 'disagree'], ['should', 'should not'],
  ['important', 'unimportant'], ['easy', 'difficult'],
  ['recommend', 'avoid'], ['prefer', 'dislike'],
  ['efficient', 'inefficient'], ['useful', 'useless'],
  ['true', 'false'], ['right', 'wrong'],
  ['increase', 'decrease'], ['better', 'worse'],
  ['positive', 'negative'], ['success', 'failure'],
];

/**
 * Keyword-based contradiction detection (no AI needed).
 * Scans for opposing signal words in semantically similar pairs.
 */
export function keywordScan(
  candidates: ContradictionCandidate[],
  maxResults = 15,
): DetectedContradiction[] {
  const found: DetectedContradiction[] = [];

  for (const r of candidates) {
    const aLower = r.a_content.toLowerCase();
    const bLower = r.b_content.toLowerCase();

    for (const [pos, neg] of CONTRADICTION_SIGNALS) {
      if (
        (aLower.includes(pos) && bLower.includes(neg)) ||
        (aLower.includes(neg) && bLower.includes(pos))
      ) {
        found.push({
          memoryA: { id: r.a_id, content: r.a_content, source: r.a_source, sourceTitle: r.a_title, createdAt: r.a_created },
          memoryB: { id: r.b_id, content: r.b_content, source: r.b_source, sourceTitle: r.b_title, createdAt: r.b_created },
          topic: extractBridgeConcept(r.a_content, r.b_content),
          description: `Potential tension: one mentions "${pos}" while the other mentions "${neg}"`,
        });
        break;
      }
    }
    if (found.length >= maxResults) break;
  }

  return found;
}

// ─── Utilities ──────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'it', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or',
  'but', 'not', 'with', 'this', 'that', 'from', 'by', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'i', 'you', 'he', 'she', 'we', 'they', 'my',
  'your', 'his', 'her', 'our', 'their', 'me', 'him', 'us', 'them', 'about', 'just',
  'also', 'than', 'then', 'when', 'what', 'how', 'which', 'where', 'more', 'some',
  'very', 'much', 'only', 'other', 'each', 'most', 'such', 'well', 'because',
  'while', 'after', 'before',
]);

/**
 * Find shared meaningful words between two texts (for labeling a contradiction topic).
 */
export function extractBridgeConcept(textA: string, textB: string): string {
  const wordsA = new Set(
    textA.toLowerCase().split(/\W+/).filter((w) => w.length > 3 && !STOP_WORDS.has(w)),
  );
  const wordsB = new Set(
    textB.toLowerCase().split(/\W+/).filter((w) => w.length > 3 && !STOP_WORDS.has(w)),
  );
  const common = [...wordsA].filter((w) => wordsB.has(w));
  return common.slice(0, 3).join(', ') || 'related concepts';
}
