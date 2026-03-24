import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/server/db';
import { sql, eq } from 'drizzle-orm';

/**
 * Topic Evolution Timeline Plugin
 * 
 * GET /api/v1/plugins/topic-evolution
 * 
 * Analyzes how user interests have evolved over time by:
 * 1. Fetching all memories with embeddings + timestamps
 * 2. Clustering into topics via k-means
 * 3. Binning each topic's memories into time periods (weeks/months)
 * 4. Detecting interest shifts: rising, declining, stable, new, dormant
 * 5. Finding pivot points where major shifts occurred
 * 
 * Query params:
 *   ?granularity=month  — month (default), week, or quarter
 *   ?maxTopics=10       — max topics to track (default 10)
 */

const PLUGIN_SLUG = 'topic-evolution';

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const granularity = (searchParams.get('granularity') || 'month') as 'week' | 'month' | 'quarter';
    const maxTopics = Math.min(parseInt(searchParams.get('maxTopics') || '10'), 16);

    await autoInstallPlugin();

    // ─── Fetch all memories with embeddings + timestamps ──────
    const memoriesResult = await db.execute(sql`
      SELECT id, content, source_type, source_title, embedding, created_at, metadata
      FROM memories
      WHERE user_id = ${userId}::uuid AND embedding IS NOT NULL
      ORDER BY created_at ASC
    `);

    const memories: Memory[] = (memoriesResult as any[]).map(m => ({
      id: m.id,
      content: m.content,
      sourceType: m.source_type,
      sourceTitle: m.source_title || 'Untitled',
      embedding: parseEmbedding(m.embedding),
      createdAt: m.created_at ? new Date(m.created_at).toISOString() : new Date().toISOString(),
    })).filter(m => m.embedding.length > 0);

    if (memories.length < 5) {
      return NextResponse.json({
        timeline: [],
        topics: [],
        shifts: [],
        stats: {
          totalMemories: memories.length,
          topicCount: 0,
          periodCount: 0,
          dateRange: null,
          insufficientData: true,
        },
      });
    }

    // ─── Determine time range ─────────────────────────────────
    const dates = memories.map(m => new Date(m.createdAt));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    // ─── Cluster memories into topics ─────────────────────────
    const numClusters = Math.min(maxTopics, Math.max(3, Math.floor(memories.length / 4)));
    const clusters = kMeansClustering(memories, numClusters, 20);

    // ─── Label topics and build metadata ──────────────────────
    const topics: Topic[] = clusters.map((cluster, i) => {
      const label = extractTopicLabel(cluster.members);
      const keywords = extractKeywords(cluster.members, 5);
      const sourceTypes = countSourceTypes(cluster.members);
      
      return {
        id: `topic-${i}`,
        label,
        keywords,
        memoryCount: cluster.members.length,
        sourceTypes,
        coherence: cluster.coherence,
        color: TOPIC_COLORS[i % TOPIC_COLORS.length],
      };
    });

    // Sort by memory count (most active topics first)
    topics.sort((a, b) => b.memoryCount - a.memoryCount);
    // Re-assign IDs after sort and update cluster order
    const sortedClusters = topics.map((t, i) => {
      const origIdx = parseInt(t.id.split('-')[1]);
      t.id = `topic-${i}`;
      t.color = TOPIC_COLORS[i % TOPIC_COLORS.length];
      return clusters[origIdx];
    });

    // ─── Build time periods ───────────────────────────────────
    const periods = buildPeriods(minDate, maxDate, granularity);

    // ─── Map memories to periods per topic ────────────────────
    const timeline: TimelinePeriod[] = periods.map(period => {
      const periodTopics: PeriodTopic[] = [];

      sortedClusters.forEach((cluster, topicIdx) => {
        const periodMemories = cluster.members.filter(m => {
          const d = new Date(m.createdAt);
          return d >= period.start && d < period.end;
        });

        periodTopics.push({
          topicId: `topic-${topicIdx}`,
          count: periodMemories.length,
          memories: periodMemories.slice(0, 3).map(m => ({
            id: m.id,
            title: m.sourceTitle || truncate(m.content.split('\n')[0], 50),
            preview: truncate(m.content.replace(/\n/g, ' '), 100),
            sourceType: m.sourceType,
          })),
        });
      });

      return {
        label: period.label,
        shortLabel: period.shortLabel,
        start: period.start.toISOString(),
        end: period.end.toISOString(),
        totalCount: periodTopics.reduce((sum, t) => sum + t.count, 0),
        topics: periodTopics,
      };
    });

    // Filter out empty periods at start/end
    let firstNonEmpty = timeline.findIndex(p => p.totalCount > 0);
    let lastNonEmpty = timeline.length - 1;
    while (lastNonEmpty > 0 && timeline[lastNonEmpty].totalCount === 0) lastNonEmpty--;
    const trimmedTimeline = timeline.slice(
      Math.max(0, firstNonEmpty),
      lastNonEmpty + 1
    );

    // ─── Detect interest shifts ───────────────────────────────
    const shifts = detectShifts(trimmedTimeline, topics);

    // ─── Find peak periods per topic ──────────────────────────
    topics.forEach((topic, i) => {
      let maxCount = 0;
      let peakPeriod = '';
      trimmedTimeline.forEach(period => {
        const pt = period.topics.find(t => t.topicId === topic.id);
        if (pt && pt.count > maxCount) {
          maxCount = pt.count;
          peakPeriod = period.label;
        }
      });
      (topic as any).peakPeriod = peakPeriod;
      (topic as any).peakCount = maxCount;

      // Find first and last activity
      const firstActive = trimmedTimeline.find(p =>
        p.topics.find(t => t.topicId === topic.id && t.count > 0)
      );
      const lastActive = [...trimmedTimeline].reverse().find(p =>
        p.topics.find(t => t.topicId === topic.id && t.count > 0)
      );
      (topic as any).firstSeen = firstActive?.label || '';
      (topic as any).lastSeen = lastActive?.label || '';
    });

    // ─── Stats ────────────────────────────────────────────────
    const stats = {
      totalMemories: memories.length,
      topicCount: topics.length,
      periodCount: trimmedTimeline.length,
      granularity,
      dateRange: {
        start: minDate.toISOString(),
        end: maxDate.toISOString(),
      },
      mostActiveMonth: trimmedTimeline.reduce((best, p) =>
        p.totalCount > (best?.totalCount || 0) ? p : best
      , trimmedTimeline[0])?.label || '',
      insufficientData: false,
    };

    return NextResponse.json({ timeline: trimmedTimeline, topics, shifts, stats });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Topic evolution error:', msg);
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
}

