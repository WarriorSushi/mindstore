import { describe, expect, it } from "vitest";
import {
  deduplicateKindleClippings,
  parseKindleClippings,
  prepareKindleImportDocuments,
  previewKindleImport,
} from "@/server/plugins/ports/kindle-importer";

const SAMPLE_CLIPPINGS = `Atomic Habits (James Clear)
- Your Highlight on page 10 | location 120-122 | Added on Monday, January 01, 2024 10:00:00 AM

Small habits compound into remarkable results.
==========
Atomic Habits (James Clear)
- Your Highlight on page 10 | location 120-125 | Added on Monday, January 01, 2024 10:01:00 AM

Small habits compound into remarkable results over time and reshape identity.
==========
Deep Work (Cal Newport)
- Your Note on page 33 | location 510-512 | Added on Tuesday, January 02, 2024 11:00:00 AM

Use time blocking for focused work sessions.
==========
Deep Work (Cal Newport)
- Your Bookmark on page 34 | location 520 | Added on Tuesday, January 02, 2024 11:05:00 AM
==========`;

describe("kindle importer port", () => {
  it("parses highlights and notes while skipping bookmarks", () => {
    const clippings = parseKindleClippings(SAMPLE_CLIPPINGS);

    expect(clippings).toHaveLength(3);
    expect(clippings[0]?.bookTitle).toBe("Atomic Habits");
    expect(clippings[1]?.type).toBe("highlight");
    expect(clippings[2]?.type).toBe("note");
  });

  it("deduplicates overlapping highlights", () => {
    const deduped = deduplicateKindleClippings(parseKindleClippings(SAMPLE_CLIPPINGS));

    expect(deduped).toHaveLength(2);
    expect(deduped[0]?.content).toContain("reshape identity");
  });

  it("builds preview and import documents from grouped books", () => {
    const preview = previewKindleImport(SAMPLE_CLIPPINGS, { dedup: true });

    expect(preview.totalBooks).toBe(2);
    expect(preview.totalHighlights).toBe(2);
    expect(preview.duplicatesRemoved).toBe(1);

    const documents = prepareKindleImportDocuments([
      {
        title: "Atomic Habits",
        author: "James Clear",
        noteCount: 0,
        highlights: deduplicateKindleClippings(parseKindleClippings(SAMPLE_CLIPPINGS)).filter(
          (clipping) => clipping.bookTitle === "Atomic Habits",
        ),
      },
    ]);

    expect(documents).toHaveLength(1);
    expect(documents[0]?.metadata.author).toBe("James Clear");
    expect(documents[0]?.content).toContain("# Atomic Habits");
  });
});
