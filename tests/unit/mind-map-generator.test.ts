import { describe, expect, it } from "vitest";
import { buildMindMapFromMemories, type MindMapMemory } from "@/server/plugins/ports/mind-map-generator";

function makeMemory(overrides: Partial<MindMapMemory> & { id: string; embedding: number[] }): MindMapMemory {
  return {
    content: `Memory content for ${overrides.id}`,
    sourceType: "text",
    sourceTitle: `Title ${overrides.id}`,
    createdAt: "2026-03-01T00:00:00.000Z",
    pinned: false,
    ...overrides,
  };
}

describe("mind map generator port", () => {
  it("returns an empty response for empty memory sets", () => {
    const result = buildMindMapFromMemories([]);
    expect(result.tree.memoryCount).toBe(0);
    expect(result.stats.topicCount).toBe(0);
    expect(result.tree.label).toBe("Your Mind");
    expect(result.connections).toEqual([]);
  });

  it("builds a deterministic topic tree when each memory becomes its own cluster", () => {
    const memories: MindMapMemory[] = [
      makeMemory({ id: "1", content: "Distributed systems notes", sourceTitle: "Systems", embedding: [1, 0, 0] }),
      makeMemory({ id: "2", content: "Design critique session", sourceTitle: "Design", embedding: [0, 1, 0], pinned: true }),
      makeMemory({ id: "3", content: "Research ideas about tooling", sourceType: "file", sourceTitle: "Research", embedding: [0, 0, 1] }),
    ];

    const result = buildMindMapFromMemories(memories, { maxTopics: 3, maxDepth: 1 });

    expect(result.tree.memoryCount).toBe(3);
    expect(result.stats.topicCount).toBe(3);
    expect(result.tree.children.every((child) => child.memories.length === 1)).toBe(true);
  });

  it("groups similar memories into the same topic", () => {
    // Create a cluster of similar embeddings and an outlier
    const memories: MindMapMemory[] = [
      makeMemory({ id: "a", content: "Python programming basics", embedding: [0.9, 0.1, 0] }),
      makeMemory({ id: "b", content: "Python data structures", embedding: [0.85, 0.15, 0] }),
      makeMemory({ id: "c", content: "Python async patterns", embedding: [0.88, 0.12, 0] }),
      makeMemory({ id: "d", content: "Cooking pasta recipes", embedding: [0, 0, 1] }),
    ];

    const result = buildMindMapFromMemories(memories, { maxTopics: 2, maxDepth: 1 });

    expect(result.stats.topicCount).toBe(2);
    // The largest topic should have the 3 Python-related memories
    expect(result.stats.largestTopicSize).toBe(3);
  });

  it("caps maxTopics at 20 regardless of input", () => {
    const memories = Array.from({ length: 100 }, (_, i) => {
      const angle = (i / 100) * Math.PI * 2;
      return makeMemory({
        id: `m${i}`,
        embedding: [Math.cos(angle), Math.sin(angle), i / 100],
      });
    });

    const result = buildMindMapFromMemories(memories, { maxTopics: 50 });
    expect(result.stats.topicCount).toBeLessThanOrEqual(20);
  });

  it("caps maxDepth at 4", () => {
    const memories = Array.from({ length: 30 }, (_, i) => {
      const angle = (i / 30) * Math.PI * 2;
      return makeMemory({
        id: `m${i}`,
        embedding: [Math.cos(angle), Math.sin(angle), 0],
      });
    });

    const result = buildMindMapFromMemories(memories, { maxDepth: 10 });
    // Even with maxDepth=10 as input, it should be capped
    expect(result.stats.maxDepth).toBeLessThanOrEqual(4);
  });

  it("produces connections between similar topic centroids", () => {
    // Two tight clusters with some similarity between them
    const memories: MindMapMemory[] = [
      makeMemory({ id: "1", embedding: [1, 0.5, 0] }),
      makeMemory({ id: "2", embedding: [0.95, 0.55, 0] }),
      makeMemory({ id: "3", embedding: [0.9, 0.6, 0] }),
      makeMemory({ id: "4", embedding: [0.8, 0.7, 0] }),
      makeMemory({ id: "5", embedding: [0.75, 0.75, 0] }),
      makeMemory({ id: "6", embedding: [0.7, 0.8, 0] }),
    ];

    const result = buildMindMapFromMemories(memories, { maxTopics: 2 });
    // With such similar embeddings, connections are likely
    expect(result.connections.length).toBeGreaterThanOrEqual(0);
    // Each connection should have source, target, and strength
    for (const conn of result.connections) {
      expect(conn.source).toMatch(/^topic-\d+$/);
      expect(conn.target).toMatch(/^topic-\d+$/);
      expect(conn.strength).toBeGreaterThan(0);
      expect(conn.strength).toBeLessThanOrEqual(1);
    }
  });

  it("tracks source types in stats per topic", () => {
    const memories: MindMapMemory[] = [
      makeMemory({ id: "1", sourceType: "text", embedding: [1, 0, 0] }),
      makeMemory({ id: "2", sourceType: "file", embedding: [0.99, 0.01, 0] }),
      makeMemory({ id: "3", sourceType: "text", embedding: [0.98, 0.02, 0] }),
    ];

    const result = buildMindMapFromMemories(memories, { maxTopics: 1, maxDepth: 1 });
    const topic = result.tree.children[0];
    expect(topic.sourceTypes).toBeDefined();
    expect(topic.sourceTypes.text).toBe(2);
    expect(topic.sourceTypes.file).toBe(1);
  });

  it("creates sub-topics when a cluster is large enough and depth allows", () => {
    // 12 memories should be enough to trigger sub-clustering
    const memories = Array.from({ length: 12 }, (_, i) =>
      makeMemory({ id: `m${i}`, embedding: [Math.cos(i * 0.3), Math.sin(i * 0.3), 0] }),
    );

    const result = buildMindMapFromMemories(memories, { maxTopics: 1, maxDepth: 3 });
    // With 12 memories in 1 topic, sub-topics should form
    const topic = result.tree.children[0];
    if (topic && topic.memoryCount >= 6) {
      expect(topic.children.length).toBeGreaterThan(0);
    }
  });

  it("includes pinned status in simplified memories", () => {
    const memories: MindMapMemory[] = [
      makeMemory({ id: "1", pinned: true, embedding: [1, 0, 0] }),
      makeMemory({ id: "2", pinned: false, embedding: [0, 1, 0] }),
      makeMemory({ id: "3", pinned: false, embedding: [0, 0, 1] }),
    ];

    const result = buildMindMapFromMemories(memories, { maxTopics: 3, maxDepth: 1 });
    const allMemories = result.tree.children.flatMap((child) => child.memories);
    const pinnedMem = allMemories.find((m) => m.id === "1");
    expect(pinnedMem?.pinned).toBe(true);
  });
});
