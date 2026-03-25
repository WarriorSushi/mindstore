import { describe, expect, it } from "vitest";
import {
  type ObsidianSyncConfig,
  type MemoryForExport,
  type ConnectionForExport,
  defaultSyncConfig,
  slugify,
  getMemoryFolder,
  memoryToMarkdown,
  buildVaultFileMap,
  buildExportPreview,
  buildExportSyncRecord,
} from "@/server/plugins/ports/obsidian-sync";

function makeMemory(overrides: Partial<MemoryForExport> = {}): MemoryForExport {
  return {
    id: 1,
    content: "TypeScript generics enable reusable typed components.",
    sourceType: "url",
    sourceTitle: "TypeScript Generics Guide",
    createdAt: new Date("2024-03-15T10:00:00Z"),
    metadata: { tags: ["typescript", "generics"] },
    ...overrides,
  };
}

function makeConfig(overrides: Partial<ObsidianSyncConfig> = {}): ObsidianSyncConfig {
  return { ...defaultSyncConfig(), ...overrides };
}

describe("obsidian-sync port", () => {
  it("defaultSyncConfig returns sane defaults", () => {
    const config = defaultSyncConfig();

    expect(config.vaultName).toBe("MindStore");
    expect(config.folderStructure).toBe("by-source");
    expect(config.includeMetadata).toBe(true);
    expect(config.includeTags).toBe(true);
    expect(config.includeBacklinks).toBe(true);
    expect(config.includeWikilinks).toBe(true);
    expect(config.frontmatterStyle).toBe("yaml");
  });

  it("slugify produces clean kebab slugs", () => {
    expect(slugify("Hello World")).toBe("hello-world");
    expect(slugify("TypeScript & React")).toBe("typescript-react");
    expect(slugify("")).toBe("untitled");
  });

  it("slugify truncates to 100 chars", () => {
    const long = "a".repeat(200);
    expect(slugify(long).length).toBeLessThanOrEqual(100);
  });

  it("getMemoryFolder by-source maps types to folders", () => {
    expect(getMemoryFolder(makeMemory({ sourceType: "chatgpt" }), "by-source")).toBe("ChatGPT");
    expect(getMemoryFolder(makeMemory({ sourceType: "kindle" }), "by-source")).toBe("Kindle");
    expect(getMemoryFolder(makeMemory({ sourceType: "youtube" }), "by-source")).toBe("YouTube");
    expect(getMemoryFolder(makeMemory({ sourceType: "url" }), "by-source")).toBe("URLs");
    expect(getMemoryFolder(makeMemory({ sourceType: "text" }), "by-source")).toBe("Notes");
  });

  it("getMemoryFolder by-date returns year/year-month", () => {
    const folder = getMemoryFolder(makeMemory(), "by-date");
    expect(folder).toBe("2024/2024-03");
  });

  it("getMemoryFolder flat returns empty string", () => {
    expect(getMemoryFolder(makeMemory(), "flat")).toBe("");
  });

  it("memoryToMarkdown includes YAML frontmatter", () => {
    const config = makeConfig();
    const md = memoryToMarkdown(makeMemory(), config, [], []);

    expect(md).toContain("---");
    expect(md).toContain('title: "TypeScript Generics Guide"');
    expect(md).toContain("source: url");
    expect(md).toContain("mindstore_id: 1");
    expect(md).toContain("TypeScript generics enable reusable");
  });

  it("memoryToMarkdown includes tags when configured", () => {
    const config = makeConfig({ includeTags: true });
    const md = memoryToMarkdown(makeMemory(), config, [], []);

    expect(md).toContain("tags:");
    expect(md).toContain("  - typescript");
    expect(md).toContain("  - generics");
  });

  it("memoryToMarkdown omits frontmatter when style is none", () => {
    const config = makeConfig({ frontmatterStyle: "none" });
    const md = memoryToMarkdown(makeMemory(), config, [], []);

    expect(md).not.toContain("---");
    expect(md).toContain("TypeScript generics enable reusable");
  });

  it("memoryToMarkdown includes wikilinks for related memories", () => {
    const mem1 = makeMemory({ id: 1 });
    const mem2 = makeMemory({ id: 2, sourceTitle: "React Hooks" });
    const connections: ConnectionForExport[] = [{ memoryAId: 1, memoryBId: 2 }];
    const config = makeConfig({ includeWikilinks: true, includeBacklinks: true });

    const md = memoryToMarkdown(mem1, config, [mem1, mem2], connections);

    expect(md).toContain("## Related");
    expect(md).toContain("[[react-hooks|React Hooks]]");
  });

  it("memoryToMarkdown omits related section when no connections", () => {
    const config = makeConfig({ includeWikilinks: true });
    const md = memoryToMarkdown(makeMemory(), config, [makeMemory()], []);

    expect(md).not.toContain("## Related");
  });

  it("buildVaultFileMap creates correct file paths by-source", () => {
    const memories = [
      makeMemory({ id: 1, sourceType: "url" }),
      makeMemory({ id: 2, sourceType: "kindle", sourceTitle: "Book Notes" }),
    ];
    const config = makeConfig({ folderStructure: "by-source" });
    const fileMap = buildVaultFileMap(memories, [], config);

    const paths = [...fileMap.keys()];
    expect(paths.some((p) => p.includes("URLs/"))).toBe(true);
    expect(paths.some((p) => p.includes("Kindle/"))).toBe(true);
    expect(paths.some((p) => p.endsWith(".md"))).toBe(true);
  });

  it("buildVaultFileMap deduplicates file names", () => {
    const memories = [
      makeMemory({ id: 1, sourceTitle: "Same Title" }),
      makeMemory({ id: 2, sourceTitle: "Same Title" }),
    ];
    const config = makeConfig({ folderStructure: "flat" });
    const fileMap = buildVaultFileMap(memories, [], config);

    const paths = [...fileMap.keys()];
    const mdPaths = paths.filter((p) => p.includes("same-title"));
    expect(mdPaths.length).toBe(2);
    // One should have a suffix
    expect(mdPaths.some((p) => p.includes("same-title-1"))).toBe(true);
  });

  it("buildVaultFileMap includes .obsidian config and README", () => {
    const memories = [makeMemory()];
    const config = makeConfig();
    const fileMap = buildVaultFileMap(memories, [], config);

    const paths = [...fileMap.keys()];
    expect(paths.some((p) => p.includes(".obsidian/app.json"))).toBe(true);
    expect(paths.some((p) => p.includes(".obsidian/appearance.json"))).toBe(true);
    expect(paths.some((p) => p.includes("README.md"))).toBe(true);
  });

  it("buildExportPreview computes correct stats", () => {
    const memories = [
      makeMemory({ id: 1, sourceType: "url", content: "one two three" }),
      makeMemory({ id: 2, sourceType: "kindle", content: "four five" }),
      makeMemory({ id: 3, sourceType: "url", content: "six seven eight nine" }),
    ];
    const config = makeConfig();
    const preview = buildExportPreview(memories, config);

    expect(preview.totalMemories).toBe(3);
    expect(preview.filteredCount).toBe(3);
    expect(preview.sourceBreakdown["url"]).toBe(2);
    expect(preview.sourceBreakdown["kindle"]).toBe(1);
    expect(preview.totalWords).toBe(9);
  });

  it("buildExportPreview respects filterBySource", () => {
    const memories = [
      makeMemory({ id: 1, sourceType: "url" }),
      makeMemory({ id: 2, sourceType: "kindle" }),
    ];
    const config = makeConfig({ filterBySource: ["kindle"] });
    const preview = buildExportPreview(memories, config);

    expect(preview.totalMemories).toBe(2);
    expect(preview.filteredCount).toBe(1);
  });

  it("buildExportSyncRecord creates valid record", () => {
    const record = buildExportSyncRecord(42);

    expect(record.direction).toBe("export");
    expect(record.count).toBe(42);
    expect(record.status).toBe("success");
    expect(record.timestamp).toBeTruthy();
  });
});
