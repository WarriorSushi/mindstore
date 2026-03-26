import { describe, expect, it } from "vitest";
import {
  parseEmbedding,
  cosineSimilarity,
  kMeansClustering,
  computeCoherence,
  extractKeywords,
  extractTopicLabel,
  countSourceTypes,
} from "@/server/plugins/ports/shared-vectors";

describe("shared-vectors", () => {
  // ─── parseEmbedding ─────────────────────────────────────────────

  describe("parseEmbedding", () => {
    it("returns empty array for falsy input", () => {
      expect(parseEmbedding(null)).toEqual([]);
      expect(parseEmbedding(undefined)).toEqual([]);
      expect(parseEmbedding(0)).toEqual([]);
    });

    it("passes through numeric arrays", () => {
      expect(parseEmbedding([0.1, 0.2, 0.3])).toEqual([0.1, 0.2, 0.3]);
    });

    it("filters non-numeric values from arrays", () => {
      expect(parseEmbedding([0.1, "bad", 0.3])).toEqual([0.1, 0.3]);
    });

    it("parses string representation of embedding", () => {
      expect(parseEmbedding("[0.1,0.2,0.3]")).toEqual([0.1, 0.2, 0.3]);
    });

    it("handles malformed strings gracefully", () => {
      expect(parseEmbedding("not an embedding")).toEqual([]);
    });

    it("returns empty for non-array objects", () => {
      expect(parseEmbedding({ x: 1 })).toEqual([]);
    });
  });

  // ─── cosineSimilarity ──────────────────────────────────────────

  describe("cosineSimilarity", () => {
    it("returns 1 for identical vectors", () => {
      expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBe(1);
    });

    it("returns 0 for orthogonal vectors", () => {
      expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    });

    it("returns -1 for opposite vectors", () => {
      expect(cosineSimilarity([1, 0], [-1, 0])).toBe(-1);
    });

    it("returns 0 for empty vectors", () => {
      expect(cosineSimilarity([], [])).toBe(0);
    });

    it("returns 0 for mismatched dimensions", () => {
      expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
    });

    it("computes correct similarity for non-unit vectors", () => {
      const sim = cosineSimilarity([3, 4], [4, 3]);
      expect(sim).toBeCloseTo(0.96, 2);
    });
  });

  // ─── kMeansClustering ─────────────────────────────────────────

  describe("kMeansClustering", () => {
    it("returns empty for no items", () => {
      expect(kMeansClustering([], 3, 10)).toEqual([]);
    });

    it("returns one cluster per item when k >= items", () => {
      const items = [
        { embedding: [1, 0] },
        { embedding: [0, 1] },
      ];
      const clusters = kMeansClustering(items, 5, 10);
      expect(clusters).toHaveLength(2);
      expect(clusters[0].members).toHaveLength(1);
      expect(clusters[1].members).toHaveLength(1);
    });

    it("assigns all items to clusters", () => {
      const items = [
        { embedding: [1, 0, 0] },
        { embedding: [0.9, 0.1, 0] },
        { embedding: [0, 0, 1] },
        { embedding: [0, 0.1, 0.9] },
      ];
      const clusters = kMeansClustering(items, 2, 20);
      const totalMembers = clusters.reduce((sum, c) => sum + c.members.length, 0);
      expect(totalMembers).toBe(4);
      expect(clusters.length).toBeGreaterThanOrEqual(1);
      expect(clusters.length).toBeLessThanOrEqual(2);
    });
  });

  // ─── computeCoherence ─────────────────────────────────────────

  describe("computeCoherence", () => {
    it("returns 1 for single member", () => {
      expect(computeCoherence([1, 0], [{ embedding: [1, 0] }])).toBe(1);
    });

    it("returns high coherence for similar items", () => {
      const centroid = [1, 0];
      const members = [
        { embedding: [0.99, 0.01] },
        { embedding: [0.98, 0.02] },
      ];
      const c = computeCoherence(centroid, members);
      expect(c).toBeGreaterThan(0.9);
    });
  });

  // ─── extractKeywords ──────────────────────────────────────────

  describe("extractKeywords", () => {
    it("extracts frequent non-stop words", () => {
      const items = [
        { content: "quantum computing research paper" },
        { content: "quantum mechanics and computing" },
        { content: "advanced quantum physics paper" },
      ];
      const keywords = extractKeywords(items, 3);
      expect(keywords).toContain("quantum");
      expect(keywords.length).toBeLessThanOrEqual(3);
    });

    it("filters stop words", () => {
      const items = [
        { content: "the the the a a a is is is" },
        { content: "the the the a a a is is is" },
      ];
      const keywords = extractKeywords(items, 5);
      expect(keywords).toEqual([]);
    });

    it("returns empty for no content", () => {
      expect(extractKeywords([], 5)).toEqual([]);
    });
  });

  // ─── extractTopicLabel ────────────────────────────────────────

  describe("extractTopicLabel", () => {
    it("uses dominant source title when > 60%", () => {
      const items = [
        { content: "text", sourceTitle: "Machine Learning" },
        { content: "text", sourceTitle: "Machine Learning" },
        { content: "text", sourceTitle: "Other" },
      ];
      expect(extractTopicLabel(items)).toBe("Machine Learning");
    });

    it("falls back to keywords when no dominant source", () => {
      const items = [
        { content: "quantum computing breakthrough", sourceTitle: "Source A" },
        { content: "quantum physics discovery", sourceTitle: "Source B" },
        { content: "neural network computing", sourceTitle: "Source C" },
      ];
      const label = extractTopicLabel(items);
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    });

    it("generates fallback for empty content", () => {
      const items = [
        { content: "", sourceTitle: "A" },
        { content: "", sourceTitle: "B" },
        { content: "", sourceTitle: "C" },
      ];
      const label = extractTopicLabel(items);
      expect(label).toMatch(/^Topic \d+$/);
    });
  });

  // ─── countSourceTypes ─────────────────────────────────────────

  describe("countSourceTypes", () => {
    it("counts source type frequencies", () => {
      const items = [
        { sourceType: "kindle" },
        { sourceType: "kindle" },
        { sourceType: "pdf" },
        { sourceType: "web" },
      ];
      expect(countSourceTypes(items)).toEqual({
        kindle: 2,
        pdf: 1,
        web: 1,
      });
    });

    it("returns empty for no items", () => {
      expect(countSourceTypes([])).toEqual({});
    });
  });
});
