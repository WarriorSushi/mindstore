import { describe, expect, it } from "vitest";
import {
  parsePocketHTML,
  parseInstapaperCSV,
  parseCSVLine,
  formatArticleContent,
  buildArticleMetadata,
} from "@/server/plugins/ports/pocket-importer";

const SAMPLE_POCKET_HTML = `
<!DOCTYPE html>
<html>
<head><title>Pocket Export</title></head>
<body>
<h1>Unread</h1>
<ul>
  <li><a href="https://example.com/article1" time_added="1704067200" tags="ai,ml">How AI is changing everything</a></li>
  <li><a href="https://example.com/article2" time_added="1704153600" tags="typescript">TypeScript tips and tricks</a></li>
  <li><a href="javascript:void(0)">Should be ignored</a></li>
</ul>
</body>
</html>
`;

const SAMPLE_INSTAPAPER_CSV = `URL,Title,Selection,Folder,Timestamp
https://example.com/deep-work,"Deep Work","The key to success","Unread",1704067200
https://example.com/remote,"Remote Work Guide","Work from anywhere","Archive",1704153600
not-a-url,Invalid,,,`;

describe("pocket importer port", () => {
  it("parses Pocket HTML bookmarks export", () => {
    const articles = parsePocketHTML(SAMPLE_POCKET_HTML);

    expect(articles).toHaveLength(2); // javascript: link is filtered
    expect(articles[0]?.url).toBe("https://example.com/article1");
    expect(articles[0]?.title).toBe("How AI is changing everything");
    expect(articles[0]?.tags).toEqual(["ai", "ml"]);
    expect(articles[0]?.source).toBe("pocket");
    expect(articles[0]?.addedAt).toBeDefined();
  });

  it("parses Instapaper CSV export", () => {
    const articles = parseInstapaperCSV(SAMPLE_INSTAPAPER_CSV);

    expect(articles).toHaveLength(2); // non-URL row is filtered
    expect(articles[0]?.url).toBe("https://example.com/deep-work");
    expect(articles[0]?.title).toBe("Deep Work");
    expect(articles[0]?.description).toBe("The key to success");
    expect(articles[0]?.folder).toBe("Unread");
    expect(articles[0]?.source).toBe("instapaper");
  });

  it("parses CSV lines with quoted fields", () => {
    const fields = parseCSVLine('hello,"world, with comma","escaped ""quotes"""');
    expect(fields).toEqual(["hello", "world, with comma", 'escaped "quotes"']);
  });

  it("formats article content with URL, description and tags", () => {
    const content = formatArticleContent({
      url: "https://example.com/article",
      title: "Test Article",
      tags: ["tag1", "tag2"],
      description: "A description",
      source: "pocket",
    });

    expect(content).toContain("Test Article");
    expect(content).toContain("https://example.com/article");
    expect(content).toContain("tag1, tag2");
    expect(content).toContain("A description");
  });

  it("builds metadata with source info", () => {
    const metadata = buildArticleMetadata({
      url: "https://example.com",
      title: "Test",
      tags: ["a"],
      folder: "Unread",
      source: "pocket",
    });

    expect(metadata.url).toBe("https://example.com");
    expect(metadata.importSource).toBe("pocket");
    expect(metadata.importedVia).toBe("pocket-importer-plugin");
    expect(metadata.tags).toEqual(["a"]);
    expect(metadata.folder).toBe("Unread");
  });
});
