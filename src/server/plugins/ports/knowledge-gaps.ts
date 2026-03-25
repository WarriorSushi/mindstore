/**
 * Knowledge Gaps Analyzer — Portable logic module
 * 
 * Extracted from the route for convergence with codex runtime.
 * Handles: gap detection (sparse, bridge, stale, single-source, isolated),
 * coverage mapping, AI suggestion prompts. Uses shared-vectors for clustering.
 * 
 * Core gap detection is algorithmic. AI suggestions are optional.
 */

import {
  type ClusterMember,
  type Cluster,
  kMeansClustering,
  cosineSimilarity,
  computeCoherence,
  extractKeywords,
  extractTopicLabel,
  countSourceTypes,
  getDensityLevel,
} from './shared-vectors';

// ─── Types ────────────────────────────────────────────────────

export interface KnowledgeGapMemory extends ClusterMember {
  id: string;
  content: string;
  embedding: number[];
  sourceType: string;
  sourceTitle: string;
  createdAt: string;
}

export interface KnowledgeTopic {
  id: string;
  label: string;
  keywords: string[];
  memoryCount: number;
  coherence: number;
  density: 'deep' | 'moderate' | 'thin' | 'sparse';
  sourceTypes: Record<string, number>;
  avgAge: number;
  recentActivity: boolean;
  previewMemories: { id: string; title: string; preview: string; sourceType: string }[];
}

export interface KnowledgeGap {
  id: string;
  type: 'sparse-topic' | 'bridge-gap' | 'stale-knowledge' | 'single-source' | 'isolated-topic';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  relatedTopics: string[];
  suggestion: string;
}

export interface CoverageMapEntry {
  id: string;
  label: string;
  size: number;
  proportion: number;
  coherence: number;
  density: string;
  hasGap: boolean;
  gapTypes: string[];
}

export interface KnowledgeGapsResult {
  topics: KnowledgeTopic[];
  gaps: KnowledgeGap[];
  coverageMap: CoverageMapEntry[];
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
  };
}

// ─── Main Analysis Pipeline ──────────────────────────────────

export function analyzeKnowledgeGaps(
  memories: KnowledgeGapMemory[],
  maxTopics = 12,
): KnowledgeGapsResult {
  if (memories.length < 5) {
    return {
      topics: [], gaps: [], coverageMap: [],
      stats: { totalMemories: memories.length, topicCount: 0, gapCount: 0, overallCoverage: 0, deepTopics: 0, moderateTopics: 0, thinTopics: 0, sparseTopics: 0, staleTopics: 0, avgCoherence: 0 },
    };
  }

  const numClusters = Math.min(maxTopics, Math.max(3, Math.floor(memories.length / 4)));
  const clusters = kMeansClustering(memories, numClusters, 20);
  const now = Date.now();

  // Build topics
  const topics: KnowledgeTopic[] = [];
  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i]!;
    if (cluster.members.length === 0) continue;

    const coherence = computeCoherence(cluster.centroid, cluster.members);
    const ages = cluster.members.map(m => (now - new Date(m.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const avgAge = ages.reduce((a, b) => a + b, 0) / ages.length;

    topics.push({
      id: `topic-${i}`,
      label: extractTopicLabel(cluster.members),
      keywords: extractKeywords(cluster.members, 5),
      memoryCount: cluster.members.length,
      coherence,
      density: getDensityLevel(cluster.members.length, memories.length, coherence),
      sourceTypes: countSourceTypes(cluster.members),
      avgAge,
      recentActivity: ages.some(a => a < 30),
      previewMemories: cluster.members.slice(0, 5).map(m => ({
        id: m.id, title: m.sourceTitle,
        preview: m.content.slice(0, 120).trim(),
        sourceType: m.sourceType,
      })),
    });
  }

  topics.sort((a, b) => b.memoryCount - a.memoryCount);

  // Detect gaps
  const gaps: KnowledgeGap[] = [];

  // 1. Sparse topics
  for (const topic of topics) {
    if (topic.density === 'sparse') {
      gaps.push({
        id: `gap-sparse-${topic.id}`, type: 'sparse-topic', severity: 'medium',
        title: `Thin coverage: ${topic.label}`,
        description: `Only ${topic.memoryCount} ${topic.memoryCount === 1 ? 'memory' : 'memories'} about "${topic.label}" — needs more depth.`,
        relatedTopics: [topic.id],
        suggestion: `Import more content about ${topic.keywords.slice(0, 3).join(', ')}.`,
      });
    }
  }

  // 2. Bridge gaps
  gaps.push(...findBridgeGaps(clusters, topics));

  // 3. Stale knowledge
  for (const topic of topics) {
    if (!topic.recentActivity && topic.avgAge > 60) {
      gaps.push({
        id: `gap-stale-${topic.id}`, type: 'stale-knowledge', severity: 'low',
        title: `Stale: ${topic.label}`,
        description: `"${topic.label}" hasn't been updated in ${Math.round(topic.avgAge)} days.`,
        relatedTopics: [topic.id],
        suggestion: `Revisit this topic. Has anything changed?`,
      });
    }
  }

  // 4. Single-source topics
  for (const topic of topics) {
    const sourceKeys = Object.keys(topic.sourceTypes);
    if (sourceKeys.length === 1 && topic.memoryCount >= 3) {
      const srcLabel = SOURCE_LABELS[sourceKeys[0]!] || sourceKeys[0]!;
      gaps.push({
        id: `gap-source-${topic.id}`, type: 'single-source', severity: 'low',
        title: `One perspective: ${topic.label}`,
        description: `All ${topic.memoryCount} memories come from ${srcLabel}. Diverse sources create stronger understanding.`,
        relatedTopics: [topic.id],
        suggestion: `Find different perspectives on ${topic.keywords[0] || topic.label}.`,
      });
    }
  }

  // 5. Isolated topics
  gaps.push(...findIsolatedTopics(clusters, topics));

  // Sort by severity
  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  gaps.sort((a, b) => (severityOrder[a.severity] ?? 1) - (severityOrder[b.severity] ?? 1));

  // Coverage map
  const totalMemories = memories.length;
  const coverageMap: CoverageMapEntry[] = topics.map(t => ({
    id: t.id, label: t.label, size: t.memoryCount,
    proportion: t.memoryCount / totalMemories,
    coherence: t.coherence, density: t.density,
    hasGap: gaps.some(g => g.relatedTopics.includes(t.id)),
    gapTypes: gaps.filter(g => g.relatedTopics.includes(t.id)).map(g => g.type),
  }));

  const deepTopics = topics.filter(t => t.density === 'deep').length;

  return {
    topics, gaps, coverageMap,
    stats: {
      totalMemories, topicCount: topics.length, gapCount: gaps.length,
      overallCoverage: Math.round((deepTopics / Math.max(topics.length, 1)) * 100),
      deepTopics,
      moderateTopics: topics.filter(t => t.density === 'moderate').length,
      thinTopics: topics.filter(t => t.density === 'thin').length,
      sparseTopics: topics.filter(t => t.density === 'sparse').length,
      staleTopics: topics.filter(t => !t.recentActivity).length,
      avgCoherence: Math.round((topics.reduce((a, t) => a + t.coherence, 0) / Math.max(topics.length, 1)) * 100) / 100,
    },
  };
}

// ─── Bridge Gap Detection ─────────────────────────────────────

function findBridgeGaps<T extends ClusterMember>(clusters: Cluster<T>[], topics: KnowledgeTopic[]): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];

  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const sim = cosineSimilarity(clusters[i]!.centroid, clusters[j]!.centroid);
      if (sim >= 0.55 && sim <= 0.75) {
        const topicA = topics.find(t => t.id === `topic-${i}`);
        const topicB = topics.find(t => t.id === `topic-${j}`);
        if (!topicA || !topicB) continue;
        if (topicA.density === 'deep' && topicB.density === 'deep') continue;

        gaps.push({
          id: `gap-bridge-${i}-${j}`, type: 'bridge-gap', severity: 'high',
          title: `Missing bridge: ${topicA.label} ↔ ${topicB.label}`,
          description: `"${topicA.label}" and "${topicB.label}" are ${Math.round(sim * 100)}% similar but lack connecting knowledge.`,
          relatedTopics: [topicA.id, topicB.id],
          suggestion: `Explore how ${topicA.keywords[0] || topicA.label} connects to ${topicB.keywords[0] || topicB.label}.`,
        });
      }
    }
  }

  return gaps.slice(0, 5);
}

