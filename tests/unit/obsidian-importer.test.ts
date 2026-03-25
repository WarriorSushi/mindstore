import { describe, expect, it } from "vitest";
import {
  analyzeVault,
  buildObsidianPreview,
  chunkAllNotes,
  parseNote,
  stripVaultRoot,
} from "@/server/plugins/ports/obsidian-importer";

describe("obsidian importer port", () => {
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

  it("analyzes vault links and chunks notes", () => {
    const notes = [
      parseNote("Vault/Alpha.md", "# Alpha\nLinks to [[Beta]]"),
      parseNote("Vault/Beta.md", "# Beta\nBacklink target"),
    ];
    stripVaultRoot(notes);
    const vault = analyzeVault(notes);
    const chunks = chunkAllNotes(vault.notes);
    const preview = buildObsidianPreview(vault);

    expect(vault.stats.totalNotes).toBe(2);
    expect(vault.backlinks.get("beta")?.length).toBe(1);
    expect(chunks.length).toBe(2);
    expect(preview.graphPreview.connectedNotes).toBeGreaterThan(0);
  });
});
