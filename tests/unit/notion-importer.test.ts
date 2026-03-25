import { describe, expect, it } from "vitest";
import {
  buildNotionImportStats,
  chunkPagesForImport,
  cleanNotionTitle,
  parseCSV,
  parseNotionExport,
} from "@/server/plugins/ports/notion-importer";

describe("notion importer port", () => {
  it("cleans notion uuid suffixes from titles", () => {
    expect(cleanNotionTitle("My Page 1234567890abcdef1234567890abcdef.md")).toBe("My Page");
  });

  it("parses notion csv exports with headers", () => {
    const parsed = parseCSV("Name,Status\nIdea,Active\nNote,Archived");
    expect(parsed.columns).toEqual(["Name", "Status"]);
    expect(parsed.rows[0]?.Name).toBe("Idea");
  });

  it("builds pages, stats, and import chunks from a notion export", () => {
    const files = new Map<string, string>([
      ["Workspace/Page 1234567890abcdef1234567890abcdef.md", "# Page\n\nHello from Notion"],
      ["Workspace/Projects 1234567890abcdef1234567890abcdef.csv", "Name,Status\nMindStore,Active"],
    ]);

    const { pages, databases } = parseNotionExport(files);
    const stats = buildNotionImportStats(pages, databases);
    const chunks = chunkPagesForImport(pages);

    expect(pages.length).toBeGreaterThan(0);
    expect(databases.length).toBe(1);
    expect(stats.totalPages).toBe(pages.length);
    expect(chunks.length).toBeGreaterThan(0);
  });
});