interface Topic {
  id: string;
  label: string;
  keywords: string[];
  memoryCount: number;
  sourceTypes: Record<string, number>;
  coherence: number;
  color: string;
}

interface PeriodTopic {
  topicId: string;
  count: number;
  memories: { id: string; title: string; preview: string; sourceType: string }[];
}

interface TimelinePeriod {
  label: string;
  shortLabel: string;
  start: string;
  end: string;
  totalCount: number;
  topics: PeriodTopic[];
}

interface Shift {
  topicId: string;
  topicLabel: string;
  type: 'rising' | 'declining' | 'new' | 'dormant' | 'resurgent' | 'steady';
  description: string;
  periodLabel: string;
  magnitude: number; // 0-1 strength
}

interface Period {
  start: Date;
  end: Date;
  label: string;
  shortLabel: string;
}

interface Cluster {
  centroid: number[];
  members: Memory[];
  coherence: number;
}

// ─── Topic Colors (teal, sky, emerald, amber, cyan, rose, lime, orange, blue, slate) ─
const TOPIC_COLORS = [
  '#14b8a6', // teal-500
  '#0ea5e9', // sky-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#06b6d4', // cyan-500
  '#f43f5e', // rose-500
  '#84cc16', // lime-500
  '#f97316', // orange-500
  '#3b82f6', // blue-500
  '#64748b', // slate-500
  '#22d3ee', // cyan-400
  '#a3e635', // lime-400
  '#fb923c', // orange-400
  '#38bdf8', // sky-400
  '#34d399', // emerald-400
  '#fbbf24', // amber-400
];

// ─── Time Period Builder ────────────────────────────────────────────

