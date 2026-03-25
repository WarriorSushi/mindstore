import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { PLUGIN_MANIFESTS } from "@/server/plugins/registry";
import {
  countSourceTypes,
  extractKeywords,
  extractTopicLabel,
  kMeansClustering,
  parseEmbedding,
} from "@/server/plugins/ports/shared-vectors";

const PLUGIN_SLUG = "topic-evolution";
const TOPIC_COLORS = [
  "#14b8a6", "#0ea5e9", "#10b981", "#f59e0b", "#06b6d4",
  "#f43f5e", "#84cc16", "#f97316", "#3b82f6", "#64748b",
  "#22d3ee", "#a3e635", "#fb923c", "#38bdf8", "#34d399", "#fbbf24",
];

type Granularity = "week" | "month" | "quarter";
type ShiftType = "rising" | "declining" | "new" | "dormant" | "resurgent" | "steady";

interface EmbeddedMemory {
  id: string;
  content: string;
  sourceType: string;
  sourceTitle: string;
  embedding: number[];
  createdAt: string;
}

interface Period {
  start: Date;
  end: Date;
  label: string;
  shortLabel: string;
}

export interface EvolutionTopic {
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
  memories: Array<{ id: string; title: string; preview: string; sourceType: string }>;
}

export interface TimelinePeriod {
  label: string;
  shortLabel: string;
  start: string;
  end: string;
  totalCount: number;
  topics: PeriodTopic[];
}

export interface TopicShift {
  topicId: string;
  topicLabel: string;
  type: ShiftType;
  description: string;
  periodLabel: string;
  magnitude: number;
}

export interface TopicEvolutionResponse {
  timeline: TimelinePeriod[];
  topics: EvolutionTopic[];
  shifts: TopicShift[];
  stats: {
    totalMemories: number;
    topicCount: number;
    periodCount: number;
    granularity: Granularity;
    dateRange: { start: string; end: string } | null;
    mostActiveMonth: string;
    insufficientData: boolean;
  };
}

