/**
 * Topic Evolution Timeline — Portable logic module
 * 
 * Extracted from the route for convergence with codex runtime.
 * Handles: time period building, topic clustering, shift detection,
 * timeline construction. Uses shared-vectors for clustering.
 * 
 * Zero AI dependency — pure algorithmic analysis.
 */

import {
  type ClusterMember,
  kMeansClustering,
  extractKeywords,
  extractTopicLabel,
  countSourceTypes,
  truncate,
} from './shared-vectors';

// ─── Types ────────────────────────────────────────────────────

export interface TopicEvolutionMemory extends ClusterMember {
  id: string;
  content: string;
  embedding: number[];
  sourceType: string;
  sourceTitle: string;
  createdAt: string;
}

export interface Topic {
  id: string;
  label: string;
  keywords: string[];
  memoryCount: number;
  sourceTypes: Record<string, number>;
  coherence: number;
  color: string;
  peakPeriod?: string;
  peakCount?: number;
  firstSeen?: string;
  lastSeen?: string;
}

export interface PeriodTopic {
  topicId: string;
  count: number;
  memories: { id: string; title: string; preview: string; sourceType: string }[];
}

export interface TimelinePeriod {
  label: string;
  shortLabel: string;
  start: string;
  end: string;
  totalCount: number;
  topics: PeriodTopic[];
}

export interface Shift {
  topicId: string;
  topicLabel: string;
  type: 'rising' | 'declining' | 'new' | 'dormant' | 'resurgent' | 'steady';
  description: string;
  periodLabel: string;
  magnitude: number;
}

export interface Period {
  start: Date;
  end: Date;
  label: string;
  shortLabel: string;
}

export interface TopicEvolutionResult {
  timeline: TimelinePeriod[];
  topics: Topic[];
  shifts: Shift[];
  stats: {
    totalMemories: number;
    topicCount: number;
    periodCount: number;
    granularity: string;
    dateRange: { start: string; end: string } | null;
    mostActiveMonth: string;
    insufficientData: boolean;
  };
}

// ─── Topic Colors ─────────────────────────────────────────────

export const TOPIC_COLORS = [
  '#14b8a6', '#0ea5e9', '#10b981', '#f59e0b', '#06b6d4',
  '#f43f5e', '#84cc16', '#f97316', '#3b82f6', '#64748b',
  '#22d3ee', '#a3e635', '#fb923c', '#38bdf8', '#34d399', '#fbbf24',
];

// ─── Main Analysis Pipeline ──────────────────────────────────

