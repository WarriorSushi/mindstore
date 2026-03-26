import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { callTextPrompt, getTextGenerationConfig } from "@/server/ai-client";
import { PLUGIN_MANIFESTS } from "@/server/plugins/registry";

const PLUGIN_SLUG = "flashcard-maker";
const DECK_COLORS = ["teal", "sky", "emerald", "amber", "cyan", "rose", "lime", "orange"];

export interface FlashcardSM2State {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: string;
  lastReview: string | null;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  hint?: string;
  tags: string[];
  sourceMemoryId?: string;
  sourceTitle?: string;
  sm2: FlashcardSM2State;
  createdAt: string;
}

export interface FlashcardDeck {
  id: string;
  userId: string;
  name: string;
  description?: string;
  color: string;
  cards: Flashcard[];
  createdAt: string;
  updatedAt: string;
}

export interface FlashcardDeckSummary {
  id: string;
  name: string;
  description?: string;
  color: string;
  cardCount: number;
  dueCount: number;
  masteredCount: number;
  avgEaseFactor: number;
  createdAt: string;
  updatedAt: string;
}

export interface FlashcardStats {
  totalCards: number;
  totalDecks: number;
  dueNow: number;
  mastered: number;
  reviewed: number;
  streak: number;
  distribution: { new: number; learning: number; reviewing: number; mastered: number };
}

export interface FlashcardGenerationRequest {
  memoryIds?: string[];
  topic?: string;
  limit?: number;
}

export interface FlashcardReviewSession {
  deckId: string;
  deckName: string;
  deckColor: string;
  totalCards: number;
  dueCards: Flashcard[];
  dueCount: number;
  newCount: number;
}

export async function ensureFlashcardMakerInstalled() {
  const manifest = PLUGIN_MANIFESTS[PLUGIN_SLUG];
  const [existing] = await db
    .select()
    .from(schema.plugins)
    .where(eq(schema.plugins.slug, PLUGIN_SLUG))
    .limit(1);

  if (existing || !manifest) {
    return;
  }

  await db.insert(schema.plugins).values({
    slug: manifest.slug,
    name: manifest.name,
    description: manifest.description,
    version: manifest.version,
    type: manifest.type,
    status: "active",
    icon: manifest.icon,
    category: manifest.category,
    author: manifest.author,
    metadata: {
      capabilities: manifest.capabilities,
      hooks: manifest.hooks,
      routes: manifest.routes,
      mcpTools: manifest.mcpTools,
      aliases: manifest.aliases || [],
      dashboardWidgets: manifest.ui?.dashboardWidgets || [],
      jobs: manifest.jobs || [],
      jobRuns: {},
    },
  });
}

export async function listFlashcardDeckSummaries(userId: string): Promise<FlashcardDeckSummary[]> {
  const decks = await getFlashcardDecks(userId);
  const now = new Date();

  return decks.map((deck) => {
    const dueCards = deck.cards.filter((card) => new Date(card.sm2.nextReview) <= now);
    const masteredCards = deck.cards.filter((card) => card.sm2.repetitions >= 5);
    const avgEase = deck.cards.length
      ? deck.cards.reduce((sum, card) => sum + card.sm2.easeFactor, 0) / deck.cards.length
      : 2.5;

    return {
      id: deck.id,
      name: deck.name,
      description: deck.description,
      color: deck.color,
      cardCount: deck.cards.length,
      dueCount: dueCards.length,
      masteredCount: masteredCards.length,
      avgEaseFactor: Math.round(avgEase * 100) / 100,
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt,
    };
  });
}

export async function getFlashcardDeckDetail(userId: string, deckId: string): Promise<FlashcardDeck | null> {
  const [row] = await db
    .select()
    .from(schema.flashcardDecks)
    .where(and(eq(schema.flashcardDecks.userId, userId), eq(schema.flashcardDecks.id, deckId)))
    .limit(1);

  return row ? normalizeDeckRow(row) : null;
}

