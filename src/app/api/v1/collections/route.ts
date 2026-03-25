import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

/**
 * Smart Collections — Auto-organized memory groups
 *
 * GET /api/v1/collections
 *   Auto-clusters memories by embedding similarity into topic groups.
 *   Uses k-means on embedding vectors, then extracts representative labels.
 *
 * Query params:
 *   ?maxCollections=12  — max number of collections (default 12)
 *   ?refresh=true       — force recalculation
 *   ?id=<collectionId>  — get single collection details with all memories
 */

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const maxCollections = Math.min(parseInt(searchParams.get('maxCollections') || '12'), 20);
    const singleId = searchParams.get('id');

    // ─── Fetch all memories with embeddings ──────────────────
    const memoriesResult = await db.execute(sql`
      SELECT id, content, source_type, source_title, embedding, created_at, metadata,
             COALESCE(source_title, LEFT(content, 80)) AS display_title
      FROM memories
      WHERE user_id = ${userId}::uuid AND embedding IS NOT NULL
      ORDER BY created_at DESC
    `);

    const memories: MemoryItem[] = (memoriesResult as any[]).map(m => ({
      id: m.id,
      content: m.content,
      sourceType: m.source_type,
      sourceTitle: m.source_title || '',
      displayTitle: m.display_title || '',
      embedding: parseEmbedding(m.embedding),
      createdAt: m.created_at ? new Date(m.created_at).toISOString() : new Date().toISOString(),
      metadata: typeof m.metadata === 'object' ? m.metadata : {},
    })).filter(m => m.embedding.length > 0);

    if (memories.length < 3) {
      return NextResponse.json({
        collections: [],
        stats: {
          totalMemories: memories.length,
          collectionCount: 0,
          insufficientData: true,
        },
      });
    }

    // ─── Get tags for each memory ───────────────────────────
    const tagResults = await db.execute(sql`
      SELECT mt.memory_id, t.name, t.color
      FROM memory_tags mt
      JOIN tags t ON t.id = mt.tag_id
      WHERE t.user_id = ${userId}::uuid
    `);

    const memoryTagMap = new Map<string, { name: string; color: string }[]>();
    for (const row of tagResults as any[]) {
      if (!memoryTagMap.has(row.memory_id)) memoryTagMap.set(row.memory_id, []);
      memoryTagMap.get(row.memory_id)!.push({ name: row.name, color: row.color });
    }

    // ─── Cluster into collections ────────────────────────────
    const numClusters = Math.min(maxCollections, Math.max(3, Math.floor(memories.length / 5)));
    const clusters = kMeansClustering(memories, numClusters, 25);

    // ─── Build collections ───────────────────────────────────
    const collections: Collection[] = clusters
      .filter(c => c.members.length >= 2)
      .map((cluster, i) => {
        const members = cluster.members.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        const label = extractCollectionLabel(members);
        const description = extractCollectionDescription(members);
        const icon = inferCollectionIcon(members);
        const sourceBreakdown = countSourceTypes(members);
        const dates = members.map(m => new Date(m.createdAt));
        const newestDate = new Date(Math.max(...dates.map(d => d.getTime())));
        const oldestDate = new Date(Math.min(...dates.map(d => d.getTime())));

        // Collect all tags from members
        const allTags = new Map<string, { count: number; color: string }>();
        for (const m of members) {
          const tags = memoryTagMap.get(m.id) || [];
          for (const t of tags) {
            const existing = allTags.get(t.name);
            if (existing) {
              existing.count++;
            } else {
              allTags.set(t.name, { count: 1, color: t.color });
            }
          }
        }
        const topTags = Array.from(allTags.entries())
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 5)
          .map(([name, { count, color }]) => ({ name, count, color }));

        // Calculate coherence (avg pairwise similarity in cluster)
        const coherence = calculateCoherence(members);

        // Representative preview — top 3 most central memories
        const centroid = cluster.centroid;
        const rankedMembers = members.map(m => ({
          ...m,
          distToCentroid: cosineSimilarity(m.embedding, centroid),
        })).sort((a, b) => b.distToCentroid - a.distToCentroid);

        const previews = rankedMembers.slice(0, 4).map(m => ({
          id: m.id,
          title: m.displayTitle,
          sourceType: m.sourceType,
          preview: m.content.slice(0, 150).replace(/\n/g, ' '),
          createdAt: m.createdAt,
        }));

        const collectionId = `col-${i}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`;

        return {
          id: collectionId,
          label,
          description,
          icon,
          memoryCount: members.length,
          coherence: Math.round(coherence * 100),
          sourceBreakdown,
          newestDate: newestDate.toISOString(),
          oldestDate: oldestDate.toISOString(),
          previews,
          topTags,
          wordCount: members.reduce((sum, m) => sum + m.content.split(/\s+/).length, 0),
          allMemoryIds: members.map(m => m.id),
        };
      })
      .sort((a, b) => b.memoryCount - a.memoryCount);

    // ─── If single collection requested ──────────────────────
    if (singleId) {
      const collection = collections.find(c => c.id === singleId);
      if (!collection) {
        return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
      }
      // Return full memories for this collection
      const fullMemories = memories
        .filter(m => collection.allMemoryIds.includes(m.id))
        .map(m => ({
          id: m.id,
          content: m.content,
          sourceType: m.sourceType,
          sourceTitle: m.sourceTitle,
          displayTitle: m.displayTitle,
          createdAt: m.createdAt,
          tags: memoryTagMap.get(m.id) || [],
          preview: m.content.slice(0, 300).replace(/\n/g, ' '),
        }));

      return NextResponse.json({
        collection: { ...collection, memories: fullMemories },
      });
    }

    // ─── Summary stats ──────────────────────────────────────
    const totalClustered = collections.reduce((sum, c) => sum + c.memoryCount, 0);

    return NextResponse.json({
      collections,
      stats: {
        totalMemories: memories.length,
        clusteredMemories: totalClustered,
        unclustered: memories.length - totalClustered,
        collectionCount: collections.length,
        avgCoherence: collections.length
          ? Math.round(collections.reduce((s, c) => s + c.coherence, 0) / collections.length)
          : 0,
      },
    });
  } catch (err) {
    console.error('Collections API error:', err);
    return NextResponse.json({ error: 'Failed to generate collections' }, { status: 500 });
  }
}

