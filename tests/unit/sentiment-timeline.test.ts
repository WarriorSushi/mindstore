import { describe, expect, it } from "vitest";
import {
  analyzeSentimentLexicon,
  buildDailySentiment,
  buildMonthlySentimentTrends,
  classifySentimentScore,
  type SentimentMemory,
} from "@/server/plugins/ports/sentiment-timeline";

describe("sentiment timeline port", () => {
  it("classifies score bands consistently", () => {
    expect(classifySentimentScore(0.6)).toBe("positive");
    expect(classifySentimentScore(0.15)).toBe("mixed");
    expect(classifySentimentScore(-0.6)).toBe("negative");
    expect(classifySentimentScore(0.02)).toBe("neutral");
  });

  it("uses the lexicon fallback to detect positive emotion", () => {
    const result = analyzeSentimentLexicon("I am excited and grateful about this amazing progress.");
    expect(result.score).toBeGreaterThan(0);
    expect(result.label).toBe("positive");
    expect(result.emotions).toContain("gratitude");
  });

  it("builds daily and monthly aggregates from analyzed memories", () => {
    const memories: SentimentMemory[] = [
      {
        id: "1",
        content: "A",
        sourceType: "text",
        sourceTitle: "One",
        createdAt: "2026-03-01T10:00:00.000Z",
        score: 0.6,
        label: "positive",
        emotions: [],
      },
      {
        id: "2",
        content: "B",
        sourceType: "text",
        sourceTitle: "Two",
        createdAt: "2026-03-01T18:00:00.000Z",
        score: -0.2,
        label: "mixed",
        emotions: [],
      },
      {
        id: "3",
        content: "C",
        sourceType: "file",
        sourceTitle: "Three",
        createdAt: "2026-04-02T10:00:00.000Z",
        score: -0.7,
        label: "negative",
        emotions: [],
      },
    ];

    const daily = buildDailySentiment(memories);
    const monthly = buildMonthlySentimentTrends(memories);

    expect(daily).toHaveLength(2);
    expect(daily[0]?.avgScore).toBe(0.2);
    expect(monthly).toHaveLength(2);
    expect(monthly[0]?.month).toBe("2026-03");
    expect(monthly[1]?.label).toBe("negative");
  });
});
