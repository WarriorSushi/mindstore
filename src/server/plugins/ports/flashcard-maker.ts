/**
 * Flashcard Maker — Portable logic for spaced repetition flashcard system
 *
 * Extracted from: src/app/api/v1/plugins/flashcard-maker/route.ts
 * Pure functions — no HTTP, no NextRequest/NextResponse.
 * AI calling injected via parameter (use shared ai-caller.ts).
 *
 * Key features:
 *   - SM-2 spaced repetition algorithm
 *   - Deck/card management (CRUD)
 *   - AI-powered flashcard generation from memory content
 *   - Review scheduling and mastery tracking
 */

// ─── Types ───────────────────────────────────────────────────

export interface SM2State {
  easeFactor: number;   // EF, starts at 2.5
  interval: number;     // days until next review
  repetitions: number;  // consecutive correct answers
  nextReview: string;   // ISO date string
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
  sm2: SM2State;
  createdAt: string;
}

export interface Deck {
  id: string;
  name: string;
  description?: string;
  color: string;
  cards: Flashcard[];
  createdAt: string;
  updatedAt: string;
}

export interface DeckSummary {
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

export interface GeneratedCard {
  front: string;
  back: string;
  hint?: string;
  tags: string[];
  sourceMemoryId?: string;
  sourceTitle?: string;
}

export interface FlashcardStats {
  totalCards: number;
  totalDecks: number;
  dueNow: number;
  mastered: number;
  reviewed: number;
  streak: number;
  distribution: {
    new: number;
    learning: number;
    reviewing: number;
    mastered: number;
  };
}

export interface ReviewResult {
  cardId: string;
  oldState: SM2State;
  newState: SM2State;
  grade: number;
}

// ─── Constants ───────────────────────────────────────────────

export const DECK_COLORS = [
  'teal', 'sky', 'emerald', 'amber', 'cyan', 'rose', 'lime', 'orange',
] as const;

export const MASTERY_THRESHOLD = 5; // repetitions to be "mastered"

// ─── ID Generation ───────────────────────────────────────────

export function generateFlashcardId(): string {
  return `fc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── SM-2 Algorithm ──────────────────────────────────────────

/**
 * Returns the default SM-2 state for a new card (due immediately).
 */
export function sm2Initial(): SM2State {
  return {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReview: new Date().toISOString(),
    lastReview: null,
  };
}

/**
 * SM-2 SuperMemo algorithm update.
 * @param state  Current SM-2 state
 * @param grade  0-5 (0-2 = fail, 3 = hard, 4 = good, 5 = easy)
 * @returns Updated SM-2 state
 */
export function sm2Update(state: SM2State, grade: number): SM2State {
  const now = new Date();
  let { easeFactor, interval, repetitions } = state;

  if (grade >= 3) {
    // Correct response
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  } else {
    // Incorrect — reset
    repetitions = 0;
    interval = 1;
  }

  // Update ease factor
  easeFactor = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  easeFactor = Math.max(1.3, easeFactor); // minimum EF

  const nextReview = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

  return {
    easeFactor: Math.round(easeFactor * 100) / 100,
    interval,
    repetitions,
    nextReview: nextReview.toISOString(),
    lastReview: now.toISOString(),
  };
}

// ─── Deck Operations ─────────────────────────────────────────

/**
 * Compute summary stats for a list of decks.
 */
export function summarizeDecks(decks: Deck[]): DeckSummary[] {
  const now = new Date();
  return decks.map(d => {
    const dueCards = d.cards.filter(c => new Date(c.sm2.nextReview) <= now);
    const masteredCards = d.cards.filter(c => c.sm2.repetitions >= MASTERY_THRESHOLD);
    const avgEase = d.cards.length > 0
      ? d.cards.reduce((sum, c) => sum + c.sm2.easeFactor, 0) / d.cards.length
      : 2.5;
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      color: d.color,
      cardCount: d.cards.length,
      dueCount: dueCards.length,
      masteredCount: masteredCards.length,
      avgEaseFactor: Math.round(avgEase * 100) / 100,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  });
}

/**
 * Create a new empty deck.
 */
export function createDeck(
  name: string,
  opts?: { description?: string; color?: string; existingDeckCount?: number }
): Deck {
  const count = opts?.existingDeckCount ?? 0;
  return {
    id: generateFlashcardId(),
    name: name.trim(),
    description: opts?.description?.trim(),
    color: opts?.color || DECK_COLORS[count % DECK_COLORS.length],
    cards: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get cards due for review in a deck.
 * Returns due cards sorted by urgency + up to `newCardLimit` unreviewed cards.
 */
export function getDueCards(
  deck: Deck,
  opts?: { newCardLimit?: number }
): { dueCards: Flashcard[]; newCards: Flashcard[]; dueCount: number; newCount: number } {
  const now = new Date();
  const limit = opts?.newCardLimit ?? 10;

  const dueCards = deck.cards
    .filter(c => new Date(c.sm2.nextReview) <= now)
    .sort((a, b) => new Date(a.sm2.nextReview).getTime() - new Date(b.sm2.nextReview).getTime());

  const dueIds = new Set(dueCards.map(c => c.id));
  const newCards = deck.cards
    .filter(c => c.sm2.repetitions === 0 && !dueIds.has(c.id))
    .slice(0, limit);

  return {
    dueCards,
    newCards,
    dueCount: dueCards.length,
    newCount: newCards.length,
  };
}

/**
 * Review a card — apply SM-2 grade and return state transition.
 * Mutates the card in place.
 */
export function reviewCard(card: Flashcard, grade: number): ReviewResult {
  if (grade < 0 || grade > 5) throw new Error('grade must be 0-5');
  const oldState = { ...card.sm2 };
  card.sm2 = sm2Update(card.sm2, grade);
  return {
    cardId: card.id,
    oldState,
    newState: card.sm2,
    grade,
  };
}

/**
 * Add generated cards to a deck, initializing SM-2 state.
 * Returns the number of cards added.
 */
export function addCardsToDeck(deck: Deck, cards: GeneratedCard[]): number {
  let added = 0;
  for (const card of cards) {
    if (!card.front || !card.back) continue;
    deck.cards.push({
      id: generateFlashcardId(),
      front: String(card.front).trim(),
      back: String(card.back).trim(),
      hint: card.hint ? String(card.hint).trim() : undefined,
      tags: Array.isArray(card.tags) ? card.tags.map(String) : [],
      sourceMemoryId: card.sourceMemoryId,
      sourceTitle: card.sourceTitle,
      sm2: sm2Initial(),
      createdAt: new Date().toISOString(),
    });
    added++;
  }
  deck.updatedAt = new Date().toISOString();
  return added;
}

// ─── Stats ───────────────────────────────────────────────────

/**
 * Calculate aggregate stats across all decks.
 */
export function computeStats(decks: Deck[]): FlashcardStats {
  const now = new Date();
  const allCards = decks.flatMap(d => d.cards);
  const totalCards = allCards.length;
  const dueNow = allCards.filter(c => new Date(c.sm2.nextReview) <= now).length;
  const mastered = allCards.filter(c => c.sm2.repetitions >= MASTERY_THRESHOLD).length;
  const reviewed = allCards.filter(c => c.sm2.lastReview !== null).length;

  // Review streak — consecutive days with at least one review
  const reviewDates = new Set<string>();
  for (const card of allCards) {
    if (card.sm2.lastReview) {
      reviewDates.add(card.sm2.lastReview.slice(0, 10));
    }
  }
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    if (reviewDates.has(dateStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  // Mastery distribution
  const distribution = { new: 0, learning: 0, reviewing: 0, mastered: 0 };
  for (const card of allCards) {
    if (card.sm2.repetitions === 0) distribution.new++;
    else if (card.sm2.repetitions < 3) distribution.learning++;
    else if (card.sm2.repetitions < MASTERY_THRESHOLD) distribution.reviewing++;
    else distribution.mastered++;
  }

  return {
    totalCards,
    totalDecks: decks.length,
    dueNow,
    mastered,
    reviewed,
    streak,
    distribution,
  };
}

// ─── AI Generation ───────────────────────────────────────────

/**
 * Build the AI prompt + system message for flashcard generation.
 * Returns { system, prompt } — caller passes them to their AI caller.
 */
export function buildGenerationPrompt(
  memoryTexts: { id: string; title: string; content: string }[],
  limit: number
): { system: string; prompt: string } {
  const count = Math.min(limit, 15);

  const formatted = memoryTexts.map((m, i) => {
    const preview = m.content.slice(0, 1500);
    return `[${m.id}] "${m.title}"\n${preview}`;
  }).join('\n\n---\n\n');

  const system = `You are a flashcard generation expert. Create high-quality Q&A flashcards from the given knowledge content.

RULES:
1. Each flashcard should test ONE concept — specific, not vague
2. Questions should be clear and unambiguous
3. Answers should be concise but complete (1-3 sentences)
4. Include a short hint (1 keyword or phrase) that nudges without giving away the answer
5. Extract meaningful tags from the content (1-3 per card)
6. Reference the source memory ID so cards link back to the original knowledge
7. Aim for different question types: definitions, comparisons, applications, cause-effect
8. Skip trivial or overly obvious facts
9. Generate exactly ${count} flashcards

Output JSON array ONLY (no markdown fences, no explanation):
[
  {
    "front": "question",
    "back": "answer",
    "hint": "hint keyword",
    "tags": ["tag1", "tag2"],
    "sourceMemoryId": "memory-uuid",
    "sourceTitle": "source title"
  }
]`;

  const prompt = `Generate ${count} flashcards from this knowledge:\n\n${formatted}`;

  return { system, prompt };
}

/**
 * Parse AI response into normalized GeneratedCard[].
 * Returns empty array if parsing fails.
 */
export function parseGeneratedCards(response: string): GeneratedCard[] {
  let cards: any[] = [];
  try {
    let jsonStr = response.trim();
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    cards = JSON.parse(jsonStr);
  } catch {
    const match = response.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        cards = JSON.parse(match[0]);
      } catch {
        return [];
      }
    } else {
      return [];
    }
  }

  return cards
    .filter((c: any) => c.front && c.back)
    .map((c: any) => ({
      front: String(c.front).trim(),
      back: String(c.back).trim(),
      hint: c.hint ? String(c.hint).trim() : undefined,
      tags: Array.isArray(c.tags) ? c.tags.map(String) : [],
      sourceMemoryId: c.sourceMemoryId || undefined,
      sourceTitle: c.sourceTitle || undefined,
    }));
}
