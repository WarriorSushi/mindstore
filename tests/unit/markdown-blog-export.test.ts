import { describe, expect, it } from "vitest";
import {
  type MemoryForExport,
  TEMPLATES,
  getTemplate,
  slugify,
  getFileName,
  generateFrontmatter,
  buildExportContent,
  ASTRO_CONTENT_CONFIG,
} from "@/server/plugins/ports/markdown-blog-export";

function makeMemory(overrides: Partial<MemoryForExport> = {}): MemoryForExport {
  return {
    id: "mem-1",
    content: "TypeScript generics are powerful for building reusable components.",
    source_type: "url",
    source_title: "Understanding TypeScript Generics",
    metadata: {},
    created_at: "2024-03-15T10:00:00Z",
    ...overrides,
  };
}

describe("markdown-blog-export port", () => {
  it("slugify produces clean kebab-case slugs", () => {
    expect(slugify("Hello World!")).toBe("hello-world");
    expect(slugify("TypeScript & React: A Guide")).toBe("typescript-react-a-guide");
    expect(slugify("  spaces   everywhere  ")).toBe("spaces-everywhere");
  });

  it("slugify truncates to 80 chars", () => {
    const longTitle = "a".repeat(200);
    expect(slugify(longTitle).length).toBeLessThanOrEqual(80);
  });

  it("TEMPLATES includes all 5 frameworks", () => {
    expect(TEMPLATES).toHaveLength(5);
    const ids = TEMPLATES.map((t) => t.id);
    expect(ids).toContain("hugo");
    expect(ids).toContain("jekyll");
    expect(ids).toContain("astro");
    expect(ids).toContain("nextjs");
    expect(ids).toContain("plain");
  });

  it("getTemplate falls back to plain for unknown id", () => {
    const t = getTemplate("nonexistent");
    expect(t.id).toBe("plain");
  });

  it("getFileName with date-prefix (Jekyll)", () => {
    const mem = makeMemory();
    const jekyll = getTemplate("jekyll");
    const name = getFileName(mem, jekyll, 0);

    expect(name).toMatch(/^2024-03-15-understanding-typescript-generics\.md$/);
  });

  it("getFileName with folder format (Hugo)", () => {
    const mem = makeMemory();
    const hugo = getTemplate("hugo");
    const name = getFileName(mem, hugo, 0);

    expect(name).toMatch(/understanding-typescript-generics\/index\.md$/);
  });

  it("getFileName with kebab format (Astro)", () => {
    const mem = makeMemory();
    const astro = getTemplate("astro");
    const name = getFileName(mem, astro, 0);

    expect(name).toBe("understanding-typescript-generics.md");
  });

  it("getFileName for Next.js uses .mdx extension", () => {
    const mem = makeMemory();
    const nextjs = getTemplate("nextjs");
    const name = getFileName(mem, nextjs, 0);

    expect(name).toMatch(/\.mdx$/);
  });

  it("generateFrontmatter produces YAML frontmatter", () => {
    const mem = makeMemory();
    const template = getTemplate("plain");
    const fm = generateFrontmatter(mem, template, { author: "Irfan" });

    expect(fm).toContain("---");
    expect(fm).toContain("title:");
    expect(fm).toContain("Understanding TypeScript Generics");
    expect(fm).toContain("author: Irfan");
    expect(fm).toContain("date:");
  });

  it("generateFrontmatter adds Hugo-specific fields", () => {
    const mem = makeMemory();
    const hugo = getTemplate("hugo");
    const fm = generateFrontmatter(mem, hugo, {});

    expect(fm).toContain("slug:");
    expect(fm).toContain("categories:");
  });

  it("generateFrontmatter adds Jekyll layout", () => {
    const mem = makeMemory();
    const jekyll = getTemplate("jekyll");
    const fm = generateFrontmatter(mem, jekyll, {});

    expect(fm).toContain("layout: post");
  });

  it("generateFrontmatter adds Astro pubDate", () => {
    const mem = makeMemory();
    const astro = getTemplate("astro");
    const fm = generateFrontmatter(mem, astro, {});

    expect(fm).toContain("pubDate:");
  });

  it("buildExportContent combines frontmatter and content", () => {
    const mem = makeMemory();
    const template = getTemplate("plain");
    const result = buildExportContent(mem, template, { includeMetadata: true });

    expect(result).toContain("---");
    expect(result).toContain("TypeScript generics are powerful");
    expect(result).toContain("<!-- Source: url");
    expect(result).toContain("Exported from MindStore -->");
  });

  it("buildExportContent without metadata omits source comment", () => {
    const mem = makeMemory();
    const template = getTemplate("plain");
    const result = buildExportContent(mem, template, { includeMetadata: false });

    expect(result).not.toContain("<!-- Source:");
  });

  it("ASTRO_CONTENT_CONFIG contains valid schema", () => {
    expect(ASTRO_CONTENT_CONFIG).toContain("defineCollection");
    expect(ASTRO_CONTENT_CONFIG).toContain("z.object");
    expect(ASTRO_CONTENT_CONFIG).toContain("title: z.string()");
  });
});