// ─── Isolated Topic Detection ─────────────────────────────────

function findIsolatedTopics<T extends ClusterMember>(clusters: Cluster<T>[], topics: KnowledgeTopic[]): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];

  for (let i = 0; i < clusters.length; i++) {
    const sims = clusters
      .filter((_, j) => j !== i)
      .map(c => cosineSimilarity(clusters[i]!.centroid, c.centroid));

    if (sims.length === 0) continue;
    const maxSim = Math.max(...sims);
    const avgSim = sims.reduce((a, b) => a + b, 0) / sims.length;

    if (maxSim < 0.45 && avgSim < 0.35) {
      const topic = topics.find(t => t.id === `topic-${i}`);
      if (!topic) continue;

      gaps.push({
        id: `gap-isolated-${topic.id}`, type: 'isolated-topic', severity: 'medium',
        title: `Island: ${topic.label}`,
        description: `"${topic.label}" is isolated from your other knowledge areas.`,
        relatedTopics: [topic.id],
        suggestion: `Write about how ${topic.keywords[0] || topic.label} relates to your other interests.`,
      });
    }
  }

  return gaps;
}

// ─── AI Suggestion Prompt ─────────────────────────────────────

export function buildSuggestionPrompt(topics: KnowledgeTopic[], gaps: KnowledgeGap[]): string {
  const topicSummary = topics.map(t => `- ${t.label} (${t.memoryCount} memories, ${t.density} coverage)`).join('\n');
  const gapSummary = gaps.slice(0, 5).map(g => `- ${g.title}`).join('\n');

  return `Based on this person's knowledge topics and gaps, suggest 5 specific adjacent topics they should explore to strengthen their understanding. Return ONLY a JSON array.

Current knowledge topics:
${topicSummary}

Identified gaps:
${gapSummary}

Return format: [{"topic": "specific topic name", "reason": "why this would help", "relatedTo": "which existing topic it connects to"}]
Return ONLY the JSON array, no markdown fences.`;
}

// ─── Constants ────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT', file: 'files', url: 'URLs', text: 'notes',
  kindle: 'Kindle', obsidian: 'Obsidian', reddit: 'Reddit', document: 'documents',
};