function buildPeriods(min: Date, max: Date, granularity: 'week' | 'month' | 'quarter'): Period[] {
  const periods: Period[] = [];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (granularity === 'week') {
    // Start from Monday of the min date's week
    const start = new Date(min);
    start.setHours(0, 0, 0, 0);
    const dow = start.getDay();
    start.setDate(start.getDate() - ((dow + 6) % 7)); // Move to Monday

    while (start <= max) {
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const weekLabel = `${months[start.getMonth()]} ${start.getDate()}`;
      periods.push({
        start: new Date(start),
        end,
        label: `Week of ${weekLabel}, ${start.getFullYear()}`,
        shortLabel: `${months[start.getMonth()]} ${start.getDate()}`,
      });
      start.setDate(start.getDate() + 7);
    }
  } else if (granularity === 'month') {
    const start = new Date(min.getFullYear(), min.getMonth(), 1);
    while (start <= max) {
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      periods.push({
        start: new Date(start),
        end,
        label: `${months[start.getMonth()]} ${start.getFullYear()}`,
        shortLabel: `${months[start.getMonth()]}`,
      });
      start.setMonth(start.getMonth() + 1);
    }
  } else {
    // Quarter
    const startQ = Math.floor(min.getMonth() / 3);
    const start = new Date(min.getFullYear(), startQ * 3, 1);
    while (start <= max) {
      const q = Math.floor(start.getMonth() / 3) + 1;
      const end = new Date(start.getFullYear(), start.getMonth() + 3, 1);
      periods.push({
        start: new Date(start),
        end,
        label: `Q${q} ${start.getFullYear()}`,
        shortLabel: `Q${q}`,
      });
      start.setMonth(start.getMonth() + 3);
    }
  }

  return periods;
}

// ─── Shift Detection ────────────────────────────────────────────────

function detectShifts(timeline: TimelinePeriod[], topics: Topic[]): Shift[] {
  const shifts: Shift[] = [];
  if (timeline.length < 2) return shifts;

  for (const topic of topics) {
    const counts = timeline.map(p => {
      const pt = p.topics.find(t => t.topicId === topic.id);
      return pt?.count || 0;
    });

    const totalCount = counts.reduce((a, b) => a + b, 0);
    if (totalCount === 0) continue;

    // Find first and last non-zero
    const firstNonZero = counts.findIndex(c => c > 0);
    const lastNonZero = counts.length - 1 - [...counts].reverse().findIndex(c => c > 0);

    // Compare first half vs second half activity
    const midpoint = Math.floor(counts.length / 2);
    const firstHalf = counts.slice(0, midpoint).reduce((a, b) => a + b, 0);
    const secondHalf = counts.slice(midpoint).reduce((a, b) => a + b, 0);
    const totalHalves = firstHalf + secondHalf;

    // Check last 3 periods for recent activity
    const recent = counts.slice(-3).reduce((a, b) => a + b, 0);
    const earlier = counts.slice(0, -3).reduce((a, b) => a + b, 0);

    // New topic (only appeared in second half)
    if (firstNonZero >= midpoint && totalCount >= 2) {
      shifts.push({
        topicId: topic.id,
        topicLabel: topic.label,
        type: 'new',
        description: `"${topic.label}" is a new interest, first appearing in ${timeline[firstNonZero].label}`,
        periodLabel: timeline[firstNonZero].label,
        magnitude: Math.min(1, totalCount / 10),
      });
      continue;
    }

    // Dormant (no activity in last 3 periods but had activity before)
    if (recent === 0 && earlier > 0 && lastNonZero < counts.length - 2) {
      shifts.push({
        topicId: topic.id,
        topicLabel: topic.label,
        type: 'dormant',
        description: `"${topic.label}" hasn't had new content since ${timeline[lastNonZero].label}`,
        periodLabel: timeline[lastNonZero].label,
        magnitude: Math.min(1, earlier / totalCount),
      });
      continue;
    }

    // Resurgent (gap then came back)
    if (counts.length >= 5) {
      const midCounts = counts.slice(
        Math.max(1, Math.floor(counts.length * 0.3)),
        Math.floor(counts.length * 0.7)
      );
      const midSum = midCounts.reduce((a, b) => a + b, 0);
      if (midSum === 0 && firstHalf > 0 && secondHalf > 0 && recent > 0) {
        shifts.push({
          topicId: topic.id,
          topicLabel: topic.label,
          type: 'resurgent',
          description: `"${topic.label}" is making a comeback after a period of inactivity`,
          periodLabel: timeline[lastNonZero].label,
          magnitude: Math.min(1, recent / (earlier || 1)),
        });
        continue;
      }
    }

    // Rising (second half significantly more)
    if (totalHalves > 0 && secondHalf / totalHalves > 0.65) {
      shifts.push({
        topicId: topic.id,
        topicLabel: topic.label,
        type: 'rising',
        description: `"${topic.label}" is gaining momentum — ${Math.round(secondHalf / totalHalves * 100)}% of activity is recent`,
        periodLabel: timeline[timeline.length - 1].label,
        magnitude: secondHalf / totalHalves,
      });
      continue;
    }

    // Declining (first half significantly more)
    if (totalHalves > 0 && firstHalf / totalHalves > 0.65) {
      shifts.push({
        topicId: topic.id,
        topicLabel: topic.label,
        type: 'declining',
        description: `"${topic.label}" has been less active lately — ${Math.round(firstHalf / totalHalves * 100)}% of activity was earlier`,
        periodLabel: timeline[0].label,
        magnitude: firstHalf / totalHalves,
      });
      continue;
    }

    // Steady (roughly even distribution)
    if (totalCount >= 3) {
      shifts.push({
        topicId: topic.id,
        topicLabel: topic.label,
        type: 'steady',
        description: `"${topic.label}" has been a consistent interest throughout`,
        periodLabel: '',
        magnitude: 0.5,
      });
    }
  }

  // Sort: new/rising first, then declining/dormant
  const typeOrder: Record<string, number> = { new: 0, rising: 1, resurgent: 2, steady: 3, declining: 4, dormant: 5 };
  shifts.sort((a, b) => (typeOrder[a.type] || 3) - (typeOrder[b.type] || 3));

  return shifts;
}

