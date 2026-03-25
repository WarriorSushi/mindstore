import { describe, expect, it } from "vitest";
import {
  buildBookmarkPreview,
  extractReadableText,
  formatBookmarkContent,
  parseBookmarksHTML,
} from "@/server/plugins/ports/browser-bookmarks";

const SAMPLE_BOOKMARKS = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Reading</H3>
  <DL><p>
    <DT><A HREF="https://example.com/article" ADD_DATE="1704067200">Example Article</A>
  </DL><p>
</DL><p>`;

describe("browser bookmarks port", () => {
  it("parses netscape bookmark exports", () => {
    const parsed = parseBookmarksHTML(SAMPLE_BOOKMARKS);
    expect(parsed.all).toHaveLength(1);
    expect(parsed.stats.totalFolders).toBe(1);
    expect(parsed.all[0]?.folder).toContain("Reading");
  });

  it("extracts readable text from html content", () => {
    const text = extractReadableText("<html><head><title>Example</title></head><body><p>Hello world</p></body></html>");
    expect(text).toContain("# Example");
    expect(text).toContain("Hello world");
  });

  it("builds a preview and formatted bookmark content", () => {
    const parsed = parseBookmarksHTML(SAMPLE_BOOKMARKS);
    const preview = buildBookmarkPreview(parsed);
    const content = formatBookmarkContent(parsed.all[0]!);

    expect(preview.sampleBookmarks[0]?.title).toBe("Example Article");
    expect(content).toContain("**URL:**");
  });
});