export async function getFlashcardReviewSession(userId: string, deckId: string): Promise<FlashcardReviewSession | null> {
  const deck = await getFlashcardDeckDetail(userId, deckId);
  if (!deck) {
    return null;
  }

  const now = new Date();
  const dueCards = deck.cards
    .filter((card) => new Date(card.sm2.nextReview) <= now)
    .sort((a, b) => new Date(a.sm2.nextReview).getTime() - new Date(b.sm2.nextReview).getTime());

  const newCards = deck.cards
    .filter((card) => card.sm2.repetitions === 0 && !dueCards.some((due) => due.id === card.id))
    .slice(0, 10);

  return {
    deckId: deck.id,
    deckName: deck.name,
    deckColor: deck.color,
    totalCards: deck.cards.length,
    dueCards: [...dueCards, ...newCards],
    dueCount: dueCards.length,
    newCount: newCards.length,
  };
}

export async function getFlashcardStats(userId: string): Promise<FlashcardStats> {
  const decks = await getFlashcardDecks(userId);
  const now = new Date();
  const allCards = decks.flatMap((deck) => deck.cards);
  const reviewDates = new Set<string>();

  for (const card of allCards) {
    if (card.sm2.lastReview) {
      reviewDates.add(card.sm2.lastReview.slice(0, 10));
    }
  }

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i += 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    if (reviewDates.has(key)) {
      streak += 1;
    } else if (i > 0) {
      break;
    }
  }

  const distribution = { new: 0, learning: 0, reviewing: 0, mastered: 0 };
  for (const card of allCards) {
    if (card.sm2.repetitions === 0) distribution.new += 1;
    else if (card.sm2.repetitions < 3) distribution.learning += 1;
    else if (card.sm2.repetitions < 5) distribution.reviewing += 1;
    else distribution.mastered += 1;
  }

  return {
    totalCards: allCards.length,
    totalDecks: decks.length,
    dueNow: allCards.filter((card) => new Date(card.sm2.nextReview) <= now).length,
    mastered: allCards.filter((card) => card.sm2.repetitions >= 5).length,
    reviewed: allCards.filter((card) => card.sm2.lastReview !== null).length,
    streak,
    distribution,
  };
}

export async function createFlashcardDeck(userId: string, input: { name: string; description?: string; color?: string }) {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error("Deck name required");
  }

  const countRows = await db
    .select({ id: schema.flashcardDecks.id })
    .from(schema.flashcardDecks)
    .where(eq(schema.flashcardDecks.userId, userId));

  const [deck] = await db.insert(schema.flashcardDecks).values({
    userId,
    name: trimmedName,
    description: input.description?.trim() || null,
    color: input.color || DECK_COLORS[countRows.length % DECK_COLORS.length] || "teal",
    cards: [],
    updatedAt: new Date(),
  }).returning();

  return normalizeDeckRow(deck);
}

export async function saveFlashcardsToDeck(userId: string, deckId: string, cards: unknown[]) {
  const deck = await getFlashcardDeckDetail(userId, deckId);
  if (!deck) {
    throw new Error("Deck not found");
  }

  const nextCards = [
    ...deck.cards,
    ...cards.map((card) => normalizeFlashcardRecord(card)),
  ];

  await updateDeckCards(deckId, nextCards);

  return {
    saved: cards.length,
    totalCards: nextCards.length,
  };
}

export async function reviewFlashcard(userId: string, deckId: string, cardId: string, grade: number) {
  const deck = await getFlashcardDeckDetail(userId, deckId);
  if (!deck) {
    throw new Error("Deck not found");
  }

  const index = deck.cards.findIndex((card) => card.id === cardId);
  if (index < 0) {
    throw new Error("Card not found");
  }

  const oldState = deck.cards[index]!.sm2;
  deck.cards[index] = {
    ...deck.cards[index]!,
    sm2: sm2Update(deck.cards[index]!.sm2, grade),
  };

  await updateDeckCards(deckId, deck.cards);

  return {
    cardId,
    oldState,
    newState: deck.cards[index]!.sm2,
    grade,
  };
}

