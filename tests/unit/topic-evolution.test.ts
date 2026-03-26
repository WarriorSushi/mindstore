import { describe, expect, it } from "vitest";
import {
  buildPeriods,
  detectShifts,
  type EvolutionTopic,
  type TimelinePeriod,
} from "@/server/plugins/ports/topic-evolution";

describe("topic evolution port", () => {
  it("builds monthly periods across a date range", () => {
    const periods = buildPeriods(new Date("2026-01-05T00:00:00.000Z"), new Date("2026-03-20T00:00:00.000Z"), "month");
    expect(periods.length).toBe(3);
    expect(periods[0]?.shortLabel).toBe("Jan");
  });

  it("detects rising and declining shifts from a timeline", () => {
    const topics: EvolutionTopic[] = [
      { id: "topic-0", label: "AI", keywords: [], memoryCount: 6, sourceTypes: {}, coherence: 0.8, color: "#14b8a6" },
      { id: "topic-1", label: "Design", keywords: [], memoryCount: 6, sourceTypes: {}, coherence: 0.8, color: "#0ea5e9" },
    ];

    const timeline: TimelinePeriod[] = [
      { label: "Jan 2026", shortLabel: "Jan", start: "", end: "", totalCount: 3, topics: [{ topicId: "topic-0", count: 0, memories: [] }, { topicId: "topic-1", count: 3, memories: [] }] },
      { label: "Feb 2026", shortLabel: "Feb", start: "", end: "", totalCount: 3, topics: [{ topicId: "topic-0", count: 1, memories: [] }, { topicId: "topic-1", count: 3, memories: [] }] },
      { label: "Mar 2026", shortLabel: "Mar", start: "", end: "", totalCount: 3, topics: [{ topicId: "topic-0", count: 2, memories: [] }, { topicId: "topic-1", count: 0, memories: [] }] },
      { label: "Apr 2026", shortLabel: "Apr", start: "", end: "", totalCount: 3, topics: [{ topicId: "topic-0", count: 3, memories: [] }, { topicId: "topic-1", count: 0, memories: [] }] },
    ];

    const shifts = detectShifts(timeline, topics);
    expect(shifts.some((shift) => shift.topicId === "topic-0" && shift.type === "rising")).toBe(true);
    expect(shifts.some((shift) => shift.topicId === "topic-1" && shift.type === "declining")).toBe(true);
  });
});
