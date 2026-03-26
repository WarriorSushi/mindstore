import { describe, expect, it } from "vitest";
import {
  parsePocketHTML,
  parseInstapaperCSV,
  parseCSVLine,
  formatArticleContent,
  buildArticleMetadata,
  type SavedArticle,
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

  it("filters javascript: URLs from Pocket HTML", () => {
    const htmlWithJs = `<ul>
      <li><a href="javascript:alert('xss')">Bad link</a></li>
      <li><a href="https://valid.com">Good link</a></li>
    </ul>`;

    const articles = parsePocketHTML(htmlWithJs);

    expect(articles).toHaveLength(1);
    expect(articles[0]?.url).toBe("https://valid.com");
  });

  it("handles Pocket HTML with no tags", () => {
    const htmlNoTags = `<ul>
      <li><a href="https://example.com/no-tags" time_added="1704067200">Article without tags</a></li>
    </ul>`;

    const articles = parsePocketHTML(htmlNoTags);

    expect(articles).toHaveLength(1);
    expect(articles[0]?.tags).toEqual([]);
  });

  it("parses Pocket HTML timestamp from time_added attribute", () => {
    const html = `<ul>
      <li><a href="https://example.com" time_added="1704067200">Test</a></li>
    </ul>`;

    const articles = parsePocketHTML(html);

    expect(articles[0]?.addedAt).toBeDefined();
    // addedAt is a string timestamp
    expect(articles[0]?.addedAt).toBeTruthy();
  });

  it("handles empty Pocket HTML", () => {
    const emptyHtml = `<!DOCTYPE html><html><body></body></html>`;
    const articles = parsePocketHTML(emptyHtml);
    expect(articles).toHaveLength(0);
  });

  it("handles empty Instapaper CSV (header only)", () => {
    const headerOnly = `URL,Title,Selection,Folder,Timestamp\n`;
    const articles = parseInstapaperCSV(headerOnly);
    expect(articles).toHaveLength(0);
  });

  it("parseCSVLine handles simple unquoted fields", () => {
    const fields = parseCSVLine("a,b,c");
    expect(fields).toEqual(["a", "b", "c"]);
  });

  it("parseCSVLine handles empty fields", () => {
    const fields = parseCSVLine("a,,c");
    expect(fields).toEqual(["a", "", "c"]);
  });

  it("formats article content without tags", () => {
    const content = formatArticleContent({
      url: "https://example.com",
      title: "No Tags Article",
      source: "pocket",
    });

    expect(content).toContain("No Tags Article");
    expect(content).toContain("https://example.com");
  });

  it("formats article content without description", () => {
    const content = formatArticleContent({
      url: "https://example.com",
      title: "No Description",
      source: "pocket",
    });

    expect(content).toContain("No Description");
    expect(content).not.toContain("undefined");
  });

  it("builds metadata for instapaper source", () => {
    const metadata = buildArticleMetadata({
      url: "https://example.com/instapaper",
      title: "Instapaper Article",
      source: "instapaper",
      folder: "Archive",
    });

    expect(metadata.importSource).toBe("instapaper");
    expect(metadata.folder).toBe("Archive");
    expect(metadata.importedVia).toBe("pocket-importer-plugin");
  });

  it("builds metadata without optional fields", () => {
    const metadata = buildArticleMetadata({
      url: "https://example.com/minimal",
      title: "Minimal",
      source: "pocket",
    });

    expect(metadata.url).toBe("https://example.com/minimal");
    expect(metadata.importSource).toBe("pocket");
    // Tags and folder should be undefined or not present
    expect(metadata.tags).toBeUndefined();
  });

  it("Instapaper CSV preserves second article data", () => {
    const articles = parseInstapaperCSV(SAMPLE_INSTAPAPER_CSV);

    expect(articles[1]?.url).toBe("https://example.com/remote");
    expect(articles[1]?.title).toBe("Remote Work Guide");
    expect(articles[1]?.description).toBe("Work from anywhere");
    expect(articles[1]?.folder).toBe("Archive");
  });
});
