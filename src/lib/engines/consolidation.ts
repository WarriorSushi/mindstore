/**
 * CONSOLIDATION ENGINE — The Brain of MindStore
 * 
 * Like how the brain consolidates memories during sleep:
 * 1. Scans all stored knowledge
 * 2. Finds unexpected connections between distant topics
 * 3. Detects contradictions in your own thinking
 * 4. Tracks how your beliefs evolve over time
 * 5. Generates insight reports
 * 
 * This is what makes MindStore not just a database, but a thinking partner.
 */

import { db, type Memory } from '../db';
import { cosineSimilarity } from '../search';
import { getEmbeddings, getApiKey } from '../openai';

export interface Connection {
  memoryA: Memory;
  memoryB: Memory;
  similarity: number;
  bridgeConcept: string;
  surprise: number; // how unexpected this connection is (0-1)
}

export interface Contradiction {
  memoryA: Memory;
  memoryB: Memory;
  topic: string;
  description: string;
  detectedAt: Date;
}

export interface InsightReport {
  id: string;
  generatedAt: Date;
  connections: Connection[];
  contradictions: Contradiction[];
  emergingThemes: string[];
  forgettingRisks: Memory[];
  knowledgeGrowth: {
    newThisWeek: number;
    totalChunks: number;
    topGrowthAreas: string[];
    neglectedAreas: string[];
  };
}

/**
 * Cross-Pollination: Find unexpected connections between distant knowledge clusters
 * 
 * Algorithm:
 * 1. Get all memories with embeddings
 * 2. For each pair from DIFFERENT sources/topics, compute similarity
 * 3. Filter for "surprising" connections — high similarity but from very different contexts
 * 4. Rank by surprise factor (similarity * context_distance)
 */
export async function findCrossConnections(limit = 20): Promise<Connection[]> {
  const memories = await db.memories.toArray();
  if (memories.length < 2) return [];

  const withEmbeddings = memories.filter(m => m.embedding?.length > 0);
  const connections: Connection[] = [];

  // Sample if too many (O(n²) is expensive)
  const sample = withEmbeddings.length > 200
    ? shuffleAndTake(withEmbeddings, 200)
    : withEmbeddings;

  for (let i = 0; i < sample.length; i++) {
    for (let j = i + 1; j < sample.length; j++) {
      const a = sample[i];
      const b = sample[j];

      // Skip same-source pairs (not surprising)
      if (a.sourceId === b.sourceId) continue;

      const similarity = cosineSimilarity(a.embedding, b.embedding);

      // We want high similarity from different contexts
      if (similarity > 0.65 && similarity < 0.95) {
        // Calculate "surprise" — how different the sources are
        const sourceDistance = a.source !== b.source ? 0.8 : 0.3;
        const timeDistance = Math.min(
          Math.abs(a.timestamp.getTime() - b.timestamp.getTime()) / (30 * 24 * 60 * 60 * 1000), // normalize to months
          1
        );
        const surprise = similarity * (sourceDistance + timeDistance) / 2;

        connections.push({
          memoryA: a,
          memoryB: b,
          similarity,
          bridgeConcept: extractBridgeConcept(a.content, b.content),
          surprise,
        });
      }
    }
  }

  return connections
    .sort((a, b) => b.surprise - a.surprise)
    .slice(0, limit);
}

/**
 * Contradiction Detector: Find places where your thinking conflicts
 */