export async function ensureTopicEvolutionInstalled() {
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

export async function analyzeTopicEvolution(
  userId: string,
  input: { granularity?: Granularity; maxTopics?: number } = {},
): Promise<TopicEvolutionResponse> {
  const granularity = input.granularity || "month";
  const maxTopics = Math.min(input.maxTopics || 10, 16);
  const rows = await db.execute(sql`
    SELECT id, content, source_type, source_title, embedding, created_at
    FROM memories
    WHERE user_id = ${userId}::uuid AND embedding IS NOT NULL
    ORDER BY created_at ASC
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
      timeline: [],
      topics: [],
      shifts: [],
      stats: {
        totalMemories: memories.length,
        topicCount: 0,
        periodCount: 0,
        granularity,
        dateRange: null,
        mostActiveMonth: "",
        insufficientData: true,
      },
    };
  }

  const dates = memories.map((memory) => new Date(memory.createdAt));
  const minDate = new Date(Math.min(...dates.map((date) => date.getTime())));
  const maxDate = new Date(Math.max(...dates.map((date) => date.getTime())));
  const clusterCount = Math.min(maxTopics, Math.max(3, Math.floor(memories.length / 4)));
  const clusters = kMeansClustering(memories, clusterCount, 20);

  const unsortedTopics = clusters.map((cluster, index) => ({
    originalIndex: index,
    topic: {
      id: `topic-${index}`,
      label: extractTopicLabel(cluster.members),
      keywords: extractKeywords(cluster.members, 5),
      memoryCount: cluster.members.length,
      sourceTypes: countSourceTypes(cluster.members),
      coherence: cluster.coherence,
      color: TOPIC_COLORS[index % TOPIC_COLORS.length] || "#14b8a6",
    } satisfies EvolutionTopic,
  }));

  const sorted = unsortedTopics.sort((left, right) => right.topic.memoryCount - left.topic.memoryCount);
  const sortedClusters: Array<{ cluster: typeof clusters[number]; topic: EvolutionTopic }> = sorted.map((entry, index) => ({
    cluster: clusters[entry.originalIndex]!,
    topic: {
      ...entry.topic,
      id: `topic-${index}`,
      color: TOPIC_COLORS[index % TOPIC_COLORS.length] || "#14b8a6",
    },
  }));

  const topics = sortedClusters.map((entry) => entry.topic);
  const periods = buildPeriods(minDate, maxDate, granularity);
  const timeline = periods.map((period) => {
    const periodTopics = sortedClusters.map(({ cluster, topic }) => {
      const periodMemories = cluster.members.filter((memory) => {
        const date = new Date(memory.createdAt);
        return date >= period.start && date < period.end;
      });

      return {
        topicId: topic.id,
        count: periodMemories.length,
        memories: periodMemories.slice(0, 3).map((memory) => ({
          id: memory.id,
          title: memory.sourceTitle || truncate(memory.content.split("\n")[0] || memory.content, 50),
          preview: truncate(memory.content.replace(/\n/g, " "), 100),
          sourceType: memory.sourceType,
        })),
      } satisfies PeriodTopic;
    });

    return {
      label: period.label,
      shortLabel: period.shortLabel,
      start: period.start.toISOString(),
      end: period.end.toISOString(),
      totalCount: periodTopics.reduce((sum, topic) => sum + topic.count, 0),
      topics: periodTopics,
    } satisfies TimelinePeriod;
  });

  const trimmedTimeline = trimTimeline(timeline);
  const shifts = detectShifts(trimmedTimeline, topics);

  for (const topic of topics) {
    let peakCount = 0;
    let peakPeriod = "";
    for (const period of trimmedTimeline) {
      const periodTopic = period.topics.find((entry) => entry.topicId === topic.id);
      if ((periodTopic?.count || 0) > peakCount) {
        peakCount = periodTopic?.count || 0;
        peakPeriod = period.label;
      }
    }

    topic.peakCount = peakCount;
    topic.peakPeriod = peakPeriod;
    topic.firstSeen = trimmedTimeline.find((period) => period.topics.find((entry) => entry.topicId === topic.id && entry.count > 0))?.label || "";
    topic.lastSeen = [...trimmedTimeline].reverse().find((period) => period.topics.find((entry) => entry.topicId === topic.id && entry.count > 0))?.label || "";
  }

  return {
    timeline: trimmedTimeline,
    topics,
    shifts,
    stats: {
      totalMemories: memories.length,
      topicCount: topics.length,
      periodCount: trimmedTimeline.length,
      granularity,
      dateRange: {
        start: minDate.toISOString(),
        end: maxDate.toISOString(),
      },
      mostActiveMonth: trimmedTimeline.reduce((best, current) => current.totalCount > best.totalCount ? current : best, trimmedTimeline[0]!).label,
      insufficientData: false,
    },
  };
}

export function buildPeriods(minDate: Date, maxDate: Date, granularity: Granularity): Period[] {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const periods: Period[] = [];

  if (granularity === "week") {
    const start = new Date(minDate);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));

    while (start <= maxDate) {
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      periods.push({
        start: new Date(start),
        end,
        label: `Week of ${months[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}`,
        shortLabel: `${months[start.getMonth()]} ${start.getDate()}`,
      });
      start.setDate(start.getDate() + 7);
    }

    return periods;
  }

  if (granularity === "quarter") {
    const quarter = Math.floor(minDate.getMonth() / 3);
    const start = new Date(minDate.getFullYear(), quarter * 3, 1);

    while (start <= maxDate) {
      const quarterLabel = Math.floor(start.getMonth() / 3) + 1;
      const end = new Date(start.getFullYear(), start.getMonth() + 3, 1);
      periods.push({
        start: new Date(start),
        end,
        label: `Q${quarterLabel} ${start.getFullYear()}`,
        shortLabel: `Q${quarterLabel}`,
      });
      start.setMonth(start.getMonth() + 3);
    }

    return periods;
  }

  const start = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  while (start <= maxDate) {
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    periods.push({
      start: new Date(start),
      end,
      label: `${months[start.getMonth()]} ${start.getFullYear()}`,
      shortLabel: months[start.getMonth()] || "",
    });
    start.setMonth(start.getMonth() + 1);
  }

  return periods;
}

export function detectShifts(timeline: TimelinePeriod[], topics: EvolutionTopic[]): TopicShift[] {
  const shifts: TopicShift[] = [];
  if (timeline.length < 2) {
    return shifts;
  }

  for (const topic of topics) {
    const counts = timeline.map((period) => period.topics.find((entry) => entry.topicId === topic.id)?.count || 0);
    const totalCount = counts.reduce((sum, count) => sum + count, 0);
    if (!totalCount) {
      continue;
    }

    const firstNonZero = counts.findIndex((count) => count > 0);
    const lastNonZero = counts.length - 1 - [...counts].reverse().findIndex((count) => count > 0);
    const midpoint = Math.floor(counts.length / 2);
    const firstHalf = counts.slice(0, midpoint).reduce((sum, count) => sum + count, 0);
    const secondHalf = counts.slice(midpoint).reduce((sum, count) => sum + count, 0);
    const recent = counts.slice(-3).reduce((sum, count) => sum + count, 0);
    const earlier = counts.slice(0, -3).reduce((sum, count) => sum + count, 0);

    if (firstNonZero >= midpoint && totalCount >= 2) {
      shifts.push({
        topicId: topic.id,
        topicLabel: topic.label,
        type: "new",
        description: `"${topic.label}" first appears in ${timeline[firstNonZero]?.label}.`,
        periodLabel: timeline[firstNonZero]?.label || "",
        magnitude: Math.min(1, totalCount / 10),
      });
      continue;
    }

    if (recent === 0 && earlier > 0 && lastNonZero < counts.length - 2) {
      shifts.push({
        topicId: topic.id,
        topicLabel: topic.label,
        type: "dormant",
        description: `"${topic.label}" has not had new activity since ${timeline[lastNonZero]?.label}.`,
        periodLabel: timeline[lastNonZero]?.label || "",
        magnitude: Math.min(1, earlier / totalCount),
      });
      continue;
    }

    if (counts.length >= 5) {
      const middleCounts = counts.slice(Math.max(1, Math.floor(counts.length * 0.3)), Math.floor(counts.length * 0.7));
      const middleSum = middleCounts.reduce((sum, count) => sum + count, 0);
      if (middleSum === 0 && firstHalf > 0 && secondHalf > 0 && recent > 0) {
        shifts.push({
          topicId: topic.id,
          topicLabel: topic.label,
          type: "resurgent",
          description: `"${topic.label}" returned after a quiet period.`,
          periodLabel: timeline[lastNonZero]?.label || "",
          magnitude: Math.min(1, recent / Math.max(1, earlier)),
        });
        continue;
      }
    }

    const totalHalves = firstHalf + secondHalf;
    if (totalHalves > 0 && secondHalf / totalHalves > 0.65) {
      shifts.push({
        topicId: topic.id,
        topicLabel: topic.label,
        type: "rising",
        description: `"${topic.label}" is gaining momentum recently.`,
        periodLabel: timeline[timeline.length - 1]?.label || "",
        magnitude: secondHalf / totalHalves,
      });
      continue;
    }

    if (totalHalves > 0 && firstHalf / totalHalves > 0.65) {
      shifts.push({
        topicId: topic.id,
        topicLabel: topic.label,
        type: "declining",
        description: `"${topic.label}" was stronger earlier than it is now.`,
        periodLabel: timeline[0]?.label || "",
        magnitude: firstHalf / totalHalves,
      });
      continue;
    }

    if (totalCount >= 3) {
      shifts.push({
        topicId: topic.id,
        topicLabel: topic.label,
        type: "steady",
        description: `"${topic.label}" has remained a steady interest.`,
        periodLabel: "",
        magnitude: 0.5,
      });
    }
  }

  const order: Record<ShiftType, number> = {
    new: 0,
    rising: 1,
    resurgent: 2,
    steady: 3,
    declining: 4,
    dormant: 5,
  };

  return shifts.sort((left, right) => order[left.type] - order[right.type]);
}

function trimTimeline(timeline: TimelinePeriod[]) {
  let firstNonEmpty = timeline.findIndex((period) => period.totalCount > 0);
  let lastNonEmpty = timeline.length - 1;
  while (lastNonEmpty > 0 && timeline[lastNonEmpty]?.totalCount === 0) {
    lastNonEmpty -= 1;
  }

  if (firstNonEmpty < 0) {
    firstNonEmpty = 0;
  }

  return timeline.slice(firstNonEmpty, lastNonEmpty + 1);
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

function truncate(value: string, max: number) {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1).trim()}...`;
}
