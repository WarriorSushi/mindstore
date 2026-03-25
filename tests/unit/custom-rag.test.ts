import { describe, expect, it, vi } from "vitest";
import {
  type RAGConfig,
  type RetrievalResult,
  type CallAI,
  type RetrieveFn,
  type EmbedFn,
  DEFAULT_CONFIG,
  STRATEGY_INFO,
  hydeRetrieve,
  multiQueryRetrieve,
  rerankRetrieve,
  compressResults,
} from "@/server/plugins/ports/custom-rag";

function makeResult(overrides: Partial<RetrievalResult> = {}): RetrievalResult {
  return {
    memoryId: "mem-1",
    content: "TypeScript is a typed superset of JavaScript.",
    sourceTitle: "TS Docs",
    score: 0.9,
    ...overrides,
  };
}

const mockCallAI: CallAI = async (system, user) => {
  // Multi-query expansion (must check before HyDE since both mention "knowledge base")
  if (system.includes("Generate exactly") || system.includes("alternative search")) {
    return '["what is typescript", "typescript vs javascript", "typed javascript"]';
  }
  // HyDE prompt
  if (system.includes("ideal document") || system.includes("hypothetical")) {
    return "TypeScript provides strong typing on top of JavaScript, enabling better tooling and error detection at compile time.";
  }
  // Reranking
  if (system.includes("Rank these")) {
    return "[2, 1, 3]";
  }
  // Contextual compression
  if (system.includes("Extract ONLY")) {
    return "TypeScript is a typed superset of JavaScript.";
  }
  return "mock response";
};

const mockEmbed: EmbedFn = async (texts) => {
  return texts.map(() => Array(768).fill(0.1));
};

const mockRetrieve: RetrieveFn = async (query, embedding, opts) => {
  return [
    makeResult({ memoryId: "m1", score: 0.9 }),
    makeResult({ memoryId: "m2", content: "JavaScript is a dynamic language", sourceTitle: "JS Docs", score: 0.8 }),
    makeResult({ memoryId: "m3", content: "React is a UI library", sourceTitle: "React Docs", score: 0.7 }),
  ];
};

const deps = { callAI: mockCallAI, embed: mockEmbed, retrieve: mockRetrieve };

describe("custom-rag port", () => {
  it("DEFAULT_CONFIG has sane defaults", () => {
    expect(DEFAULT_CONFIG.activeStrategy).toBe("default");
    expect(DEFAULT_CONFIG.rerankTopK).toBe(20);
    expect(DEFAULT_CONFIG.enabledLayers.bm25).toBe(true);
    expect(DEFAULT_CONFIG.enabledLayers.vector).toBe(true);
    expect(DEFAULT_CONFIG.enabledLayers.tree).toBe(true);
    expect(DEFAULT_CONFIG.rrfK).toBe(60);
  });

  it("STRATEGY_INFO has all 6 strategies", () => {
    const keys = Object.keys(STRATEGY_INFO);
    expect(keys).toHaveLength(6);
    expect(keys).toContain("default");
    expect(keys).toContain("hyde");
    expect(keys).toContain("multi-query");
    expect(keys).toContain("reranking");
    expect(keys).toContain("contextual-compression");
    expect(keys).toContain("maximal");
  });

  it("each strategy info has required fields", () => {
    for (const [key, info] of Object.entries(STRATEGY_INFO)) {
      expect(info.name).toBeTruthy();
      expect(info.description).toBeTruthy();
      expect(info.pros.length).toBeGreaterThan(0);
      expect(info.cons.length).toBeGreaterThan(0);
      expect(info.latency).toBeTruthy();
      expect(info.accuracy).toBeTruthy();
    }
  });

  it("hydeRetrieve generates hypothetical doc and retrieves", async () => {
    const result = await hydeRetrieve("what is typescript", "user-1", 5, deps);

    expect(result.hydeDocument).toContain("TypeScript");
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("multiQueryRetrieve expands queries and merges results", async () => {
    const result = await multiQueryRetrieve("typescript", "user-1", 5, 3, deps);

    expect(result.expandedQueries.length).toBeGreaterThan(1);
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("rerankRetrieve returns reranked results", async () => {
    const manyResultsRetrieve: RetrieveFn = async () => [
      makeResult({ memoryId: "m1", score: 0.9 }),
      makeResult({ memoryId: "m2", content: "JavaScript is a dynamic language", score: 0.8 }),
      makeResult({ memoryId: "m3", content: "React is a UI library", score: 0.7 }),
      makeResult({ memoryId: "m4", content: "Node.js is a runtime", score: 0.6 }),
    ];

    const result = await rerankRetrieve(
      "what is typescript",
      [0.1],
      "user-1",
      5,
      20,
      { callAI: mockCallAI, retrieve: manyResultsRetrieve }
    );

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.rerankedCount).toBe(3); // [2, 1, 3]
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("rerankRetrieve skips reranking for ≤3 results", async () => {
    const fewResultsRetrieve: RetrieveFn = async () => [
      makeResult({ memoryId: "m1" }),
      makeResult({ memoryId: "m2" }),
    ];

    const result = await rerankRetrieve(
      "query",
      null,
      "user-1",
      5,
      10,
      { callAI: mockCallAI, retrieve: fewResultsRetrieve }
    );

    expect(result.rerankedCount).toBe(0); // skipped
  });

  it("compressResults extracts relevant parts", async () => {
    const results = [
      makeResult({ content: "A".repeat(500) }),
      makeResult({ memoryId: "m2", content: "Short" }),
    ];

    const compressed = await compressResults("typescript", results, 200, { callAI: mockCallAI });

    expect(compressed.compressedCount).toBe(2);
    expect(compressed.results).toHaveLength(2);
    expect(compressed.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("compressResults handles empty input", async () => {
    const result = await compressResults("query", [], 200, { callAI: mockCallAI });

    expect(result.results).toHaveLength(0);
    expect(result.compressedCount).toBe(0);
  });
});
