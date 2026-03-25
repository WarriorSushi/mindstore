import { eq, sql } from "drizzle-orm";
import { callTextPrompt, getTextGenerationConfig } from "@/server/ai-client";
import { db, schema } from "@/server/db";
import { PLUGIN_MANIFESTS } from "@/server/plugins/registry";
import {
  countSourceTypes,
  cosineSimilarity,
  extractKeywords,
  extractTopicLabel,
  kMeansClustering,
  parseEmbedding,
} from "@/server/plugins/ports/shared-vectors";

const PLUGIN_SLUG = "knowledge-gaps";

type GapType = "sparse-topic" | "bridge-gap" | "stale-knowledge" | "single-source" | "isolated-topic";
type GapSeverity = "high" | "medium" | "low";
type DensityLevel = "deep" | "moderate" | "thin" | "sparse";

interface EmbeddedMemory {
  id: string;
  content: string;
  sourceType: string;
  sourceTitle: string;
  embedding: number[];
  createdAt: string;
}

export interface KnowledgeTopic {
  id: string;
  label: string;
  keywords: string[];
  memoryCount: number;
  coherence: number;
  density: DensityLevel;
  sourceTypes: Record<string, number>;
  avgAge: number;
  recentActivity: boolean;
  previewMemories: Array<{ id: string; title: string; preview: string; sourceType: string }>;
}

export interface KnowledgeGap {
  id: string;
  type: GapType;
  severity: GapSeverity;
  title: string;
  description: string;
  relatedTopics: string[];
  suggestion: string;
}

export interface CoverageItem {
  id: string;
  label: string;
  size: number;
  proportion: number;
  coherence: number;
  density: DensityLevel;
  hasGap: boolean;
  gapTypes: GapType[];
}

export interface KnowledgeSuggestion {
  topic: string;
  reason: string;
  relatedTo: string;
}

export interface KnowledgeGapsResponse {
  topics: KnowledgeTopic[];
  gaps: KnowledgeGap[];
  coverageMap: CoverageItem[];
  stats: {
    totalMemories: number;
    topicCount: number;
    gapCount: number;
    overallCoverage: number;
    deepTopics: number;
    moderateTopics: number;
    thinTopics: number;
    sparseTopics: number;
    staleTopics: number;
    avgCoherence: number;
    insufficientData?: boolean;
  };
  suggestions: KnowledgeSuggestion[];
}

export async function ensureKnowledgeGapsInstalled() {
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
      pages: manifest.ui?.pages || [],
    },
  });
}

