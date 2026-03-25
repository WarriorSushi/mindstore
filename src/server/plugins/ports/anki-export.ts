/**
 * Anki Export — Portable Logic
 *
 * Extracts flashcard export formatting from the route into pure functions.
 * No HTTP, no NextRequest/NextResponse — just data in, data out.
 *
 * Capabilities:
 * - Generate Anki-compatible TSV with import headers
 * - Generate CSV (universal, works with Quizlet/Brainscape too)
 * - Package single or multi-deck exports into ZIP
 * - Deck summaries with due/mastered counts
 */

import JSZip from 'jszip';

// ─── Types ───────────────────────────────────────────────────

export interface SM2State {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: string;
  lastReview?: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface ExportFormat {
  id: 'tsv' | 'csv';
  name: string;
  description: string;
  extension: string;
  recommended: boolean;
}

export interface ExportResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

export interface ExportStats {
  decksExported: number;
  cardsExported: number;
}

// ─── Constants ───────────────────────────────────────────────

export const EXPORT_FORMATS: ExportFormat[] = [
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
];

// ─── Deck Summaries ──────────────────────────────────────────

export function summarizeDecks(decks: Deck[]): DeckSummary[] {
  const now = new Date();
  return decks.map((d) => {
    const dueCards = d.cards.filter((c) => new Date(c.sm2.nextReview) <= now);
    const masteredCards = d.cards.filter((c) => c.sm2.repetitions >= 5);
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
}

export function totalCards(decks: Deck[]): number {
  return decks.reduce((sum, d) => sum + d.cards.length, 0);
}

// ─── TSV Generation (Anki-native) ────────────────────────────

function escapeAnkiField(text: string): string {
  return text
    .replace(/\t/g, '    ')
    .replace(/\n/g, '<br>')
    .replace(/\r/g, '');
}

export function generateAnkiTSV(cards: Flashcard[], deckName: string): string {
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
    const back = escapeAnkiField(
      card.back + (card.hint ? `<br><br><i>Hint: ${card.hint}</i>` : ''),
    );
    const tags = card.tags.join(' ') || 'mindstore';
    lines.push(`${front}\t${back}\t${tags}`);
  }

  return lines.join('\n');
}

// ─── CSV Generation (Universal) ─────────────────────────────

function csvEscape(text: string): string {
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function generateCSV(cards: Flashcard[], includeMetadata: boolean): string {
  const headers = includeMetadata
    ? ['Front', 'Back', 'Hint', 'Tags', 'Source', 'Ease Factor', 'Interval (days)', 'Repetitions', 'Created']
    : ['Front', 'Back', 'Tags'];

  const rows = cards.map((card) => {
    const base = [csvEscape(card.front), csvEscape(card.back)];
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

// ─── ZIP Packaging ───────────────────────────────────────────

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_');
}

export async function createExportPackage(
  decks: Deck[],
  deckIds: string[],
  format: 'tsv' | 'csv',
  includeMetadata: boolean,
): Promise<ExportResult> {
  const selectedDecks =
    deckIds.length > 0 ? decks.filter((d) => deckIds.includes(d.id)) : decks;

  if (selectedDecks.length === 0) {
    throw new Error('No decks selected for export');
  }

  // Single deck → single file
  if (selectedDecks.length === 1) {
    const deck = selectedDecks[0];
    const name = safeName(deck.name);

    if (format === 'tsv') {
      const content = generateAnkiTSV(deck.cards, deck.name);
      return {
        buffer: Buffer.from(content, 'utf-8'),
        filename: `${name}_anki.txt`,
        contentType: 'text/plain',
      };
    } else {
      const content = generateCSV(deck.cards, includeMetadata);
      return {
        buffer: Buffer.from(content, 'utf-8'),
        filename: `${name}.csv`,
        contentType: 'text/csv',
      };
    }
  }

  // Multiple decks → ZIP
  const zip = new JSZip();
  for (const deck of selectedDecks) {
    const name = safeName(deck.name);
    if (format === 'tsv') {
      zip.file(`${name}_anki.txt`, generateAnkiTSV(deck.cards, deck.name));
    } else {
      zip.file(`${name}.csv`, generateCSV(deck.cards, includeMetadata));
    }
  }

  zip.file(
    'README.md',
    [
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
      ...selectedDecks.map((d) => `- **${d.name}**: ${d.cards.length} cards`),
    ].join('\n'),
  );

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  return {
    buffer: zipBuffer,
    filename: 'mindstore_flashcards.zip',
    contentType: 'application/zip',
  };
}

/**
 * Compute export stats for a selection of decks.
 */
export function computeExportStats(decks: Deck[], deckIds: string[]): ExportStats {
  const selected =
    deckIds.length > 0 ? decks.filter((d) => deckIds.includes(d.id)) : decks.filter((d) => d.cards.length > 0);
  return {
    decksExported: selected.length,
    cardsExported: selected.reduce((s, d) => s + d.cards.length, 0),
  };
}

/**
 * Generate CSV for a flat list of cards (used by export-csv action).
 */
export function exportCardsCSV(
  decks: Deck[],
  deckIds: string[],
  includeMetadata: boolean,
): { csv: string; cardCount: number } {
  const selected =
    deckIds.length > 0 ? decks.filter((d) => deckIds.includes(d.id)) : decks;
  const allCards = selected.flatMap((d) => d.cards);
  return {
    csv: generateCSV(allCards, includeMetadata),
    cardCount: allCards.length,
  };
}
