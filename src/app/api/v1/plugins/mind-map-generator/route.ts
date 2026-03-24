import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/server/db';
import { sql, eq } from 'drizzle-orm';

/**
 * GET /api/v1/plugins/mind-map-generator
 * 
 * Generates a hierarchical mind map from the user's memories.
 * Uses embedding-based clustering to group memories into topics,
 * then builds a tree structure: Root → Topics → Subtopics → Memories
 * 
 * Query params:
 *   ?maxTopics=12    — max number of top-level topics (default 12)
 *   ?maxDepth=3      — max tree depth (default 3)
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const maxTopics = Math.min(parseInt(searchParams.get('maxTopics') || '12'), 20);
    const maxDepth = Math.min(parseInt(searchParams.get('maxDepth') || '3'), 4);

    // Auto-install plugin on first use
    await autoInstallPlugin();

    // ─── Fetch all memories with embeddings ────────────────────
    const memoriesResult = await db.execute(sql`
      SELECT id, content, source_type, source_title, embedding, created_at,
             metadata
      FROM memories
      WHERE user_id = ${userId}::uuid AND embedding IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 500
    `);
    const memories = (memoriesResult as any[]).map(m => ({
      id: m.id,
      content: m.content,
      sourceType: m.source_type,
      sourceTitle: m.source_title || 'Untitled',
      embedding: parseEmbedding(m.embedding),
      createdAt: m.created_at,
      pinned: !!(m.metadata && (m.metadata as any).pinned),
      metadata: m.metadata || {},
    })).filter(m => m.embedding && m.embedding.length > 0);

    if (memories.length === 0) {
      return NextResponse.json({
        tree: { id: 'root', label: 'Your Mind', children: [], memoryCount: 0 },
        stats: { totalMemories: 0, topicCount: 0, maxDepth: 0, avgTopicSize: 0 },
      });
    }

    // ─── K-Means-like clustering ───────────────────────────────
    const numClusters = Math.min(maxTopics, Math.max(3, Math.floor(memories.length / 5)));
    const clusters = kMeansClustering(memories, numClusters, 15);

    // ─── Build hierarchical tree ───────────────────────────────
    const topicNodes: TopicNode[] = [];

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      if (cluster.members.length === 0) continue;

      // Extract topic label from cluster content
      const topicLabel = extractTopicLabel(cluster.members);
      const topicKeywords = extractKeywords(cluster.members, 5);

      // Sub-cluster if large enough and depth allows
      let children: TopicNode[] = [];
      if (cluster.members.length >= 6 && maxDepth >= 2) {
        const subClusters = kMeansClustering(cluster.members, Math.min(4, Math.floor(cluster.members.length / 3)), 10);
        for (const sub of subClusters) {
          if (sub.members.length === 0) continue;
          const subLabel = extractTopicLabel(sub.members);
          const subKeywords = extractKeywords(sub.members, 3);
          children.push({
            id: `sub-${i}-${children.length}`,
            label: subLabel,
            keywords: subKeywords,
            memoryCount: sub.members.length,
            memories: sub.members.slice(0, 8).map(simplifyMemory),
            children: [],
            sourceTypes: countSourceTypes(sub.members),
            coherence: sub.coherence,
          });
        }
      }

      topicNodes.push({
        id: `topic-${i}`,
        label: topicLabel,
        keywords: topicKeywords,
        memoryCount: cluster.members.length,
        memories: children.length > 0
          ? [] // Memories are in sub-topics
          : cluster.members.slice(0, 8).map(simplifyMemory),
        children,
        sourceTypes: countSourceTypes(cluster.members),
        coherence: cluster.coherence,
      });
    }

    // Sort topics by size (largest first)
    topicNodes.sort((a, b) => b.memoryCount - a.memoryCount);

    // ─── Cross-topic connections ───────────────────────────────
    const connections: CrossConnection[] = [];
    for (let i = 0; i < topicNodes.length; i++) {
      for (let j = i + 1; j < topicNodes.length; j++) {
        const sim = clusterSimilarity(clusters[i], clusters[j]);
        if (sim > 0.6) {
          connections.push({
            source: topicNodes[i].id,
            target: topicNodes[j].id,
            strength: sim,
          });
        }
      }
    }
    connections.sort((a, b) => b.strength - a.strength);

    // ─── Build root tree ───────────────────────────────────────
    const tree: MindMapTree = {
      id: 'root',
      label: 'Your Mind',
      memoryCount: memories.length,
      children: topicNodes,
    };

    // ─── Stats ─────────────────────────────────────────────────
    const stats = {
      totalMemories: memories.length,
      topicCount: topicNodes.length,
      subTopicCount: topicNodes.reduce((sum, t) => sum + t.children.length, 0),
      maxDepth: topicNodes.some(t => t.children.length > 0) ? 2 : 1,
      avgTopicSize: Math.round(memories.length / topicNodes.length),
      largestTopic: topicNodes[0]?.label || '',
      largestTopicSize: topicNodes[0]?.memoryCount || 0,
      connectionCount: connections.length,
    };

    return NextResponse.json({ tree, connections, stats });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Mind map generation error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── Types ──────────────────────────────────────────────────────────

interface Memory {
  id: string;
  content: string;
  sourceType: string;
  sourceTitle: string;
  embedding: number[];
  createdAt: string;
  pinned: boolean;
  metadata: Record<string, unknown>;
}

interface TopicNode {
  id: string;
  label: string;
  keywords: string[];
  memoryCount: number;
  memories: SimplifiedMemory[];
  children: TopicNode[];
  sourceTypes: Record<string, number>;
  coherence: number;
}

interface SimplifiedMemory {
  id: string;
  title: string;
  preview: string;
  sourceType: string;
  sourceTitle: string;
  pinned: boolean;
}

interface MindMapTree {
  id: string;
  label: string;
  memoryCount: number;
  children: TopicNode[];
}

interface CrossConnection {
  source: string;
  target: string;
  strength: number;
}

interface Cluster {
  centroid: number[];
  members: Memory[];
  coherence: number;
}

// ─── Embedding Utilities ────────────────────────────────────────────

function parseEmbedding(raw: unknown): number[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      // pgvector format: "[0.1,0.2,...]"
      const cleaned = raw.replace(/^\[|\]$/g, '');
      return cleaned.split(',').map(Number);
    } catch { return []; }
  }
  return [];
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function vectorAdd(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + (b[i] || 0));
}

function vectorScale(v: number[], s: number): number[] {
  return v.map(x => x * s);
}

// ─── K-Means Clustering ────────────────────────────────────────────

function kMeansClustering(memories: Memory[], k: number, maxIter: number): Cluster[] {
  if (memories.length <= k) {
    // Each memory is its own cluster
    return memories.map(m => ({
      centroid: m.embedding,
      members: [m],
      coherence: 1,
    }));
  }

  const dim = memories[0].embedding.length;

  // Initialize centroids using k-means++ strategy
  const centroids: number[][] = [];
  centroids.push([...memories[Math.floor(Math.random() * memories.length)].embedding]);

  for (let c = 1; c < k; c++) {
    // Compute distances to nearest centroid
    const distances = memories.map(m => {
      const minDist = centroids.reduce((min, cent) => {
        const d = 1 - cosineSimilarity(m.embedding, cent);
        return Math.min(min, d);
      }, Infinity);
      return minDist * minDist; // Square for probability weighting
    });

    const totalDist = distances.reduce((a, b) => a + b, 0);
    if (totalDist === 0) break;

    // Weighted random selection
    let r = Math.random() * totalDist;
    for (let i = 0; i < distances.length; i++) {
      r -= distances[i];
      if (r <= 0) {
        centroids.push([...memories[i].embedding]);
        break;
      }
    }
  }

  // Iterate
  let assignments = new Array(memories.length).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign each memory to nearest centroid
    const newAssignments = memories.map(m => {
      let bestCluster = 0;
      let bestSim = -Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const sim = cosineSimilarity(m.embedding, centroids[c]);
        if (sim > bestSim) {
          bestSim = sim;
          bestCluster = c;
        }
      }
      return bestCluster;
    });

    // Check convergence
    const changed = newAssignments.some((a, i) => a !== assignments[i]);
    assignments = newAssignments;
    if (!changed) break;

    // Update centroids
    for (let c = 0; c < centroids.length; c++) {
      const members = memories.filter((_, i) => assignments[i] === c);
      if (members.length === 0) continue;

      const sum = members.reduce(
        (acc, m) => vectorAdd(acc, m.embedding),
        new Array(dim).fill(0)
      );
      centroids[c] = vectorScale(sum, 1 / members.length);
    }
  }

  // Build cluster objects
  const clusters: Cluster[] = centroids.map((centroid, c) => {
    const members = memories.filter((_, i) => assignments[i] === c);
    
    // Calculate coherence (average similarity to centroid)
    const coherence = members.length > 0
      ? members.reduce((sum, m) => sum + cosineSimilarity(m.embedding, centroid), 0) / members.length
      : 0;

    return { centroid, members, coherence };
  });

  return clusters.filter(c => c.members.length > 0);
}

function clusterSimilarity(a: Cluster, b: Cluster): number {
  return cosineSimilarity(a.centroid, b.centroid);
}

// ─── Topic Label Extraction ─────────────────────────────────────────

// Common stop words to filter out
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'not', 'no', 'nor',
  'so', 'if', 'then', 'than', 'too', 'very', 'just', 'about', 'also',
  'more', 'some', 'any', 'each', 'every', 'all', 'both', 'few', 'most',
  'other', 'into', 'over', 'such', 'after', 'before', 'between', 'under',
  'again', 'there', 'here', 'when', 'where', 'why', 'how', 'what', 'which',
  'who', 'whom', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we',
  'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its',
  'they', 'them', 'their', 'up', 'out', 'one', 'two', 'get', 'got',
  'like', 'make', 'made', 'use', 'used', 'using', 'new', 'way', 'want',
  'know', 'think', 'see', 'said', 'say', 'need', 'well', 'back', 'much',
  'even', 'many', 'let', 'still', 'take', 'look', 'come', 'go', 'good',
  'give', 'going', 'right', 'sure', 'really', 'thing', 'things', 'don',
  'people', 'time', 'work', 'actually', 'something', 'first', 'long',
  'example', 'different', 'help', 'same', 'part', 'able', 'based',
  'always', 'never', 'yes', 'however', 'though', 'since', 'without',
  'only', 'already', 'while', 'through', 'because', 'rather', 'another',
  'ask', 'told', 'tell', 'point', 'set', 'keep', 'kind', 'start',
  'trying', 'try', 'put', 'lot', 'mean', 'end', 'own', 'called',
  'does', 'doesn', 'didn', 'isn', 'aren', 'wasn', 'weren', 'won',
  'couldn', 'shouldn', 'wouldn', 'haven', 'hasn', 'hadn',
]);

function extractKeywords(memories: Memory[], count: number): string[] {
  const wordFreq = new Map<string, number>();

  for (const mem of memories) {
    const words = mem.content
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

    const unique = new Set(words); // Count each word once per memory
    for (const word of unique) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
  }

  // Get words that appear in multiple memories (not just one)
  const candidates = [...wordFreq.entries()]
    .filter(([_, freq]) => freq >= Math.max(2, memories.length * 0.15))
    .sort((a, b) => b[1] - a[1]);

  return candidates.slice(0, count).map(([word]) => word);
}

function extractTopicLabel(memories: Memory[]): string {
  // Strategy 1: Check if memories share a source title
  const sourceCounts = new Map<string, number>();
  for (const m of memories) {
    const title = m.sourceTitle;
    if (title && title !== 'Untitled') {
      sourceCounts.set(title, (sourceCounts.get(title) || 0) + 1);
    }
  }
  
  // If >60% from same source, use that
  const dominant = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (dominant && dominant[1] > memories.length * 0.6) {
    return truncateLabel(dominant[0], 30);
  }

  // Strategy 2: Extract most distinctive keywords
  const keywords = extractKeywords(memories, 3);
  if (keywords.length >= 2) {
    return capitalize(keywords.slice(0, 2).join(' & '));
  }
  if (keywords.length === 1) {
    return capitalize(keywords[0]);
  }

  // Strategy 3: Fallback to first memory's content
  const first = memories[0];
  const firstLine = first.content.split('\n')[0].trim();
  return truncateLabel(firstLine, 30);
}

function truncateLabel(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trim() + '…';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Helpers ────────────────────────────────────────────────────────

function simplifyMemory(m: Memory): SimplifiedMemory {
  const firstLine = m.content.split('\n')[0].trim();
  return {
    id: m.id,
    title: m.sourceTitle || truncateLabel(firstLine, 40),
    preview: truncateLabel(m.content.replace(/\n/g, ' '), 120),
    sourceType: m.sourceType,
    sourceTitle: m.sourceTitle,
    pinned: m.pinned || false,
  };
}

function countSourceTypes(memories: Memory[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const m of memories) {
    counts[m.sourceType] = (counts[m.sourceType] || 0) + 1;
  }
  return counts;
}

async function autoInstallPlugin() {
  try {
    const existing = await db.select().from(schema.plugins).where(eq(schema.plugins.slug, 'mind-map-generator')).limit(1);
    if (existing.length === 0) {
      await db.insert(schema.plugins).values({
        slug: 'mind-map-generator',
        name: 'Mind Map Generator',
        version: '1.0.0',
        type: 'extension',
        status: 'active',
        config: {},
      });
    }
  } catch {
    // Plugin already exists or table not ready — ignore
  }
}