// ─── Types ──────────────────────────────────────────────────────

interface MemoryItem {
  id: string;
  content: string;
  sourceType: string;
  sourceTitle: string;
  displayTitle: string;
  embedding: number[];
  createdAt: string;
  metadata: Record<string, unknown>;
}

interface Cluster {
  centroid: number[];
  members: MemoryItem[];
}

interface Collection {
  id: string;
  label: string;
  description: string;
  icon: string;
  memoryCount: number;
  coherence: number;
  sourceBreakdown: Record<string, number>;
  newestDate: string;
  oldestDate: string;
  previews: { id: string; title: string; sourceType: string; preview: string; createdAt: string }[];
  topTags: { name: string; count: number; color: string }[];
  wordCount: number;
  allMemoryIds: string[];
}

// ─── Embedding Utilities ─────────────────────────────────────────

function parseEmbedding(raw: any): number[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const cleaned = raw.replace(/^\[/, '').replace(/\]$/, '');
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

function calculateCoherence(members: MemoryItem[]): number {
  if (members.length < 2) return 1;
  const sample = members.length > 20 ? members.slice(0, 20) : members;
  let totalSim = 0;
  let count = 0;
  for (let i = 0; i < sample.length; i++) {
    for (let j = i + 1; j < sample.length; j++) {
      totalSim += cosineSimilarity(sample[i].embedding, sample[j].embedding);
      count++;
    }
  }
  return count > 0 ? totalSim / count : 0;
}

// ─── K-Means Clustering ─────────────────────────────────────────

function kMeansClustering(items: MemoryItem[], k: number, maxIterations: number): Cluster[] {
  if (items.length === 0 || k <= 0) return [];
  k = Math.min(k, items.length);

  const dim = items[0].embedding.length;

  // Initialize centroids with k-means++ for better convergence
  const centroids: number[][] = [];
  const usedIndices = new Set<number>();
  
  // First centroid: random
  const firstIdx = Math.floor(Math.random() * items.length);
  centroids.push([...items[firstIdx].embedding]);
  usedIndices.add(firstIdx);

  // Remaining centroids: weighted by distance to nearest existing centroid
  for (let c = 1; c < k; c++) {
    const distances: number[] = items.map((item, idx) => {
      if (usedIndices.has(idx)) return 0;
      let minDist = Infinity;
      for (const centroid of centroids) {
        const sim = cosineSimilarity(item.embedding, centroid);
        const dist = 1 - sim;
        if (dist < minDist) minDist = dist;
      }
      return minDist * minDist; // Square for probability weighting
    });

    const totalDist = distances.reduce((s, d) => s + d, 0);
    if (totalDist === 0) break;

    let r = Math.random() * totalDist;
    let selectedIdx = 0;
    for (let i = 0; i < distances.length; i++) {
      r -= distances[i];
      if (r <= 0) { selectedIdx = i; break; }
    }
    centroids.push([...items[selectedIdx].embedding]);
    usedIndices.add(selectedIdx);
  }

  let assignments = new Array(items.length).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign each item to nearest centroid
    const newAssignments = items.map(item => {
      let bestCluster = 0;
      let bestSim = -Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const sim = cosineSimilarity(item.embedding, centroids[c]);
        if (sim > bestSim) { bestSim = sim; bestCluster = c; }
      }
      return bestCluster;
    });

    // Check convergence
    let changed = false;
    for (let i = 0; i < items.length; i++) {
      if (newAssignments[i] !== assignments[i]) { changed = true; break; }
    }
    assignments = newAssignments;
    if (!changed) break;

    // Recalculate centroids
    for (let c = 0; c < centroids.length; c++) {
      const members = items.filter((_, idx) => assignments[idx] === c);
      if (members.length === 0) continue;
      for (let d = 0; d < dim; d++) {
        centroids[c][d] = members.reduce((sum, m) => sum + m.embedding[d], 0) / members.length;
      }
    }
  }

  // Build clusters
  const clusters: Cluster[] = [];
  for (let c = 0; c < centroids.length; c++) {
    const members = items.filter((_, idx) => assignments[idx] === c);
    if (members.length > 0) {
      clusters.push({ centroid: centroids[c], members });
    }
  }

  return clusters;
}

