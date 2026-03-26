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

  it("truncates long highlight text in the title", () => {
    const longHighlight: ReadwiseHighlight = {
      id: 5003,
      text: "A".repeat(200),
      book_id: 100,
      tags: [],
    };

    const memory = formatHighlightMemory(longHighlight, SAMPLE_BOOK);

    // Title should truncate to ~60 chars of the text + ellipsis
    expect(memory.title.length).toBeLessThan(200);
    expect(memory.title).toContain("...");
    expect(memory.title).toContain("Atomic Habits");
  });

  it("does not add ellipsis for short highlight text in title", () => {
    const shortHighlight: ReadwiseHighlight = {
      id: 5004,
      text: "Short quote",
      book_id: 100,
      tags: [],
    };

    const memory = formatHighlightMemory(shortHighlight, SAMPLE_BOOK);

    expect(memory.title).not.toContain("...");
    expect(memory.title).toContain("Short quote");
  });

  it("includes location metadata when present", () => {
    const memory = formatHighlightMemory(SAMPLE_HIGHLIGHT, SAMPLE_BOOK);

    expect(memory.metadata.location).toBe(42);
  });

  it("omits location metadata when not present", () => {
    const noLocation: ReadwiseHighlight = {
      id: 5005,
      text: "Highlight without location",
      book_id: 100,
      tags: [],
    };

    const memory = formatHighlightMemory(noLocation, SAMPLE_BOOK);

    expect(memory.metadata.location).toBeUndefined();
  });

  it("includes color metadata when present", () => {
    const coloredHighlight: ReadwiseHighlight = {
      id: 5006,
      text: "A colored highlight",
      book_id: 100,
      tags: [],
      color: "yellow",
    };

    const memory = formatHighlightMemory(coloredHighlight, SAMPLE_BOOK);

    expect(memory.metadata.color).toBe("yellow");
  });

  it("includes source URL from book when available", () => {
    const bookWithUrl: ReadwiseBook = {
      ...SAMPLE_BOOK,
      source_url: "https://example.com/article",
    };

    const highlight: ReadwiseHighlight = {
      id: 5007,
      text: "Article highlight",
      book_id: 100,
      tags: [],
    };

    const memory = formatHighlightMemory(highlight, bookWithUrl);

    expect(memory.metadata.sourceUrl).toBe("https://example.com/article");
  });

  it("includes cover image from book when available", () => {
    const bookWithCover: ReadwiseBook = {
      ...SAMPLE_BOOK,
      cover_image_url: "https://images.example.com/cover.jpg",
    };

    const highlight: ReadwiseHighlight = {
      id: 5008,
      text: "A highlight",
      book_id: 100,
      tags: [],
    };

    const memory = formatHighlightMemory(highlight, bookWithCover);

    expect(memory.metadata.coverImage).toBe("https://images.example.com/cover.jpg");
  });

  it("defaults createdAt to current date when highlighted_at is missing", () => {
    const noDate: ReadwiseHighlight = {
      id: 5009,
      text: "Undated highlight",
      book_id: 100,
      tags: [],
    };

    const before = new Date();
    const memory = formatHighlightMemory(noDate, SAMPLE_BOOK);
    const after = new Date();

    expect(memory.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(memory.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("handles article category from Readwise", () => {
    const articleBook: ReadwiseBook = {
      id: 200,
      title: "How AI Will Transform Everything",
      author: "Blog Author",
      category: "articles",
      source: "web",
      num_highlights: 2,
    };

    const highlight: ReadwiseHighlight = {
      id: 6001,
      text: "AI is going to be huge",
      book_id: 200,
      tags: [{ id: 10, name: "ai" }],
    };

    const memory = formatHighlightMemory(highlight, articleBook);

    expect(memory.metadata.readwiseCategory).toBe("articles");
    expect(memory.metadata.bookTitle).toBe("How AI Will Transform Everything");
    expect(memory.metadata.bookAuthor).toBe("Blog Author");
    expect(memory.metadata.importedVia).toBe("readwise-importer-plugin");
  });

  it("sets dedupKey from highlight ID as string", () => {
    const highlight: ReadwiseHighlight = {
      id: 99999,
      text: "Dedup test",
      book_id: 100,
      tags: [],
    };

    const memory = formatHighlightMemory(highlight, SAMPLE_BOOK);

    expect(memory.dedupKey).toBe("99999");
    expect(typeof memory.dedupKey).toBe("string");
  });

  it("includes book author in content attribution line", () => {
    const memory = formatHighlightMemory(SAMPLE_HIGHLIGHT, SAMPLE_BOOK);

    expect(memory.content).toContain("— Atomic Habits by James Clear");
  });

  it("handles book with no author gracefully", () => {
    const noAuthorBook: ReadwiseBook = {
      id: 300,
      title: "Anonymous Text",
      author: "",
      category: "supplementals",
      source: "manual",
      num_highlights: 1,
    };

    const highlight: ReadwiseHighlight = {
      id: 7001,
      text: "Some supplemental content",
      book_id: 300,
      tags: [],
    };

    const memory = formatHighlightMemory(highlight, noAuthorBook);

    // Should have the title but not " by " when author is empty
    expect(memory.content).toContain("— Anonymous Text");
    expect(memory.content).not.toContain("by ");
  });
});
