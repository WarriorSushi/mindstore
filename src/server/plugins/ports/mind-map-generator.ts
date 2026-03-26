import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { PLUGIN_MANIFESTS } from "@/server/plugins/registry";
import {
  countSourceTypes,
  cosineSimilarity,
  extractKeywords,
  extractTopicLabel,
  kMeansClustering,
  parseEmbedding,
  type EmbeddedMemoryLike,
} from "@/server/plugins/ports/shared-vectors";

const PLUGIN_SLUG = "mind-map-generator";

export interface MindMapMemory extends EmbeddedMemoryLike {
  pinned: boolean;
}

export interface SimplifiedMindMapMemory {
  id: string;
  title: string;
  preview: string;
  sourceType: string;
  sourceTitle: string;
  pinned: boolean;
}

export interface MindMapTopicNode {
  id: string;
  label: string;
  keywords: string[];
  memoryCount: number;
  memories: SimplifiedMindMapMemory[];
  children: MindMapTopicNode[];
  sourceTypes: Record<string, number>;
  coherence: number;
}

export interface MindMapTree {
  id: string;
  label: string;
  memoryCount: number;
  children: MindMapTopicNode[];
}

export interface MindMapConnection {
  source: string;
  target: string;
  strength: number;
}

export interface MindMapResponse {
  tree: MindMapTree;
  connections: MindMapConnection[];
  stats: {
    totalMemories: number;
    topicCount: number;
    subTopicCount: number;
    maxDepth: number;
    avgTopicSize: number;
    largestTopic: string;
    largestTopicSize: number;
    connectionCount: number;
  };
}

export async function ensureMindMapInstalled() {
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

export async function generateMindMap(
  userId: string,
  input: { maxTopics?: number; maxDepth?: number } = {},
): Promise<MindMapResponse> {
  const rows = await db.execute(sql`
    SELECT id, content, source_type, source_title, embedding, created_at, metadata
    FROM memories
    WHERE user_id = ${userId}::uuid
      AND embedding IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 500
  `) as unknown as Array<Record<string, unknown>>;

  const memories = rows
    .map((row) => ({
      id: String(row.id),
      content: String(row.content || ""),
      sourceType: String(row.source_type || "unknown"),
      sourceTitle: typeof row.source_title === "string" ? row.source_title : "Untitled",
      embedding: parseEmbedding(row.embedding),
      createdAt: normalizeDate(row.created_at),
      pinned: Boolean((row.metadata as { pinned?: boolean } | null)?.pinned),
    }))
    .filter((memory) => memory.embedding.length > 0);

  return buildMindMapFromMemories(memories, input);
}

export function buildMindMapFromMemories(
  memories: MindMapMemory[],
  input: { maxTopics?: number; maxDepth?: number } = {},
): MindMapResponse {
  if (!memories.length) {
    return emptyMindMap();
  }

  const maxTopics = Math.min(input.maxTopics || 12, 20);
  const maxDepth = Math.min(input.maxDepth || 3, 4);
  const clusterCount = Math.min(maxTopics, Math.max(3, Math.floor(memories.length / 5)));
  const clusters = kMeansClustering(memories, clusterCount, 15);

  const sortedClusters = [...clusters].sort((left, right) => right.members.length - left.members.length);
  const topicNodes = sortedClusters.map((cluster, topicIndex) => {
    const children = buildSubTopics(cluster.members, maxDepth, topicIndex);
    return {
      id: `topic-${topicIndex}`,
      label: extractTopicLabel(cluster.members),
      keywords: extractKeywords(cluster.members, 5),
      memoryCount: cluster.members.length,
      memories: children.length ? [] : cluster.members.slice(0, 8).map(simplifyMemory),
      children,
      sourceTypes: countSourceTypes(cluster.members),
      coherence: cluster.coherence,
    } satisfies MindMapTopicNode;
  });

  const connections: MindMapConnection[] = [];
  for (let index = 0; index < sortedClusters.length; index += 1) {
    for (let compare = index + 1; compare < sortedClusters.length; compare += 1) {
      const similarity = cosineSimilarity(
        sortedClusters[index]?.centroid || [],
        sortedClusters[compare]?.centroid || [],
      );
      if (similarity > 0.6) {
        connections.push({
          source: `topic-${index}`,
          target: `topic-${compare}`,
          strength: round(similarity, 2),
        });
      }
    }
  }

  const tree: MindMapTree = {
    id: "root",
    label: "Your Mind",
    memoryCount: memories.length,
    children: topicNodes,
  };

  return {
    tree,
    connections: connections.sort((left, right) => right.strength - left.strength),
    stats: {
      totalMemories: memories.length,
      topicCount: topicNodes.length,
      subTopicCount: topicNodes.reduce((sum, topic) => sum + topic.children.length, 0),
      maxDepth: topicNodes.some((topic) => topic.children.length > 0) ? 2 : 1,
      avgTopicSize: Math.round(memories.length / Math.max(1, topicNodes.length)),
      largestTopic: topicNodes[0]?.label || "",
      largestTopicSize: topicNodes[0]?.memoryCount || 0,
      connectionCount: connections.length,
    },
  };
}

function buildSubTopics(memories: MindMapMemory[], maxDepth: number, topicIndex: number) {
  if (memories.length < 6 || maxDepth < 2) {
    return [];
  }

  const subClusters = kMeansClustering(
    memories,
    Math.min(4, Math.max(2, Math.floor(memories.length / 3))),
    10,
  );

  return subClusters
    .filter((cluster) => cluster.members.length > 0)
    .map((cluster, childIndex) => ({
      id: `sub-${topicIndex}-${childIndex}`,
      label: extractTopicLabel(cluster.members),
      keywords: extractKeywords(cluster.members, 3),
      memoryCount: cluster.members.length,
      memories: cluster.members.slice(0, 8).map(simplifyMemory),
      children: [],
      sourceTypes: countSourceTypes(cluster.members),
      coherence: cluster.coherence,
    }));
}

function simplifyMemory(memory: MindMapMemory): SimplifiedMindMapMemory {
  const firstLine = memory.content.split("\n")[0]?.trim() || memory.content;
  return {
    id: memory.id,
    title: memory.sourceTitle || truncate(firstLine, 40),
    preview: truncate(memory.content.replace(/\n/g, " "), 120),
    sourceType: memory.sourceType,
    sourceTitle: memory.sourceTitle,
    pinned: memory.pinned,
  };
}

function emptyMindMap(): MindMapResponse {
  return {
    tree: {
      id: "root",
      label: "Your Mind",
      memoryCount: 0,
      children: [],
    },
    connections: [],
    stats: {
      totalMemories: 0,
      topicCount: 0,
      subTopicCount: 0,
      maxDepth: 0,
      avgTopicSize: 0,
      largestTopic: "",
      largestTopicSize: 0,
      connectionCount: 0,
    },
  };
}

function normalizeDate(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string" || typeof value === "number") {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
}

function truncate(value: string, max: number) {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 3).trim()}...`;
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
