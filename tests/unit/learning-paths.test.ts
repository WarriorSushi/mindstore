import { describe, expect, it } from "vitest";
import {
  computeLearningPathProgress,
  normalizeLearningDepth,
  normalizeLearningDifficulty,
  normalizeLearningNodeType,
  normalizeLearningResourceType,
} from "@/server/plugins/ports/learning-paths";
import type { LearningPathNode } from "@/server/plugins/ports/learning-paths";

describe("learning paths port", () => {
  it("computes progress as a percentage of completed nodes", () => {
    const nodes = [
      { completed: true },
      { completed: true },
      { completed: false },
      { completed: false },
    ] as LearningPathNode[];

    expect(computeLearningPathProgress(nodes)).toBe(50);
  });

  it("returns 0 for empty node list", () => {
    expect(computeLearningPathProgress([])).toBe(0);
  });

  it("returns 100 when all nodes are complete", () => {
    const nodes = [
      { completed: true },
      { completed: true },
      { completed: true },
    ] as LearningPathNode[];

    expect(computeLearningPathProgress(nodes)).toBe(100);
  });

  it("rounds to nearest integer", () => {
    const nodes = [
      { completed: true },
      { completed: false },
      { completed: false },
    ] as LearningPathNode[];

    expect(computeLearningPathProgress(nodes)).toBe(33);
  });

  it("normalizes valid difficulty values", () => {
    expect(normalizeLearningDifficulty("beginner")).toBe("beginner");
    expect(normalizeLearningDifficulty("intermediate")).toBe("intermediate");
    expect(normalizeLearningDifficulty("advanced")).toBe("advanced");
    expect(normalizeLearningDifficulty("mixed")).toBe("mixed");
  });

  it("defaults unknown difficulty to mixed", () => {
    expect(normalizeLearningDifficulty("easy")).toBe("mixed");
    expect(normalizeLearningDifficulty(null)).toBe("mixed");
    expect(normalizeLearningDifficulty(undefined)).toBe("mixed");
  });

  it("normalizes node types and defaults to concept", () => {
    expect(normalizeLearningNodeType("practice")).toBe("practice");
    expect(normalizeLearningNodeType("project")).toBe("project");
    expect(normalizeLearningNodeType("milestone")).toBe("milestone");
    expect(normalizeLearningNodeType("quiz")).toBe("concept");
  });

  it("normalizes depth and defaults to beginner", () => {
    expect(normalizeLearningDepth("advanced")).toBe("advanced");
    expect(normalizeLearningDepth("expert")).toBe("beginner");
  });

  it("normalizes resource types and defaults to article", () => {
    expect(normalizeLearningResourceType("video")).toBe("video");
    expect(normalizeLearningResourceType("book")).toBe("book");
    expect(normalizeLearningResourceType("podcast")).toBe("article");
  });
});
