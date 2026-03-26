import { describe, expect, it } from "vitest";
import { getAllDocs, getDocBySlug } from "@/lib/docs";

describe("docs loader", () => {
  it("loads the docs home page from the filesystem", async () => {
    const doc = await getDocBySlug([]);
    expect(doc?.title).toBe("MindStore Docs");
    expect(doc?.html).toContain("Getting Started");
    expect(doc?.html).not.toContain("<h1>");
  });

  it("discovers builder and user docs", async () => {
    const docs = await getAllDocs();
    const urls = docs.map((doc) => doc.url);
    expect(urls).toContain("/docs/build");
    expect(urls).toContain("/docs/getting-started/quickstart");
  });
});
