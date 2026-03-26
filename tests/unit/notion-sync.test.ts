import { describe, expect, it } from "vitest";
import {
  type NotionSyncConfig,
  type MemoryForSync,
  defaultSyncConfig,
  formatSourceType,
  filterUnsyncedMemories,
  buildSyncRecord,
} from "@/server/plugins/ports/notion-sync";

function makeMemory(overrides: Partial<MemoryForSync> = {}): MemoryForSync {
  return {
    id: 1,
    content: "TypeScript is a typed superset of JavaScript.",
    sourceType: "url",
    sourceTitle: "TypeScript Docs",
    createdAt: new Date("2024-03-15T10:00:00Z"),
    metadata: {},
    ...overrides,
  };
}

describe("notion-sync port", () => {
  it("defaultSyncConfig returns sane defaults", () => {
    const config = defaultSyncConfig();

    expect(config.syncDirection).toBe("push");
    expect(config.autoSync).toBe(false);
    expect(config.syncInterval).toBe(60);
    expect(config.syncedMemoryIds).toEqual([]);
    expect(config.totalSynced).toBe(0);
    expect(config.syncHistory).toEqual([]);
    expect(config.apiToken).toBeUndefined();
  });

  it("formatSourceType maps known types correctly", () => {
    expect(formatSourceType("chatgpt")).toBe("ChatGPT");
    expect(formatSourceType("kindle")).toBe("Kindle");
    expect(formatSourceType("youtube")).toBe("YouTube");
    expect(formatSourceType("reddit")).toBe("Reddit");
    expect(formatSourceType("url")).toBe("URL");
    expect(formatSourceType("file")).toBe("File");
    expect(formatSourceType("text")).toBe("Text");
  });

  it("formatSourceType returns Text for unknown types", () => {
    expect(formatSourceType("some-random-source")).toBe("Text");
    expect(formatSourceType("")).toBe("Text");
  });

  it("filterUnsyncedMemories excludes already-synced IDs", () => {
    const memories = [
      makeMemory({ id: 1 }),
      makeMemory({ id: 2 }),
      makeMemory({ id: 3 }),
    ];
    const syncedIds = new Set(["1", "3"]);

    const unsynced = filterUnsyncedMemories(memories, syncedIds);
    expect(unsynced).toHaveLength(1);
    expect(unsynced[0]!.id).toBe(2);
  });

  it("filterUnsyncedMemories filters by source type", () => {
    const memories = [
      makeMemory({ id: 1, sourceType: "url" }),
      makeMemory({ id: 2, sourceType: "kindle" }),
      makeMemory({ id: 3, sourceType: "chatgpt" }),
    ];

    const filtered = filterUnsyncedMemories(memories, new Set(), ["url", "kindle"]);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((m) => m.sourceType)).toEqual(["url", "kindle"]);
  });

  it("filterUnsyncedMemories combines synced exclusion and source filter", () => {
    const memories = [
      makeMemory({ id: 1, sourceType: "url" }),
      makeMemory({ id: 2, sourceType: "url" }),
      makeMemory({ id: 3, sourceType: "kindle" }),
    ];

    const filtered = filterUnsyncedMemories(memories, new Set(["1"]), ["url"]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.id).toBe(2);
  });

  it("buildSyncRecord creates success record when no errors", () => {
    const record = buildSyncRecord(10, []);

    expect(record.direction).toBe("push");
    expect(record.count).toBe(10);
    expect(record.status).toBe("success");
    expect(record.errors).toEqual([]);
    expect(record.timestamp).toBeTruthy();
    expect(record.id).toBeTruthy();
  });

  it("buildSyncRecord creates partial record with errors", () => {
    const record = buildSyncRecord(5, ["Memory 3: rate limited", "Memory 7: timeout"]);

    expect(record.status).toBe("partial");
    expect(record.count).toBe(5);
    expect(record.errors).toHaveLength(2);
  });

  it("buildSyncRecord creates failed record when 0 successes", () => {
    const record = buildSyncRecord(0, ["All failed"]);

    expect(record.status).toBe("failed");
    expect(record.count).toBe(0);
  });

  it("buildSyncRecord truncates errors to 5", () => {
    const errors = Array.from({ length: 20 }, (_, i) => `Error ${i}`);
    const record = buildSyncRecord(0, errors);

    expect(record.errors).toHaveLength(5);
  });
});
