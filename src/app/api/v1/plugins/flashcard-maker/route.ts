/**
 * Flashcard Maker Plugin — Route (thin wrapper)
 *
 * GET  ?action=decks|cards|review|generate|stats
 * POST ?action=create-deck|save-cards|review-card|delete-deck|delete-card
 *
 * Logic delegated to src/server/plugins/ports/flashcard-maker.ts
 */

import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import {
  summarizeDecks,
  createDeck,
  getDueCards,
  reviewCard,
  addCardsToDeck,
  computeStats,
  buildGenerationPrompt,
  parseGeneratedCards,
  generateFlashcardId,
  sm2Initial,
  type Deck,
} from '@/server/plugins/ports/flashcard-maker';

const PLUGIN_SLUG = 'flashcard-maker';

// ─── Auto-install ────────────────────────────────────────────

async function ensurePluginInstalled() {
  const existing = await db.execute(sql`SELECT id FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
  if ((existing as any[]).length === 0) {
    await db.execute(sql`
      INSERT INTO plugins (slug, name, description, type, status, icon, category)
      VALUES (${PLUGIN_SLUG}, 'Flashcard Maker',
        'Auto-generate spaced repetition flashcards from your memories with built-in review.',
        'extension', 'active', 'Layers', 'action')
    `);
  }
}

// ─── AI Config ───────────────────────────────────────────────

interface AIConfig {
  type: 'openai-compatible' | 'gemini' | 'ollama';
  url: string; key?: string; model: string;
  extraHeaders?: Record<string, string>;
}

function getAIConfig(config: Record<string, string>): AIConfig | null {
  const p = config.chat_provider;
  const oai = config.openai_api_key || process.env.OPENAI_API_KEY;
  const gem = config.gemini_api_key || process.env.GEMINI_API_KEY;
  const oll = config.ollama_url || process.env.OLLAMA_URL;
  const orr = config.openrouter_api_key || process.env.OPENROUTER_API_KEY;
  const ck = config.custom_api_key, cu = config.custom_api_url, cm = config.custom_api_model;

  if (p === 'openrouter' && orr) return { type: 'openai-compatible', url: 'https://openrouter.ai/api/v1/chat/completions', key: orr, model: 'anthropic/claude-3.5-haiku', extraHeaders: { 'HTTP-Referer': 'https://mindstore.app', 'X-Title': 'MindStore' } };
  if (p === 'custom' && ck && cu) return { type: 'openai-compatible', url: cu, key: ck, model: cm || 'default' };
  if (p === 'gemini' && gem) return { type: 'gemini', url: '', key: gem, model: 'gemini-2.0-flash-lite' };
  if (p === 'openai' && oai) return { type: 'openai-compatible', url: 'https://api.openai.com/v1/chat/completions', key: oai, model: 'gpt-4o-mini' };
  if (p === 'ollama' && oll) return { type: 'ollama', url: oll, model: 'llama3.2' };
  if (gem) return { type: 'gemini', url: '', key: gem, model: 'gemini-2.0-flash-lite' };
  if (oai) return { type: 'openai-compatible', url: 'https://api.openai.com/v1/chat/completions', key: oai, model: 'gpt-4o-mini' };
  if (orr) return { type: 'openai-compatible', url: 'https://openrouter.ai/api/v1/chat/completions', key: orr, model: 'anthropic/claude-3.5-haiku', extraHeaders: { 'HTTP-Referer': 'https://mindstore.app', 'X-Title': 'MindStore' } };
  if (ck && cu) return { type: 'openai-compatible', url: cu, key: ck, model: cm || 'default' };
  if (oll) return { type: 'ollama', url: oll, model: 'llama3.2' };
  return null;
}

async function callAI(aiConfig: AIConfig, prompt: string, system: string): Promise<string | null> {
  try {
    if (aiConfig.type === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${aiConfig.model}:generateContent?key=${aiConfig.key}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 4096 } }),
      });
      return res.ok ? ((await res.json()).candidates?.[0]?.content?.parts?.[0]?.text || null) : null;
    }
    if (aiConfig.type === 'ollama') {
      const res = await fetch(`${aiConfig.url}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: aiConfig.model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], stream: false, options: { temperature: 0.3 } }),
      });
      return res.ok ? ((await res.json()).message?.content || null) : null;
    }
    const res = await fetch(aiConfig.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiConfig.key}`, ...(aiConfig.extraHeaders || {}) },
      body: JSON.stringify({ model: aiConfig.model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], temperature: 0.3, max_tokens: 4096 }),
    });
    return res.ok ? ((await res.json()).choices?.[0]?.message?.content || null) : null;
  } catch { return null; }
}

// ─── Storage ─────────────────────────────────────────────────

async function getDecks(_userId: string): Promise<Deck[]> {
  const rows = await db.execute(sql`SELECT config FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
  const row = (rows as any[])[0];
  if (!row?.config) return [];
  const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
  return config.decks || [];
}

async function saveDecks(decks: Deck[]) {
  await db.execute(sql`
    UPDATE plugins SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{decks}', ${JSON.stringify(decks)}::jsonb), updated_at = NOW()
    WHERE slug = ${PLUGIN_SLUG}
  `);
}

