/**
 * Contradiction Finder — Portable logic module
 * 
 * Extracted from the route for convergence with codex runtime.
 * Handles: candidate finding (via embeddings), AI verification prompts,
 * keyword fallback, contradiction resolution.
 * 
 * Note: AI config/calling will use Codex's shared ai-client.ts once converged.
 * For now, the callAI dependency is injected.
 */

import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────

export interface ContradictionCandidate {
  aId: string;
  aContent: string;
  aSource: string;
  aTitle: string;
  aCreated: string;
  bId: string;
  bContent: string;
  bSource: string;
  bTitle: string;
  bCreated: string;
  similarity: number;
}

export interface VerifiedContradiction {
  topic: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
}

export interface ContradictionResult {
  id: string;
  topic: string;
  description: string;
  detectedAt: string;
  memoryA: { id: string; content: string; source: string; sourceTitle: string; createdAt: string };
  memoryB: { id: string; content: string; source: string; sourceTitle: string; createdAt: string };
}

export interface ScanResult {
  contradictions: ContradictionResult[];
  count: number;
  scanned: number;
  newFound: number;
  aiPowered: boolean;
  message: string;
}

// ─── Find Candidate Pairs ─────────────────────────────────────

export async function findCandidatePairs(userId: string, limit = 80): Promise<ContradictionCandidate[]> {
  const results = await db.execute(sql`
    SELECT 
      a.id as a_id, a.content as a_content, a.source_type as a_source, 
      a.source_title as a_title, a.created_at as a_created,
      b.id as b_id, b.content as b_content, b.source_type as b_source, 
      b.source_title as b_title, b.created_at as b_created,
      1 - (a.embedding <=> b.embedding) as similarity
    FROM memories a, memories b
    WHERE a.user_id = ${userId}::uuid AND b.user_id = ${userId}::uuid
      AND a.id < b.id
      AND a.embedding IS NOT NULL AND b.embedding IS NOT NULL
      AND vector_dims(a.embedding) = vector_dims(b.embedding)
      AND 1 - (a.embedding <=> b.embedding) BETWEEN 0.60 AND 0.95
      AND a.content != b.content
      AND LENGTH(a.content) > 50 AND LENGTH(b.content) > 50
    ORDER BY 1 - (a.embedding <=> b.embedding) DESC
    LIMIT ${limit}
  `);

  return (results as any[]).map(r => ({
    aId: r.a_id,
    aContent: r.a_content,
    aSource: r.a_source,
    aTitle: r.a_title,
    aCreated: r.a_created,
    bId: r.b_id,
    bContent: r.b_content,
    bSource: r.b_source,
    bTitle: r.b_title,
    bCreated: r.b_created,
    similarity: r.similarity,
  }));
}

// ─── Build Verification Prompt ────────────────────────────────

export function buildVerificationPrompt(candidate: ContradictionCandidate): string {
  return `You are a contradiction analyzer. Given two text passages from the same person's knowledge base, determine if they contain a genuine contradiction, conflicting belief, or inconsistency.

TEXT A (from "${candidate.aTitle || candidate.aSource}"):
"${candidate.aContent.slice(0, 600)}"

TEXT B (from "${candidate.bTitle || candidate.bSource}"):
"${candidate.bContent.slice(0, 600)}"

Analyze carefully:
1. Do these passages express genuinely conflicting views, contradictory facts, or inconsistent beliefs?
2. Is this a real contradiction or just different aspects/contexts of the same topic?
3. Evolution of thought over time is NOT a contradiction — if one clearly supersedes the other, that's growth.

Respond with ONLY valid JSON (no markdown, no explanation):
- If a genuine contradiction exists:
  {"contradiction": true, "topic": "brief topic (3-5 words)", "description": "Clear description of what conflicts", "severity": "high|medium|low"}
- If no real contradiction:
  {"contradiction": false}`;
}

// ─── Parse AI Verification Response ───────────────────────────

