import { eq, sql } from "drizzle-orm";
import { callTextPrompt, getTextGenerationConfig } from "@/server/ai-client";
import { db, schema } from "@/server/db";
import { PLUGIN_MANIFESTS } from "@/server/plugins/registry";

const PLUGIN_SLUG = "contradiction-finder";
const MAX_VERIFIED_RESULTS = 20;
const BATCH_SIZE = 5;
const CONTRADICTION_SIGNALS: Array<[string, string]> = [
  ["always", "never"],
  ["best", "worst"],
  ["love", "hate"],
  ["agree", "disagree"],
  ["should", "should not"],
  ["important", "unimportant"],
  ["easy", "difficult"],
  ["recommend", "avoid"],
  ["prefer", "dislike"],
  ["efficient", "inefficient"],
  ["useful", "useless"],
  ["true", "false"],
  ["right", "wrong"],
  ["increase", "decrease"],
  ["better", "worse"],
  ["positive", "negative"],
  ["success", "failure"],
];

export interface ContradictionMemoryRef {
  id: string;
  content: string;
  source: string;
  sourceTitle: string | null;
  createdAt: string | null;
}

export interface ContradictionResult {
  id: string;
  topic: string | null;
  description: string | null;
  detectedAt: string | null;
  memoryA: ContradictionMemoryRef;
  memoryB: ContradictionMemoryRef;
}

interface ContradictionCandidate {
  aId: string;
  aContent: string;
  aSource: string;
  aTitle: string | null;
  aCreated: string | null;
  bId: string;
  bContent: string;
  bSource: string;
  bTitle: string | null;
  bCreated: string | null;
  similarity: number;
}

interface VerifiedContradiction {
  topic: string;
  description: string;
  severity: string;
}

export async function ensureContradictionFinderInstalled() {
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
      jobs: manifest.jobs || [],
    },
  });
}

export async function listContradictions(userId: string) {
  const rows = await db.execute(sql`
    SELECT
      c.id, c.topic, c.description, c.detected_at,
      c.memory_a_id, c.memory_b_id,
      a.content AS a_content, a.source_type AS a_source, a.source_title AS a_title, a.created_at AS a_created,
      b.content AS b_content, b.source_type AS b_source, b.source_title AS b_title, b.created_at AS b_created
    FROM contradictions c
    JOIN memories a ON a.id = c.memory_a_id
    JOIN memories b ON b.id = c.memory_b_id
    WHERE c.user_id = ${userId}::uuid
    ORDER BY c.detected_at DESC
  `);

  const contradictions = (rows as unknown as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    topic: toNullableString(row.topic),
    description: toNullableString(row.description),
    detectedAt: toIsoString(row.detected_at),
    memoryA: {
      id: String(row.memory_a_id),
      content: String(row.a_content || ""),
      source: String(row.a_source || ""),
      sourceTitle: toNullableString(row.a_title),
      createdAt: toIsoString(row.a_created),
    },
    memoryB: {
      id: String(row.memory_b_id),
      content: String(row.b_content || ""),
      source: String(row.b_source || ""),
      sourceTitle: toNullableString(row.b_title),
      createdAt: toIsoString(row.b_created),
    },
  })) satisfies ContradictionResult[];

  return {
    contradictions,
    count: contradictions.length,
  };
}

