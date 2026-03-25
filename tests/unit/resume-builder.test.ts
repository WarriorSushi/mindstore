import { describe, expect, it } from "vitest";
import {
  extractJsonObject,
  normalizeResumeSectionType,
  RESUME_TEMPLATES,
} from "@/server/plugins/ports/resume-builder";

describe("resume builder port", () => {
  it("provides at least 3 resume templates", () => {
    expect(RESUME_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    for (const template of RESUME_TEMPLATES) {
      expect(template.id).toBeTruthy();
      expect(template.name).toBeTruthy();
      expect(template.sections.length).toBeGreaterThan(0);
    }
  });

  it("modern template starts with header and summary", () => {
    const modern = RESUME_TEMPLATES.find((t) => t.id === "modern");
    expect(modern).toBeDefined();
    expect(modern!.sections[0]).toBe("header");
    expect(modern!.sections[1]).toBe("summary");
  });

  it("extracts a JSON object from surrounding text", () => {
    const input = 'Here is the result:\n{"sections": [{"type": "summary"}]}\nDone.';
    const result = extractJsonObject(input);
    expect(JSON.parse(result)).toEqual({ sections: [{ type: "summary" }] });
  });

  it("throws when no JSON object is present", () => {
    expect(() => extractJsonObject("no json here")).toThrow("Failed to parse");
  });

  it("extracts nested JSON objects correctly", () => {
    const input = '{"a": {"b": "c"}, "d": [1, 2]}';
    const result = extractJsonObject(input);
    expect(JSON.parse(result)).toEqual({ a: { b: "c" }, d: [1, 2] });
  });

  it("normalizes valid section types", () => {
    expect(normalizeResumeSectionType("header")).toBe("header");
    expect(normalizeResumeSectionType("summary")).toBe("summary");
    expect(normalizeResumeSectionType("experience")).toBe("experience");
    expect(normalizeResumeSectionType("education")).toBe("education");
    expect(normalizeResumeSectionType("skills")).toBe("skills");
    expect(normalizeResumeSectionType("projects")).toBe("projects");
    expect(normalizeResumeSectionType("certifications")).toBe("certifications");
    expect(normalizeResumeSectionType("languages")).toBe("languages");
    expect(normalizeResumeSectionType("interests")).toBe("interests");
    expect(normalizeResumeSectionType("custom")).toBe("custom");
  });

  it("defaults unknown section types to custom", () => {
    expect(normalizeResumeSectionType("awards")).toBe("custom");
    expect(normalizeResumeSectionType(null)).toBe("custom");
    expect(normalizeResumeSectionType(undefined)).toBe("custom");
  });
});