export function analyzeTopicEvolution(
  memories: TopicEvolutionMemory[],
  granularity: 'week' | 'month' | 'quarter' = 'month',
  maxTopics = 10,
): TopicEvolutionResult {
  if (memories.length < 5) {
    return {
      timeline: [], topics: [], shifts: [],
      stats: { totalMemories: memories.length, topicCount: 0, periodCount: 0, granularity, dateRange: null, mostActiveMonth: '', insufficientData: true },
    };
  }

  const dates = memories.map(m => new Date(m.createdAt));
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

  const numClusters = Math.min(maxTopics, Math.max(3, Math.floor(memories.length / 4)));
  const clusters = kMeansClustering(memories, numClusters, 20);

  // Build topics
  const topics: Topic[] = clusters.map((cluster, i) => ({
    id: `topic-${i}`,
    label: extractTopicLabel(cluster.members),
    keywords: extractKeywords(cluster.members, 5),
    memoryCount: cluster.members.length,
    sourceTypes: countSourceTypes(cluster.members),
    coherence: cluster.coherence,
    color: TOPIC_COLORS[i % TOPIC_COLORS.length]!,
  }));

  topics.sort((a, b) => b.memoryCount - a.memoryCount);

  const sortedClusters = topics.map((t, i) => {
    const origIdx = parseInt(t.id.split('-')[1]!);
    t.id = `topic-${i}`;
    t.color = TOPIC_COLORS[i % TOPIC_COLORS.length]!;
    return clusters[origIdx]!;
  });

  const periods = buildPeriods(minDate, maxDate, granularity);

  const timeline: TimelinePeriod[] = periods.map(period => {
    const periodTopics: PeriodTopic[] = sortedClusters.map((cluster, topicIdx) => {
      const periodMemories = cluster.members.filter(m => {
        const d = new Date(m.createdAt);
        return d >= period.start && d < period.end;
      });
      return {
        topicId: `topic-${topicIdx}`,
        count: periodMemories.length,
        memories: periodMemories.slice(0, 3).map(m => ({
          id: m.id,
          title: m.sourceTitle || truncate(m.content.split('\n')[0]!, 50),
          preview: truncate(m.content.replace(/\n/g, ' '), 100),
          sourceType: m.sourceType,
        })),
      };
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

  // Trim empty edges
  let firstNonEmpty = timeline.findIndex(p => p.totalCount > 0);
  let lastNonEmpty = timeline.length - 1;
  while (lastNonEmpty > 0 && timeline[lastNonEmpty]!.totalCount === 0) lastNonEmpty--;
  const trimmed = timeline.slice(Math.max(0, firstNonEmpty), lastNonEmpty + 1);

  // Detect shifts
  const shifts = detectShifts(trimmed, topics);

  // Annotate peak periods
  for (const topic of topics) {
    let maxCount = 0, peakPeriod = '';
    for (const period of trimmed) {
      const pt = period.topics.find(t => t.topicId === topic.id);
      if (pt && pt.count > maxCount) { maxCount = pt.count; peakPeriod = period.label; }
    }
    topic.peakPeriod = peakPeriod;
    topic.peakCount = maxCount;
    topic.firstSeen = trimmed.find(p => p.topics.find(t => t.topicId === topic.id && t.count > 0))?.label || '';
    topic.lastSeen = [...trimmed].reverse().find(p => p.topics.find(t => t.topicId === topic.id && t.count > 0))?.label || '';
  }

  return {
    timeline: trimmed, topics, shifts,
    stats: {
      totalMemories: memories.length,
      topicCount: topics.length,
      periodCount: trimmed.length,
      granularity,
      dateRange: { start: minDate.toISOString(), end: maxDate.toISOString() },
      mostActiveMonth: trimmed.reduce((best, p) => p.totalCount > (best?.totalCount || 0) ? p : best, trimmed[0])?.label || '',
      insufficientData: false,
    },
  };
}

// ─── Time Period Builder ──────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function buildPeriods(min: Date, max: Date, granularity: 'week' | 'month' | 'quarter'): Period[] {
  const periods: Period[] = [];

  if (granularity === 'week') {
    const start = new Date(min);
    start.setHours(0, 0, 0, 0);
    const dow = start.getDay();
    start.setDate(start.getDate() - ((dow + 6) % 7));
    while (start <= max) {
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      periods.push({
        start: new Date(start), end,
        label: `Week of ${MONTHS[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}`,
        shortLabel: `${MONTHS[start.getMonth()]} ${start.getDate()}`,
      });
      start.setDate(start.getDate() + 7);
    }
  } else if (granularity === 'month') {
    const start = new Date(min.getFullYear(), min.getMonth(), 1);
    while (start <= max) {
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      periods.push({
        start: new Date(start), end,
        label: `${MONTHS[start.getMonth()]} ${start.getFullYear()}`,
        shortLabel: `${MONTHS[start.getMonth()]}`,
      });
      start.setMonth(start.getMonth() + 1);
    }
  } else {
    const startQ = Math.floor(min.getMonth() / 3);
    const start = new Date(min.getFullYear(), startQ * 3, 1);
    while (start <= max) {
      const q = Math.floor(start.getMonth() / 3) + 1;
      const end = new Date(start.getFullYear(), start.getMonth() + 3, 1);
      periods.push({
        start: new Date(start), end,
        label: `Q${q} ${start.getFullYear()}`,
        shortLabel: `Q${q}`,
      });
      start.setMonth(start.getMonth() + 3);
    }
  }

  return periods;
}

// ─── Shift Detection ─────────────────────────────────────────

export function detectShifts(timeline: TimelinePeriod[], topics: Topic[]): Shift[] {
  const shifts: Shift[] = [];
  if (timeline.length < 2) return shifts;

  for (const topic of topics) {
    const counts = timeline.map(p => p.topics.find(t => t.topicId === topic.id)?.count || 0);
    const totalCount = counts.reduce((a, b) => a + b, 0);
    if (totalCount === 0) continue;

    const firstNonZero = counts.findIndex(c => c > 0);
    const lastNonZero = counts.length - 1 - [...counts].reverse().findIndex(c => c > 0);
    const midpoint = Math.floor(counts.length / 2);
    const firstHalf = counts.slice(0, midpoint).reduce((a, b) => a + b, 0);
    const secondHalf = counts.slice(midpoint).reduce((a, b) => a + b, 0);
    const totalHalves = firstHalf + secondHalf;
    const recent = counts.slice(-3).reduce((a, b) => a + b, 0);
    const earlier = counts.slice(0, -3).reduce((a, b) => a + b, 0);

    if (firstNonZero >= midpoint && totalCount >= 2) {
      shifts.push({ topicId: topic.id, topicLabel: topic.label, type: 'new', description: `"${topic.label}" is a new interest, first appearing in ${timeline[firstNonZero]!.label}`, periodLabel: timeline[firstNonZero]!.label, magnitude: Math.min(1, totalCount / 10) });
      continue;
    }
    if (recent === 0 && earlier > 0 && lastNonZero < counts.length - 2) {
      shifts.push({ topicId: topic.id, topicLabel: topic.label, type: 'dormant', description: `"${topic.label}" hasn't had new content since ${timeline[lastNonZero]!.label}`, periodLabel: timeline[lastNonZero]!.label, magnitude: Math.min(1, earlier / totalCount) });
      continue;
    }
    if (counts.length >= 5) {
      const midCounts = counts.slice(Math.max(1, Math.floor(counts.length * 0.3)), Math.floor(counts.length * 0.7));
      if (midCounts.reduce((a, b) => a + b, 0) === 0 && firstHalf > 0 && recent > 0) {
        shifts.push({ topicId: topic.id, topicLabel: topic.label, type: 'resurgent', description: `"${topic.label}" is making a comeback after inactivity`, periodLabel: timeline[lastNonZero]!.label, magnitude: Math.min(1, recent / (earlier || 1)) });
        continue;
      }
    }
    if (totalHalves > 0 && secondHalf / totalHalves > 0.65) {
      shifts.push({ topicId: topic.id, topicLabel: topic.label, type: 'rising', description: `"${topic.label}" is gaining momentum — ${Math.round(secondHalf / totalHalves * 100)}% of activity is recent`, periodLabel: timeline[timeline.length - 1]!.label, magnitude: secondHalf / totalHalves });
      continue;
    }
    if (totalHalves > 0 && firstHalf / totalHalves > 0.65) {
      shifts.push({ topicId: topic.id, topicLabel: topic.label, type: 'declining', description: `"${topic.label}" has been less active lately`, periodLabel: timeline[0]!.label, magnitude: firstHalf / totalHalves });
      continue;
    }
    if (totalCount >= 3) {
      shifts.push({ topicId: topic.id, topicLabel: topic.label, type: 'steady', description: `"${topic.label}" has been a consistent interest`, periodLabel: '', magnitude: 0.5 });
    }
  }

  const typeOrder: Record<string, number> = { new: 0, rising: 1, resurgent: 2, steady: 3, declining: 4, dormant: 5 };
  shifts.sort((a, b) => (typeOrder[a.type] || 3) - (typeOrder[b.type] || 3));
  return shifts;
}
