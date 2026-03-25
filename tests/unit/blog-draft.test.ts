import { describe, expect, it } from "vitest";
import { renderBlogHtml, slugify } from "@/server/plugins/ports/blog-draft";

describe("blog draft port", () => {
  it("converts markdown headings and bold to html", () => {
    const html = renderBlogHtml({
      title: "My Post",
      content: "# Title\n\n## Subtitle\n\n**Bold text** and *italic*.",
    });

    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<h2>Subtitle</h2>");
    expect(html).toContain("<strong>Bold text</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<title>My Post</title>");
  });

  it("converts blockquotes and list items", () => {
    const html = renderBlogHtml({
      title: "Lists",
      content: "> A wise quote\n\n- First item\n- Second item\n\n1. Ordered one",
    });

    expect(html).toContain("<blockquote>A wise quote</blockquote>");
    expect(html).toContain("<li>First item</li>");
    expect(html).toContain("<li>Ordered one</li>");
  });

  it("uses teal accent color for blockquote borders", () => {
    const html = renderBlogHtml({ title: "Test", content: "> quote" });
    expect(html).toContain("#14b8a6");
    expect(html).not.toMatch(/violet|purple|fuchsia/i);
  });

  it("slugifies titles for filenames", () => {
    expect(slugify("Hello World!")).toBe("hello-world");
    expect(slugify("  My --- Post  ")).toBe("my-post");
    expect(slugify("")).toBe("blog-draft");
    expect(slugify("One Two Three")).toBe("one-two-three");
  });
});
