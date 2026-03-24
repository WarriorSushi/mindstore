import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

/**
 * Flashcard Maker Plugin — Spaced repetition from your knowledge
 *
 * GET  ?action=decks          — List all decks with stats
 * GET  ?action=cards&deckId=  — Get cards in a deck
 * GET  ?action=review&deckId= — Get cards due for review (SM-2 schedule)
 * GET  ?action=generate       — Generate flashcards from memories (AI-powered)
 * POST ?action=create-deck    — Create a new deck
 * POST ?action=save-cards     — Save generated cards to a deck
 * POST ?action=review-card    — Submit a review grade for a card (SM-2 update)
 * POST ?action=delete-deck    — Delete a deck and its cards
 * POST ?action=delete-card    — Delete a single card
 *
 * Cards stored in memory metadata. SM-2 algorithm for spaced repetition scheduling.
 */

const PLUGIN_SLUG = 'flashcard-maker';

// ─── Auto-install ────────────────────────────────────────────

async function ensurePluginInstalled() {
  const existing = await db.execute(sql`SELECT id FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
  if ((existing as any[]).length === 0) {
    await db.execute(sql`
      INSERT INTO plugins (slug, name, description, type, status, icon, category)
      VALUES (
        ${PLUGIN_SLUG},
        'Flashcard Maker',
        'Auto-generate spaced repetition flashcards from your memories with built-in review.',
        'extension',
        'active',
        'Layers',
        'action'
      )
    `);
  }
}

// ─── AI Config ───────────────────────────────────────────────

interface AIConfig {
  type: 'openai-compatible' | 'gemini' | 'ollama';
  url: string;
  key?: string;
  model: string;
  extraHeaders?: Record<string, string>;
}

function getAIConfig(config: Record<string, string>): AIConfig | null {
  const preferred = config.chat_provider;
  const openaiKey = config.openai_api_key || process.env.OPENAI_API_KEY;
  const geminiKey = config.gemini_api_key || process.env.GEMINI_API_KEY;
  const ollamaUrl = config.ollama_url || process.env.OLLAMA_URL;
  const openrouterKey = config.openrouter_api_key || process.env.OPENROUTER_API_KEY;
  const customKey = config.custom_api_key;
  const customUrl = config.custom_api_url;
  const customModel = config.custom_api_model;

  if (preferred === 'openrouter' && openrouterKey) {
    return { type: 'openai-compatible', url: 'https://openrouter.ai/api/v1/chat/completions', key: openrouterKey, model: 'anthropic/claude-3.5-haiku', extraHeaders: { 'HTTP-Referer': 'https://mindstore.app', 'X-Title': 'MindStore' } };
  }
  if (preferred === 'custom' && customKey && customUrl) {
    return { type: 'openai-compatible', url: customUrl, key: customKey, model: customModel || 'default' };
  }
  if (preferred === 'gemini' && geminiKey) {
    return { type: 'gemini', url: '', key: geminiKey, model: 'gemini-2.0-flash-lite' };
  }
  if (preferred === 'openai' && openaiKey) {
    return { type: 'openai-compatible', url: 'https://api.openai.com/v1/chat/completions', key: openaiKey, model: 'gpt-4o-mini' };
  }
  if (preferred === 'ollama' && ollamaUrl) {
    return { type: 'ollama', url: ollamaUrl, model: 'llama3.2' };
  }

  if (geminiKey) return { type: 'gemini', url: '', key: geminiKey, model: 'gemini-2.0-flash-lite' };
  if (openaiKey) return { type: 'openai-compatible', url: 'https://api.openai.com/v1/chat/completions', key: openaiKey, model: 'gpt-4o-mini' };
  if (openrouterKey) return { type: 'openai-compatible', url: 'https://openrouter.ai/api/v1/chat/completions', key: openrouterKey, model: 'anthropic/claude-3.5-haiku', extraHeaders: { 'HTTP-Referer': 'https://mindstore.app', 'X-Title': 'MindStore' } };
  if (customKey && customUrl) return { type: 'openai-compatible', url: customUrl, key: customKey, model: customModel || 'default' };
  if (ollamaUrl) return { type: 'ollama', url: ollamaUrl, model: 'llama3.2' };
  return null;
}

async function callAI(aiConfig: AIConfig, prompt: string, system: string): Promise<string | null> {
  try {
    if (aiConfig.type === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${aiConfig.model}:generateContent?key=${aiConfig.key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }

    if (aiConfig.type === 'ollama') {
      const res = await fetch(`${aiConfig.url}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
          stream: false,
          options: { temperature: 0.3 },
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.message?.content || null;
    }

    // OpenAI-compatible
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiConfig.key}`,
      ...(aiConfig.extraHeaders || {}),
    };
    const res = await fetch(aiConfig.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

// ─── SM-2 Algorithm ──────────────────────────────────────────

interface SM2State {
  easeFactor: number;   // EF, starts at 2.5
  interval: number;     // days until next review
  repetitions: number;  // consecutive correct answers
  nextReview: string;   // ISO date string
  lastReview: string | null;
}

function sm2Initial(): SM2State {
  return {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReview: new Date().toISOString(),
    lastReview: null,
  };
}

/**
 * SM-2 SuperMemo algorithm
 * grade: 0-5 (0-2 = fail, 3 = hard, 4 = good, 5 = easy)
 */
function sm2Update(state: SM2State, grade: number): SM2State {
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

// ─── Flashcard Types ─────────────────────────────────────────

interface Flashcard {
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

interface Deck {
  id: string;
  name: string;
  description?: string;
  color: string;
  cards: Flashcard[];
  createdAt: string;
  updatedAt: string;
}

// ─── Storage (plugin config in DB) ───────────────────────────

async function getDecks(userId: string): Promise<Deck[]> {
  const rows = await db.execute(
    sql`SELECT config FROM plugins WHERE slug = ${PLUGIN_SLUG}`
  );
  const row = (rows as any[])[0];
  if (!row?.config) return [];
  const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
  return config.decks || [];
}

async function saveDecks(decks: Deck[]) {
  await db.execute(sql`
    UPDATE plugins 
    SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{decks}', ${JSON.stringify(decks)}::jsonb),
        updated_at = NOW()
    WHERE slug = ${PLUGIN_SLUG}
  `);
}

function generateId(): string {
  return `fc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Deck Colors ─────────────────────────────────────────────

