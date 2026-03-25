/**
 * Mind Map Generator — Portable logic module
 * 
 * Extracted from the route for convergence with codex runtime.
 * Handles: hierarchical clustering, tree building, cross-topic connections.
 * Uses shared-vectors for clustering.
 * 
 * Zero AI dependency — pure algorithmic.
 */

import {
  type ClusterMember,
  kMeansClustering,
  cosineSimilarity,
  extractKeywords,
  extractTopicLabel,
  countSourceTypes,
  truncate,
} from './shared-vectors';

// ─── Types ────────────────────────────────────────────────────

export interface MindMapMemory extends ClusterMember {
  id: string;
  content: string;
  embedding: number[];
  sourceType: string;
  sourceTitle: string;
  createdAt: string;
  pinned?: boolean;
}

export interface SimplifiedMemory {
  id: string;
  title: string;
  preview: string;
  sourceType: string;
  sourceTitle: string;
  pinned: boolean;
}

export interface TopicNode {
  id: string;
  label: string;
  keywords: string[];
  memoryCount: number;
  memories: SimplifiedMemory[];
  children: TopicNode[];
  sourceTypes: Record<string, number>;
  coherence: number;
}

export interface MindMapTree {
  id: string;
  label: string;
  memoryCount: number;
  children: TopicNode[];
}

export interface CrossConnection {
  source: string;
  target: string;
  strength: number;
}

export interface MindMapResult {
  tree: MindMapTree;
  connections: CrossConnection[];
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

// ─── Main Pipeline ────────────────────────────────────────────

export function generateMindMap(
  memories: MindMapMemory[],
  maxTopics = 12,
  maxDepth = 3,
): MindMapResult {
  if (memories.length === 0) {
    return {
      tree: { id: 'root', label: 'Your Mind', children: [], memoryCount: 0 },
      connections: [],
      stats: { totalMemories: 0, topicCount: 0, subTopicCount: 0, maxDepth: 0, avgTopicSize: 0, largestTopic: '', largestTopicSize: 0, connectionCount: 0 },
    };
  }

  const numClusters = Math.min(maxTopics, Math.max(3, Math.floor(memories.length / 5)));
  const clusters = kMeansClustering(memories, numClusters, 15);

  const topicNodes: TopicNode[] = [];

  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i]!;
    if (cluster.members.length === 0) continue;

    const topicLabel = extractTopicLabel(cluster.members);
    const topicKeywords = extractKeywords(cluster.members, 5);

    // Sub-cluster for large topics
    let children: TopicNode[] = [];
    if (cluster.members.length >= 6 && maxDepth >= 2) {
      const subClusters = kMeansClustering(
        cluster.members,
        Math.min(4, Math.floor(cluster.members.length / 3)),
        10,
      );
      for (const sub of subClusters) {
        if (sub.members.length === 0) continue;
        children.push({
          id: `sub-${i}-${children.length}`,
          label: extractTopicLabel(sub.members),
          keywords: extractKeywords(sub.members, 3),
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
      memories: children.length > 0 ? [] : cluster.members.slice(0, 8).map(simplifyMemory),
      children,
      sourceTypes: countSourceTypes(cluster.members),
      coherence: cluster.coherence,
    });
  }

  topicNodes.sort((a, b) => b.memoryCount - a.memoryCount);

  // Cross-topic connections
  const connections: CrossConnection[] = [];
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const sim = cosineSimilarity(clusters[i]!.centroid, clusters[j]!.centroid);
      if (sim > 0.6) {
        connections.push({
          source: topicNodes[i]?.id || `topic-${i}`,
          target: topicNodes[j]?.id || `topic-${j}`,
          strength: sim,
        });
      }
    }
  }
  connections.sort((a, b) => b.strength - a.strength);

  const tree: MindMapTree = {
    id: 'root',
    label: 'Your Mind',
    memoryCount: memories.length,
    children: topicNodes,
  };

  return {
    tree, connections,
    stats: {
      totalMemories: memories.length,
      topicCount: topicNodes.length,
      subTopicCount: topicNodes.reduce((sum, t) => sum + t.children.length, 0),
      maxDepth: topicNodes.some(t => t.children.length > 0) ? 2 : 1,
      avgTopicSize: Math.round(memories.length / Math.max(topicNodes.length, 1)),
      largestTopic: topicNodes[0]?.label || '',
      largestTopicSize: topicNodes[0]?.memoryCount || 0,
      connectionCount: connections.length,
    },
  };
}

// ─── Memory Simplification ───────────────────────────────────

export function simplifyMemory(m: MindMapMemory): SimplifiedMemory {
  return {
    id: m.id,
    title: m.sourceTitle || truncate(m.content.split('\n')[0]!, 50),
    preview: truncate(m.content.replace(/\n/g, ' '), 100),
    sourceType: m.sourceType,
    sourceTitle: m.sourceTitle,
    pinned: m.pinned || false,
  };
}
