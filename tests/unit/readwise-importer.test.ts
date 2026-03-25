import { describe, expect, it } from "vitest";
import {
  formatHighlightMemory,
  type ReadwiseBook,
  type ReadwiseHighlight,
} from "@/server/plugins/ports/readwise-importer";

const SAMPLE_BOOK: ReadwiseBook = {
  id: 100,
  title: "Atomic Habits",
  author: "James Clear",
  category: "books",
  source: "kindle",
  num_highlights: 5,
  last_highlight_at: "2024-01-15T10:00:00Z",
};

const SAMPLE_HIGHLIGHT: ReadwiseHighlight = {
  id: 5001,
  text: "You do not rise to the level of your goals. You fall to the level of your systems.",
  note: "Key insight about systems thinking",
  location: 42,
  highlighted_at: "2024-01-10T09:00:00Z",
  book_id: 100,
  tags: [
    { id: 1, name: "habits" },
    { id: 2, name: "systems" },
  ],
};

describe("readwise importer port", () => {
  it("formats a highlight into a memory-ready object", () => {
    const memory = formatHighlightMemory(SAMPLE_HIGHLIGHT, SAMPLE_BOOK);

    expect(memory.content).toContain("You do not rise");
    expect(memory.content).toContain("**Note:** Key insight");
    expect(memory.content).toContain("Atomic Habits");
    expect(memory.content).toContain("James Clear");
    expect(memory.title).toContain("Atomic Habits");
    expect(memory.metadata.readwiseHighlightId).toBe(5001);
    expect(memory.metadata.readwiseBookId).toBe(100);
    expect(memory.metadata.readwiseCategory).toBe("books");
    expect(memory.metadata.tags).toEqual(["habits", "systems"]);
    expect(memory.metadata.source).toBe("readwise");
    expect(memory.dedupKey).toBe("5001");
    expect(memory.createdAt).toEqual(new Date("2024-01-10T09:00:00Z"));
  });

  it("handles highlights without notes or tags", () => {
    const bareHighlight: ReadwiseHighlight = {
      id: 5002,
      text: "Simple highlight with no extras",
      book_id: 100,
      tags: [],
    };

    const memory = formatHighlightMemory(bareHighlight, SAMPLE_BOOK);

    expect(memory.content).toContain("Simple highlight");
    expect(memory.content).not.toContain("**Note:**");
    expect(memory.metadata.tags).toBeUndefined();
  });
});
