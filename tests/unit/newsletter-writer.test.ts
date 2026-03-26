import { describe, expect, it } from "vitest";
import {
  getPeriodLabel,
  normalizeNewsletterSectionType,
} from "@/server/plugins/ports/newsletter-writer";

describe("newsletter writer port", () => {
  it("formats a period label from a day count", () => {
    const label = getPeriodLabel(7);

    // Should contain two date-like strings and the year
    expect(label).toMatch(/\w+ \d+/);
    expect(label).toMatch(/\d{4}$/);
    expect(label).toContain("-");
  });

  it("handles single-day period", () => {
    const label = getPeriodLabel(1);
    expect(label).toMatch(/\w+ \d+-\w+ \d+, \d{4}/);
  });

  it("normalizes valid section types", () => {
    expect(normalizeNewsletterSectionType("intro")).toBe("intro");
    expect(normalizeNewsletterSectionType("topic")).toBe("topic");
    expect(normalizeNewsletterSectionType("highlight")).toBe("highlight");
    expect(normalizeNewsletterSectionType("quicklinks")).toBe("quicklinks");
    expect(normalizeNewsletterSectionType("reflection")).toBe("reflection");
    expect(normalizeNewsletterSectionType("outro")).toBe("outro");
  });

  it("defaults unknown section types to topic", () => {
    expect(normalizeNewsletterSectionType("editorial")).toBe("topic");
    expect(normalizeNewsletterSectionType(null)).toBe("topic");
    expect(normalizeNewsletterSectionType(42)).toBe("topic");
  });
});