export async function deleteFlashcardDeck(userId: string, deckId: string) {
  const [deleted] = await db
    .delete(schema.flashcardDecks)
    .where(and(eq(schema.flashcardDecks.userId, userId), eq(schema.flashcardDecks.id, deckId)))
    .returning();

  if (!deleted) {
    throw new Error("Deck not found");
  }

  return { deleted: true };
}

export async function deleteFlashcard(userId: string, deckId: string, cardId: string) {
  const deck = await getFlashcardDeckDetail(userId, deckId);
  if (!deck) {
    throw new Error("Deck not found");
  }

  const nextCards = deck.cards.filter((card) => card.id !== cardId);
  if (nextCards.length === deck.cards.length) {
    throw new Error("Card not found");
  }

  await updateDeckCards(deckId, nextCards);

  return {
    deleted: true,
    remainingCards: nextCards.length,
  };
}

export async function generateFlashcards(userId: string, input: FlashcardGenerationRequest) {
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 15);
  const memories = await loadCandidateMemories(userId, input);

  if (!memories.length) {
    return {
      cards: [],
      count: 0,
      memoriesUsed: 0,
      message: "No memories found to generate from",
    };
  }

  const aiConfig = await getTextGenerationConfig({
    openai: "gpt-4o-mini",
    openrouter: "anthropic/claude-3.5-haiku",
    gemini: "gemini-2.0-flash-lite",
    ollama: "llama3.2",
    custom: "default",
  });
  if (!aiConfig) {
    throw new Error("No AI provider configured");
  }

  const memoryTexts = memories.map((memory, index) => {
    const title = memory.source_title || `Memory ${index + 1}`;
    const preview = String(memory.content).slice(0, 1500);
    return `[${memory.id}] "${title}"\n${preview}`;
  }).join("\n\n---\n\n");

  const system = `You are a flashcard generation expert. Create high-quality Q&A flashcards from the given knowledge content.

RULES:
1. Each flashcard should test one concept.
2. Questions should be clear and unambiguous.
3. Answers should be concise but complete.
4. Include a short hint that nudges without giving away the answer.
5. Extract meaningful tags from the content.
6. Reference the source memory ID when possible.
7. Aim for different question types: definitions, comparisons, applications, cause-effect.
8. Skip trivial facts.
9. Generate exactly ${limit} flashcards.

Output a JSON array only.`;

  const prompt = `Generate ${limit} flashcards from this knowledge:\n\n${memoryTexts}`;
  const response = await callTextPrompt(aiConfig, prompt, system, {
    temperature: 0.3,
    maxTokens: 4096,
  });
  if (!response) {
    throw new Error("AI generation failed");
  }

  const generatedCards = normalizeGeneratedCards(parseJsonArray(response));

  return {
    cards: generatedCards,
    count: generatedCards.length,
    memoriesUsed: memories.length,
  };
}

export function sm2Initial(): FlashcardSM2State {
  return {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReview: new Date().toISOString(),
    lastReview: null,
  };
}

export function sm2Update(state: FlashcardSM2State, grade: number): FlashcardSM2State {
  const now = new Date();
  let { easeFactor, interval, repetitions } = state;

  if (grade >= 3) {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 1;
  }

  easeFactor += 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02);
  easeFactor = Math.max(1.3, easeFactor);

  const nextReview = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
  return {
    easeFactor: Math.round(easeFactor * 100) / 100,
    interval,
    repetitions,
    nextReview: nextReview.toISOString(),
    lastReview: now.toISOString(),
  };
}

export function normalizeGeneratedCards(cards: unknown[]): Flashcard[] {
  return cards
    .filter((card) => isRecord(card) && typeof card.front === "string" && typeof card.back === "string")
    .map((card) => normalizeFlashcardRecord(card));
}

