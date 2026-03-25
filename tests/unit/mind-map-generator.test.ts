import { describe, expect, it } from "vitest";
import { buildMindMapFromMemories, type MindMapMemory } from "@/server/plugins/ports/mind-map-generator";

describe("mind map generator port", () => {
  it("returns an empty response for empty memory sets", () => {
    const result = buildMindMapFromMemories([]);
    expect(result.tree.memoryCount).toBe(0);
    expect(result.stats.topicCount).toBe(0);
  });

  it("builds a deterministic topic tree when each memory becomes its own cluster", () => {
    const memories: MindMapMemory[] = [
      {
        id: "1",
        content: "Distributed systems notes",
        sourceType: "text",
        sourceTitle: "Systems",
        embedding: [1, 0, 0],
        createdAt: "2026-03-01T00:00:00.000Z",
        pinned: false,
      },
      {
        id: "2",
        content: "Design critique session",
        sourceType: "text",
        sourceTitle: "Design",
        embedding: [0, 1, 0],
        createdAt: "2026-03-02T00:00:00.000Z",
        pinned: true,
      },
      {
        id: "3",
        content: "Research ideas about tooling",
        sourceType: "file",
        sourceTitle: "Research",
        embedding: [0, 0, 1],
        createdAt: "2026-03-03T00:00:00.000Z",
        pinned: false,
      },
    ];

    const result = buildMindMapFromMemories(memories, { maxTopics: 3, maxDepth: 1 });

    expect(result.tree.memoryCount).toBe(3);
    expect(result.stats.topicCount).toBe(3);
    expect(result.tree.children.every((child) => child.memories.length === 1)).toBe(true);
  });
});
