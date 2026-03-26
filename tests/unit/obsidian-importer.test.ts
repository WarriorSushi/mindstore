import { describe, expect, it } from "vitest";
import {
  analyzeVault,
  buildObsidianPreview,
  chunkAllNotes,
  chunkNote,
  extractHeadings,
  extractInlineTags,
  extractWikilinks,
  formatNoteContent,
  parseFrontmatter,
  parseNote,
  stripVaultRoot,
} from "@/server/plugins/ports/obsidian-importer";

describe("obsidian importer port", () => {
  // ─── parseFrontmatter ─────────────────────────────────────────

  it("parses YAML frontmatter with string, boolean, number, and array values", () => {
    const { frontmatter, body } = parseFrontmatter(`---
title: Test Note
draft: true
rating: 4.5
tags: [alpha, beta, gamma]
---
Body content here`);

    expect(frontmatter.title).toBe("Test Note");
    expect(frontmatter.draft).toBe(true);
    expect(frontmatter.rating).toBe(4.5);
    expect(frontmatter.tags).toEqual(["alpha", "beta", "gamma"]);
    expect(body).toBe("Body content here");
  });

  it("returns empty frontmatter when no YAML block exists", () => {
    const { frontmatter, body } = parseFrontmatter("Just plain content");
    expect(frontmatter).toEqual({});
    expect(body).toBe("Just plain content");
  });

  it("parses multi-line YAML arrays with dash syntax", () => {
    const { frontmatter } = parseFrontmatter(`---
tags:
- one
- two
- three
---
body`);

    expect(frontmatter.tags).toEqual(["one", "two", "three"]);
  });

  // ─── extractWikilinks ─────────────────────────────────────────

  it("extracts wikilinks including aliased ones", () => {
    const links = extractWikilinks("See [[Alpha]] and [[Beta|The Beta Note]] for details.");
    expect(links).toEqual(["Alpha", "Beta"]);
  });

  it("does not extract image embeds as wikilinks", () => {
    const links = extractWikilinks("![[image.png]] and [[Real Link]]");
    expect(links).toEqual(["Real Link"]);
  });

  it("deduplicates repeated wikilinks", () => {
    const links = extractWikilinks("[[A]] then [[B]] then [[A]] again");
    expect(links).toEqual(["A", "B"]);
  });

  // ─── extractInlineTags ────────────────────────────────────────

  it("extracts inline tags from content", () => {
    const tags = extractInlineTags("Something about #pkm and #mindstore/plugin ideas");
    expect(tags).toContain("pkm");
    expect(tags).toContain("mindstore/plugin");
  });

  it("ignores hash in the middle of words", () => {
    const tags = extractInlineTags("Issue #123 is not a tag");
    // #123 starts with a digit so should not be captured
    expect(tags).not.toContain("123");
  });

  // ─── extractHeadings ──────────────────────────────────────────

  it("extracts headings with levels and positions", () => {
    const headings = extractHeadings("# Title\nSome text\n## Subtitle\nMore text\n### Deep");
    expect(headings).toHaveLength(3);
    expect(headings[0]).toMatchObject({ level: 1, text: "Title" });
    expect(headings[1]).toMatchObject({ level: 2, text: "Subtitle" });
    expect(headings[2]).toMatchObject({ level: 3, text: "Deep" });
  });

  it("returns empty for content with no headings", () => {
    expect(extractHeadings("Just text, no headings")).toEqual([]);
  });

  // ─── parseNote ────────────────────────────────────────────────

  it("parses frontmatter, tags, aliases, and wikilinks", () => {
    const note = parseNote("Vault/Notes/Alpha.md", `---
tags: [mindstore, pkm]
aliases: [A]
date: 2026-03-25
---
# Alpha
Links to [[Beta]] and #ideas`);

    expect(note.name).toBe("Alpha");
    expect(note.tags).toContain("mindstore");
    expect(note.aliases).toContain("A");
    expect(note.wikilinks).toContain("Beta");
  });

  it("derives name from filename and folder from path", () => {
    const note = parseNote("Root/Sub/MyNote.md", "content");
    expect(note.name).toBe("MyNote");
    expect(note.folder).toBe("Root/Sub");
  });

  it("handles notes with no frontmatter", () => {
    const note = parseNote("Note.md", "# Simple\nJust content.");
    expect(note.frontmatter).toEqual({});
    expect(note.tags).toEqual([]);
    expect(note.content).toBe("# Simple\nJust content.");
  });

  it("merges frontmatter tags and inline tags without duplicates", () => {
    const note = parseNote("N.md", `---
tags: [alpha]
---
#alpha and #beta`);

    expect(note.tags).toEqual(["alpha", "beta"]);
  });

  it("counts words correctly", () => {
    const note = parseNote("N.md", "one two three four five");
    expect(note.wordCount).toBe(5);
  });

  // ─── stripVaultRoot ───────────────────────────────────────────

  it("strips a common vault root prefix from all note paths", () => {
    const notes = [
      parseNote("MyVault/A.md", "A"),
      parseNote("MyVault/Sub/B.md", "B"),
    ];
    stripVaultRoot(notes);
    expect(notes[0].path).toBe("A.md");
    expect(notes[1].path).toBe("Sub/B.md");
    expect(notes[1].folder).toBe("Sub");
  });

  it("does not strip when paths have different roots", () => {
    const notes = [
      parseNote("VaultA/X.md", "X"),
      parseNote("VaultB/Y.md", "Y"),
    ];
    stripVaultRoot(notes);
    expect(notes[0].path).toBe("VaultA/X.md");
  });

  // ─── analyzeVault ─────────────────────────────────────────────

  it("analyzes vault links, backlinks, and orphans", () => {
    const notes = [
      parseNote("Vault/Alpha.md", "# Alpha\nLinks to [[Beta]]"),
      parseNote("Vault/Beta.md", "# Beta\nBacklink target"),
      parseNote("Vault/Orphan.md", "# Orphan\nNo links at all"),
    ];
    stripVaultRoot(notes);
    const vault = analyzeVault(notes);

    expect(vault.stats.totalNotes).toBe(3);
    expect(vault.backlinks.get("beta")?.length).toBe(1);
    expect(vault.stats.orphanNotes).toBe(1); // Orphan has no links in or out
  });

  it("resolves wikilinks through aliases", () => {
    const notes = [
      parseNote("V/A.md", `---
aliases: [ANote]
---
Content of A`),
      parseNote("V/B.md", "Links to [[ANote]]"),
    ];
    stripVaultRoot(notes);
    const vault = analyzeVault(notes);

    // B links to A via the alias "ANote", so A should have a backlink from B
    expect(vault.backlinks.get("a")?.length).toBe(1);
  });

  it("computes date range from notes with created dates", () => {
    const notes = [
      parseNote("V/Old.md", "---\ndate: 2024-01-01\n---\nOld note"),
      parseNote("V/New.md", "---\ndate: 2026-03-25\n---\nNew note"),
      parseNote("V/NoDate.md", "No date here"),
    ];
    stripVaultRoot(notes);
    const vault = analyzeVault(notes);

    expect(vault.stats.dateRange.oldest).toBe("2024-01-01");
    expect(vault.stats.dateRange.newest).toBe("2026-03-25");
  });

  // ─── formatNoteContent ────────────────────────────────────────

  it("formats note with title, metadata, and resolved wikilinks", () => {
    const note = parseNote("V/Test.md", `---
tags: [demo]
date: 2026-03-25
---
See [[Other]] for details`);

    const formatted = formatNoteContent(note);
    expect(formatted).toContain("# Test");
    expect(formatted).toContain("#demo");
    expect(formatted).toContain("Other"); // wikilink resolved to plain text
    expect(formatted).not.toContain("[[");
  });

  // ─── chunkNote ────────────────────────────────────────────────

  it("returns a single chunk for short notes", () => {
    const note = parseNote("V/Short.md", "Brief content");
    const chunks = chunkNote(note);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].title).toBe("Short");
  });

  it("splits long notes into multiple chunks", () => {
    const longContent = Array(200).fill("This is a line of moderate content.").join("\n");
    const note = parseNote("V/Long.md", longContent);
    const chunks = chunkNote(note, 500);
    expect(chunks.length).toBeGreaterThan(1);
  });

  // ─── chunkAllNotes + buildObsidianPreview ─────────────────────

  it("chunks all notes and builds a preview with graph stats", () => {
    const notes = [
      parseNote("Vault/Alpha.md", "# Alpha\nLinks to [[Beta]]"),
      parseNote("Vault/Beta.md", "# Beta\nBacklink target"),
    ];
    stripVaultRoot(notes);
    const vault = analyzeVault(notes);
    const chunks = chunkAllNotes(vault.notes);
    const preview = buildObsidianPreview(vault);

    expect(chunks.length).toBe(2);
    expect(preview.graphPreview.connectedNotes).toBeGreaterThan(0);
    expect(preview.stats.totalNotes).toBe(2);
    expect(preview.sampleNotes).toHaveLength(2);
  });
});