// ─── GET Handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    await ensurePluginInstalled();
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'decks';

    if (action === 'decks') {
      const decks = await getDecks(userId);
      return NextResponse.json({ decks: summarizeDecks(decks) });
    }

    if (action === 'cards') {
      const deckId = searchParams.get('deckId');
      if (!deckId) return NextResponse.json({ error: 'deckId required' }, { status: 400 });
      const decks = await getDecks(userId);
      const deck = decks.find(d => d.id === deckId);
      if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
      return NextResponse.json({ deck });
    }

    if (action === 'review') {
      const deckId = searchParams.get('deckId');
      if (!deckId) return NextResponse.json({ error: 'deckId required' }, { status: 400 });
      const decks = await getDecks(userId);
      const deck = decks.find(d => d.id === deckId);
      if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
      const due = getDueCards(deck);
      return NextResponse.json({
        deckId: deck.id, deckName: deck.name, deckColor: deck.color,
        totalCards: deck.cards.length, dueCards: [...due.dueCards, ...due.newCards],
        dueCount: due.dueCount, newCount: due.newCount,
      });
    }

    if (action === 'generate') {
      const memoryIds = searchParams.get('memoryIds')?.split(',').filter(Boolean);
      const topic = searchParams.get('topic');
      const limit = parseInt(searchParams.get('limit') || '10');

      let memories: any[];
      if (memoryIds?.length) {
        memories = await db.execute(sql`SELECT id, content, source_title FROM memories WHERE user_id = ${userId} AND id::text = ANY(${memoryIds}::text[]) LIMIT 20`) as any[];
      } else if (topic) {
        memories = await db.execute(sql`SELECT id, content, source_title FROM memories WHERE user_id = ${userId} AND (content ILIKE ${'%' + topic + '%'} OR source_title ILIKE ${'%' + topic + '%'}) ORDER BY created_at DESC LIMIT 20`) as any[];
      } else {
        memories = await db.execute(sql`SELECT id, content, source_title FROM memories WHERE user_id = ${userId} AND length(content) > 100 ORDER BY RANDOM() LIMIT 15`) as any[];
      }

      if (!memories.length) return NextResponse.json({ cards: [], message: 'No memories found to generate from' });

      const settingsRows = await db.execute(sql`SELECT key, value FROM settings WHERE key IN ('openai_api_key','gemini_api_key','ollama_url','openrouter_api_key','custom_api_key','custom_api_url','custom_api_model','chat_provider')`);
      const config: Record<string, string> = {};
      for (const row of settingsRows as any[]) config[row.key] = row.value;
      const aiConfig = getAIConfig(config);
      if (!aiConfig) return NextResponse.json({ error: 'No AI provider configured' }, { status: 400 });

      const memTexts = memories.map(m => ({ id: m.id, title: m.source_title || 'Untitled', content: m.content }));
      const { system, prompt } = buildGenerationPrompt(memTexts, limit);
      const response = await callAI(aiConfig, prompt, system);
      if (!response) return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });

      const cards = parseGeneratedCards(response);
      if (!cards.length) return NextResponse.json({ error: 'Failed to parse AI response', raw: response.slice(0, 500) }, { status: 500 });

      const withIds = cards.map(c => ({ ...c, id: generateFlashcardId(), sm2: sm2Initial(), createdAt: new Date().toISOString() }));
      return NextResponse.json({ cards: withIds, count: withIds.length, memoriesUsed: memories.length });
    }

    if (action === 'stats') {
      const decks = await getDecks(userId);
      return NextResponse.json(computeStats(decks));
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

// ─── POST Handler ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    await ensurePluginInstalled();
    const userId = await getUserId();
    const body = await req.json();
    const action = body.action;

    if (action === 'create-deck') {
      const { name, description, color } = body;
      if (!name) return NextResponse.json({ error: 'Deck name required' }, { status: 400 });
      const decks = await getDecks(userId);
      const newDeck = createDeck(name, { description, color, existingDeckCount: decks.length });
      decks.push(newDeck);
      await saveDecks(decks);
      return NextResponse.json({ deck: { ...newDeck, cards: undefined, cardCount: 0 } });
    }

    if (action === 'save-cards') {
      const { deckId, cards } = body;
      if (!deckId || !cards?.length) return NextResponse.json({ error: 'deckId and cards required' }, { status: 400 });
      const decks = await getDecks(userId);
      const deck = decks.find(d => d.id === deckId);
      if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
      const added = addCardsToDeck(deck, cards);
      await saveDecks(decks);
      return NextResponse.json({ saved: added, totalCards: deck.cards.length });
    }

    if (action === 'review-card') {
      const { deckId, cardId, grade } = body;
      if (!deckId || !cardId || grade === undefined) return NextResponse.json({ error: 'deckId, cardId, and grade required' }, { status: 400 });
      if (grade < 0 || grade > 5) return NextResponse.json({ error: 'grade must be 0-5' }, { status: 400 });
      const decks = await getDecks(userId);
      const deck = decks.find(d => d.id === deckId);
      if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
      const card = deck.cards.find(c => c.id === cardId);
      if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });
      const result = reviewCard(card, grade);
      deck.updatedAt = new Date().toISOString();
      await saveDecks(decks);
      return NextResponse.json(result);
    }

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

    if (action === 'delete-card') {
      const { deckId, cardId } = body;
      if (!deckId || !cardId) return NextResponse.json({ error: 'deckId and cardId required' }, { status: 400 });
      const decks = await getDecks(userId);
      const deck = decks.find(d => d.id === deckId);
      if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
      const ci = deck.cards.findIndex(c => c.id === cardId);
      if (ci === -1) return NextResponse.json({ error: 'Card not found' }, { status: 404 });
      deck.cards.splice(ci, 1);
      deck.updatedAt = new Date().toISOString();
      await saveDecks(decks);
      return NextResponse.json({ deleted: true, remainingCards: deck.cards.length });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
