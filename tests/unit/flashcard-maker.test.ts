import { describe, expect, it } from "vitest";
import {
  normalizeGeneratedCards,
  sm2Initial,
  sm2Update,
} from "@/server/plugins/ports/flashcard-maker";

describe("flashcard maker port", () => {
  it("initializes SM-2 state for new flashcards", () => {
    const initial = sm2Initial();

    expect(initial.easeFactor).toBe(2.5);
    expect(initial.interval).toBe(0);
    expect(initial.repetitions).toBe(0);
    expect(initial.lastReview).toBeNull();
  });

  it("advances SM-2 state after a successful review", () => {
    const state = sm2Update(sm2Initial(), 4);

    expect(state.repetitions).toBe(1);
    expect(state.interval).toBe(1);
    expect(state.easeFactor).toBeGreaterThan(2.4);
    expect(state.lastReview).not.toBeNull();
  });

  it("normalizes generated cards and drops invalid entries", () => {
    const cards = normalizeGeneratedCards([
      {
        front: "What is spaced repetition?",
        back: "A review method that increases intervals between successful recalls.",
        hint: "memory",
        tags: ["learning", "memory"],
      },
      {
        front: "Missing back",
      },
    ]);

    expect(cards).toHaveLength(1);
    expect(cards[0]?.front).toBe("What is spaced repetition?");
    expect(cards[0]?.sm2.repetitions).toBe(0);
    expect(cards[0]?.tags).toEqual(["learning", "memory"]);
  });
});
