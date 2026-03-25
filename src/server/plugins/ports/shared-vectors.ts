/**
 * Shared Vector & Clustering Utilities — Portable module
 * 
 * Extracted from topic-evolution, knowledge-gaps, mind-map-generator, 
 * and smart-collections. These functions were duplicated 4+ times.
 * 
 * Zero external dependencies. Pure math.
 */

// ─── Types ────────────────────────────────────────────────────

export interface ClusterMember {
  id: string;
  content: string;
  embedding: number[];
  sourceType: string;
  sourceTitle: string;
  createdAt: string;
  [key: string]: unknown;
}

export interface Cluster<T extends ClusterMember = ClusterMember> {
  centroid: number[];
  members: T[];
  coherence: number;
}

// ─── Vector Operations ────────────────────────────────────────

export function parseEmbedding(raw: unknown): number[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const cleaned = raw.replace(/^\[|\]$/g, '');
      return cleaned.split(',').map(Number);
    } catch { return []; }
  }
  return [];
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function vectorAdd(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + (b[i] || 0));
}

export function vectorScale(v: number[], s: number): number[] {
  return v.map(x => x * s);
}

// ─── K-Means Clustering (k-means++ init) ──────────────────────

export function kMeansClustering<T extends ClusterMember>(
  items: T[],
  k: number,
  maxIter = 20,
): Cluster<T>[] {
  if (items.length === 0) return [];
  if (items.length <= k) {
    return items.map(m => ({
      centroid: m.embedding,
      members: [m],
      coherence: 1,
    }));
  }

  const dim = items[0]!.embedding.length;
  if (dim === 0) return [];

  // k-means++ initialization
  const centroids: number[][] = [];
  centroids.push([...items[Math.floor(Math.random() * items.length)]!.embedding]);

  for (let c = 1; c < k; c++) {
    const distances = items.map(m => {
      const minDist = centroids.reduce((min, cent) => {
        const d = 1 - cosineSimilarity(m.embedding, cent);
        return Math.min(min, d);
      }, Infinity);
      return minDist * minDist;
    });

    const totalDist = distances.reduce((a, b) => a + b, 0);
    if (totalDist === 0) break;

    let r = Math.random() * totalDist;
    for (let i = 0; i < distances.length; i++) {
      r -= distances[i]!;
      if (r <= 0) {
        centroids.push([...items[i]!.embedding]);
        break;
      }
    }
  }

  let assignments = new Array(items.length).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    const newAssignments = items.map(m => {
      let bestCluster = 0;
      let bestSim = -Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const sim = cosineSimilarity(m.embedding, centroids[c]!);
        if (sim > bestSim) {
          bestSim = sim;
          bestCluster = c;
        }
      }
      return bestCluster;
    });

    const changed = newAssignments.some((a, i) => a !== assignments[i]);
    assignments = newAssignments;
    if (!changed) break;

    for (let c = 0; c < centroids.length; c++) {
      const members = items.filter((_, i) => assignments[i] === c);
      if (members.length === 0) continue;
      const sum = members.reduce(
        (acc, m) => vectorAdd(acc, m.embedding),
        new Array(dim).fill(0) as number[],
      );
      centroids[c] = vectorScale(sum, 1 / members.length);
    }
  }

  return centroids.map((centroid, c) => {
    const members = items.filter((_, i) => assignments[i] === c);
    const coherence = members.length > 0
      ? members.reduce((sum, m) => sum + cosineSimilarity(m.embedding, centroid), 0) / members.length
      : 0;
    return { centroid, members, coherence };
  }).filter(c => c.members.length > 0);
}

// ─── Keyword Extraction ───────────────────────────────────────

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
  'doesn', 'didn', 'isn', 'aren', 'wasn', 'weren', 'won',
  'couldn', 'shouldn', 'wouldn', 'haven', 'hasn', 'hadn',
]);

export function extractKeywords(items: { content: string }[], count: number, minFreqRatio = 0.15): string[] {
  const wordFreq = new Map<string, number>();
  for (const item of items) {
    const words = item.content
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
    const unique = new Set(words);
    for (const word of unique) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
  }
  return [...wordFreq.entries()]
    .filter(([_, freq]) => freq >= Math.max(2, items.length * minFreqRatio))
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([word]) => word);
}

// ─── Topic Label Extraction ───────────────────────────────────

export function extractTopicLabel(items: { content: string; sourceTitle: string }[]): string {
  const sourceCounts = new Map<string, number>();
  for (const m of items) {
    if (m.sourceTitle && m.sourceTitle !== 'Untitled') {
      sourceCounts.set(m.sourceTitle, (sourceCounts.get(m.sourceTitle) || 0) + 1);
    }
  }
  const dominant = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (dominant && dominant[1] > items.length * 0.6) {
    return truncate(dominant[0], 30);
  }
  const keywords = extractKeywords(items, 3);
  if (keywords.length >= 2) return capitalize(keywords.slice(0, 2).join(' & '));
  if (keywords.length === 1) return capitalize(keywords[0]!);
  return truncate(items[0]!.content.split('\n')[0]!.trim(), 30);
}

// ─── Source Type Counting ─────────────────────────────────────

export function countSourceTypes(items: { sourceType: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const m of items) counts[m.sourceType] = (counts[m.sourceType] || 0) + 1;
  return counts;
}

// ─── Cluster Similarity (for hierarchical/mind-map) ───────────

export function clusterSimilarity<T extends ClusterMember>(a: Cluster<T>, b: Cluster<T>): number {
  return cosineSimilarity(a.centroid, b.centroid);
}

// ─── Density Classification ───────────────────────────────────

export function getDensityLevel(
  clusterSize: number,
  totalItems: number,
  coherence: number,
): 'deep' | 'moderate' | 'thin' | 'sparse' {
  const sizeRatio = clusterSize / totalItems;
  if (sizeRatio > 0.15 && coherence > 0.8) return 'deep';
  if (sizeRatio > 0.08 || coherence > 0.75) return 'moderate';
  if (sizeRatio > 0.03 || coherence > 0.65) return 'thin';
  return 'sparse';
}

// ─── Coherence Computation ────────────────────────────────────

export function computeCoherence<T extends ClusterMember>(centroid: number[], members: T[]): number {
  if (members.length === 0) return 0;
  return members.reduce((sum, m) => sum + cosineSimilarity(m.embedding, centroid), 0) / members.length;
}

// ─── String Helpers ───────────────────────────────────────────

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trim() + '…';
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