export function parseVerificationResponse(response: string): VerifiedContradiction | null {
  try {
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

// ─── Store Verified Contradiction ─────────────────────────────

export async function storeContradiction(
  userId: string,
  candidate: ContradictionCandidate,
  verified: VerifiedContradiction,
): Promise<boolean> {
  const existing = await db.execute(sql`
    SELECT id FROM contradictions 
    WHERE user_id = ${userId}::uuid
      AND ((memory_a_id = ${candidate.aId}::uuid AND memory_b_id = ${candidate.bId}::uuid)
        OR (memory_a_id = ${candidate.bId}::uuid AND memory_b_id = ${candidate.aId}::uuid))
  `);

  if ((existing as any[]).length > 0) return false;

  await db.execute(sql`
    INSERT INTO contradictions (user_id, memory_a_id, memory_b_id, topic, description)
    VALUES (${userId}::uuid, ${candidate.aId}::uuid, ${candidate.bId}::uuid, ${verified.topic}, ${verified.description})
  `);
  return true;
}

// ─── Get Cached Results ───────────────────────────────────────

export async function getCachedContradictions(userId: string): Promise<ContradictionResult[]> {
  const results = await db.execute(sql`
    SELECT 
      c.id, c.topic, c.description, c.detected_at,
      c.memory_a_id, c.memory_b_id,
      a.content as a_content, a.source_type as a_source, a.source_title as a_title, a.created_at as a_created,
      b.content as b_content, b.source_type as b_source, b.source_title as b_title, b.created_at as b_created
    FROM contradictions c
    JOIN memories a ON a.id = c.memory_a_id
    JOIN memories b ON b.id = c.memory_b_id
    WHERE c.user_id = ${userId}::uuid
    ORDER BY c.detected_at DESC
  `);

  return (results as any[]).map(r => ({
    id: r.id,
    topic: r.topic,
    description: r.description,
    detectedAt: r.detected_at,
    memoryA: { id: r.memory_a_id, content: r.a_content, source: r.a_source, sourceTitle: r.a_title, createdAt: r.a_created },
    memoryB: { id: r.memory_b_id, content: r.b_content, source: r.b_source, sourceTitle: r.b_title, createdAt: r.b_created },
  }));
}

// ─── Resolve Contradiction ────────────────────────────────────

export async function resolveContradiction(
  userId: string,
  contradictionId: string,
  resolution: 'dismiss' | 'keep-a' | 'keep-b',
): Promise<void> {
  const existing = await db.execute(sql`
    SELECT id, memory_a_id, memory_b_id FROM contradictions 
    WHERE id = ${contradictionId}::uuid AND user_id = ${userId}::uuid
  `);

  if ((existing as any[]).length === 0) throw new Error('Contradiction not found');
  const record = (existing as any[])[0];

  if (resolution === 'keep-a') {
    await db.execute(sql`DELETE FROM memories WHERE id = ${record.memory_b_id}::uuid AND user_id = ${userId}::uuid`);
  } else if (resolution === 'keep-b') {
    await db.execute(sql`DELETE FROM memories WHERE id = ${record.memory_a_id}::uuid AND user_id = ${userId}::uuid`);
  }

  await db.execute(sql`DELETE FROM contradictions WHERE id = ${contradictionId}::uuid AND user_id = ${userId}::uuid`);
}

// ─── Keyword Fallback Scan ────────────────────────────────────

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

export function keywordScan(candidates: ContradictionCandidate[]): ContradictionResult[] {
  const found: ContradictionResult[] = [];

  for (const c of candidates) {
    const aLower = c.aContent.toLowerCase();
    const bLower = c.bContent.toLowerCase();

    for (const [pos, neg] of CONTRADICTION_SIGNALS) {
      if ((aLower.includes(pos!) && bLower.includes(neg!)) || (aLower.includes(neg!) && bLower.includes(pos!))) {
        found.push({
          id: crypto.randomUUID(),
          topic: extractBridgeConcept(c.aContent, c.bContent),
          description: `Potential tension: one mentions "${pos}" while the other mentions "${neg}"`,
          detectedAt: new Date().toISOString(),
          memoryA: { id: c.aId, content: c.aContent, source: c.aSource, sourceTitle: c.aTitle, createdAt: c.aCreated },
          memoryB: { id: c.bId, content: c.bContent, source: c.bSource, sourceTitle: c.bTitle, createdAt: c.bCreated },
        });
        break;
      }
    }
    if (found.length >= 15) break;
  }

  return found;
}

// ─── Helpers ──────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'it', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but',
  'not', 'with', 'this', 'that', 'from', 'by', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
  'might', 'can', 'i', 'you', 'he', 'she', 'we', 'they', 'my', 'your', 'his', 'her',
  'our', 'their', 'me', 'him', 'us', 'them', 'about', 'just', 'also', 'than', 'then',
  'when', 'what', 'how', 'which', 'where', 'more', 'some', 'very', 'much', 'only',
  'other', 'each', 'most', 'such', 'well', 'because', 'while', 'after', 'before',
]);

function extractBridgeConcept(textA: string, textB: string): string {
  const wordsA = new Set(textA.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !STOP_WORDS.has(w)));
  const wordsB = new Set(textB.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !STOP_WORDS.has(w)));
  const common = [...wordsA].filter(w => wordsB.has(w));
  return common.slice(0, 3).join(', ') || 'related concepts';
}