export async function findContradictions(): Promise<Contradiction[]> {
  const memories = await db.memories.toArray();
  const withEmbeddings = memories.filter(m => m.embedding?.length > 0);
  const contradictions: Contradiction[] = [];

  // Look for high-similarity pairs that contain contradictory language
  const contradictionSignals = [
    ['always', 'never'],
    ['best', 'worst'],
    ['love', 'hate'],
    ['agree', 'disagree'],
    ['should', 'should not'],
    ['important', 'unimportant'],
    ['easy', 'difficult'],
    ['yes', 'no'],
    ['pro', 'con'],
    ['better', 'worse'],
  ];

  const sample = withEmbeddings.length > 150
    ? shuffleAndTake(withEmbeddings, 150)
    : withEmbeddings;

  for (let i = 0; i < sample.length; i++) {
    for (let j = i + 1; j < sample.length; j++) {
      const a = sample[i];
      const b = sample[j];
      const sim = cosineSimilarity(a.embedding, b.embedding);

      // High topical similarity
      if (sim > 0.7) {
        const aLower = a.content.toLowerCase();
        const bLower = b.content.toLowerCase();

        for (const [pos, neg] of contradictionSignals) {
          if (
            (aLower.includes(pos) && bLower.includes(neg)) ||
            (aLower.includes(neg) && bLower.includes(pos))
          ) {
            contradictions.push({
              memoryA: a,
              memoryB: b,
              topic: extractBridgeConcept(a.content, b.content),
              description: `Potential contradiction: one mentions "${pos}" while the other mentions "${neg}" on a similar topic`,
              detectedAt: new Date(),
            });
            break;
          }
        }
      }
    }
  }

  return contradictions;
}

/**
 * Forgetting Curve: Find knowledge at risk of being forgotten
 * Based on Ebbinghaus spaced repetition intervals
 */
export async function getForgettingRisks(limit = 20): Promise<(Memory & { urgency: number })[]> {
  const memories = await db.memories.toArray();
  const now = Date.now();

  return memories
    .map(m => {
      const daysSinceImport = (now - m.importedAt.getTime()) / (24 * 60 * 60 * 1000);
      
      // Ebbinghaus forgetting curve approximation
      // Retention = e^(-t/S) where S is stability
      // Higher urgency = more likely to be forgotten
      const stability = 7; // assume 7-day initial stability
      const retention = Math.exp(-daysSinceImport / stability);
      const urgency = 1 - retention;

      return { ...m, urgency };
    })
    .filter(m => m.urgency > 0.5) // more than 50% likely forgotten
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, limit);
}

/**
 * Mind Diff: Compare knowledge states between two time periods
 */
export async function getMindDiff(
  startDate: Date,
  endDate: Date = new Date()
): Promise<{
  newMemories: number;
  topNewTopics: string[];
  sourceBreakdown: Record<string, number>;
  growthRate: number; // memories per day
}> {
  const memories = await db.memories
    .where('importedAt')
    .between(startDate, endDate)
    .toArray();

  const sourceBreakdown: Record<string, number> = {};
  const topicCounts: Record<string, number> = {};

  for (const m of memories) {
    sourceBreakdown[m.source] = (sourceBreakdown[m.source] || 0) + 1;
    
    // Extract rough topic from first 50 chars
    const topic = m.sourceTitle || m.content.slice(0, 50);
    topicCounts[topic] = (topicCounts[topic] || 0) + 1;
  }

  const days = Math.max(1, (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

  return {
    newMemories: memories.length,
    topNewTopics: Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic]) => topic),
    sourceBreakdown,
    growthRate: memories.length / days,
  };
}

/**
 * Knowledge Metabolism Score
 * Measures how actively you're using your knowledge system
 */
export async function getMetabolismScore(): Promise<{
  score: number; // 0-10
  intake: number; // new items this week
  connections: number; // cross-connections found
  searchFrequency: number; // estimated searches per day
  verdict: string;
}> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const recentMemories = await db.memories
    .where('importedAt')
    .above(weekAgo)
    .count();

  const totalMemories = await db.memories.count();
  const connections = await findCrossConnections(5);

  // Scoring rubric
  const intakeScore = Math.min(recentMemories / 10, 3); // max 3 points for 10+ items/week
  const connectionScore = Math.min(connections.length / 3, 3); // max 3 points for connections
  const volumeScore = Math.min(totalMemories / 50, 2); // max 2 points for 50+ total
  const diversityScore = Math.min(
    (await db.sources.count()) / 3, 2
  ); // max 2 points for 3+ sources

  const score = Math.round((intakeScore + connectionScore + volumeScore + diversityScore) * 10) / 10;

  let verdict = '';
  if (score >= 8) verdict = 'Your mind is on fire. Knowledge flowing fast and connecting well.';
  else if (score >= 5) verdict = 'Solid knowledge metabolism. Keep feeding your mind.';
  else if (score >= 3) verdict = 'Your mind could use more fuel. Try importing more sources.';
  else verdict = 'Dormant. Time to wake up your knowledge base.';

  return {
    score: Math.min(score, 10),
    intake: recentMemories,
    connections: connections.length,
    searchFrequency: 0, // TODO: track searches
    verdict,
  };
}

