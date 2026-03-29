import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  executeMock,
  getEmbeddingConfigMock,
  generateEmbeddingsMock,
  buildTreeIndexMock,
} = vi.hoisted(() => ({
  executeMock: vi.fn(),
  getEmbeddingConfigMock: vi.fn(),
  generateEmbeddingsMock: vi.fn(),
  buildTreeIndexMock: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: {
    execute: executeMock,
  },
}));

vi.mock("@/server/embeddings", () => ({
  getEmbeddingConfig: getEmbeddingConfigMock,
  generateEmbeddings: generateEmbeddingsMock,
}));

vi.mock("@/server/retrieval", () => ({
  buildTreeIndex: buildTreeIndexMock,
}));

import { runEmbeddingBackfillBatch, scheduleEmbeddingBackfill } from "@/server/indexing-jobs";

describe("indexing jobs", () => {
  beforeEach(() => {
    executeMock.mockReset();
    getEmbeddingConfigMock.mockReset();
    generateEmbeddingsMock.mockReset();
    buildTreeIndexMock.mockReset();
  });

  it("creates a new embedding backfill job when memories still need vectors", async () => {
    executeMock
      .mockResolvedValueOnce([{ total: 5, with_embeddings: 2, without_embeddings: 3 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "job-1",
          user_id: "user-1",
          job_type: "embedding_backfill",
          status: "pending",
          reason: "import-too-large-for-inline-embedding",
          provider: null,
          requested_count: 3,
          processed_count: 0,
          remaining_count: 3,
          last_error: null,
          metadata: { surface: "unit-test" },
          scheduled_at: "2026-03-30T00:00:00.000Z",
          started_at: null,
          completed_at: null,
          updated_at: "2026-03-30T00:00:00.000Z",
        },
      ]);

    const job = await scheduleEmbeddingBackfill({
      userId: "user-1",
      requestedCount: 3,
      reason: "import-too-large-for-inline-embedding",
      metadata: { surface: "unit-test" },
    });

    expect(job?.id).toBe("job-1");
    expect(job?.status).toBe("pending");
    expect(job?.remainingCount).toBe(3);
  });

  it("marks backfill as blocked when no provider is configured", async () => {
    executeMock
      .mockResolvedValueOnce([
        {
          id: "job-2",
          user_id: "user-2",
          job_type: "embedding_backfill",
          status: "pending",
          reason: "manual-reindex-request",
          provider: null,
          requested_count: 4,
          processed_count: 0,
          remaining_count: 4,
          last_error: null,
          metadata: {},
          scheduled_at: "2026-03-30T00:00:00.000Z",
          started_at: null,
          completed_at: null,
          updated_at: "2026-03-30T00:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([{ total: 4, with_embeddings: 0, without_embeddings: 4 }])
      .mockResolvedValueOnce([
        {
          id: "job-2",
          user_id: "user-2",
          job_type: "embedding_backfill",
          status: "pending",
          reason: "manual-reindex-request",
          provider: null,
          requested_count: 4,
          processed_count: 0,
          remaining_count: 4,
          last_error: null,
          metadata: {},
          scheduled_at: "2026-03-30T00:00:00.000Z",
          started_at: null,
          completed_at: null,
          updated_at: "2026-03-30T00:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "job-2",
          user_id: "user-2",
          job_type: "embedding_backfill",
          status: "blocked",
          reason: "manual-reindex-request",
          provider: null,
          requested_count: 4,
          processed_count: 0,
          remaining_count: 4,
          last_error: "No embedding provider configured",
          metadata: {},
          scheduled_at: "2026-03-30T00:00:00.000Z",
          started_at: null,
          completed_at: null,
          updated_at: "2026-03-30T00:01:00.000Z",
        },
      ]);

    getEmbeddingConfigMock.mockResolvedValue(null);

    const result = await runEmbeddingBackfillBatch({ userId: "user-2" });

    expect(result?.job.status).toBe("blocked");
    expect(result?.remaining).toBe(4);
    expect(result?.message).toContain("no embedding provider");
  });
});