export async function runContradictionScan(userId: string) {
  const candidates = await loadContradictionCandidates(userId);

  if (candidates.length === 0) {
    return {
      contradictions: [],
      count: 0,
      scanned: 0,
      message: "No candidate pairs found. Import more knowledge to discover contradictions.",
    };
  }

  const aiConfig = await getTextGenerationConfig({
    openai: "gpt-4o-mini",
    openrouter: "anthropic/claude-3.5-haiku",
    gemini: "gemini-2.0-flash-lite",
    ollama: "llama3.2",
    custom: "default",
  });

  if (!aiConfig) {
    return runKeywordContradictionScan(candidates);
  }

  const verified: Array<VerifiedContradiction & { candidate: ContradictionCandidate }> = [];

  for (let index = 0; index < candidates.length && verified.length < MAX_VERIFIED_RESULTS; index += BATCH_SIZE) {
    const batch = candidates.slice(index, index + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((candidate) => verifyContradiction(candidate, aiConfig)),
    );

    for (let batchIndex = 0; batchIndex < results.length; batchIndex += 1) {
      const result = results[batchIndex];
      if (result?.status === "fulfilled" && result.value) {
        verified.push({
          ...result.value,
          candidate: batch[batchIndex]!,
        });
      }
    }
  }

  let newFound = 0;

  for (const item of verified) {
    const existing = await db.execute(sql`
      SELECT id
      FROM contradictions
      WHERE user_id = ${userId}::uuid
        AND (
          (memory_a_id = ${item.candidate.aId}::uuid AND memory_b_id = ${item.candidate.bId}::uuid)
          OR
          (memory_a_id = ${item.candidate.bId}::uuid AND memory_b_id = ${item.candidate.aId}::uuid)
        )
    `);

    if ((existing as unknown as Array<Record<string, unknown>>).length > 0) {
      continue;
    }

    await db.execute(sql`
      INSERT INTO contradictions (user_id, memory_a_id, memory_b_id, topic, description)
      VALUES (
        ${userId}::uuid,
        ${item.candidate.aId}::uuid,
        ${item.candidate.bId}::uuid,
        ${item.topic},
        ${item.description}
      )
    `);
    newFound += 1;
  }

  const results = await listContradictions(userId);

  return {
    ...results,
    scanned: candidates.length,
    newFound,
    message: newFound > 0
      ? `Found ${newFound} new contradiction${newFound > 1 ? "s" : ""} across ${candidates.length} memory pairs.`
      : `Scanned ${candidates.length} memory pairs. No new contradictions found.`,
  };
}

export async function resolveContradiction(
  userId: string,
  body: { contradictionId?: string; resolution?: "dismiss" | "keep-a" | "keep-b" },
) {
  if (!body.contradictionId) {
    throw new Error("contradictionId required");
  }

  const rows = await db.execute(sql`
    SELECT id, memory_a_id, memory_b_id
    FROM contradictions
    WHERE id = ${body.contradictionId}::uuid AND user_id = ${userId}::uuid
  `);

  const record = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!record) {
    throw new Error("Contradiction not found");
  }

  if (body.resolution === "keep-a") {
    await db.execute(sql`
      DELETE FROM memories
      WHERE id = ${String(record.memory_b_id)}::uuid AND user_id = ${userId}::uuid
    `);
  } else if (body.resolution === "keep-b") {
    await db.execute(sql`
      DELETE FROM memories
      WHERE id = ${String(record.memory_a_id)}::uuid AND user_id = ${userId}::uuid
    `);
  }

  await db.execute(sql`
    DELETE FROM contradictions
    WHERE id = ${body.contradictionId}::uuid AND user_id = ${userId}::uuid
  `);

  return {
    success: true,
    resolution: body.resolution || "dismiss",
  };
}

export function extractBridgeConcept(textA: string, textB: string) {
  const stopWords = new Set([
    "the", "a", "an", "is", "it", "in", "on", "at", "to", "for", "of", "and", "or", "but", "not", "with",
    "this", "that", "from", "by", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does",
    "did", "will", "would", "could", "should", "may", "might", "can", "i", "you", "he", "she", "we", "they",
    "my", "your", "his", "her", "our", "their", "me", "him", "us", "them", "about", "just", "also", "than",
    "then", "when", "what", "how", "which", "where", "more", "some", "very", "much", "only", "other", "each",
    "most", "such", "well", "because", "while", "after", "before",
  ]);

  const wordsA = new Set(textA.toLowerCase().split(/\W+/).filter((word) => word.length > 3 && !stopWords.has(word)));
  const wordsB = new Set(textB.toLowerCase().split(/\W+/).filter((word) => word.length > 3 && !stopWords.has(word)));
  const common = [...wordsA].filter((word) => wordsB.has(word));
  return common.slice(0, 3).join(", ") || "related concepts";
}