// ─── Label Extraction ────────────────────────────────────────────

function extractCollectionLabel(members: MemoryItem[]): string {
  // Use source titles if available, otherwise extract key phrases from content
  const titles = members
    .map(m => m.sourceTitle)
    .filter(Boolean)
    .slice(0, 10);

  if (titles.length >= 3) {
    // Find common words across titles
    const wordFreq = new Map<string, number>();
    for (const title of titles) {
      const words = title.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w));
      const seen = new Set<string>();
      for (const w of words) {
        if (!seen.has(w)) {
          wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
          seen.add(w);
        }
      }
    }
    const topWords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([w]) => w.charAt(0).toUpperCase() + w.slice(1));

    if (topWords.length > 0) return topWords.join(' & ');
  }

  // Fall back to content analysis
  const allContent = members.slice(0, 15).map(m => m.content).join(' ');
  const words = allContent.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w));
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);

  const topTerms = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([w]) => w.charAt(0).toUpperCase() + w.slice(1));

  return topTerms.length > 0 ? topTerms.join(' & ') : `Collection ${members.length}`;
}

function extractCollectionDescription(members: MemoryItem[]): string {
  const sources = countSourceTypes(members);
  const topSource = Object.entries(sources).sort((a, b) => b[1] - a[1])[0];
  const dateRange = getDateRange(members);

  const parts: string[] = [];
  parts.push(`${members.length} memories`);
  if (topSource) {
    const sourceLabel = topSource[0].replace(/[-_]/g, ' ');
    const pct = Math.round((topSource[1] / members.length) * 100);
    if (pct > 60) {
      parts.push(`mostly from ${sourceLabel}`);
    }
  }
  if (dateRange) parts.push(dateRange);

  return parts.join(' · ');
}

function getDateRange(members: MemoryItem[]): string {
  const dates = members.map(m => new Date(m.createdAt)).filter(d => !isNaN(d.getTime()));
  if (dates.length === 0) return '';
  
  const oldest = new Date(Math.min(...dates.map(d => d.getTime())));
  const newest = new Date(Math.max(...dates.map(d => d.getTime())));
  
  const diffDays = Math.floor((newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 1) return 'today';
  if (diffDays < 7) return `last ${diffDays} days`;
  if (diffDays < 30) return `last ${Math.ceil(diffDays / 7)} weeks`;
  if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months`;
  return `${(diffDays / 365).toFixed(1)} years`;
}

function inferCollectionIcon(members: MemoryItem[]): string {
  const sources = countSourceTypes(members);
  const topSource = Object.entries(sources).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  // Map common source types to icon names
  const iconMap: Record<string, string> = {
    'chatgpt': 'MessageCircle',
    'claude': 'MessageSquare',
    'text': 'Type',
    'note': 'StickyNote',
    'url': 'Globe',
    'webpage': 'Globe',
    'notion': 'FileStack',
    'obsidian': 'Gem',
    'kindle': 'BookOpen',
    'pdf': 'FileText',
    'youtube': 'Play',
    'reddit': 'MessageSquare',
    'twitter': 'AtSign',
    'telegram': 'Send',
    'spotify': 'Music',
    'document': 'FileText',
    'image': 'Image',
    'audio': 'Mic',
  };

  return iconMap[topSource] || 'FolderOpen';
}

function countSourceTypes(members: MemoryItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const m of members) {
    counts[m.sourceType] = (counts[m.sourceType] || 0) + 1;
  }
  return counts;
}

const STOP_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
  'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see',
  'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over',
  'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work',
  'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these',
  'give', 'day', 'most', 'us', 'very', 'been', 'here', 'more', 'much',
  'should', 'was', 'were', 'had', 'has', 'did', 'does', 'are', 'been',
  'being', 'each', 'same', 'such', 'using', 'used', 'both', 'between',
  'while', 'where', 'why', 'still', 'since', 'through', 'without', 'before',
  'though', 'many', 'those', 'however', 'down', 'need', 'something', 'going',
  'really', 'right', 'things', 'thing', 'sure', 'able', 'actually', 'always',
  'never', 'every', 'already', 'don\'t', 'doesn\'t', 'didn\'t', 'won\'t', 'wouldn\'t',
  'can\'t', 'couldn\'t', 'isn\'t', 'aren\'t', 'wasn\'t', 'weren\'t', 'hasn\'t', 'haven\'t',
  'that\'s', 'it\'s', 'i\'m', 'i\'ve', 'i\'ll', 'i\'d', 'you\'re', 'you\'ve', 'you\'ll',
  'we\'re', 'we\'ve', 'we\'ll', 'they\'re', 'they\'ve', 'they\'ll', 'there\'s',
  'what\'s', 'let\'s', 'here\'s', 'who\'s', 'he\'s', 'she\'s',
]);