export async function analyzeKnowledgeGaps(
  userId: string,
  input: { action?: "analyze" | "suggest"; maxTopics?: number } = {},
): Promise<KnowledgeGapsResponse> {
  const action = input.action || "analyze";
  const maxTopics = Math.min(input.maxTopics || 12, 20);
  const rows = await db.execute(sql`
    SELECT id, content, source_type, source_title, embedding, created_at
    FROM memories
    WHERE user_id = ${userId}::uuid AND embedding IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 500
  `) as unknown as Array<Record<string, unknown>>;

  const memories: EmbeddedMemory[] = rows
    .map((row) => ({
      id: String(row.id),
      content: String(row.content || ""),
      sourceType: String(row.source_type || "unknown"),
      sourceTitle: typeof row.source_title === "string" ? row.source_title : "Untitled",
      embedding: parseEmbedding(row.embedding),
      createdAt: normalizeDate(row.created_at),
    }))
    .filter((memory) => memory.embedding.length > 0);

  if (memories.length < 5) {
    return {
      topics: [],
      gaps: [],
      coverageMap: [],
      stats: {
        totalMemories: memories.length,
        topicCount: 0,
        gapCount: 0,
        overallCoverage: 0,
        deepTopics: 0,
        moderateTopics: 0,
        thinTopics: 0,
        sparseTopics: 0,
        staleTopics: 0,
        avgCoherence: 0,
        insufficientData: true,
      },
      suggestions: [],
    };
  }

  const clusterCount = Math.min(maxTopics, Math.max(3, Math.floor(memories.length / 4)));
  const clusters = kMeansClustering(memories, clusterCount, 20);
  const now = Date.now();

  const topics = clusters
    .map((cluster, index) => {
      const keywords = extractKeywords(cluster.members, 5);
      const ages = cluster.members.map((memory) => (now - new Date(memory.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      const avgAge = ages.reduce((sum, age) => sum + age, 0) / ages.length;

      return {
        id: `topic-${index}`,
        label: extractTopicLabel(cluster.members),
        keywords,
        memoryCount: cluster.members.length,
        coherence: cluster.coherence,
        density: getDensityLevel(cluster.members.length, memories.length, cluster.coherence),
        sourceTypes: countSourceTypes(cluster.members),
        avgAge,
        recentActivity: ages.some((age) => age < 30),
        previewMemories: cluster.members.slice(0, 5).map((memory) => ({
          id: memory.id,
          title: memory.sourceTitle,
          preview: memory.content.slice(0, 120).trim(),
          sourceType: memory.sourceType,
        })),
      };
    })
    .sort((left, right) => right.memoryCount - left.memoryCount);

  const gaps: KnowledgeGap[] = [];

  for (const topic of topics) {
    if (topic.density === "sparse") {
      gaps.push({
        id: `gap-sparse-${topic.id}`,
        type: "sparse-topic",
        severity: "medium",
        title: `Thin coverage: ${topic.label}`,
        description: `You only have ${topic.memoryCount} ${topic.memoryCount === 1 ? "memory" : "memories"} about "${topic.label}".`,
        relatedTopics: [topic.id],
        suggestion: `Import more material about ${topic.keywords.slice(0, 3).join(", ") || topic.label} to deepen this area.`,
      });
    }
  }

  gaps.push(...findBridgeGaps(clusters, topics));

  for (const topic of topics) {
    if (!topic.recentActivity && topic.avgAge > 60) {
      gaps.push({
        id: `gap-stale-${topic.id}`,
        type: "stale-knowledge",
        severity: "low",
        title: `Stale: ${topic.label}`,
        description: `This topic has not been refreshed in about ${Math.round(topic.avgAge)} days.`,
        relatedTopics: [topic.id],
        suggestion: `Revisit ${topic.label} and update it with fresher notes, links, or ideas.`,
      });
    }

    const sourceKeys = Object.keys(topic.sourceTypes);
    if (sourceKeys.length === 1 && topic.memoryCount >= 3) {
      gaps.push({
        id: `gap-source-${topic.id}`,
        type: "single-source",
        severity: "low",
        title: `One perspective: ${topic.label}`,
        description: `This topic is mostly built from one source type: ${sourceKeys[0]}.`,
        relatedTopics: [topic.id],
        suggestion: `Add another source type so your understanding of ${topic.label} is less one-dimensional.`,
      });
    }
  }

  gaps.push(...findIsolatedTopics(clusters, topics));

  const severityOrder: Record<GapSeverity, number> = { high: 0, medium: 1, low: 2 };
  gaps.sort((left, right) => severityOrder[left.severity] - severityOrder[right.severity]);

  const coverageMap = topics.map((topic) => ({
    id: topic.id,
    label: topic.label,
    size: topic.memoryCount,
    proportion: topic.memoryCount / memories.length,
    coherence: topic.coherence,
    density: topic.density,
    hasGap: gaps.some((gap) => gap.relatedTopics.includes(topic.id)),
    gapTypes: gaps.filter((gap) => gap.relatedTopics.includes(topic.id)).map((gap) => gap.type),
  }));

  const suggestions = action === "suggest"
    ? await generateSuggestions(topics, gaps)
    : [];

  const deepTopics = topics.filter((topic) => topic.density === "deep").length;

  return {
    topics,
    gaps,
    coverageMap,
    stats: {
      totalMemories: memories.length,
      topicCount: topics.length,
      gapCount: gaps.length,
      overallCoverage: Math.round((deepTopics / Math.max(1, topics.length)) * 100),
      deepTopics,
      moderateTopics: topics.filter((topic) => topic.density === "moderate").length,
      thinTopics: topics.filter((topic) => topic.density === "thin").length,
      sparseTopics: topics.filter((topic) => topic.density === "sparse").length,
      staleTopics: topics.filter((topic) => !topic.recentActivity).length,
      avgCoherence: round(topics.reduce((sum, topic) => sum + topic.coherence, 0) / Math.max(1, topics.length), 2),
    },
    suggestions,
  };
}

export function getDensityLevel(clusterSize: number, totalMemories: number, coherence: number): DensityLevel {
  const proportion = clusterSize / totalMemories;
  if (clusterSize >= 10 && proportion >= 0.08 && coherence >= 0.7) return "deep";
  if (clusterSize >= 5 && proportion >= 0.04) return "moderate";
  if (clusterSize >= 3) return "thin";
  return "sparse";
}

export function findBridgeGaps(
  clusters: Array<{ centroid: number[] }>,
  topics: KnowledgeTopic[],
): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];

  for (let leftIndex = 0; leftIndex < clusters.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < clusters.length; rightIndex += 1) {
      const similarity = cosineSimilarity(clusters[leftIndex]?.centroid || [], clusters[rightIndex]?.centroid || []);
      if (similarity < 0.55 || similarity > 0.75) {
        continue;
      }

      const leftTopic = topics.find((topic) => topic.id === `topic-${leftIndex}`);
      const rightTopic = topics.find((topic) => topic.id === `topic-${rightIndex}`);
      if (!leftTopic || !rightTopic) {
        continue;
      }

      if (leftTopic.density === "deep" && rightTopic.density === "deep") {
        continue;
      }

      gaps.push({
        id: `gap-bridge-${leftIndex}-${rightIndex}`,
        type: "bridge-gap",
        severity: "high",
        title: `Missing bridge: ${leftTopic.label} ↔ ${rightTopic.label}`,
        description: `These topics are semantically close (${Math.round(similarity * 100)}% similar) but not well connected in your memory base.`,
        relatedTopics: [leftTopic.id, rightTopic.id],
        suggestion: `Look for articles, notes, or your own ideas that explicitly connect ${leftTopic.label} with ${rightTopic.label}.`,
      });
    }
  }

  return gaps.slice(0, 5);
}