async function loadContradictionCandidates(userId: string) {
  const rows = await db.execute(sql`
    SELECT
      a.id AS a_id, a.content AS a_content, a.source_type AS a_source,
      a.source_title AS a_title, a.created_at AS a_created,
      b.id AS b_id, b.content AS b_content, b.source_type AS b_source,
      b.source_title AS b_title, b.created_at AS b_created,
      1 - (a.embedding <=> b.embedding) AS similarity
    FROM memories a, memories b
    WHERE a.user_id = ${userId}::uuid AND b.user_id = ${userId}::uuid
      AND a.id < b.id
      AND a.embedding IS NOT NULL AND b.embedding IS NOT NULL
      AND vector_dims(a.embedding) = vector_dims(b.embedding)
      AND 1 - (a.embedding <=> b.embedding) BETWEEN 0.60 AND 0.95
      AND a.content != b.content
      AND LENGTH(a.content) > 50 AND LENGTH(b.content) > 50
    ORDER BY 1 - (a.embedding <=> b.embedding) DESC
    LIMIT 80
  `);

  return (rows as unknown as Array<Record<string, unknown>>).map((row) => ({
    aId: String(row.a_id),
    aContent: String(row.a_content || ""),
    aSource: String(row.a_source || ""),
    aTitle: toNullableString(row.a_title),
    aCreated: toIsoString(row.a_created),
    bId: String(row.b_id),
    bContent: String(row.b_content || ""),
    bSource: String(row.b_source || ""),
    bTitle: toNullableString(row.b_title),
    bCreated: toIsoString(row.b_created),
    similarity: Number(row.similarity || 0),
  })) satisfies ContradictionCandidate[];
}

async function verifyContradiction(candidate: ContradictionCandidate, aiConfig: Awaited<ReturnType<typeof getTextGenerationConfig>>) {
  if (!aiConfig) {
    return null;
  }

  const prompt = `You are a contradiction analyzer. Given two text passages from the same person's knowledge base, determine if they contain a genuine contradiction, conflicting belief, or inconsistency.

TEXT A (from "${candidate.aTitle || candidate.aSource}"):
"${candidate.aContent.slice(0, 600)}"

TEXT B (from "${candidate.bTitle || candidate.bSource}"):
"${candidate.bContent.slice(0, 600)}"

Analyze carefully:
1. Do these passages express genuinely conflicting views, contradictory facts, or inconsistent beliefs?
2. Is this a real contradiction or just different aspects or contexts of the same topic?
3. Evolution of thought over time is NOT a contradiction. If one clearly supersedes the other, that is growth.

Respond with ONLY valid JSON:
- If a genuine contradiction exists:
  {"contradiction": true, "topic": "brief topic (3-5 words)", "description": "Clear description of what conflicts", "severity": "high|medium|low"}
- If no real contradiction:
  {"contradiction": false}`;

  const response = await callTextPrompt(aiConfig, prompt, undefined, {
    temperature: 0.1,
    maxTokens: 300,
  });

  if (!response) {
    return null;
  }

  try {
    const parsed = JSON.parse(stripJsonFence(response)) as {
      contradiction?: boolean;
      topic?: string;
      description?: string;
      severity?: string;
    };

    if (!parsed.contradiction) {
      return null;
    }

    return {
      topic: parsed.topic || "Unknown topic",
      description: parsed.description || "Potential contradiction detected",
      severity: parsed.severity || "medium",
    };
  } catch {
    return null;
  }
}

function runKeywordContradictionScan(candidates: ContradictionCandidate[]) {
  const contradictions: Array<Omit<ContradictionResult, "id" | "detectedAt">> = [];

  for (const candidate of candidates) {
    const left = candidate.aContent.toLowerCase();
    const right = candidate.bContent.toLowerCase();

    for (const [positive, negative] of CONTRADICTION_SIGNALS) {
      if (
        (left.includes(positive) && right.includes(negative))
        || (left.includes(negative) && right.includes(positive))
      ) {
        contradictions.push({
          topic: extractBridgeConcept(candidate.aContent, candidate.bContent),
          description: `Potential tension: one mentions "${positive}" while the other mentions "${negative}"`,
          memoryA: {
            id: candidate.aId,
            content: candidate.aContent,
            source: candidate.aSource,
            sourceTitle: candidate.aTitle,
            createdAt: candidate.aCreated,
          },
          memoryB: {
            id: candidate.bId,
            content: candidate.bContent,
            source: candidate.bSource,
            sourceTitle: candidate.bTitle,
            createdAt: candidate.bCreated,
          },
        });
        break;
      }
    }

    if (contradictions.length >= 15) {
      break;
    }
  }

  return {
    contradictions,
    count: contradictions.length,
    scanned: candidates.length,
    aiPowered: false,
    message: contradictions.length > 0
      ? `Found ${contradictions.length} potential contradiction${contradictions.length > 1 ? "s" : ""} using keyword analysis. Connect an AI provider for deeper analysis.`
      : "No contradictions detected via keyword analysis. Connect an AI provider for deeper analysis.",
  };
}

function stripJsonFence(value: string) {
  return value.trim().replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
}

function toNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function toIsoString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  return null;
}