async function getFlashcardDecks(userId: string): Promise<FlashcardDeck[]> {
  const rows = await db
    .select()
    .from(schema.flashcardDecks)
    .where(eq(schema.flashcardDecks.userId, userId))
    .orderBy(desc(schema.flashcardDecks.updatedAt));

  return rows.map((row) => normalizeDeckRow(row));
}

async function updateDeckCards(deckId: string, cards: Flashcard[]) {
  await db
    .update(schema.flashcardDecks)
    .set({ cards, updatedAt: new Date() })
    .where(eq(schema.flashcardDecks.id, deckId));
}

async function loadCandidateMemories(userId: string, input: FlashcardGenerationRequest) {
  if (input.memoryIds?.length) {
    return db.execute(sql`
      SELECT id, content, source_title, source_type, metadata
      FROM memories
      WHERE user_id = ${userId}::uuid
        AND id::text = ANY(${input.memoryIds}::text[])
      LIMIT 20
    `) as Promise<Array<Record<string, unknown>>>;
  }

  if (input.topic?.trim()) {
    const pattern = `%${input.topic.trim()}%`;
    return db.execute(sql`
      SELECT id, content, source_title, source_type, metadata
      FROM memories
      WHERE user_id = ${userId}::uuid
        AND (content ILIKE ${pattern} OR source_title ILIKE ${pattern})
      ORDER BY created_at DESC
      LIMIT 20
    `) as Promise<Array<Record<string, unknown>>>;
  }

  return db.execute(sql`
    SELECT id, content, source_title, source_type, metadata
    FROM memories
    WHERE user_id = ${userId}::uuid
      AND length(content) > 100
    ORDER BY RANDOM()
    LIMIT 15
  `) as Promise<Array<Record<string, unknown>>>;
}

function parseJsonArray(response: string): unknown[] {
  try {
    return JSON.parse(stripMarkdownFence(response));
  } catch {
    const match = response.match(/\[[\s\S]*\]/);
    if (!match) {
      throw new Error("AI response did not contain valid JSON");
    }
    return JSON.parse(match[0]);
  }
}

function stripMarkdownFence(value: string) {
  return value.trim().replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
}

function normalizeDeckRow(row: typeof schema.flashcardDecks.$inferSelect): FlashcardDeck {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description || undefined,
    color: row.color,
    cards: Array.isArray(row.cards) ? row.cards.map((card) => normalizeFlashcardRecord(card)) : [],
    createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString() || new Date().toISOString(),
  };
}

function normalizeFlashcardRecord(card: unknown): Flashcard {
  const value = isRecord(card) ? card : {};
  return {
    id: typeof value.id === "string" && value.id ? value.id : `fc_${randomUUID()}`,
    front: typeof value.front === "string" ? value.front.trim() : "",
    back: typeof value.back === "string" ? value.back.trim() : "",
    hint: typeof value.hint === "string" && value.hint.trim() ? value.hint.trim() : undefined,
    tags: Array.isArray(value.tags) ? value.tags.map(String).filter(Boolean).slice(0, 8) : [],
    sourceMemoryId: typeof value.sourceMemoryId === "string" ? value.sourceMemoryId : undefined,
    sourceTitle: typeof value.sourceTitle === "string" ? value.sourceTitle : undefined,
    sm2: normalizeSm2State(value.sm2),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
  };
}

function normalizeSm2State(value: unknown): FlashcardSM2State {
  if (!isRecord(value)) {
    return sm2Initial();
  }

  return {
    easeFactor: typeof value.easeFactor === "number" ? value.easeFactor : 2.5,
    interval: typeof value.interval === "number" ? value.interval : 0,
    repetitions: typeof value.repetitions === "number" ? value.repetitions : 0,
    nextReview: typeof value.nextReview === "string" ? value.nextReview : new Date().toISOString(),
    lastReview: typeof value.lastReview === "string" ? value.lastReview : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