const DECK_COLORS = [
  'teal', 'sky', 'emerald', 'amber', 'cyan', 'rose', 'lime', 'orange',
];

// ─── GET Handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    await ensurePluginInstalled();
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'decks';

    // ─── List decks ────────────────────────────────────────
    if (action === 'decks') {
      const decks = await getDecks(userId);
      const deckSummaries = decks.map(d => {
        const now = new Date();
        const dueCards = d.cards.filter(c => new Date(c.sm2.nextReview) <= now);
        const masteredCards = d.cards.filter(c => c.sm2.repetitions >= 5);
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
      return NextResponse.json({ decks: deckSummaries });
    }

    // ─── Get cards in a deck ───────────────────────────────
    if (action === 'cards') {
      const deckId = searchParams.get('deckId');
      if (!deckId) return NextResponse.json({ error: 'deckId required' }, { status: 400 });
      
      const decks = await getDecks(userId);
      const deck = decks.find(d => d.id === deckId);
      if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 });

      return NextResponse.json({ deck: { ...deck, cards: deck.cards } });
    }

    // ─── Get due cards for review ──────────────────────────
    if (action === 'review') {
      const deckId = searchParams.get('deckId');
      if (!deckId) return NextResponse.json({ error: 'deckId required' }, { status: 400 });
      
      const decks = await getDecks(userId);
      const deck = decks.find(d => d.id === deckId);
      if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 });

      const now = new Date();
      const dueCards = deck.cards
        .filter(c => new Date(c.sm2.nextReview) <= now)
        .sort((a, b) => new Date(a.sm2.nextReview).getTime() - new Date(b.sm2.nextReview).getTime());

      // Also include new cards (never reviewed, up to 10 per session)
      const newCards = deck.cards
        .filter(c => c.sm2.repetitions === 0 && !dueCards.find(d => d.id === c.id))
        .slice(0, 10);

      return NextResponse.json({
        deckId: deck.id,
        deckName: deck.name,
        deckColor: deck.color,
        totalCards: deck.cards.length,
        dueCards: [...dueCards, ...newCards],
        dueCount: dueCards.length,
        newCount: newCards.length,
      });
    }

    // ─── Generate flashcards from memories ─────────────────
    if (action === 'generate') {
      const memoryIds = searchParams.get('memoryIds')?.split(',').filter(Boolean);
      const topic = searchParams.get('topic');
      const limit = parseInt(searchParams.get('limit') || '10');

      // Get memories to generate from
      let memories: any[];
      if (memoryIds && memoryIds.length > 0) {
        // Specific memories selected
        const placeholders = memoryIds.map((_, i) => `$${i + 2}`).join(',');
        memories = await db.execute(
          sql`SELECT id, content, source_title, source_type, metadata 
              FROM memories 
              WHERE user_id = ${userId} 
              AND id::text = ANY(${memoryIds}::text[])
              LIMIT 20`
        ) as any[];
      } else if (topic) {
        // Search by topic
        memories = await db.execute(
          sql`SELECT id, content, source_title, source_type, metadata
              FROM memories
              WHERE user_id = ${userId}
              AND (content ILIKE ${'%' + topic + '%'} OR source_title ILIKE ${'%' + topic + '%'})
              ORDER BY created_at DESC
              LIMIT 20`
        ) as any[];
      } else {
        // Random selection of recent memories
        memories = await db.execute(
          sql`SELECT id, content, source_title, source_type, metadata
              FROM memories
              WHERE user_id = ${userId}
              AND length(content) > 100
              ORDER BY RANDOM()
              LIMIT 15`
        ) as any[];
      }

      if (memories.length === 0) {
        return NextResponse.json({ cards: [], message: 'No memories found to generate from' });
      }

      // Get AI config
      const settingsRows = await db.execute(
        sql`SELECT key, value FROM settings WHERE key IN (
          'openai_api_key', 'gemini_api_key', 'ollama_url',
          'openrouter_api_key', 'custom_api_key', 'custom_api_url', 'custom_api_model',
          'chat_provider'
        )`
      );
      const config: Record<string, string> = {};
      for (const row of settingsRows as any[]) config[row.key] = row.value;
      
      const aiConfig = getAIConfig(config);
      if (!aiConfig) {
        return NextResponse.json({ error: 'No AI provider configured' }, { status: 400 });
      }

      // Build content for AI
      const memoryTexts = memories.map((m, i) => {
        const title = m.source_title || `Memory ${i + 1}`;
        const preview = m.content.slice(0, 1500);
        return `[${m.id}] "${title}"\n${preview}`;
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
9. Generate exactly ${Math.min(limit, 15)} flashcards

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

      const prompt = `Generate ${Math.min(limit, 15)} flashcards from this knowledge:\n\n${memoryTexts}`;

      const response = await callAI(aiConfig, prompt, system);
      if (!response) {
        return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
      }

      // Parse response
      let cards: any[] = [];
      try {
        let jsonStr = response.trim();
        // Strip markdown fences if present
        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
        cards = JSON.parse(jsonStr);
      } catch {
        // Try to extract JSON array from response
        const match = response.match(/\[[\s\S]*\]/);
        if (match) {
          try {
            cards = JSON.parse(match[0]);
          } catch {
            return NextResponse.json({ error: 'Failed to parse AI response', raw: response.slice(0, 500) }, { status: 500 });
          }
        } else {
          return NextResponse.json({ error: 'AI response did not contain valid JSON', raw: response.slice(0, 500) }, { status: 500 });
        }
      }

      // Normalize cards
      const generatedCards = cards
        .filter((c: any) => c.front && c.back)
        .map((c: any) => ({
          id: generateId(),
          front: String(c.front).trim(),
          back: String(c.back).trim(),
          hint: c.hint ? String(c.hint).trim() : undefined,
          tags: Array.isArray(c.tags) ? c.tags.map(String) : [],
          sourceMemoryId: c.sourceMemoryId || undefined,
          sourceTitle: c.sourceTitle || undefined,
          sm2: sm2Initial(),
          createdAt: new Date().toISOString(),
        }));

      return NextResponse.json({
        cards: generatedCards,
        count: generatedCards.length,
        memoriesUsed: memories.length,
      });
    }

    // ─── Stats ─────────────────────────────────────────────
    if (action === 'stats') {
      const decks = await getDecks(userId);
      const now = new Date();
      
      const allCards = decks.flatMap(d => d.cards);
      const totalCards = allCards.length;
      const dueNow = allCards.filter(c => new Date(c.sm2.nextReview) <= now).length;
      const mastered = allCards.filter(c => c.sm2.repetitions >= 5).length;
      const reviewed = allCards.filter(c => c.sm2.lastReview !== null).length;
      
      // Review streak (consecutive days with at least one review)
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
        else if (card.sm2.repetitions < 5) distribution.reviewing++;
        else distribution.mastered++;
      }

      return NextResponse.json({
        totalCards,
        totalDecks: decks.length,
        dueNow,
        mastered,
        reviewed,
        streak,
        distribution,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── POST Handler ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    await ensurePluginInstalled();
    const userId = await getUserId();
    const body = await req.json();
    const action = body.action;

    // ─── Create deck ───────────────────────────────────────
    if (action === 'create-deck') {
      const { name, description, color } = body;
      if (!name) return NextResponse.json({ error: 'Deck name required' }, { status: 400 });

      const decks = await getDecks(userId);
      const newDeck: Deck = {
        id: generateId(),
        name: name.trim(),
        description: description?.trim(),
        color: color || DECK_COLORS[decks.length % DECK_COLORS.length],
        cards: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      decks.push(newDeck);
      await saveDecks(decks);

      return NextResponse.json({ deck: { ...newDeck, cards: undefined, cardCount: 0 } });
    }

    // ─── Save cards to deck ────────────────────────────────
    if (action === 'save-cards') {
      const { deckId, cards } = body;
      if (!deckId || !cards?.length) {
        return NextResponse.json({ error: 'deckId and cards required' }, { status: 400 });
      }

      const decks = await getDecks(userId);
      const deck = decks.find(d => d.id === deckId);
      if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 });

      // Add cards, ensuring they have SM-2 state
      for (const card of cards) {
        deck.cards.push({
          id: card.id || generateId(),
          front: card.front,
          back: card.back,
          hint: card.hint,
          tags: card.tags || [],
          sourceMemoryId: card.sourceMemoryId,
          sourceTitle: card.sourceTitle,
          sm2: card.sm2 || sm2Initial(),
          createdAt: card.createdAt || new Date().toISOString(),
        });
      }
      deck.updatedAt = new Date().toISOString();
      await saveDecks(decks);

      return NextResponse.json({ saved: cards.length, totalCards: deck.cards.length });
    }

    // ─── Review card (SM-2 update) ─────────────────────────
    if (action === 'review-card') {
      const { deckId, cardId, grade } = body;
      if (!deckId || !cardId || grade === undefined) {
        return NextResponse.json({ error: 'deckId, cardId, and grade required' }, { status: 400 });
      }
      if (grade < 0 || grade > 5) {
        return NextResponse.json({ error: 'grade must be 0-5' }, { status: 400 });
      }

      const decks = await getDecks(userId);
      const deck = decks.find(d => d.id === deckId);
      if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 });

      const card = deck.cards.find(c => c.id === cardId);
      if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

      const oldState = { ...card.sm2 };
      card.sm2 = sm2Update(card.sm2, grade);
      deck.updatedAt = new Date().toISOString();
      await saveDecks(decks);

      return NextResponse.json({
        cardId,
        oldState,
        newState: card.sm2,
        grade,
      });
    }

    // ─── Delete deck ───────────────────────────────────────
    if (action === 'delete-deck') {
      const { deckId } = body;
      if (!deckId) return NextResponse.json({ error: 'deckId required' }, { status: 400 });

      const decks = await getDecks(userId);
      const idx = decks.findIndex(d => d.id === deckId);
      if (idx === -1) return NextResponse.json({ error: 'Deck not found' }, { status: 404 });

      decks.splice(idx, 1);
      await saveDecks(decks);

      return NextResponse.json({ deleted: true });
    }

    // ─── Delete card ───────────────────────────────────────
    if (action === 'delete-card') {
      const { deckId, cardId } = body;
      if (!deckId || !cardId) {
        return NextResponse.json({ error: 'deckId and cardId required' }, { status: 400 });
      }

      const decks = await getDecks(userId);
      const deck = decks.find(d => d.id === deckId);
      if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 });

      const cardIdx = deck.cards.findIndex(c => c.id === cardId);
      if (cardIdx === -1) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

      deck.cards.splice(cardIdx, 1);
      deck.updatedAt = new Date().toISOString();
      await saveDecks(decks);

      return NextResponse.json({ deleted: true, remainingCards: deck.cards.length });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
