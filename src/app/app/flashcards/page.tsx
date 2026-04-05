"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Layers, Plus, Play, Brain, Loader2, Sparkles, Trash2,
  ChevronRight, RotateCcw, Check, X, Eye, EyeOff,
  Zap, Clock, Award, BarChart3, ArrowLeft,
  BookOpen, Flame, AlertCircle, ChevronDown, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageTransition, Stagger } from "@/components/PageTransition";
import { toast } from "sonner";
import { usePageTitle } from "@/lib/use-page-title";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────

interface DeckSummary {
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

interface Flashcard {
  id: string;
  front: string;
  back: string;
  hint?: string;
  tags: string[];
  sourceMemoryId?: string;
  sourceTitle?: string;
  sm2: {
    easeFactor: number;
    interval: number;
    repetitions: number;
    nextReview: string;
    lastReview: string | null;
  };
  createdAt: string;
}

interface ReviewSession {
  deckId: string;
  deckName: string;
  deckColor: string;
  cards: Flashcard[];
  currentIndex: number;
  showAnswer: boolean;
  results: { cardId: string; grade: number }[];
  totalCards: number;
}

interface Stats {
  totalCards: number;
  totalDecks: number;
  dueNow: number;
  mastered: number;
  reviewed: number;
  streak: number;
  distribution: { new: number; learning: number; reviewing: number; mastered: number };
}

// ─── Colors ───────────────────────────────────────────────────

const DECK_COLOR_MAP: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  teal: { bg: "bg-teal-500/10", border: "border-teal-500/20", text: "text-teal-400", glow: "shadow-teal-500/5" },
  sky: { bg: "bg-sky-500/10", border: "border-sky-500/20", text: "text-sky-400", glow: "shadow-sky-500/5" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", glow: "shadow-emerald-500/5" },
  amber: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", glow: "shadow-amber-500/5" },
  cyan: { bg: "bg-cyan-500/10", border: "border-cyan-500/20", text: "text-cyan-400", glow: "shadow-cyan-500/5" },
  rose: { bg: "bg-rose-500/10", border: "border-rose-500/20", text: "text-rose-400", glow: "shadow-rose-500/5" },
  lime: { bg: "bg-lime-500/10", border: "border-lime-500/20", text: "text-lime-400", glow: "shadow-lime-500/5" },
  orange: { bg: "bg-orange-500/10", border: "border-orange-500/20", text: "text-orange-400", glow: "shadow-orange-500/5" },
};

const GRADE_CONFIG = [
  { grade: 0, label: "Forgot", shortLabel: "0", color: "bg-rose-500", hoverColor: "hover:bg-rose-600", key: "1" },
  { grade: 1, label: "Barely", shortLabel: "1", color: "bg-rose-400", hoverColor: "hover:bg-rose-500", key: "2" },
  { grade: 2, label: "Hard", shortLabel: "2", color: "bg-amber-500", hoverColor: "hover:bg-amber-600", key: "3" },
  { grade: 3, label: "Okay", shortLabel: "3", color: "bg-amber-400", hoverColor: "hover:bg-amber-500", key: "4" },
  { grade: 4, label: "Good", shortLabel: "4", color: "bg-teal-500", hoverColor: "hover:bg-teal-600", key: "5" },
  { grade: 5, label: "Easy", shortLabel: "5", color: "bg-emerald-500", hoverColor: "hover:bg-emerald-600", key: "6" },
];

// ─── Page Component ───────────────────────────────────────────

export default function FlashcardsPage() {
  usePageTitle("Flashcards");
  const [view, setView] = useState<"decks" | "deck-detail" | "review" | "generate">("decks");
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [selectedDeck, setSelectedDeck] = useState<{ id: string; name: string; color: string; cards: Flashcard[] } | null>(null);
  const [review, setReview] = useState<ReviewSession | null>(null);
  const [generatedCards, setGeneratedCards] = useState<Flashcard[]>([]);
  const [generating, setGenerating] = useState(false);
  const [showCreateDeck, setShowCreateDeck] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckDesc, setNewDeckDesc] = useState("");
  const [generateTopic, setGenerateTopic] = useState("");
  const [savingCards, setSavingCards] = useState(false);
  const [reviewGrading, setReviewGrading] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hasAI, setHasAI] = useState(true); // optimistic default

  useEffect(() => {
    fetch("/api/v1/settings").then(r => r.ok ? r.json() : null).then(data => {
      if (data) setHasAI(!!data.hasApiKey);
    }).catch(() => {});
  }, []);

  // ─── Fetch data ──────────────────────────────────────────

  const fetchDecks = useCallback(async () => {
    try {
      const [decksRes, statsRes] = await Promise.all([
        fetch("/api/v1/plugins/flashcard-maker?action=decks"),
        fetch("/api/v1/plugins/flashcard-maker?action=stats"),
      ]);
      if (decksRes.ok) {
        const data = await decksRes.json();
        setDecks(data.decks || []);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDecks(); }, [fetchDecks]);

  // ─── Keyboard shortcuts ──────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (view !== "review" || !review) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!review.showAnswer) {
          setReview(r => r ? { ...r, showAnswer: true } : null);
        }
        return;
      }

      if (review.showAnswer && e.key >= "1" && e.key <= "6") {
        e.preventDefault();
        handleGrade(parseInt(e.key) - 1);
        return;
      }

      if (e.key === "h") {
        e.preventDefault();
        setShowHint(s => !s);
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        finishReview();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, review]);

  // ─── Create deck ─────────────────────────────────────────

  async function handleCreateDeck() {
    if (!newDeckName.trim()) return;
    try {
      const res = await fetch("/api/v1/plugins/flashcard-maker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-deck", name: newDeckName, description: newDeckDesc }),
      });
      if (res.ok) {
        toast.success("Deck created");
        setNewDeckName("");
        setNewDeckDesc("");
        setShowCreateDeck(false);
        fetchDecks();
      }
    } catch { toast.error("Failed to create deck"); }
  }

  // ─── Delete deck ─────────────────────────────────────────

  async function handleDeleteDeck(deckId: string) {
    if (!confirm("Delete this deck and all its cards?")) return;
    try {
      const res = await fetch("/api/v1/plugins/flashcard-maker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-deck", deckId }),
      });
      if (res.ok) {
        toast.success("Deck deleted");
        if (selectedDeckId === deckId) {
          setView("decks");
          setSelectedDeckId(null);
          setSelectedDeck(null);
        }
        fetchDecks();
      }
    } catch { toast.error("Failed to delete deck"); }
  }

  // ─── Open deck detail ────────────────────────────────────

  async function openDeck(deckId: string) {
    setSelectedDeckId(deckId);
    try {
      const res = await fetch(`/api/v1/plugins/flashcard-maker?action=cards&deckId=${deckId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedDeck({ id: data.deck.id, name: data.deck.name, color: data.deck.color, cards: data.deck.cards });
        setView("deck-detail");
      }
    } catch { toast.error("Failed to load deck"); }
  }

  // ─── Start review ────────────────────────────────────────

  async function startReview(deckId: string) {
    try {
      const res = await fetch(`/api/v1/plugins/flashcard-maker?action=review&deckId=${deckId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.dueCards.length === 0) {
          toast("No cards due for review! Come back later.", { icon: "🎉" });
          return;
        }
        setReview({
          deckId: data.deckId,
          deckName: data.deckName,
          deckColor: data.deckColor,
          cards: data.dueCards,
          currentIndex: 0,
          showAnswer: false,
          results: [],
          totalCards: data.dueCards.length,
        });
        setShowHint(false);
        setView("review");
      }
    } catch { toast.error("Failed to start review"); }
  }

  // ─── Handle grade ────────────────────────────────────────

  async function handleGrade(grade: number) {
    if (!review || reviewGrading) return;
    setReviewGrading(true);

    const card = review.cards[review.currentIndex];
    try {
      await fetch("/api/v1/plugins/flashcard-maker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "review-card", deckId: review.deckId, cardId: card.id, grade }),
      });
    } catch { /* still advance */ }

    const newResults = [...review.results, { cardId: card.id, grade }];
    const nextIndex = review.currentIndex + 1;

    if (nextIndex >= review.cards.length) {
      // Session complete
      setReview(r => r ? { ...r, results: newResults, currentIndex: nextIndex } : null);
      setReviewGrading(false);
      return;
    }

    setReview(r => r ? { ...r, currentIndex: nextIndex, showAnswer: false, results: newResults } : null);
    setShowHint(false);
    setReviewGrading(false);
  }

  // ─── Finish review ───────────────────────────────────────

  function finishReview() {
    setReview(null);
    setView("decks");
    fetchDecks();
  }

  // ─── Generate flashcards ─────────────────────────────────

  async function handleGenerate() {
    setGenerating(true);
    setGeneratedCards([]);
    try {
      const params = new URLSearchParams({ action: "generate", limit: "10" });
      if (generateTopic.trim()) params.set("topic", generateTopic.trim());

      const res = await fetch(`/api/v1/plugins/flashcard-maker?${params}`);
      if (res.ok) {
        const data = await res.json();
        setGeneratedCards(data.cards || []);
        if (data.cards?.length === 0) {
          toast("No flashcards could be generated. Try a different topic.");
        }
      } else {
        const err = await res.json();
        toast.error(err.error || "Generation failed");
      }
    } catch { toast.error("Failed to generate flashcards"); }
    setGenerating(false);
  }

  // ─── Save generated cards to deck ────────────────────────

  async function saveGeneratedCards(deckId: string) {
    if (!generatedCards.length) return;
    setSavingCards(true);
    try {
      const res = await fetch("/api/v1/plugins/flashcard-maker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-cards", deckId, cards: generatedCards }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.saved} cards added to deck`);
        setGeneratedCards([]);
        setView("decks");
        fetchDecks();
      }
    } catch { toast.error("Failed to save cards"); }
    setSavingCards(false);
  }

  // ─── Delete card ─────────────────────────────────────────

  async function handleDeleteCard(deckId: string, cardId: string) {
    try {
      const res = await fetch("/api/v1/plugins/flashcard-maker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-card", deckId, cardId }),
      });
      if (res.ok) {
        toast.success("Card deleted");
        // Refresh deck
        if (selectedDeck) {
          setSelectedDeck(d => d ? { ...d, cards: d.cards.filter(c => c.id !== cardId) } : null);
        }
        fetchDecks();
      }
    } catch { toast.error("Failed to delete card"); }
  }

  // ─── Loading ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="animate-pulse rounded-xl bg-white/[0.04] h-7 w-36" />
            <div className="animate-pulse rounded-xl bg-white/[0.04] h-4 w-48" />
          </div>
          <div className="flex gap-2">
            <div className="animate-pulse rounded-xl bg-white/[0.04] h-9 w-24" />
            <div className="animate-pulse rounded-xl bg-white/[0.04] h-9 w-24" />
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 space-y-4">
            <div className="animate-pulse rounded-xl bg-white/[0.04] h-5 w-20 mx-auto" />
            <div className="animate-pulse rounded-xl bg-white/[0.04] h-6 w-3/4 mx-auto" />
            <div className="animate-pulse rounded-xl bg-white/[0.04] h-4 w-1/2 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  // ─── Review Mode ─────────────────────────────────────────

  if (view === "review" && review) {
    const isComplete = review.currentIndex >= review.cards.length;

    if (isComplete) {
      // Review session results
      const correct = review.results.filter(r => r.grade >= 3).length;
      const total = review.results.length;
      const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

      return (
        <PageTransition>
          <div className="max-w-lg mx-auto px-4 pt-8 pb-20">
            <Stagger>
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mx-auto mb-4">
                  <Award className="w-8 h-8 text-teal-400" />
                </div>
                <h2 className="text-[22px] font-semibold tracking-[-0.03em]">Session Complete!</h2>
                <p className="text-zinc-500 text-[14px] mt-1">
                  {review.deckName}
                </p>
              </div>
            </Stagger>

            <Stagger>
              {/* Score circle */}
              <div className="flex justify-center mb-8">
                <div className="relative w-32 h-32">
                  <svg className="w-32 h-32 -rotate-90" viewBox="0 0 128 128">
                    <circle cx="64" cy="64" r="56" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8" />
                    <circle
                      cx="64" cy="64" r="56"
                      fill="none"
                      stroke={pct >= 80 ? "#14b8a6" : pct >= 50 ? "#f59e0b" : "#f43f5e"}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${(pct / 100) * 352} 352`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[32px] font-bold tabular-nums">{pct}%</span>
                  </div>
                </div>
              </div>
            </Stagger>

            <Stagger>
              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-8">
                <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-3 sm:p-4 text-center">
                  <div className="text-[18px] sm:text-[20px] font-semibold tabular-nums text-emerald-400">{correct}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">Correct</div>
                </div>
                <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-3 sm:p-4 text-center">
                  <div className="text-[18px] sm:text-[20px] font-semibold tabular-nums text-rose-400">{total - correct}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">Missed</div>
                </div>
                <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 text-center">
                  <div className="text-[20px] font-semibold tabular-nums text-zinc-300">{total}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">Reviewed</div>
                </div>
              </div>
            </Stagger>

            <Stagger>
              <div className="flex gap-3">
                <button
                  onClick={() => startReview(review.deckId)}
                  className="flex-1 h-12 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-medium text-[14px] transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Review Again
                </button>
                <button
                  onClick={finishReview}
                  className="flex-1 h-12 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 font-medium text-[14px] transition-colors"
                >
                  Done
                </button>
              </div>
            </Stagger>
          </div>
        </PageTransition>
      );
    }

    // Active review card
    const card = review.cards[review.currentIndex];
    const progress = ((review.currentIndex) / review.cards.length) * 100;
    const colors = DECK_COLOR_MAP[review.deckColor] || DECK_COLOR_MAP.teal;

    return (
      <div className="max-w-lg mx-auto px-4 pt-4 pb-20 md:pt-8">
        {/* Review header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={finishReview}
            className="h-8 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-400 text-[13px] flex items-center gap-1.5 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> End
          </button>
          <div className="text-[13px] text-zinc-500">
            <span className="text-zinc-300 font-medium tabular-nums">{review.currentIndex + 1}</span>
            <span> / {review.cards.length}</span>
          </div>
          <div className={cn("text-[12px] font-medium px-2.5 py-1 rounded-full", colors.bg, colors.text)}>
            {review.deckName}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full bg-white/[0.04] mb-8 overflow-hidden">
          <div
            className="h-full rounded-full bg-teal-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Card */}
        <div className="relative">
          {/* Front */}
          <div
            className={cn(
              "rounded-3xl border p-8 min-h-[280px] flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer",
              review.showAnswer
                ? "bg-white/[0.01] border-white/[0.04]"
                : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.03]"
            )}
            onClick={() => !review.showAnswer && setReview(r => r ? { ...r, showAnswer: true } : null)}
          >
            <div className="text-[11px] text-zinc-600 uppercase tracking-widest font-medium mb-4">
              {review.showAnswer ? "Question" : "Tap to reveal"}
            </div>
            <p className="text-[18px] md:text-[20px] font-medium leading-relaxed text-zinc-200 max-w-md">
              {card.front}
            </p>

            {/* Hint */}
            {card.hint && !review.showAnswer && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowHint(s => !s); }}
                className="mt-6 text-[12px] text-zinc-600 hover:text-zinc-400 flex items-center gap-1.5 transition-colors"
              >
                {showHint ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showHint ? card.hint : "Show hint"}
              </button>
            )}

            {!review.showAnswer && (
              <div className="mt-6 text-[11px] text-zinc-700">
                Press <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] font-mono text-[10px] text-zinc-500">Space</kbd> to reveal
              </div>
            )}
          </div>

          {/* Answer (slides in below) */}
          {review.showAnswer && (
            <div className="mt-4 rounded-3xl bg-teal-500/[0.04] border border-teal-500/15 p-8 text-center"
              style={{ animation: "fc-slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1)" }}
            >
              <div className="text-[11px] text-teal-500/70 uppercase tracking-widest font-medium mb-4">Answer</div>
              <p className="text-[16px] md:text-[18px] leading-relaxed text-zinc-300 max-w-md mx-auto">
                {card.back}
              </p>
              {card.sourceTitle && (
                <p className="text-[11px] text-zinc-600 mt-4">
                  From: {card.sourceTitle}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Grading buttons */}
        {review.showAnswer && (
          <div className="mt-6" style={{ animation: "fc-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both" }}>
            <div className="text-[11px] text-zinc-600 text-center mb-3">How well did you know this?</div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {GRADE_CONFIG.map(g => (
                <button
                  key={g.grade}
                  onClick={() => handleGrade(g.grade)}
                  disabled={reviewGrading}
                  className={cn(
                    "h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95",
                    g.color, g.hoverColor,
                    "text-white font-medium disabled:opacity-50",
                  )}
                >
                  <span className="text-[14px] font-semibold">{g.shortLabel}</span>
                  <span className="text-[9px] opacity-80 hidden sm:block">{g.label}</span>
                </button>
              ))}
            </div>
            <div className="text-[10px] text-zinc-700 text-center mt-2">
              Press <kbd className="px-1 py-0.5 rounded bg-white/[0.06] font-mono text-[9px] text-zinc-500">1</kbd>–<kbd className="px-1 py-0.5 rounded bg-white/[0.06] font-mono text-[9px] text-zinc-500">6</kbd> to grade
            </div>
          </div>
        )}

        {/* Tags */}
        {card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center mt-6">
            {card.tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[10px] text-zinc-500">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Animation keyframes */}
        <style jsx>{`
          @keyframes fc-slide-in {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  // ─── Generate View ───────────────────────────────────────

  if (view === "generate") {
    return (
      <PageTransition>
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-20 md:pt-8">
          <Stagger>
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => { setView("decks"); setGeneratedCards([]); }}
                className="h-8 w-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] flex items-center justify-center transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-zinc-400" />
              </button>
              <div>
                <h1 className="text-[22px] font-semibold tracking-[-0.03em]">Generate Flashcards</h1>
                <p className="text-zinc-500 text-[13px]">AI creates Q&A cards from your knowledge</p>
              </div>
            </div>
          </Stagger>

          <Stagger>
            {/* No AI provider banner */}
            {!hasAI && (
              <Link href="/app/settings">
                <div className="flex items-center gap-3 rounded-2xl bg-amber-500/[0.06] border border-amber-500/15 px-4 py-3 mb-5 hover:bg-amber-500/[0.1] transition-colors">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-amber-300">AI provider required</p>
                    <p className="text-[11px] text-amber-400/60 mt-0.5">Connect Gemini (free) or OpenAI in Settings to generate flashcards.</p>
                  </div>
                  <Settings className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                </div>
              </Link>
            )}
          </Stagger>

          <Stagger>
            {/* Topic input */}
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5 mb-6">
              <label className="text-[13px] text-zinc-400 font-medium block mb-2">
                Topic (optional)
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={generateTopic}
                  onChange={(e) => setGenerateTopic(e.target.value)}
                  placeholder="e.g. machine learning, TypeScript, history…"
                  className="flex-1 h-11 rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 text-[14px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-teal-500/30 transition-colors"
                  onKeyDown={(e) => e.key === "Enter" && !generating && handleGenerate()}
                />
                <button
                  onClick={handleGenerate}
                  disabled={generating || !hasAI}
                  className="h-11 px-5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-medium text-[14px] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {generating ? "Generating…" : "Generate"}
                </button>
              </div>
              <p className="text-[11px] text-zinc-600 mt-2">
                Leave empty to generate from random memories
              </p>
            </div>
          </Stagger>

          {/* Generated cards */}
          {generatedCards.length > 0 && (
            <Stagger>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-medium text-zinc-300">
                  {generatedCards.length} cards generated
                </h3>
              </div>

              <div className="space-y-3 mb-6">
                {generatedCards.map((card, i) => (
                  <div
                    key={card.id}
                    className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5 hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <span className="text-[11px] text-zinc-600 font-mono tabular-nums shrink-0 mt-0.5">
                        Q{i + 1}
                      </span>
                      <button
                        onClick={() => setGeneratedCards(cs => cs.filter(c => c.id !== card.id))}
                        className="p-1 rounded-lg hover:bg-white/[0.06] text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[14px] text-zinc-200 font-medium mb-2">{card.front}</p>
                    <p className="text-[13px] text-zinc-400 mb-2">{card.back}</p>
                    {card.hint && (
                      <p className="text-[11px] text-teal-500/60">💡 {card.hint}</p>
                    )}
                    {card.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {card.tags.map(tag => (
                          <span key={tag} className="px-1.5 py-0.5 rounded-full bg-white/[0.04] text-[10px] text-zinc-500">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Save to deck */}
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5">
                <h4 className="text-[13px] font-medium text-zinc-400 mb-3">Save to deck</h4>
                {decks.length === 0 ? (
                  <div className="text-[13px] text-zinc-500">
                    Create a deck first to save these cards.
                    <button
                      onClick={() => setShowCreateDeck(true)}
                      className="text-teal-400 hover:text-teal-300 ml-1"
                    >
                      Create deck →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {decks.map(deck => {
                      const colors = DECK_COLOR_MAP[deck.color] || DECK_COLOR_MAP.teal;
                      return (
                        <button
                          key={deck.id}
                          onClick={() => saveGeneratedCards(deck.id)}
                          disabled={savingCards}
                          className={cn(
                            "w-full h-12 rounded-xl border flex items-center justify-between px-4 transition-all hover:bg-white/[0.03] disabled:opacity-50",
                            "bg-white/[0.01] border-white/[0.06]"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn("w-3 h-3 rounded-full", colors.bg, "border", colors.border)} />
                            <span className="text-[14px] text-zinc-300">{deck.name}</span>
                            <span className="text-[11px] text-zinc-600">{deck.cardCount} cards</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[13px] text-teal-400">
                            {savingCards ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            Add
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </Stagger>
          )}
        </div>
      </PageTransition>
    );
  }

  // ─── Deck Detail View ────────────────────────────────────

  if (view === "deck-detail" && selectedDeck) {
    const colors = DECK_COLOR_MAP[selectedDeck.color] || DECK_COLOR_MAP.teal;
    const now = new Date();
    const dueCards = selectedDeck.cards.filter(c => new Date(c.sm2.nextReview) <= now);
    const newCards = selectedDeck.cards.filter(c => c.sm2.repetitions === 0);
    const masteredCards = selectedDeck.cards.filter(c => c.sm2.repetitions >= 5);
    const learningCards = selectedDeck.cards.filter(c => c.sm2.repetitions > 0 && c.sm2.repetitions < 5);

    return (
      <PageTransition>
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-20 md:pt-8">
          <Stagger>
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => { setView("decks"); setSelectedDeck(null); }}
                className="h-8 w-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] flex items-center justify-center transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-zinc-400" />
              </button>
              <div className="flex-1">
                <h1 className="text-[22px] font-semibold tracking-[-0.03em]">{selectedDeck.name}</h1>
                <p className="text-zinc-500 text-[13px]">{selectedDeck.cards.length} cards</p>
              </div>
              <button
                onClick={() => startReview(selectedDeck.id)}
                disabled={dueCards.length === 0 && newCards.length === 0}
                className={cn(
                  "h-10 px-5 rounded-xl font-medium text-[14px] transition-all flex items-center gap-2",
                  dueCards.length > 0 || newCards.length > 0
                    ? "bg-teal-600 hover:bg-teal-500 text-white"
                    : "bg-white/[0.04] text-zinc-500 cursor-not-allowed"
                )}
              >
                <Play className="w-4 h-4" /> Review {dueCards.length > 0 ? `(${dueCards.length})` : ""}
              </button>
            </div>
          </Stagger>

          {/* Stats bar */}
          <Stagger>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: "Due", count: dueCards.length, color: "text-amber-400", icon: Clock },
                { label: "New", count: newCards.length, color: "text-sky-400", icon: Sparkles },
                { label: "Learning", count: learningCards.length, color: "text-teal-400", icon: BookOpen },
                { label: "Mastered", count: masteredCards.length, color: "text-emerald-400", icon: Award },
              ].map(stat => (
                <div key={stat.label} className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-3 text-center">
                  <stat.icon className={cn("w-4 h-4 mx-auto mb-1", stat.color)} />
                  <div className={cn("text-[18px] font-semibold tabular-nums", stat.color)}>{stat.count}</div>
                  <div className="text-[10px] text-zinc-600">{stat.label}</div>
                </div>
              ))}
            </div>
          </Stagger>

          {/* Cards list */}
          <Stagger>
            {selectedDeck.cards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.08] p-8 text-center">
                <Layers className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                <p className="text-[14px] text-zinc-400 mb-2">No cards yet</p>
                <button
                  onClick={() => setView("generate")}
                  className="text-[13px] text-teal-400 hover:text-teal-300"
                >
                  Generate flashcards →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDeck.cards.map((card, i) => {
                  const isNew = card.sm2.repetitions === 0;
                  const isDue = new Date(card.sm2.nextReview) <= now;
                  const isMastered = card.sm2.repetitions >= 5;

                  return (
                    <div
                      key={card.id}
                      className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 hover:bg-white/[0.03] transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] text-zinc-200 font-medium line-clamp-2">{card.front}</p>
                          <p className="text-[12px] text-zinc-500 mt-1 line-clamp-1">{card.back}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isNew && (
                            <span className="px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-[10px] text-sky-400">New</span>
                          )}
                          {isDue && !isNew && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400">Due</span>
                          )}
                          {isMastered && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400">Mastered</span>
                          )}
                          <button
                            onClick={() => handleDeleteCard(selectedDeck.id, card.id)}
                            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-zinc-700 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {card.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {card.tags.map(tag => (
                            <span key={tag} className="px-1.5 py-0.5 rounded-full bg-white/[0.03] text-[9px] text-zinc-600">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Stagger>
        </div>
      </PageTransition>
    );
  }

  // ─── Decks View (main) ──────────────────────────────────

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-20 md:pt-8">
        {/* Header */}
        <Stagger>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-[22px] md:text-[28px] font-semibold tracking-[-0.03em]">Flashcards</h1>
              <p className="text-zinc-500 text-[13px] md:text-[14px]">Spaced repetition from your knowledge</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView("generate")}
                className="h-9 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 text-[13px] font-medium transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4 text-teal-400" /> Generate
              </button>
              <button
                onClick={() => setShowCreateDeck(true)}
                className="h-9 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[13px] font-medium transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> New Deck
              </button>
            </div>
          </div>
        </Stagger>

        {/* Stats */}
        {stats && stats.totalCards > 0 && (
          <Stagger>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-3.5">
                <div className="flex items-center gap-2 mb-1">
                  <Layers className="w-4 h-4 text-teal-400" />
                  <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Cards</span>
                </div>
                <div className="text-[20px] font-semibold tabular-nums text-zinc-200">{stats.totalCards}</div>
              </div>
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-3.5">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Due</span>
                </div>
                <div className={cn("text-[20px] font-semibold tabular-nums", stats.dueNow > 0 ? "text-amber-400" : "text-zinc-200")}>
                  {stats.dueNow}
                </div>
              </div>
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-3.5">
                <div className="flex items-center gap-2 mb-1">
                  <Award className="w-4 h-4 text-emerald-400" />
                  <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Mastered</span>
                </div>
                <div className="text-[20px] font-semibold tabular-nums text-emerald-400">{stats.mastered}</div>
              </div>
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-3.5">
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Streak</span>
                </div>
                <div className="text-[20px] font-semibold tabular-nums text-orange-400">
                  {stats.streak > 0 ? `${stats.streak}d` : "—"}
                </div>
              </div>
            </div>

            {/* Mastery distribution */}
            {stats.totalCards > 0 && (
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 mb-6">
                <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-3">Mastery Progress</div>
                <div className="flex h-3 rounded-full overflow-hidden bg-white/[0.04]">
                  {stats.distribution.mastered > 0 && (
                    <div
                      className="bg-emerald-500 transition-all"
                      style={{ width: `${(stats.distribution.mastered / stats.totalCards) * 100}%` }}
                    />
                  )}
                  {stats.distribution.reviewing > 0 && (
                    <div
                      className="bg-teal-500 transition-all"
                      style={{ width: `${(stats.distribution.reviewing / stats.totalCards) * 100}%` }}
                    />
                  )}
                  {stats.distribution.learning > 0 && (
                    <div
                      className="bg-amber-500 transition-all"
                      style={{ width: `${(stats.distribution.learning / stats.totalCards) * 100}%` }}
                    />
                  )}
                  {stats.distribution.new > 0 && (
                    <div
                      className="bg-sky-500 transition-all"
                      style={{ width: `${(stats.distribution.new / stats.totalCards) * 100}%` }}
                    />
                  )}
                </div>
                <div className="flex items-center justify-between mt-2">
                  {[
                    { label: "Mastered", count: stats.distribution.mastered, color: "bg-emerald-500" },
                    { label: "Reviewing", count: stats.distribution.reviewing, color: "bg-teal-500" },
                    { label: "Learning", count: stats.distribution.learning, color: "bg-amber-500" },
                    { label: "New", count: stats.distribution.new, color: "bg-sky-500" },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-1.5">
                      <div className={cn("w-2 h-2 rounded-full", s.color)} />
                      <span className="text-[10px] text-zinc-500">{s.label} ({s.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Stagger>
        )}

        {/* Create deck modal */}
        {showCreateDeck && (
          <Stagger>
            <div className="rounded-2xl bg-white/[0.03] border border-teal-500/20 p-5 mb-6">
              <h3 className="text-[15px] font-medium text-zinc-200 mb-3">New Deck</h3>
              <input
                type="text"
                value={newDeckName}
                onChange={(e) => setNewDeckName(e.target.value)}
                placeholder="Deck name"
                className="w-full h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 text-[14px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-teal-500/30 mb-2 transition-colors"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreateDeck()}
              />
              <input
                type="text"
                value={newDeckDesc}
                onChange={(e) => setNewDeckDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 text-[14px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-teal-500/30 mb-3 transition-colors"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowCreateDeck(false); setNewDeckName(""); setNewDeckDesc(""); }}
                  className="h-9 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-400 text-[13px] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateDeck}
                  disabled={!newDeckName.trim()}
                  className="h-9 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[13px] font-medium transition-colors disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </div>
          </Stagger>
        )}

        {/* Deck list */}
        <Stagger>
          {decks.length === 0 && !showCreateDeck ? (
            <div className="rounded-2xl border border-dashed border-white/[0.08] p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mx-auto mb-4">
                <Layers className="w-7 h-7 text-teal-400" />
              </div>
              <h3 className="text-[16px] font-medium text-zinc-300 mb-2">No flashcard decks yet</h3>
              <p className="text-[13px] text-zinc-500 mb-4 max-w-sm mx-auto">
                Create a deck, then generate flashcards from your memories. Review them with spaced repetition to learn efficiently.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowCreateDeck(true)}
                  className="h-10 px-5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-medium text-[14px] transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Create Deck
                </button>
                <button
                  onClick={() => setView("generate")}
                  className="h-10 px-5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 font-medium text-[14px] transition-colors flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-teal-400" /> Generate Cards
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {decks.map(deck => {
                const colors = DECK_COLOR_MAP[deck.color] || DECK_COLOR_MAP.teal;
                return (
                  <div
                    key={deck.id}
                    className={cn(
                      "rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5 transition-all cursor-pointer group",
                      "hover:bg-white/[0.03] hover:border-white/[0.08]"
                    )}
                    onClick={() => openDeck(deck.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                          colors.bg, "border", colors.border,
                        )}>
                          <Layers className={cn("w-5 h-5", colors.text)} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-[16px] font-medium text-zinc-200 group-hover:text-white transition-colors">
                            {deck.name}
                          </h3>
                          {deck.description && (
                            <p className="text-[12px] text-zinc-500 mt-0.5 line-clamp-1">{deck.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-[12px] text-zinc-500">{deck.cardCount} cards</span>
                            {deck.dueCount > 0 && (
                              <span className="text-[12px] text-amber-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {deck.dueCount} due
                              </span>
                            )}
                            {deck.masteredCount > 0 && (
                              <span className="text-[12px] text-emerald-400 flex items-center gap-1">
                                <Award className="w-3 h-3" /> {deck.masteredCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {deck.dueCount > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); startReview(deck.id); }}
                            className="h-8 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[12px] font-medium transition-colors flex items-center gap-1.5"
                          >
                            <Play className="w-3.5 h-3.5" /> Review
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteDeck(deck.id); }}
                          className="p-2 rounded-xl hover:bg-white/[0.06] text-zinc-700 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Stagger>
      </div>
    </PageTransition>
  );
}
