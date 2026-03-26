import { describe, expect, it } from "vitest";
import {
  type Deck,
  type Flashcard,
  summarizeDecks,
  totalCards,
  generateAnkiTSV,
  generateCSV,
  createExportPackage,
  computeExportStats,
  exportCardsCSV,
  EXPORT_FORMATS,
} from "@/server/plugins/ports/anki-export";

function makeSM2(overrides: Partial<Flashcard["sm2"]> = {}): Flashcard["sm2"] {
  return {
    easeFactor: 2.5,
    interval: 1,
    repetitions: 0,
    nextReview: new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
  };
}

function makeCard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: "card-1",
    front: "What is TypeScript?",
    back: "A typed superset of JavaScript",
    tags: ["programming", "typescript"],
    sm2: makeSM2(),
    createdAt: "2024-01-15T10:00:00Z",
    ...overrides,
  };
}

function makeDeck(overrides: Partial<Deck> = {}): Deck {
  return {
    id: "deck-1",
    name: "Programming Basics",
    description: "Fundamentals of programming",
    color: "#0d9488",
    cards: [makeCard()],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
    ...overrides,
  };
}

describe("anki-export port", () => {
  it("summarizeDecks returns correct card counts", () => {
    const decks = [makeDeck({ cards: [makeCard(), makeCard({ id: "card-2" })] })];
    const summaries = summarizeDecks(decks);

    expect(summaries).toHaveLength(1);
    expect(summaries[0]!.cardCount).toBe(2);
    expect(summaries[0]!.name).toBe("Programming Basics");
  });

  it("summarizeDecks counts mastered cards (repetitions >= 5)", () => {
    const mastered = makeCard({ id: "m1", sm2: makeSM2({ repetitions: 7 }) });
    const novice = makeCard({ id: "m2", sm2: makeSM2({ repetitions: 1 }) });
    const decks = [makeDeck({ cards: [mastered, novice] })];
    const summaries = summarizeDecks(decks);

    expect(summaries[0]!.masteredCount).toBe(1);
  });

  it("totalCards sums across multiple decks", () => {
    const decks = [
      makeDeck({ id: "d1", cards: [makeCard(), makeCard({ id: "c2" })] }),
      makeDeck({ id: "d2", cards: [makeCard({ id: "c3" })] }),
    ];
    expect(totalCards(decks)).toBe(3);
  });

  it("generateAnkiTSV produces valid tab-separated format with headers", () => {
    const cards = [makeCard(), makeCard({ id: "c2", front: "What is JS?", back: "A language" })];
    const tsv = generateAnkiTSV(cards, "Test Deck");

    expect(tsv).toContain("# separator:tab");
    expect(tsv).toContain("# deck:Test Deck");
    expect(tsv).toContain("# notetype:Basic");
    expect(tsv).toContain("What is TypeScript?");
    expect(tsv).toContain("What is JS?");
    // Tab-separated: front\tback\ttags
    const dataLines = tsv.split("\n").filter((l) => !l.startsWith("#") && l.trim());
    expect(dataLines.length).toBe(2);
    expect(dataLines[0]!.split("\t")).toHaveLength(3);
  });

  it("generateAnkiTSV includes hint in back field", () => {
    const cards = [makeCard({ hint: "Think about types" })];
    const tsv = generateAnkiTSV(cards, "Deck");

    expect(tsv).toContain("Think about types");
  });

  it("generateCSV with metadata includes all columns", () => {
    const cards = [makeCard({ sourceTitle: "MDN Docs" })];
    const csv = generateCSV(cards, true);
    const lines = csv.split("\n");

    expect(lines[0]).toContain("Front");
    expect(lines[0]).toContain("Source");
    expect(lines[0]).toContain("Ease Factor");
    expect(lines[1]).toContain("What is TypeScript?");
    expect(lines[1]).toContain("MDN Docs");
  });

  it("generateCSV without metadata is minimal", () => {
    const cards = [makeCard()];
    const csv = generateCSV(cards, false);
    const headers = csv.split("\n")[0]!;

    expect(headers).toBe("Front,Back,Tags");
  });

  it("createExportPackage single deck returns single file", async () => {
    const decks = [makeDeck()];
    const result = await createExportPackage(decks, [], "tsv", false);

    expect(result.filename).toContain("anki.txt");
    expect(result.contentType).toBe("text/plain");
    expect(result.buffer.toString()).toContain("What is TypeScript?");
  });

  it("createExportPackage multiple decks returns ZIP", async () => {
    const decks = [
      makeDeck({ id: "d1", name: "Deck A" }),
      makeDeck({ id: "d2", name: "Deck B" }),
    ];
    const result = await createExportPackage(decks, [], "csv", true);

    expect(result.filename).toBe("mindstore_flashcards.zip");
    expect(result.contentType).toBe("application/zip");
    // ZIP starts with PK signature
    expect(result.buffer[0]).toBe(0x50);
    expect(result.buffer[1]).toBe(0x4b);
  });

  it("computeExportStats counts correctly", () => {
    const decks = [
      makeDeck({ id: "d1", cards: [makeCard(), makeCard({ id: "c2" })] }),
      makeDeck({ id: "d2", cards: [makeCard({ id: "c3" })] }),
    ];
    const stats = computeExportStats(decks, ["d1"]);

    expect(stats.decksExported).toBe(1);
    expect(stats.cardsExported).toBe(2);
  });

  it("exportCardsCSV flattens across decks", () => {
    const decks = [
      makeDeck({ id: "d1", cards: [makeCard()] }),
      makeDeck({ id: "d2", cards: [makeCard({ id: "c2", front: "Second card" })] }),
    ];
    const { csv, cardCount } = exportCardsCSV(decks, [], false);

    expect(cardCount).toBe(2);
    expect(csv).toContain("What is TypeScript?");
    expect(csv).toContain("Second card");
  });

  it("EXPORT_FORMATS has tsv and csv options", () => {
    expect(EXPORT_FORMATS).toHaveLength(2);
    expect(EXPORT_FORMATS.map((f) => f.id)).toEqual(["tsv", "csv"]);
    expect(EXPORT_FORMATS.find((f) => f.id === "tsv")?.recommended).toBe(true);
  });
});
