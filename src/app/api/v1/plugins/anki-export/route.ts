import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import JSZip from 'jszip';

/**
 * Anki Deck Export Plugin — Export flashcards as .apkg files
 *
 * GET  ?action=decks          — List available decks for export
 * GET  ?action=preview&deckId= — Preview cards in a deck
 * GET  ?action=config         — Get export configuration
 * POST ?action=export         — Generate and return .apkg file
 * POST ?action=export-csv     — Export as CSV (simpler alternative)
 * POST ?action=export-memories — Export selected memories as flashcards
 *
 * Anki .apkg format: SQLite DB + media files in a ZIP container.
 * Since we can't use SQLite in serverless, we generate the SQL dump
 * as a TSV import that Anki can import directly (File → Import).
 * We also support CSV/TSV for direct Anki import.
 */

const PLUGIN_SLUG = 'anki-export';

// ─── Auto-install ────────────────────────────────────────────

async function ensurePluginInstalled() {
  try {
    const existing = await db.execute(sql`SELECT id FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
    if ((existing as any[]).length === 0) {
      await db.execute(sql`
        INSERT INTO plugins (slug, name, description, type, status, icon, category)
        VALUES (
          ${PLUGIN_SLUG},
          'Anki Deck Export',
          'Export flashcards as Anki-compatible files for spaced repetition.',
          'extension',
          'active',
          'Download',
          'export'
        )
      `);
    }
  } catch {
    // Table might not exist yet
  }
}

// ─── Flashcard Data Access ───────────────────────────────────

interface SM2State {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: string;
  lastReview?: string;
}

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

async function getDecks(): Promise<Deck[]> {
  try {
    const rows = await db.execute(
      sql`SELECT config FROM plugins WHERE slug = 'flashcard-maker'`
    );
    const row = (rows as any[])[0];
    if (!row?.config) return [];
    const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
    return config.decks || [];
  } catch {
    return [];
  }
}

// ─── Export Formats ──────────────────────────────────────────

function escapeAnkiField(text: string): string {
  // Anki TSV: escape HTML, handle newlines
  return text
    .replace(/\t/g, '    ')
    .replace(/\n/g, '<br>')
    .replace(/\r/g, '');
}

function generateAnkiTSV(cards: Flashcard[], deckName: string): string {
  // Anki import format: front\tback\ttags
  // With header comment for configuration
  const lines: string[] = [
    `# separator:tab`,
    `# html:true`,
    `# deck:${deckName}`,
    `# notetype:Basic`,
    `# columns:Front\tBack\tTags`,
    '',
  ];

  for (const card of cards) {
    const front = escapeAnkiField(card.front);
    const back = escapeAnkiField(card.back + (card.hint ? `<br><br><i>Hint: ${card.hint}</i>` : ''));
    const tags = card.tags.join(' ') || 'mindstore';
    lines.push(`${front}\t${back}\t${tags}`);
  }

  return lines.join('\n');
}

function generateCSV(cards: Flashcard[], includeMetadata: boolean): string {
  const headers = includeMetadata
    ? ['Front', 'Back', 'Hint', 'Tags', 'Source', 'Ease Factor', 'Interval (days)', 'Repetitions', 'Created']
    : ['Front', 'Back', 'Tags'];

  const rows = cards.map(card => {
    const base = [
      csvEscape(card.front),
      csvEscape(card.back),
    ];
    if (includeMetadata) {
      base.push(
        csvEscape(card.hint || ''),
        csvEscape(card.tags.join(', ')),
        csvEscape(card.sourceTitle || ''),
        card.sm2.easeFactor.toFixed(2),
        card.sm2.interval.toString(),
        card.sm2.repetitions.toString(),
        card.createdAt,
      );
    } else {
      base.push(csvEscape(card.tags.join(' ')));
    }
    return base.join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

function csvEscape(text: string): string {
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

// ─── ZIP Package ─────────────────────────────────────────────

async function createExportPackage(
  decks: Deck[],
  deckIds: string[],
  format: 'tsv' | 'csv',
  includeMetadata: boolean,
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  const selectedDecks = deckIds.length > 0
    ? decks.filter(d => deckIds.includes(d.id))
    : decks;

  if (selectedDecks.length === 0) {
    throw new Error('No decks selected for export');
  }

  // Single deck → single file
  if (selectedDecks.length === 1) {
    const deck = selectedDecks[0];
    const safeName = deck.name.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_');

    if (format === 'tsv') {
      const content = generateAnkiTSV(deck.cards, deck.name);
      return {
        buffer: Buffer.from(content, 'utf-8'),
        filename: `${safeName}_anki.txt`,
        contentType: 'text/plain',
      };
    } else {
      const content = generateCSV(deck.cards, includeMetadata);
      return {
        buffer: Buffer.from(content, 'utf-8'),
        filename: `${safeName}.csv`,
        contentType: 'text/csv',
      };
    }
  }

  // Multiple decks → ZIP
  const zip = new JSZip();
  for (const deck of selectedDecks) {
    const safeName = deck.name.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_');
    if (format === 'tsv') {
      zip.file(`${safeName}_anki.txt`, generateAnkiTSV(deck.cards, deck.name));
    } else {
      zip.file(`${safeName}.csv`, generateCSV(deck.cards, includeMetadata));
    }
  }

  // Add README
  zip.file('README.md', [
    '# MindStore Flashcard Export',
    '',
    `Exported ${selectedDecks.length} deck(s) on ${new Date().toISOString().slice(0, 10)}`,
    '',
    '## How to Import into Anki',
    '',
    '### TSV Files (.txt)',
    '1. Open Anki → File → Import',
    '2. Select the .txt file',
    '3. Anki auto-detects the format from header comments',
    '4. Cards appear in the specified deck',
    '',
    '### CSV Files (.csv)',
    '1. Open Anki → File → Import',
    '2. Select the .csv file',
    '3. Map columns: Field 1 = Front, Field 2 = Back, Tags = Field 3',
    '4. Choose target deck',
    '',
    '## Decks Included',
    '',
    ...selectedDecks.map(d => `- **${d.name}**: ${d.cards.length} cards`),
  ].join('\n'));

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  return {
    buffer: zipBuffer,
    filename: 'mindstore_flashcards.zip',
    contentType: 'application/zip',
  };
}

// ─── Route Handlers ──────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    await ensurePluginInstalled();

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'decks';

    // ─── List decks ────────────────────────────────────
    if (action === 'decks') {
      const decks = await getDecks();
      const deckSummaries = decks.map(d => {
        const now = new Date();
        const dueCards = d.cards.filter(c => new Date(c.sm2.nextReview) <= now);
        const masteredCards = d.cards.filter(c => c.sm2.repetitions >= 5);
        return {
          id: d.id,
          name: d.name,
          description: d.description,
          color: d.color,
          cardCount: d.cards.length,
          dueCount: dueCards.length,
          masteredCount: masteredCards.length,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        };
      });

      // Also get total memories for "export from memories" feature
      let totalMemories = 0;
      try {
        const memRows = await db.execute(
          sql`SELECT COUNT(*) as count FROM memories WHERE user_id = ${userId}`
        );
        totalMemories = parseInt((memRows as any[])[0]?.count || '0');
      } catch {}

      return NextResponse.json({
        decks: deckSummaries,
        totalCards: decks.reduce((sum, d) => sum + d.cards.length, 0),
        totalMemories,
        formats: [
          {
            id: 'tsv',
            name: 'Anki Import (TSV)',
            description: 'Tab-separated format with Anki-specific headers. Import directly via File → Import.',
            extension: '.txt',
            recommended: true,
          },
          {
            id: 'csv',
            name: 'CSV (Universal)',
            description: 'Standard CSV format. Works with Anki, Quizlet, Brainscape, and other tools.',
            extension: '.csv',
            recommended: false,
          },
        ],
      });
    }

    // ─── Preview deck ──────────────────────────────────
    if (action === 'preview') {
      const deckId = searchParams.get('deckId');
      if (!deckId) {
        return NextResponse.json({ error: 'deckId required' }, { status: 400 });
      }
      const decks = await getDecks();
      const deck = decks.find(d => d.id === deckId);
      if (!deck) {
        return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
      }

      return NextResponse.json({
        deck: {
          id: deck.id,
          name: deck.name,
          description: deck.description,
          color: deck.color,
          cardCount: deck.cards.length,
        },
        cards: deck.cards.slice(0, 20).map(c => ({
          id: c.id,
          front: c.front,
          back: c.back,
          hint: c.hint,
          tags: c.tags,
          source: c.sourceTitle,
          ease: c.sm2.easeFactor,
          interval: c.sm2.interval,
          reps: c.sm2.repetitions,
        })),
        hasMore: deck.cards.length > 20,
        totalCards: deck.cards.length,
      });
    }

    // ─── Config ────────────────────────────────────────
    if (action === 'config') {
      const decks = await getDecks();
      return NextResponse.json({
        hasFlashcards: decks.some(d => d.cards.length > 0),
        deckCount: decks.length,
        totalCards: decks.reduce((sum, d) => sum + d.cards.length, 0),
        supportedFormats: ['tsv', 'csv'],
        ankiImportGuide: 'https://docs.ankiweb.net/importing/text-files.html',
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    await ensurePluginInstalled();

    const body = await req.json();
    const action = body.action;

    // ─── Export as file ────────────────────────────────
    if (action === 'export') {
      const { deckIds = [], format = 'tsv', includeMetadata = false } = body;
      const decks = await getDecks();

      if (decks.length === 0 || decks.every(d => d.cards.length === 0)) {
        return NextResponse.json({
          error: 'No flashcards to export. Create some flashcards first using the Flashcard Maker plugin.',
        }, { status: 400 });
      }

      const { buffer, filename, contentType } = await createExportPackage(
        decks, deckIds, format, includeMetadata
      );

      // Return as base64 since we can't stream binary from JSON API easily
      return NextResponse.json({
        file: buffer.toString('base64'),
        filename,
        contentType,
        size: buffer.length,
        stats: {
          decksExported: deckIds.length > 0
            ? decks.filter(d => deckIds.includes(d.id)).length
            : decks.filter(d => d.cards.length > 0).length,
          cardsExported: deckIds.length > 0
            ? decks.filter(d => deckIds.includes(d.id)).reduce((s, d) => s + d.cards.length, 0)
            : decks.reduce((s, d) => s + d.cards.length, 0),
        },
      });
    }

    // ─── Export as CSV ─────────────────────────────────
    if (action === 'export-csv') {
      const { deckIds = [], includeMetadata = true } = body;
      const decks = await getDecks();
      const selected = deckIds.length > 0
        ? decks.filter(d => deckIds.includes(d.id))
        : decks;
      const allCards = selected.flatMap(d => d.cards);

      if (allCards.length === 0) {
        return NextResponse.json({ error: 'No cards to export' }, { status: 400 });
      }

      const csv = generateCSV(allCards, includeMetadata);
      return NextResponse.json({
        file: Buffer.from(csv).toString('base64'),
        filename: 'mindstore_flashcards.csv',
        contentType: 'text/csv',
        size: Buffer.from(csv).length,
        cardCount: allCards.length,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
