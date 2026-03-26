import { describe, expect, it } from "vitest";
import {
  createPluginScopedId,
  stripMarkdownFence,
  parseJsonValue,
} from "@/server/plugins/ports/plugin-config";

describe("plugin-config utilities", () => {
  // ─── createPluginScopedId ─────────────────────────────────────

  describe("createPluginScopedId", () => {
    it("creates ID with given prefix", () => {
      const id = createPluginScopedId("kindle");
      expect(id).toMatch(/^kindle_/);
    });

    it("generates unique IDs", () => {
      const a = createPluginScopedId("test");
      const b = createPluginScopedId("test");
      expect(a).not.toBe(b);
    });

    it("includes timestamp and random segments", () => {
      const id = createPluginScopedId("p");
      const parts = id.split("_");
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe("p");
      expect(parts[1]!.length).toBeGreaterThan(0);
      expect(parts[2]!.length).toBeGreaterThan(0);
    });
  });

  // ─── stripMarkdownFence ───────────────────────────────────────

  describe("stripMarkdownFence", () => {
    it("strips ```json fences", () => {
      expect(stripMarkdownFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
    });

    it("strips plain ``` fences", () => {
      expect(stripMarkdownFence('```\nsome text\n```')).toBe("some text");
    });

    it("returns plain text unchanged", () => {
      expect(stripMarkdownFence('{"a":1}')).toBe('{"a":1}');
    });

    it("handles extra whitespace", () => {
      expect(stripMarkdownFence('  ```json\n{"x":1}\n```  ')).toBe('{"x":1}');
    });

    it("handles empty fenced block", () => {
      expect(stripMarkdownFence("```\n```")).toBe("");
    });
  });

  // ─── parseJsonValue ───────────────────────────────────────────

  describe("parseJsonValue", () => {
    it("parses plain JSON string", () => {
      expect(parseJsonValue<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
    });

    it("parses fenced JSON", () => {
      expect(parseJsonValue<number[]>('```json\n[1,2,3]\n```')).toEqual([1, 2, 3]);
    });

    it("throws on invalid JSON", () => {
      expect(() => parseJsonValue("not json")).toThrow();
    });

    it("parses nested objects from fenced blocks", () => {
      const input = '```json\n{"config":{"key":"value","count":42}}\n```';
      expect(parseJsonValue<{ config: { key: string; count: number } }>(input)).toEqual({
        config: { key: "value", count: 42 },
      });
    });
  });
});
