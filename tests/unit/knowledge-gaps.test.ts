import { describe, expect, it } from "vitest";
import {
  findBridgeGaps,
  findIsolatedTopics,
  getDensityLevel,
  type KnowledgeTopic,
} from "@/server/plugins/ports/knowledge-gaps";

describe("knowledge gaps port", () => {
  it("classifies sparse and deep coverage based on size and coherence", () => {
    expect(getDensityLevel(1, 50, 0.9)).toBe("sparse");
    expect(getDensityLevel(12, 80, 0.82)).toBe("deep");
  });

  it("finds bridge gaps for moderately similar topics", () => {
    const topics: KnowledgeTopic[] = [
      { id: "topic-0", label: "Systems", keywords: [], memoryCount: 3, coherence: 0.7, density: "thin", sourceTypes: {}, avgAge: 10, recentActivity: true, previewMemories: [] },
      { id: "topic-1", label: "Design", keywords: [], memoryCount: 2, coherence: 0.7, density: "sparse", sourceTypes: {}, avgAge: 12, recentActivity: true, previewMemories: [] },
    ];

    const gaps = findBridgeGaps(
      [
        { centroid: [1, 0, 0] },
        { centroid: [0.6, 0.8, 0] },
      ],
      topics,
    );

    expect(gaps.length).toBe(1);
    expect(gaps[0]?.type).toBe("bridge-gap");
  });

  it("marks weakly connected topics as isolated", () => {
    const topics: KnowledgeTopic[] = [
      { id: "topic-0", label: "Alpha", keywords: [], memoryCount: 4, coherence: 0.7, density: "thin", sourceTypes: {}, avgAge: 10, recentActivity: true, previewMemories: [] },
      { id: "topic-1", label: "Beta", keywords: [], memoryCount: 4, coherence: 0.7, density: "thin", sourceTypes: {}, avgAge: 10, recentActivity: true, previewMemories: [] },
      { id: "topic-2", label: "Gamma", keywords: [], memoryCount: 4, coherence: 0.7, density: "thin", sourceTypes: {}, avgAge: 10, recentActivity: true, previewMemories: [] },
    ];

    const gaps = findIsolatedTopics(
      [
        { centroid: [1, 0, 0] },
        { centroid: [0.05, 1, 0] },
        { centroid: [0.05, 0.1, 1] },
      ],
      topics,
    );

    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.some((gap) => gap.type === "isolated-topic")).toBe(true);
  });
});
