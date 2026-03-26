"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Send, Loader2, Brain, User, Sparkles, ArrowUp,
  Plus, History, Trash2, X, MessageSquare, Clock,
  Copy, Check, ChevronDown, ChevronUp, FileText, Globe, MessageCircle,
  ChevronsDown, Square, RotateCcw, Search, Lightbulb, TrendingUp, Zap, Pencil,
  BookmarkPlus,
  Pin, PinOff, Download, Hash,
} from "lucide-react";
import { getSourceType } from "@/lib/source-types";
import { streamChat, checkApiKey } from "@/lib/openai";
import { ChatMarkdown } from "@/components/ChatMarkdown";
import { openMemoryDrawer } from "@/components/MemoryDrawer";
import { NoAIBanner } from "@/components/ErrorBoundary";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/lib/use-page-title";
import {
  type ChatMessage,
  type Conversation,
  getConversations,
  getConversation,
  createConversation,
  saveConversation,
  deleteConversation,
  renameConversation,
  togglePinConversation,
  searchConversations,
  exportConversationMarkdown,
  getConversationStats,
  clearAllConversations,
} from "@/lib/chat-history";

const SUGGESTION_GROUPS = [
  {
    icon: Search,
    color: "text-blue-400 bg-blue-500/10",
    items: [
      "What topics have I explored most?",
      "Summarize my key interests",
    ],
  },
  {
    icon: Lightbulb,
    color: "text-amber-400 bg-amber-500/10",
    items: [
      "What did I learn recently?",
      "Connections between my ideas?",
    ],
  },
  {
    icon: TrendingUp,
    color: "text-emerald-400 bg-emerald-500/10",
    items: [
      "How have my ideas evolved?",
      "What patterns do you see?",
    ],
  },
];

/** Time-aware greeting */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Late night thinking";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Late night thinking";
}

/** Generate follow-up question suggestions based on conversation context */
async function generateFollowUps(
  query: string,
  answer: string,
  signal?: AbortSignal,
): Promise<string[]> {
  try {
    const res = await fetch("/api/v1/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content:
              "Generate exactly 3 short follow-up questions a user might ask next, based on the conversation. Each question should be concise (under 10 words), curious, and explore different angles. Return ONLY a JSON array of 3 strings, nothing else. Example: [\"How does this relate to X?\",\"What are the key takeaways?\",\"Any contradictions in my notes?\"]",
          },
          {
            role: "user",
            content: `User asked: "${query}"\n\nAssistant answered: "${answer.slice(0, 500)}"`,
          },
        ],
      }),
      signal,
    });
    if (!res.ok) return [];

    // Read the streamed response fully
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let full = "";
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try {
            const json = JSON.parse(line.slice(6));
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) full += delta;
          } catch {}
        }
      }
    }

    // Extract JSON array from response
    const match = full.match(/\[[\s\S]*?\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((q: any) => typeof q === "string" && q.trim().length > 0)
      .slice(0, 3);
  } catch {
    return [];
  }
}

