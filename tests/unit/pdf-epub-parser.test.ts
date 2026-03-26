import { describe, expect, it } from "vitest";
import {
  extractPDFSections,
  htmlToText,
  previewParsedDocument,
  smartChunkDocument,
  type ParsedDocument,
} from "@/server/plugins/ports/pdf-epub-parser";

describe("pdf epub parser port", () => {
  it("extracts likely sections from heading-like PDF text", () => {
    const sections = extractPDFSections(
      "\nCHAPTER 1\nHello world with enough content to keep this section.\n\n1. Background\nMore text here with enough substance.",
      "Demo",
    );
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0]?.title).toContain("CHAPTER");
  });

  it("converts simple epub html to readable text", () => {
    const text = htmlToText("<h1>Intro</h1><p>Hello <strong>world</strong>.</p><ul><li>One</li></ul>");
    expect(text).toContain("## Intro");
    expect(text).toContain("Hello world.");
  });

  it("builds document preview stats from smart chunks", () => {
    const document: ParsedDocument = {
      title: "Demo Book",
      format: "epub",
      sections: [
        { title: "Intro", content: "Hello world from mindstore", level: 1 },
        { title: "Chapter 1", content: "More content here", level: 1 },
      ],
      metadata: {},
    };

    const chunks = smartChunkDocument(document);
    const preview = previewParsedDocument(document, chunks);

    expect(chunks.length).toBe(2);
    expect(preview.document.totalChapters).toBe(2);
    expect(preview.sections[0]?.title).toBe("Intro");
  });
});