// ─── Embedding Utilities ────────────────────────────────────────────

function parseEmbedding(raw: unknown): number[] {
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
    return memories.map(m => ({
      centroid: m.embedding,
      members: [m],
      coherence: 1,
    }));
  }

  const dim = memories[0].embedding.length;
  const centroids: number[][] = [];
  centroids.push([...memories[Math.floor(Math.random() * memories.length)].embedding]);

  for (let c = 1; c < k; c++) {
    const distances = memories.map(m => {
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
      r -= distances[i];
      if (r <= 0) {
        centroids.push([...memories[i].embedding]);
        break;
      }
    }
  }

  let assignments = new Array(memories.length).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
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

    const changed = newAssignments.some((a, i) => a !== assignments[i]);
    assignments = newAssignments;
    if (!changed) break;

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

  return centroids.map((centroid, c) => {
    const members = memories.filter((_, i) => assignments[i] === c);
    const coherence = members.length > 0
      ? members.reduce((sum, m) => sum + cosineSimilarity(m.embedding, centroid), 0) / members.length
      : 0;
    return { centroid, members, coherence };
  }).filter(c => c.members.length > 0);
}

// ─── Topic Label & Keyword Extraction ───────────────────────────────

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
    const unique = new Set(words);
    for (const word of unique) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
  }
  return [...wordFreq.entries()]
    .filter(([_, freq]) => freq >= Math.max(2, memories.length * 0.15))
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([word]) => word);
}

function extractTopicLabel(memories: Memory[]): string {
  const sourceCounts = new Map<string, number>();
  for (const m of memories) {
    if (m.sourceTitle && m.sourceTitle !== 'Untitled') {
      sourceCounts.set(m.sourceTitle, (sourceCounts.get(m.sourceTitle) || 0) + 1);
    }
  }
  const dominant = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (dominant && dominant[1] > memories.length * 0.6) {
    return truncate(dominant[0], 30);
  }
  const keywords = extractKeywords(memories, 3);
  if (keywords.length >= 2) return capitalize(keywords.slice(0, 2).join(' & '));
  if (keywords.length === 1) return capitalize(keywords[0]);
  return truncate(memories[0].content.split('\n')[0].trim(), 30);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trim() + '…';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function countSourceTypes(memories: Memory[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const m of memories) counts[m.sourceType] = (counts[m.sourceType] || 0) + 1;
  return counts;
}

async function autoInstallPlugin() {
  try {
    const existing = await db.select().from(schema.plugins).where(eq(schema.plugins.slug, PLUGIN_SLUG)).limit(1);
    if (existing.length === 0) {
      await db.insert(schema.plugins).values({
        slug: PLUGIN_SLUG,
        name: 'Topic Evolution Timeline',
        description: 'Shows how your interests changed over time. Visual timeline of knowledge evolution with trend detection.',
        version: '1.0.0',
        type: 'extension',
        status: 'active',
        icon: 'TrendingUp',
        category: 'analysis',
        config: {},
      });
    }
  } catch {
    // Already exists or table not ready
  }
}