export default function ChatPage() {
  usePageTitle("Chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [memoryCount, setMemoryCount] = useState(0);
  const [hasAI, setHasAI] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [chatProvider, setChatProvider] = useState<string>("auto");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const searchParams = useSearchParams();
  const autoSentRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const followUpAbortRef = useRef<AbortController | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const isNearBottomRef = useRef(true);
  const lastQueryRef = useRef<string>("");
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [followUpsLoading, setFollowUpsLoading] = useState(false);
  const [thinking, setThinking] = useState(false); // true while waiting for first token
  const [thinkingStep, setThinkingStep] = useState<"searching" | "found" | "generating" | null>(null);
  const [searchResultCount, setSearchResultCount] = useState(0);
  const [highlightedCitation, setHighlightedCitation] = useState<{ msgIndex: number; sourceIndex: number } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const historySearchRef = useRef<HTMLInputElement>(null);

  // Load stats & conversations on mount
  useEffect(() => {
    fetch("/api/v1/stats")
      .then((r) => r.json())
      .then((d) => setMemoryCount(d.totalMemories || 0))
      .catch(() => {});
    checkApiKey().then((d: any) => {
      setHasAI(d.hasApiKey);
      if (d.chatModel) setSelectedModel(d.chatModel);
      if (d.chatProvider) setChatProvider(d.chatProvider);
    });
    refreshHistory();
  }, []);

  // Listen for Command Palette events (new-chat, load-chat)
  useEffect(() => {
    function onNewChat() { handleNewChat(); }
    function onLoadChat(e: Event) {
      const id = (e as CustomEvent).detail?.id;
      if (id) handleLoadConversation(id);
    }
    window.addEventListener("mindstore:new-chat", onNewChat);
    window.addEventListener("mindstore:load-chat", onLoadChat);
    return () => {
      window.removeEventListener("mindstore:new-chat", onNewChat);
      window.removeEventListener("mindstore:load-chat", onLoadChat);
    };
  }, []);

  // Auto-send query from ?q= param (e.g. from Explore "Ask about this")
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !autoSentRef.current && memoryCount > 0) {
      autoSentRef.current = true;
      // Clear the URL param to avoid re-sending on re-render
      const url = new URL(window.location.href);
      url.searchParams.delete("q");
      window.history.replaceState(null, "", url.toString());
      // Small delay to ensure hasAI state is resolved
      setTimeout(() => handleSend(q), 200);
    }
  }, [searchParams, memoryCount]);

  // Auto-scroll on new messages (only when near bottom)
  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  // Detect scroll position for "scroll to bottom" button
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onScroll() {
      if (!el) return;
      const threshold = 120;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      isNearBottomRef.current = nearBottom;
      setShowScrollBtn(!nearBottom && messages.length > 0);
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [messages.length]);

  /** Scroll to the bottom of the chat */
  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height =
        Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  // Persist messages whenever they change (debounced)
  useEffect(() => {
    if (!conversationId || messages.length === 0) return;
    const t = setTimeout(() => {
      saveConversation(conversationId, messages);
      refreshHistory();
    }, 300);
    return () => clearTimeout(t);
  }, [messages, conversationId]);

  function refreshHistory() {
    setConversations(getConversations());
  }

  /** Start a brand-new chat */
  function handleNewChat() {
    setMessages([]);
    setConversationId(null);
    setHistoryOpen(false);
    setFollowUps([]);
    setFollowUpsLoading(false);
    setThinkingStep(null);
    setSearchResultCount(0);
    if (followUpAbortRef.current) followUpAbortRef.current.abort();
    inputRef.current?.focus();
  }

  /** Load a previous conversation */
  function handleLoadConversation(id: string) {
    const convo = getConversation(id);
    if (!convo) return;
    setConversationId(id);
    setMessages(convo.messages);
    setHistoryOpen(false);
  }

  /** Delete a conversation from history */
  function handleDeleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    deleteConversation(id);
    refreshHistory();
    if (conversationId === id) {
      handleNewChat();
    }
  }

  /** Clear all history */
  function handleClearAll() {
    if (!confirm("Delete all chat history?")) return;
    clearAllConversations();
    refreshHistory();
    handleNewChat();
    toast.success("Chat history cleared");
  }

  const handleSend = async (text?: string) => {
    const query = (text || input).trim();
    if (!query || loading) return;
    if (memoryCount === 0) {
      toast.error("Import some knowledge first");
      return;
    }

    // Ensure we have a conversation ID
    let cid = conversationId;
    if (!cid) {
      cid = createConversation();
      setConversationId(cid);
    }

    lastQueryRef.current = query;
    setInput("");
    setFollowUps([]);
    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: query },
    ];
    setMessages(newMessages);
    setLoading(true);
    setThinkingStep("searching");
    setSearchResultCount(0);

    // Create AbortController for this request
    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const searchRes = await fetch(
        `/api/v1/search?q=${encodeURIComponent(query)}&limit=8`,
        { signal: abortController.signal }
      );
      if (!searchRes.ok) throw new Error("Search failed");
      const { results = [] } = await searchRes.json();
      setSearchResultCount(results.length);
      if (results.length > 0) {
        setThinkingStep("found");
        // Brief pause so user sees "Found X memories" before generating starts
        await new Promise(r => setTimeout(r, 600));
      } else {
        setThinkingStep(null);
      }

      if (results.length === 0) {
        const updated = [
          ...newMessages,
          {
            role: "assistant" as const,
            content:
              "I couldn't find anything relevant in your knowledge base. Try importing more content or rephrasing your question.",
          },
        ];
        setMessages(updated);
        setLoading(false);
        setThinkingStep(null);
        abortRef.current = null;
        return;
      }

      // If no AI provider configured, show search results directly
      if (!hasAI) {
        const searchResponse = results
          .map(
            (r: any, i: number) =>
              `[${i + 1}] ${r.sourceTitle || "Untitled"} (${r.sourceType})\n${r.content}`
          )
          .join("\n\n");

        const updated = [
          ...newMessages,
          {
            role: "assistant" as const,
            content: `Found ${results.length} relevant memories:\n\n${searchResponse}\n\n💡 Connect an AI provider in Settings for synthesized answers.`,
            sources: results.map((r: any) => ({
              title: r.sourceTitle || "",
              type: r.sourceType,
              score: r.score,
              id: r.memoryId || r.id || "",
              preview: (r.content || "").slice(0, 120).replace(/\n/g, " ").trim(),
              content: r.content || "",
            })),
          },
        ];
        setMessages(updated);
        setLoading(false);
        setThinkingStep(null);
        abortRef.current = null;
        return;
      }

      const context = results
        .map(
          (r: any, i: number) =>
            `[${i + 1}] "${r.sourceTitle}" (${r.sourceType})\n${r.content}`
        )
        .join("\n\n---\n\n");

      const ragMessages = [
        {
          role: "system",
          content: `You are MindStore, a personal knowledge assistant. Answer based ONLY on the user's stored knowledge. Cite sources as [1], [2]. Be concise. Highlight unexpected connections.`,
        },
        {
          role: "user",
          content: `Context from my knowledge base:\n\n${context}\n\n---\n\nQuestion: ${query}`,
        },
      ];

      let fullResponse = "";
      const withPlaceholder: ChatMessage[] = [
        ...newMessages,
        {
          role: "assistant",
          content: "",
          sources: results.map((r: any) => ({
            title: r.sourceTitle || "",
            type: r.sourceType,
            score: r.score,
            id: r.memoryId || r.id || "",
            preview: (r.content || "").slice(0, 120).replace(/\n/g, " ").trim(),
            content: r.content || "",
          })),
        },
      ];
      setMessages(withPlaceholder);
      setThinking(true);
      setThinkingStep("generating");

      for await (const chunk of streamChat(ragMessages, abortController.signal, selectedModel || undefined)) {
        if (fullResponse.length === 0) {
          setThinking(false);
          setThinkingStep(null);
        }
        fullResponse += chunk;
        setMessages((prev) => {
          const u = [...prev];
          u[u.length - 1] = { ...u[u.length - 1], content: fullResponse };
          return u;
        });
      }
      setThinking(false);

      // Generate follow-up suggestions in background
      if (fullResponse.length > 20) {
        setFollowUpsLoading(true);
        // Cancel any previous follow-up request
        if (followUpAbortRef.current) followUpAbortRef.current.abort();
        const fuAbort = new AbortController();
        followUpAbortRef.current = fuAbort;
        generateFollowUps(query, fullResponse, fuAbort.signal)
          .then((fus) => {
            if (!fuAbort.signal.aborted) {
              setFollowUps(fus);
              setFollowUpsLoading(false);
            }
          })
          .catch(() => setFollowUpsLoading(false));
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        // User stopped generation — keep whatever was streamed so far
        setThinking(false);
        setThinkingStep(null);
        setFollowUps([]);
        setFollowUpsLoading(false);
        if (followUpAbortRef.current) followUpAbortRef.current.abort();
        setMessages((prev) => {
          const u = [...prev];
          const last = u[u.length - 1];
          if (last && last.role === "assistant" && !last.content) {
            // If nothing was streamed, add a stopped message
            u[u.length - 1] = { ...last, content: "_Generation stopped._" };
          }
          return u;
        });
      } else {
        toast.error(err.message);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${err.message}` },
        ]);
      }
    } finally {
      setLoading(false);
      setThinking(false);
      setThinkingStep(null);
      abortRef.current = null;
    }
  };

  /** Regenerate a specific assistant response — re-sends the preceding user question */
  const handleRegenerateAt = useCallback((messageIndex: number) => {
    // Find the user message that triggered this assistant response
    const userMsg = messages.slice(0, messageIndex).reverse().find((m) => m.role === "user");
    if (!userMsg) return;
    // Remove messages from this assistant message onward and re-send
    setMessages((prev) => prev.slice(0, messageIndex));
    // Small delay so state updates first
    setTimeout(() => handleSend(userMsg.content), 50);
  }, [messages]);

  /** Stop the current streaming response */
  const handleStop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  /** Regenerate the last assistant response */
  const handleRegenerate = useCallback(() => {
    if (loading || messages.length < 2) return;
    // Find the last user message
    const lastUserIdx = messages.map((m, i) => ({ role: m.role, i })).filter(x => x.role === "user").pop();
    if (!lastUserIdx) return;
    const query = messages[lastUserIdx.i].content;
    // Remove the last assistant response
    const trimmed = messages.slice(0, lastUserIdx.i);
    setMessages(trimmed);
    setFollowUps([]);
    setFollowUpsLoading(false);
    if (followUpAbortRef.current) followUpAbortRef.current.abort();
    // Re-send with the same query
    setTimeout(() => handleSend(query), 50);
  }, [loading, messages]);

  const [copiedChat, setCopiedChat] = useState(false);

  /** Copy entire conversation as formatted markdown */
  const handleCopyConversation = useCallback(() => {
    if (messages.length === 0) return;
    const md = messages.map((m) => {
      const role = m.role === "user" ? "**You**" : "**MindStore**";
      return `${role}:\n${m.content}`;
    }).join("\n\n---\n\n");
    navigator.clipboard.writeText(md).then(() => {
      setCopiedChat(true);
      setTimeout(() => setCopiedChat(false), 1500);
      toast.success("Conversation copied");
    });
  }, [messages]);

  const activeConversations = conversations.filter(
    (c) => c.messages.length > 0
  );

  // Filtered conversations for history panel search
  const filteredConversations = historySearch.trim()
    ? activeConversations.filter(c => {
        const q = historySearch.toLowerCase().trim();
        if (c.title.toLowerCase().includes(q)) return true;
        return c.messages.some(m => m.content.toLowerCase().includes(q));
      })
    : activeConversations;

  // Handle pin toggle
  const handlePinConversation = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    togglePinConversation(id);
    refreshHistory();
    toast.success("Conversation " + (conversations.find(c => c.id === id)?.pinned ? "unpinned" : "pinned"));
  }, [conversations]);

  // Handle export conversation
  const handleExportConversation = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const convo = getConversation(id);
    if (!convo) return;
    const md = exportConversationMarkdown(convo);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${convo.title.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Conversation exported");
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* ═══ Top Bar ═══ */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04] shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all active:scale-[0.96]"
          >
            <Plus className="w-3.5 h-3.5" />
            New chat
          </button>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={handleCopyConversation}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-medium text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all active:scale-[0.96]"
              title="Copy conversation"
            >
              {copiedChat ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
          {activeConversations.length > 0 && (
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className={cn(
                "flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-all active:scale-[0.96]",
                historyOpen
                  ? "text-teal-300 bg-teal-500/10"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]"
              )}
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">History</span>
              <span className="text-[10px] tabular-nums opacity-60">
                {activeConversations.length}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ═══ History Panel (slide-over) ═══ */}
      {historyOpen && (
        <div
          className="absolute inset-0 z-[55]"
          onClick={() => { setHistoryOpen(false); setHistorySearch(""); }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="absolute top-0 right-0 h-full w-[280px] sm:w-[320px] bg-[#111113] border-l border-white/[0.06] shadow-2xl shadow-black/60 animate-in slide-in-from-right flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-semibold">History</h3>
                <span className="text-[10px] tabular-nums text-zinc-600 bg-white/[0.04] px-1.5 py-0.5 rounded-md">
                  {activeConversations.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {activeConversations.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-[11px] text-zinc-600 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-500/5 transition-colors"
                  >
                    Clear all
                  </button>
                )}
                <button
                  onClick={() => { setHistoryOpen(false); setHistorySearch(""); }}
                  className="p-1.5 hover:bg-white/[0.06] rounded-lg"
                >
                  <X className="w-4 h-4 text-zinc-500" />
                </button>
              </div>
            </div>

            {/* Search bar */}
            {activeConversations.length > 2 && (
              <div className="px-3 py-2 border-b border-white/[0.04] shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
                  <input
                    ref={historySearchRef}
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Search conversations…"
                    className="w-full h-8 pl-7 pr-7 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[12px] placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-teal-500/30 focus:border-teal-500/20 transition-all"
                  />
                  {historySearch && (
                    <button
                      onClick={() => setHistorySearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/[0.08]"
                    >
                      <X className="w-3 h-3 text-zinc-600" />
                    </button>
                  )}
                </div>
                {historySearch && (
                  <p className="text-[10px] text-zinc-600 mt-1 px-0.5">
                    {filteredConversations.length} result{filteredConversations.length !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            )}

            {/* Conversation list */}
            <div className="overflow-y-auto flex-1 py-2 px-2">
              {activeConversations.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-5 h-5 text-zinc-700 mx-auto mb-2" />
                  <p className="text-[12px] text-zinc-600">No conversations yet</p>
                  <p className="text-[11px] text-zinc-700 mt-0.5">Start chatting to build history</p>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="w-5 h-5 text-zinc-700 mx-auto mb-2" />
                  <p className="text-[12px] text-zinc-600">No matches for &ldquo;{historySearch}&rdquo;</p>
                  <button
                    onClick={() => setHistorySearch("")}
                    className="text-[11px] text-teal-400 hover:text-teal-300 mt-1 transition-colors"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {/* Pinned section label */}
                  {filteredConversations.some(c => c.pinned) && (
                    <div className="flex items-center gap-1.5 px-2 py-1">
                      <Pin className="w-2.5 h-2.5 text-amber-500/60" />
                      <span className="text-[9px] text-zinc-600 uppercase tracking-[0.08em] font-semibold">Pinned</span>
                    </div>
                  )}
                  {filteredConversations.filter(c => c.pinned).map((c) => {
                    const stats = getConversationStats(c);
                    return (
                      <HistoryCard
                        key={c.id}
                        convo={c}
                        stats={stats}
                        active={conversationId === c.id}
                        renaming={renamingId === c.id}
                        renameValue={renameValue}
                        onLoad={() => handleLoadConversation(c.id)}
                        onRename={(id) => { setRenamingId(id); setRenameValue(c.title); }}
                        onRenameSubmit={(trimmed) => { renameConversation(c.id, trimmed); refreshHistory(); setRenamingId(null); }}
                        onRenameCancel={() => setRenamingId(null)}
                        onRenameChange={setRenameValue}
                        onPin={(e) => handlePinConversation(c.id, e)}
                        onExport={(e) => handleExportConversation(c.id, e)}
                        onDelete={(e) => handleDeleteConversation(c.id, e)}
                      />
                    );
                  })}
                  {/* Unpinned section label (only show if there are also pinned ones) */}
                  {filteredConversations.some(c => c.pinned) && filteredConversations.some(c => !c.pinned) && (
                    <div className="flex items-center gap-1.5 px-2 py-1 mt-1">
                      <Clock className="w-2.5 h-2.5 text-zinc-600" />
                      <span className="text-[9px] text-zinc-600 uppercase tracking-[0.08em] font-semibold">Recent</span>
                    </div>
                  )}
                  {filteredConversations.filter(c => !c.pinned).map((c) => {
                    const stats = getConversationStats(c);
                    return (
                      <HistoryCard
                        key={c.id}
                        convo={c}
                        stats={stats}
                        active={conversationId === c.id}
                        renaming={renamingId === c.id}
                        renameValue={renameValue}
                        onLoad={() => handleLoadConversation(c.id)}
                        onRename={(id) => { setRenamingId(id); setRenameValue(c.title); }}
                        onRenameSubmit={(trimmed) => { renameConversation(c.id, trimmed); refreshHistory(); setRenamingId(null); }}
                        onRenameCancel={() => setRenamingId(null)}
                        onRenameChange={setRenameValue}
                        onPin={(e) => handlePinConversation(c.id, e)}
                        onExport={(e) => handleExportConversation(c.id, e)}
                        onDelete={(e) => handleDeleteConversation(c.id, e)}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer stats */}
            {activeConversations.length > 0 && (
              <div className="px-4 py-2.5 border-t border-white/[0.04] shrink-0">
                <div className="flex items-center justify-between text-[10px] text-zinc-700">
                  <span className="flex items-center gap-1">
                    <Hash className="w-2.5 h-2.5" />
                    {activeConversations.reduce((sum, c) => sum + c.messages.length, 0)} total messages
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-2.5 h-2.5" />
                    {activeConversations.length} chats
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Messages Area ═══ */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center h-full px-6 pb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500/20 to-sky-500/20 flex items-center justify-center mb-3 ring-1 ring-teal-500/10">
              <Brain className="w-6 h-6 text-teal-400" />
            </div>
            <h2 className="text-[17px] font-semibold text-zinc-200 mb-0.5 tracking-[-0.01em]">
              {getGreeting()}
            </h2>
            <p className="text-[13px] text-zinc-500 mb-6">
              {memoryCount > 0 ? (
                `${memoryCount.toLocaleString()} memories ready to explore`
              ) : (
                <Link
                  href="/app/import"
                  className="text-teal-400 hover:text-teal-300 transition-colors"
                >
                  Import knowledge to start →
                </Link>
              )}
            </p>

            {/* No AI provider notice */}
            {!hasAI && memoryCount > 0 && (
              <div className="w-full max-w-sm mb-4">
                <NoAIBanner />
              </div>
            )}

            {/* Categorized suggestions */}
            <div className="w-full max-w-sm space-y-3">
              {SUGGESTION_GROUPS.map((group, gi) => (
                <div key={gi} className="space-y-1.5">
                  <div className="flex items-center gap-1.5 px-1">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center ${group.color.split(" ").slice(1).join(" ")}`}>
                      <group.icon className={`w-3 h-3 ${group.color.split(" ")[0]}`} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {group.items.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSend(s)}
                        className="text-left text-[12px] leading-snug p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/[0.1] text-zinc-400 transition-all active:scale-[0.97]"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Recent conversations quick-access */}
            {activeConversations.length > 0 && (
              <div className="mt-8 w-full max-w-xs">
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.08em] mb-2 px-1">
                  {activeConversations.some(c => c.pinned) ? "Pinned & recent" : "Recent conversations"}
                </p>
                <div className="space-y-1">
                  {activeConversations.slice(0, 3).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleLoadConversation(c.id)}
                      className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] transition-all active:scale-[0.98]"
                    >
                      {c.pinned ? (
                        <Pin className="w-3.5 h-3.5 text-amber-500/60 shrink-0" />
                      ) : (
                        <MessageSquare className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                      )}
                      <span className="text-[12px] text-zinc-400 truncate flex-1">
                        {c.title}
                      </span>
                      <span className="text-[10px] text-zinc-700 shrink-0">
                        {formatRelativeTime(c.updatedAt)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Message List */
          <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2.5 group/msg ${msg.role === "user" ? "justify-end" : ""}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-teal-500/20 to-sky-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Brain className="w-3.5 h-3.5 text-teal-400" />
                  </div>
                )}
                <div className="relative max-w-[82%] min-w-0">
                  <div
                    className={`overflow-hidden ${
                      msg.role === "user"
                        ? "rounded-[20px] rounded-br-md bg-teal-600 text-white px-4 py-2.5"
                        : "rounded-[20px] rounded-bl-md bg-white/[0.04] border border-white/[0.06] px-4 py-2.5"
                    }`}
                  >
                    <div className="text-[13px] leading-[1.6] break-words [overflow-wrap:anywhere]">
                      {msg.content ? (
                        <ChatMarkdown
                          content={msg.content}
                          {...(msg.role === "assistant" && msg.sources?.length ? {
                            onCitationHover: (sourceIndex) => {
                              if (sourceIndex !== null) {
                                setHighlightedCitation({ msgIndex: i, sourceIndex });
                              } else {
                                setHighlightedCitation(null);
                              }
                            },
                            onCitationClick: (sourceIndex) => {
                              const source = msg.sources?.[sourceIndex];
                              if (source?.id) {
                                openMemoryDrawer({
                                  id: source.id,
                                  content: source.content || source.preview || "",
                                  source: source.type,
                                  sourceId: "",
                                  sourceTitle: source.title || "Untitled",
                                  timestamp: "",
                                  importedAt: "",
                                  metadata: {},
                                  pinned: false,
                                });
                              }
                            },
                          } : {})}
                        />
                      ) : loading && i === messages.length - 1 ? (
                        <span className="flex items-center gap-2 text-zinc-500">
                          <span className="flex gap-[3px] items-center">
                            <span
                              className="w-[5px] h-[5px] rounded-full bg-teal-400/60"
                              style={{ animation: "ms-pulse 1.4s ease-in-out infinite", animationDelay: "0ms" }}
                            />
                            <span
                              className="w-[5px] h-[5px] rounded-full bg-teal-400/60"
                              style={{ animation: "ms-pulse 1.4s ease-in-out infinite", animationDelay: "200ms" }}
                            />
                            <span
                              className="w-[5px] h-[5px] rounded-full bg-teal-400/60"
                              style={{ animation: "ms-pulse 1.4s ease-in-out infinite", animationDelay: "400ms" }}
                            />
                          </span>
                          <span className="text-[11px] text-zinc-600">Generating…</span>
                        </span>
                      ) : (
                        ""
                      )}
                    </div>
                    {msg.sources &&
                      msg.sources.length > 0 &&
                      msg.content && (
                        <SourceCards
                          sources={msg.sources}
                          highlightedIndex={highlightedCitation?.msgIndex === i ? highlightedCitation.sourceIndex : null}
                        />
                      )}
                  </div>
                  {/* Hover action buttons */}
                  {msg.content && (
                    msg.role === "assistant" ? (
                      <MessageActions
                        content={msg.content}
                        question={
                          // Find the preceding user message as context for the title
                          messages.slice(0, i).reverse().find((m) => m.role === "user")?.content || ""
                        }
                        onRegenerate={!loading ? () => handleRegenerateAt(i) : undefined}
                      />
                    ) : (
                      <MessageCopyButton content={msg.content} side="left" />
                    )
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-xl bg-teal-600/20 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-teal-300" />
                  </div>
                )}
              </div>
            ))}

            {/* Multi-step thinking indicator — shows progress through RAG pipeline */}
            {loading && messages.length > 0 && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-teal-500/20 to-sky-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Brain className="w-3.5 h-3.5 text-teal-400" />
                </div>
                <div className="rounded-[20px] rounded-bl-md bg-white/[0.04] border border-white/[0.06] px-4 py-3">
                  <div className="flex flex-col gap-1.5">
                    {/* Step 1: Searching */}
                    <span className="flex items-center gap-2">
                      {thinkingStep === "searching" ? (
                        <span className="flex gap-[3px] items-center">
                          <span className="w-[5px] h-[5px] rounded-full bg-teal-400/60" style={{ animation: "ms-pulse 1.4s ease-in-out infinite", animationDelay: "0ms" }} />
                          <span className="w-[5px] h-[5px] rounded-full bg-teal-400/60" style={{ animation: "ms-pulse 1.4s ease-in-out infinite", animationDelay: "200ms" }} />
                          <span className="w-[5px] h-[5px] rounded-full bg-teal-400/60" style={{ animation: "ms-pulse 1.4s ease-in-out infinite", animationDelay: "400ms" }} />
                        </span>
                      ) : (thinkingStep === "found" || thinkingStep === "generating") ? (
                        <Check className="w-3 h-3 text-green-400/70" />
                      ) : null}
                      <span className={`text-[11px] ${thinkingStep === "searching" ? "text-zinc-400" : "text-zinc-600"}`}>
                        {thinkingStep === "searching"
                          ? "Searching memories…"
                          : searchResultCount > 0
                            ? `Found ${searchResultCount} relevant ${searchResultCount === 1 ? "memory" : "memories"}`
                            : "Searching memories…"}
                      </span>
                    </span>
                    {/* Step 2: Generating */}
                    {(thinkingStep === "found" || thinkingStep === "generating") && (
                      <span className="flex items-center gap-2">
                        {thinkingStep === "generating" ? (
                          <span className="flex gap-[3px] items-center">
                            <span className="w-[5px] h-[5px] rounded-full bg-teal-400/60" style={{ animation: "ms-pulse 1.4s ease-in-out infinite", animationDelay: "0ms" }} />
                            <span className="w-[5px] h-[5px] rounded-full bg-teal-400/60" style={{ animation: "ms-pulse 1.4s ease-in-out infinite", animationDelay: "200ms" }} />
                            <span className="w-[5px] h-[5px] rounded-full bg-teal-400/60" style={{ animation: "ms-pulse 1.4s ease-in-out infinite", animationDelay: "400ms" }} />
                          </span>
                        ) : (
                          <Loader2 className="w-3 h-3 text-teal-400/60 animate-spin" />
                        )}
                        <span className="text-[11px] text-zinc-400">Generating response…</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Follow-up suggestions — shown after last assistant message */}
            {!loading && messages.length >= 2 && messages[messages.length - 1]?.role === "assistant" && (
              <div className="flex gap-2 flex-wrap pl-9">
                {followUpsLoading ? (
                  <div className="flex items-center gap-1.5 h-7 px-3 rounded-full border border-white/[0.06] bg-white/[0.02]">
                    <Loader2 className="w-3 h-3 text-zinc-600 animate-spin" />
                    <span className="text-[11px] text-zinc-600">Thinking of follow-ups…</span>
                  </div>
                ) : followUps.length > 0 ? (
                  followUps.map((fu, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setFollowUps([]);
                        handleSend(fu);
                      }}
                      className="text-left text-[12px] leading-snug px-3 py-1.5 rounded-full border border-teal-500/15 bg-teal-500/[0.06] text-teal-300 hover:bg-teal-500/[0.12] hover:border-teal-500/25 transition-all active:scale-[0.97] max-w-[280px] truncate"
                    >
                      {fu}
                    </button>
                  ))
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ Scroll to Bottom FAB ═══ */}
      {showScrollBtn && (
        <div className="relative">
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
            <button
              onClick={scrollToBottom}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-[#1a1a1d] border border-white/[0.1] shadow-lg shadow-black/40 text-[12px] font-medium text-zinc-400 hover:text-white hover:bg-[#222225] hover:border-white/[0.15] transition-all active:scale-[0.95] backdrop-blur-sm"
            >
              <ChevronsDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New messages</span>
            </button>
          </div>
        </div>
      )}

      {/* ═══ Input Bar ═══ */}
      <div className="border-t border-white/[0.04] bg-[#0a0a0b] px-3 py-2">
        <div className="max-w-2xl mx-auto">
          {/* Regenerate button — shows after last assistant message when not loading */}
          {!loading && messages.length >= 2 && messages[messages.length - 1]?.role === "assistant" && (
            <div className="flex justify-center mb-2">
              <button
                onClick={handleRegenerate}
                className="flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-medium text-zinc-500 hover:text-zinc-300 border border-white/[0.06] hover:bg-white/[0.06] transition-all active:scale-[0.95]"
              >
                <RotateCcw className="w-3 h-3" />
                Regenerate
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask anything…"
                rows={1}
                className="w-full resize-none rounded-2xl bg-white/[0.05] border border-white/[0.08] px-4 py-2.5 text-[14px] placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-teal-500/30 focus:border-teal-500/30 transition-all max-h-[120px]"
              />
            </div>
            {loading ? (
              <button
                onClick={handleStop}
                className="w-10 h-10 rounded-full bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-all shrink-0 active:scale-90 ring-1 ring-white/[0.1]"
                title="Stop generating"
              >
                <Square className="w-3.5 h-3.5 text-white fill-white" />
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className="w-10 h-10 rounded-full bg-teal-600 hover:bg-teal-500 disabled:opacity-30 disabled:hover:bg-teal-600 flex items-center justify-center transition-all shrink-0 active:scale-90"
              >
                <ArrowUp className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
          {/* Model selector */}
          <div className="flex items-center gap-2 mt-1.5 px-1">
            <ModelSelector
              provider={chatProvider}
              selectedModel={selectedModel}
              onModelChange={(m) => setSelectedModel(m)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Model picker — compact dropdown below chat input */
const MODEL_OPTIONS: Record<string, { label: string; models: { id: string; name: string; tag?: string }[] }> = {
  gemini: {
    label: "Gemini",
    models: [
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", tag: "default" },
      { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", tag: "fast" },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", tag: "smart" },
    ],
  },
  openai: {
    label: "OpenAI",
    models: [
      { id: "gpt-4o-mini", name: "GPT-4o Mini", tag: "default" },
      { id: "gpt-4o", name: "GPT-4o", tag: "smart" },
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", tag: "new" },
      { id: "gpt-4.1", name: "GPT-4.1", tag: "new" },
      { id: "o4-mini", name: "o4-mini", tag: "reasoning" },
    ],
  },
  openrouter: {
    label: "OpenRouter",
    models: [
      { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", tag: "default" },
      { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", tag: "smart" },
      { id: "anthropic/claude-opus-4", name: "Claude Opus 4", tag: "best" },
      { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", tag: "free" },
      { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash" },
      { id: "mistralai/mistral-large-latest", name: "Mistral Large" },
      { id: "deepseek/deepseek-chat-v3", name: "DeepSeek V3", tag: "cheap" },
      { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B" },
    ],
  },
  ollama: {
    label: "Ollama",
    models: [
      { id: "llama3.2", name: "Llama 3.2", tag: "default" },
      { id: "llama3.1", name: "Llama 3.1" },
      { id: "mistral", name: "Mistral" },
      { id: "gemma2", name: "Gemma 2" },
      { id: "phi3", name: "Phi-3" },
      { id: "qwen2.5", name: "Qwen 2.5" },
    ],
  },
  custom: {
    label: "Custom",
    models: [],
  },
};

function ModelSelector({ provider, selectedModel, onModelChange }: {
  provider: string;
  selectedModel: string;
  onModelChange: (model: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Get available models based on provider (or show all if auto)
  const providerKey = provider === "auto" ? null : provider;
  const sections = providerKey
    ? { [providerKey]: MODEL_OPTIONS[providerKey] }
    : MODEL_OPTIONS;

  // Find current model name
  const currentName = (() => {
    for (const section of Object.values(MODEL_OPTIONS)) {
      const found = section.models.find((m) => m.id === selectedModel);
      if (found) return found.name;
    }
    return selectedModel || "Default";
  })();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 h-6 px-2 rounded-lg text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-all"
      >
        <Sparkles className="w-3 h-3" />
        <span>{currentName}</span>
        <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-56 rounded-xl bg-[#131315]/95 backdrop-blur-lg border border-white/[0.08] shadow-2xl shadow-black/60 overflow-hidden z-50">
          {Object.entries(sections).filter(([, s]) => s).map(([key, section]) => (
            <div key={key}>
              <div className="px-3 pt-2 pb-1">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.08em]">{section!.label}</span>
              </div>
              {section!.models.map((model) => (
                <button
                  key={model.id}
                  onClick={() => { onModelChange(model.id); setOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors",
                    selectedModel === model.id
                      ? "text-teal-300 bg-teal-500/10"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                  )}
                >
                  <span className="flex-1">{model.name}</span>
                  {model.tag && (
                    <span className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded-full font-medium",
                      model.tag === "default" && "text-zinc-500 bg-zinc-500/10",
                      model.tag === "fast" && "text-blue-400 bg-blue-500/10",
                      model.tag === "smart" && "text-amber-400 bg-amber-500/10",
                      model.tag === "new" && "text-emerald-400 bg-emerald-500/10",
                      model.tag === "reasoning" && "text-rose-400 bg-rose-500/10",
                    )}>{model.tag}</span>
                  )}
                  {selectedModel === model.id && <Check className="w-3 h-3 text-teal-400 shrink-0" />}
                </button>
              ))}
            </div>
          ))}
          {selectedModel && (
            <button
              onClick={() => { onModelChange(""); setOpen(false); }}
              className="w-full px-3 py-1.5 text-left text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border-t border-white/[0.06]"
            >
              Reset to default
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Copy button that appears on message hover */
function MessageCopyButton({ content, side }: { content: string; side: "left" | "right" }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(content).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className={cn(
        "absolute -bottom-1 opacity-0 group-hover/msg:opacity-100 transition-all",
        "w-6 h-6 rounded-lg bg-[#111113] border border-white/[0.08] flex items-center justify-center",
        "hover:bg-white/[0.08] active:scale-90 shadow-lg shadow-black/30",
        side === "right" ? "right-0" : "left-0",
      )}
      title="Copy message"
    >
      {copied ? (
        <Check className="w-3 h-3 text-green-400" />
      ) : (
        <Copy className="w-3 h-3 text-zinc-500" />
      )}
    </button>
  );
}

/** Action buttons (Copy + Save to Memory + Regenerate) for assistant messages */
function MessageActions({ content, question, onRegenerate }: { content: string; question: string; onRegenerate?: () => void }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSaveToMemory = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      // Generate a title from the user's question
      const title = question
        ? (question.length > 80 ? question.slice(0, 77) + "…" : question)
        : "Chat Insight";

      const res = await fetch("/api/v1/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents: [
            {
              title: `💡 ${title}`,
              content: content,
              sourceType: "text",
            },
          ],
        }),
      });

      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setSaved(true);
      toast.success(`Saved to memory — ${data.imported || 1} chunk${(data.imported || 1) > 1 ? "s" : ""}`, {
        description: "Find it in Explore",
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute -bottom-1 left-0 flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-all">
      {/* Copy button */}
      <button
        onClick={() => {
          navigator.clipboard.writeText(content).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className={cn(
          "w-6 h-6 rounded-lg bg-[#111113] border border-white/[0.08] flex items-center justify-center",
          "hover:bg-white/[0.08] active:scale-90 shadow-lg shadow-black/30",
        )}
        title="Copy message"
      >
        {copied ? (
          <Check className="w-3 h-3 text-green-400" />
        ) : (
          <Copy className="w-3 h-3 text-zinc-500" />
        )}
      </button>

      {/* Save to Memory button */}
      <button
        onClick={handleSaveToMemory}
        disabled={saving || saved}
        className={cn(
          "h-6 rounded-lg border flex items-center justify-center gap-1 px-1.5",
          "shadow-lg shadow-black/30 active:scale-90 transition-all",
          saved
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 cursor-default"
            : saving
              ? "bg-[#111113] border-white/[0.08] text-zinc-500 cursor-wait"
              : "bg-[#111113] border-white/[0.08] text-zinc-500 hover:bg-teal-500/10 hover:border-teal-500/20 hover:text-teal-400",
        )}
        title={saved ? "Saved to memory" : "Save to memory"}
      >
        {saving ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : saved ? (
          <Check className="w-3 h-3" />
        ) : (
          <BookmarkPlus className="w-3 h-3" />
        )}
        <span className="text-[10px] font-medium leading-none hidden sm:inline">
          {saved ? "Saved" : saving ? "Saving…" : "Save"}
        </span>
      </button>

      {/* Regenerate button */}
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          className={cn(
            "w-6 h-6 rounded-lg bg-[#111113] border border-white/[0.08] flex items-center justify-center",
            "hover:bg-white/[0.08] active:scale-90 shadow-lg shadow-black/30 transition-all",
          )}
          title="Regenerate response"
        >
          <RotateCcw className="w-3 h-3 text-zinc-500" />
        </button>
      )}
    </div>
  );
}

/** Expandable source citations — Perplexity-style with previews & clickable memory drawer */
function SourceCards({
  sources,
  highlightedIndex,
}: {
  sources: Array<{ title: string; type: string; score?: number; id?: string; preview?: string; content?: string }>;
  highlightedIndex?: number | null;
}) {
  const [expanded, setExpanded] = useState(false);

  const displayed = expanded ? sources : sources.slice(0, 3);

  const handleOpenMemory = (s: typeof sources[0], e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (s.id) {
      openMemoryDrawer({
        id: s.id,
        content: s.content || s.preview || "",
        source: s.type,
        sourceId: "",
        sourceTitle: s.title || "Untitled",
        timestamp: "",
        importedAt: "",
        metadata: {},
        pinned: false,
      });
    }
  };

  return (
    <div className="mt-2 pt-2 border-t border-white/[0.06]">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.08em]">
          Sources · {sources.length}
        </span>
        {sources.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-0.5 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {expanded ? "Less" : `+${sources.length - 3} more`}
            {expanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
          </button>
        )}
      </div>
      <div className="space-y-1">
        {displayed.map((s, j) => {
          const st = getSourceType(s.type);
          const Icon = st.icon;
          const scorePercent = s.score != null ? Math.round(s.score * 100) : null;
          const isClickable = !!s.id;
          const isHighlighted = highlightedIndex != null && j === highlightedIndex;

          return (
            <div
              key={j}
              data-source-index={j}
              onClick={isClickable ? (e) => handleOpenMemory(s, e) : undefined}
              className={cn(
                "flex flex-col gap-1 px-2.5 py-2 rounded-lg border transition-all duration-200",
                isHighlighted
                  ? "bg-teal-500/[0.08] border-teal-500/20 ring-1 ring-teal-500/15"
                  : isClickable
                    ? "bg-white/[0.03] border-white/[0.04] hover:bg-white/[0.06] hover:border-white/[0.08] cursor-pointer"
                    : "bg-white/[0.03] border-white/[0.04]",
              )}
            >
              {/* Header row: citation badge + icon + title + score */}
              <div className="flex items-center gap-2">
                {/* Citation number badge */}
                <span className={cn(
                  "text-[9px] font-bold rounded w-4 h-4 flex items-center justify-center shrink-0 tabular-nums transition-colors",
                  isHighlighted
                    ? "bg-teal-500/20 text-teal-300"
                    : "bg-white/[0.06] text-zinc-500"
                )}>
                  {j + 1}
                </span>
                <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${st.bgColor}`}>
                  <Icon className={`w-2.5 h-2.5 ${st.textColor}`} />
                </div>
                <span className={cn(
                  "text-[11px] truncate flex-1 min-w-0 font-medium transition-colors",
                  isHighlighted ? "text-zinc-200" : "text-zinc-400"
                )}>
                  {s.title || "Untitled"}
                </span>
                {scorePercent != null && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="w-8 h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-teal-500/60 transition-all"
                        style={{ width: `${Math.max(scorePercent, 8)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-zinc-600 tabular-nums font-mono w-5 text-right">
                      {scorePercent}%
                    </span>
                  </div>
                )}
              </div>
              {/* Content preview */}
              {s.preview && (
                <p className="text-[10px] text-zinc-600 leading-relaxed line-clamp-2 pl-6">
                  {s.preview}{s.preview.length >= 118 ? "…" : ""}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** History card — a single conversation in the history panel */
function HistoryCard({
  convo, stats, active, renaming, renameValue,
  onLoad, onRename, onRenameSubmit, onRenameCancel, onRenameChange,
  onPin, onExport, onDelete,
}: {
  convo: Conversation;
  stats: { messageCount: number; wordCount: number; userMessages: number; aiMessages: number };
  active: boolean;
  renaming: boolean;
  renameValue: string;
  onLoad: () => void;
  onRename: (id: string) => void;
  onRenameSubmit: (trimmed: string) => void;
  onRenameCancel: () => void;
  onRenameChange: (v: string) => void;
  onPin: (e: React.MouseEvent) => void;
  onExport: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={() => { if (!renaming) onLoad(); }}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-xl transition-all group flex items-start gap-2.5 cursor-pointer relative",
        active
          ? "bg-teal-500/10 border border-teal-500/20"
          : "hover:bg-white/[0.04] border border-transparent"
      )}
    >
      {/* Icon */}
      <div className="relative shrink-0 mt-0.5">
        {convo.pinned ? (
          <Pin className={cn("w-3.5 h-3.5", active ? "text-amber-400" : "text-amber-500/60")} />
        ) : (
          <MessageSquare className={cn("w-3.5 h-3.5", active ? "text-teal-400" : "text-zinc-600")} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {renaming ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = renameValue.trim();
              if (trimmed) onRenameSubmit(trimmed);
              else onRenameCancel();
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => onRenameChange(e.target.value)}
              onBlur={() => {
                const trimmed = renameValue.trim();
                if (trimmed) onRenameSubmit(trimmed);
                else onRenameCancel();
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") { e.stopPropagation(); onRenameCancel(); }
              }}
              className="w-full text-[13px] bg-white/[0.06] border border-teal-500/30 rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-teal-500/40 text-white"
            />
          </form>
        ) : (
          <p
            className={cn(
              "text-[13px] truncate",
              active ? "text-white font-medium" : "text-zinc-400"
            )}
            onDoubleClick={(e) => { e.stopPropagation(); onRename(convo.id); }}
          >
            {convo.title}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-0.5">
          <Clock className="w-2.5 h-2.5 text-zinc-700" />
          <span className="text-[10px] text-zinc-600">{formatRelativeTime(convo.updatedAt)}</span>
          <span className="text-[10px] text-zinc-700">· {stats.messageCount} msg</span>
          <span className="text-[10px] text-zinc-700">· {stats.wordCount >= 1000 ? `${(stats.wordCount / 1000).toFixed(1)}k` : stats.wordCount} words</span>
        </div>
      </div>

      {/* Action buttons (hover-reveal) */}
      {!renaming && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
          <button
            onClick={onPin}
            className="p-1 rounded-lg hover:bg-amber-500/10 transition-all"
            title={convo.pinned ? "Unpin" : "Pin"}
          >
            {convo.pinned ? (
              <PinOff className="w-2.5 h-2.5 text-amber-400 hover:text-amber-300" />
            ) : (
              <Pin className="w-2.5 h-2.5 text-zinc-600 hover:text-amber-400" />
            )}
          </button>
          <button
            onClick={onExport}
            className="p-1 rounded-lg hover:bg-white/[0.08] transition-all"
            title="Export as markdown"
          >
            <Download className="w-2.5 h-2.5 text-zinc-600 hover:text-zinc-400" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRename(convo.id); }}
            className="p-1 rounded-lg hover:bg-white/[0.08] transition-all"
            title="Rename"
          >
            <Pencil className="w-2.5 h-2.5 text-zinc-600 hover:text-zinc-400" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded-lg hover:bg-red-500/10 transition-all"
            title="Delete"
          >
            <Trash2 className="w-3 h-3 text-zinc-600 hover:text-red-400" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Format a timestamp to relative time (e.g. "2m ago", "3h ago", "yesterday") */
function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
