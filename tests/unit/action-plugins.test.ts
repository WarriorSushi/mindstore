import { describe, expect, it } from "vitest";
import { renderBlogHtml } from "@/server/plugins/ports/blog-draft";
import { buildConversationSearchQueries } from "@/server/plugins/ports/conversation-prep";
import { getPeriodLabel } from "@/server/plugins/ports/newsletter-writer";
import { computeLearningPathProgress } from "@/server/plugins/ports/learning-paths";

describe("action plugin helpers", () => {
  it("renders blog draft html with title and headings", () => {
    const html = renderBlogHtml({
      title: "My Post",
      content: "# My Post\n\n## Section\n\nHello world",
    });

    expect(html).toContain("<title>My Post</title>");
    expect(html).toContain("<h2>Section</h2>");
  });

  it("builds person-specific briefing search queries", () => {
    const queries = buildConversationSearchQueries("Ada Lovelace", "person", "upcoming call");

    expect(queries[0]).toBe("Ada Lovelace");
    expect(queries).toContain("Ada Lovelace upcoming call");
    expect(queries).toContain("Ada Lovelace conversation");
  });

  it("formats newsletter period labels", () => {
    const label = getPeriodLabel(7);

    expect(label).toMatch(/[A-Z][a-z]{2} \d{1,2}-[A-Z][a-z]{2} \d{1,2}, \d{4}/);
  });

  it("computes learning path completion percentage", () => {
    const progress = computeLearningPathProgress([
      { completed: true },
      { completed: false },
      { completed: true },
      { completed: true },
    ] as never);

    expect(progress).toBe(75);
  });
});