export function findIsolatedTopics(
  clusters: Array<{ centroid: number[] }>,
  topics: KnowledgeTopic[],
): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];

  for (let index = 0; index < clusters.length; index += 1) {
    const similarities = clusters
      .filter((_, clusterIndex) => clusterIndex !== index)
      .map((cluster) => cosineSimilarity(clusters[index]?.centroid || [], cluster.centroid));

    if (!similarities.length) {
      continue;
    }

    const maxSimilarity = Math.max(...similarities);
    const avgSimilarity = similarities.reduce((sum, value) => sum + value, 0) / similarities.length;
    if (maxSimilarity >= 0.45 || avgSimilarity >= 0.35) {
      continue;
    }

    const topic = topics.find((entry) => entry.id === `topic-${index}`);
    if (!topic) {
      continue;
    }

    gaps.push({
      id: `gap-isolated-${topic.id}`,
      type: "isolated-topic",
      severity: "medium",
      title: `Island: ${topic.label}`,
      description: `This topic sits far away from your other knowledge areas and lacks supporting connections.`,
      relatedTopics: [topic.id],
      suggestion: `Try relating ${topic.label} to your other interests or importing material that bridges it to adjacent fields.`,
    });
  }

  return gaps;
}

async function generateSuggestions(topics: KnowledgeTopic[], gaps: KnowledgeGap[]) {
  const config = await getTextGenerationConfig({
    openai: "gpt-4o-mini",
    openrouter: "anthropic/claude-3.5-haiku",
    gemini: "gemini-2.0-flash-lite",
    ollama: "llama3.2",
    custom: "default",
  });

  if (!config) {
    return [];
  }

  const topicSummary = topics.map((topic) => `- ${topic.label} (${topic.memoryCount} memories, ${topic.density} coverage)`).join("\n");
  const gapSummary = gaps.slice(0, 5).map((gap) => `- ${gap.title}`).join("\n");
  const prompt = `Based on this person's knowledge topics and gaps, suggest 5 specific adjacent topics they should explore. Return only valid JSON.

Current knowledge topics:
${topicSummary}

Current gaps:
${gapSummary}

Return format:
[{"topic":"specific topic","reason":"why it would help","relatedTo":"existing topic"}]`;

  const response = await callTextPrompt(config, prompt, undefined, {
    temperature: 0.6,
    maxTokens: 700,
  });

  if (!response) {
    return [];
  }

  try {
    const parsed = JSON.parse(stripJsonFence(response)) as KnowledgeSuggestion[];
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function stripJsonFence(value: string) {
  return value.trim().replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
}

function normalizeDate(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
