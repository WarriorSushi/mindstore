"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Download, ArrowLeft, Layers, FileText, Check, Loader2, AlertTriangle,
  ChevronRight, ChevronDown, Package, FileSpreadsheet, Info, Zap,
  CheckCircle2, Copy,
} from "lucide-react";
import { PageTransition, Stagger } from "@/components/PageTransition";

// ─── Types ────────────────────────────────────────────────────

interface DeckSummary {
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

interface ExportFormat {
  id: string;
  name: string;
  description: string;
  extension: string;
  recommended: boolean;
}

interface CardPreview {
  id: string;
  front: string;
  back: string;
  hint?: string;
  tags: string[];
  source?: string;
  ease: number;
  interval: number;
  reps: number;
}

// ─── Component ────────────────────────────────────────────────

export default function AnkiExportPage() {
  const router = useRouter();
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [formats, setFormats] = useState<ExportFormat[]>([]);
  const [totalCards, setTotalCards] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [selectedDecks, setSelectedDecks] = useState<Set<string>>(new Set());
  const [selectedFormat, setSelectedFormat] = useState('tsv');
  const [includeMetadata, setIncludeMetadata] = useState(false);
  const [previewDeck, setPreviewDeck] = useState<string | null>(null);
  const [previewCards, setPreviewCards] = useState<CardPreview[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [exportStats, setExportStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // ─── Load decks ──────────────────────────────────────

  const loadDecks = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/plugins/anki-export?action=decks');
      const data = await res.json();
      setDecks(data.decks || []);
      setFormats(data.formats || []);
      setTotalCards(data.totalCards || 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDecks(); }, [loadDecks]);

  // ─── Preview deck ────────────────────────────────────

  const loadPreview = async (deckId: string) => {
    if (previewDeck === deckId) {
      setPreviewDeck(null);
      return;
    }
    setPreviewDeck(deckId);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/v1/plugins/anki-export?action=preview&deckId=${deckId}`);
      const data = await res.json();
      setPreviewCards(data.cards || []);
    } catch {
      setPreviewCards([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  // ─── Toggle deck selection ───────────────────────────

  const toggleDeck = (id: string) => {
    setSelectedDecks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedDecks.size === decks.length) {
      setSelectedDecks(new Set());
    } else {
      setSelectedDecks(new Set(decks.map(d => d.id)));
    }
  };

  // ─── Export ──────────────────────────────────────────

  const handleExport = async () => {
    setExporting(true);
    setExported(false);
    setError(null);
    try {
      const res = await fetch('/api/v1/plugins/anki-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export',
          deckIds: Array.from(selectedDecks),
          format: selectedFormat,
          includeMetadata,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Download the file
      const blob = new Blob(
        [Buffer.from(data.file, 'base64')],
        { type: data.contentType }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportStats(data.stats);
      setExported(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  };

  // ─── Render ──────────────────────────────────────────

  const selectedCardCount = selectedDecks.size > 0
    ? decks.filter(d => selectedDecks.has(d.id)).reduce((s, d) => s + d.cardCount, 0)
    : totalCards;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
        {/* ─── Header ──────────────────────────────── */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/app/plugins')}
            className="p-2 rounded-xl border border-zinc-800/60 bg-zinc-900/50 hover:bg-zinc-800/60 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-zinc-400" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-teal-500/10 border border-teal-500/20">
                <Download className="w-6 h-6 text-teal-400" />
              </div>
              Anki Export
            </h1>
            <p className="text-zinc-500 mt-1">Export your flashcards for Anki spaced repetition</p>
          </div>
        </div>

        {/* ─── No Flashcards State ─────────────────── */}
        {decks.length === 0 || totalCards === 0 ? (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center">
              <Layers className="w-8 h-8 text-zinc-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">No Flashcards Yet</h2>
              <p className="text-zinc-500 mt-1">Create flashcards with the Flashcard Maker plugin first, then export them for Anki.</p>
            </div>
            <button
              onClick={() => router.push('/app/flashcards')}
              className="px-5 py-2.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 hover:bg-teal-500/20 transition-colors text-sm font-medium"
            >
              Go to Flashcards →
            </button>
          </div>
        ) : (
          <>
            {/* ─── Stats Row ──────────────────────── */}
            <Stagger>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Decks', value: decks.length, icon: Package },
                  { label: 'Total Cards', value: totalCards, icon: Layers },
                  { label: 'Selected', value: selectedDecks.size > 0 ? selectedDecks.size : decks.length, icon: Check },
                  { label: 'Cards to Export', value: selectedCardCount, icon: Download },
                ].map((stat) => (
                  <div key={stat.label} className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/60">
                    <div className="flex items-center gap-2 mb-1">
                      <stat.icon className="w-3.5 h-3.5 text-zinc-500" />
                      <span className="text-xs text-zinc-500">{stat.label}</span>
                    </div>
                    <p className="text-xl font-bold text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            </Stagger>

            {/* ─── Deck Selection ─────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Select Decks</h2>
                <button
                  onClick={selectAll}
                  className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
                >
                  {selectedDecks.size === decks.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="space-y-2">
                {decks.map(deck => (
                  <div key={deck.id} className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-zinc-800/30 transition-colors"
                      onClick={() => toggleDeck(deck.id)}
                    >
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        selectedDecks.has(deck.id) || selectedDecks.size === 0
                          ? 'bg-teal-500/20 border-teal-500/60'
                          : 'border-zinc-700 bg-zinc-800/40'
                      }`}>
                        {(selectedDecks.has(deck.id) || selectedDecks.size === 0) && (
                          <Check className="w-3 h-3 text-teal-400" />
                        )}
                      </div>

                      {/* Deck info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{deck.name}</span>
                          <span className="text-xs text-zinc-500 bg-zinc-800/60 px-2 py-0.5 rounded-full">
                            {deck.cardCount} cards
                          </span>
                        </div>
                        {deck.description && (
                          <p className="text-xs text-zinc-500 mt-0.5 truncate">{deck.description}</p>
                        )}
                      </div>

                      {/* Preview toggle */}
                      <button
                        onClick={(e) => { e.stopPropagation(); loadPreview(deck.id); }}
                        className="p-1.5 rounded-lg hover:bg-zinc-700/40 transition-colors"
                      >
                        {previewDeck === deck.id ? (
                          <ChevronDown className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-zinc-400" />
                        )}
                      </button>
                    </div>

                    {/* Preview panel */}
                    {previewDeck === deck.id && (
                      <div className="border-t border-zinc-800/60 bg-zinc-950/40 p-4 space-y-2">
                        {previewLoading ? (
                          <div className="flex items-center gap-2 text-zinc-500">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">Loading preview...</span>
                          </div>
                        ) : previewCards.length === 0 ? (
                          <p className="text-sm text-zinc-500">No cards in this deck.</p>
                        ) : (
                          <>
                            {previewCards.slice(0, 5).map(card => (
                              <div key={card.id} className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/40 space-y-1">
                                <div className="text-sm text-white font-medium">
                                  <span className="text-teal-400 text-xs mr-2">Q:</span>
                                  {card.front}
                                </div>
                                <div className="text-sm text-zinc-400">
                                  <span className="text-sky-400 text-xs mr-2">A:</span>
                                  {card.back}
                                </div>
                                {card.tags.length > 0 && (
                                  <div className="flex gap-1 mt-1">
                                    {card.tags.map(t => (
                                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-500">
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                            {previewCards.length > 5 && (
                              <p className="text-xs text-zinc-600 text-center">
                                and {deck.cardCount - 5} more cards...
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ─── Export Format ───────────────────── */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-white">Export Format</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {formats.map(fmt => (
                  <button
                    key={fmt.id}
                    onClick={() => setSelectedFormat(fmt.id)}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      selectedFormat === fmt.id
                        ? 'bg-teal-500/5 border-teal-500/30 ring-1 ring-teal-500/20'
                        : 'bg-zinc-900/40 border-zinc-800/60 hover:border-zinc-700/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileSpreadsheet className={`w-4 h-4 ${selectedFormat === fmt.id ? 'text-teal-400' : 'text-zinc-500'}`} />
                      <span className={`font-medium ${selectedFormat === fmt.id ? 'text-white' : 'text-zinc-300'}`}>
                        {fmt.name}
                      </span>
                      {fmt.recommended && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">{fmt.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* ─── Options ─────────────────────────── */}
            <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 space-y-3">
              <h3 className="text-sm font-semibold text-white">Options</h3>
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setIncludeMetadata(!includeMetadata)}
                  className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                    includeMetadata ? 'bg-teal-500/30' : 'bg-zinc-700/60'
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                    includeMetadata ? 'left-4 bg-teal-400' : 'left-0.5 bg-zinc-500'
                  }`} />
                </div>
                <div>
                  <p className="text-sm text-white">Include study metadata</p>
                  <p className="text-xs text-zinc-500">Add ease factor, interval, and repetition data to CSV export</p>
                </div>
              </label>
            </div>

            {/* ─── Export Button ────────────────────── */}
            {error && (
              <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 flex items-center gap-2 text-sm text-red-400">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {exported && exportStats && (
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Export Complete!</span>
                </div>
                <p className="text-sm text-zinc-400">
                  Exported {exportStats.cardsExported} cards from {exportStats.decksExported} deck(s).
                  Your file has been downloaded.
                </p>
              </div>
            )}

            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full py-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-400 font-semibold hover:bg-teal-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating export...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export {selectedCardCount} Cards
                </>
              )}
            </button>

            {/* ─── How to Import ────────────────────── */}
            <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-teal-400" />
                How to Import into Anki
              </h3>
              <div className="space-y-3">
                {[
                  { step: '1', text: 'Open Anki on your computer', detail: 'Make sure you have the latest version installed' },
                  { step: '2', text: 'Go to File → Import', detail: 'Select the downloaded file' },
                  { step: '3', text: 'Anki auto-detects the format', detail: 'TSV files include configuration headers — no manual setup needed' },
                  { step: '4', text: 'Click Import — done!', detail: 'Cards appear in the specified deck, ready for review' },
                ].map(item => (
                  <div key={item.step} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-teal-400">{item.step}</span>
                    </div>
                    <div>
                      <p className="text-sm text-white">{item.text}</p>
                      <p className="text-xs text-zinc-500">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </PageTransition>
  );
}
