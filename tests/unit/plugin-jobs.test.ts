import { describe, expect, it } from "vitest";
import { computeNextRunAt } from "@/server/plugin-jobs";

describe("plugin job scheduling", () => {
  it("computes the next run timestamp from the requested interval", () => {
    const base = new Date("2026-03-25T10:00:00.000Z");

    expect(computeNextRunAt(base, 5).toISOString()).toBe("2026-03-25T10:05:00.000Z");
    expect(computeNextRunAt(base, 1440).toISOString()).toBe("2026-03-26T10:00:00.000Z");
  });
});