/**
 * Generate Knowledge Fingerprint data for visualization
 * Returns nodes + edges for the knowledge graph
 */
export async function generateFingerprint(): Promise<{
  nodes: Array<{ id: string; label: string; size: number; group: string }>;
  edges: Array<{ id: string; source: string; target: string; weight: number }>;
  clusters: Array<{ name: string; size: number; color: string }>;
}> {
  const memories = await db.memories.toArray();
  const sources = await db.sources.toArray();

  // Create nodes from sources and high-importance memories
  const nodes: Array<{ id: string; label: string; size: number; group: string }> = [];
  const edges: Array<{ id: string; source: string; target: string; weight: number }> = [];

  // Source nodes (large)
  for (const source of sources) {
    nodes.push({
      id: `src-${source.id}`,
      label: source.title,
      size: Math.max(10, source.itemCount * 2),
      group: source.type,
    });
  }

  // Memory nodes (smaller, sampled)
  const sampledMemories = memories.length > 100
    ? shuffleAndTake(memories, 100)
    : memories;

  for (const mem of sampledMemories) {
    nodes.push({
      id: `mem-${mem.id}`,
      label: mem.sourceTitle || mem.content.slice(0, 30),
      size: 5,
      group: mem.source,
    });

    // Edge to source
    edges.push({
      id: `e-${mem.id}-src`,
      source: `mem-${mem.id}`,
      target: `src-${mem.sourceId}`,
      weight: 1,
    });
  }

  // Cross-edges between similar memories
  const withEmb = sampledMemories.filter(m => m.embedding?.length > 0);
  for (let i = 0; i < withEmb.length; i++) {
    for (let j = i + 1; j < Math.min(withEmb.length, i + 20); j++) {
      const sim = cosineSimilarity(withEmb[i].embedding, withEmb[j].embedding);
      if (sim > 0.75) {
        edges.push({
          id: `e-${withEmb[i].id}-${withEmb[j].id}`,
          source: `mem-${withEmb[i].id}`,
          target: `mem-${withEmb[j].id}`,
          weight: sim,
        });
      }
    }
  }

  // Cluster detection (simple: by source type)
  const clusterColors: Record<string, string> = {
    chatgpt: '#10b981',
    text: '#8b5cf6',
    file: '#f59e0b',
    url: '#3b82f6',
  };

  const clusters = sources.reduce((acc, s) => {
    const existing = acc.find(c => c.name === s.type);
    if (existing) {
      existing.size += s.itemCount;
    } else {
      acc.push({ name: s.type, size: s.itemCount, color: clusterColors[s.type] || '#6b7280' });
    }
    return acc;
  }, [] as Array<{ name: string; size: number; color: string }>);

  return { nodes, edges, clusters };
}

// Helpers

function shuffleAndTake<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}

function extractBridgeConcept(textA: string, textB: string): string {
  // Find common significant words between two texts
  const stopWords = new Set(['the', 'a', 'an', 'is', 'it', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but', 'not', 'with', 'this', 'that', 'from', 'by', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'i', 'you', 'he', 'she', 'we', 'they', 'my', 'your', 'his', 'her', 'our', 'their', 'me', 'him', 'us', 'them']);

  const wordsA = new Set(
    textA.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !stopWords.has(w))
  );
  const wordsB = new Set(
    textB.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !stopWords.has(w))
  );

  const common = [...wordsA].filter(w => wordsB.has(w));
  return common.slice(0, 3).join(', ') || 'related concepts';
}
