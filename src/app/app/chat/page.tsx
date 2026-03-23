"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Send, Loader2, Brain, User, Sparkles, ArrowUp,
  Plus, History, Trash2, X, MessageSquare, Clock,
} from "lucide-react";
import { streamChat, checkApiKey } from "@/lib/openai";
import { ChatMarkdown } from "@/components/ChatMarkdown";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  type ChatMessage,
  type Conversation,
  getConversations,
  getConversation,
  createConversation,
  saveConversation,
  deleteConversation,
  clearAllConversations,
} from "@/lib/chat-history";

const SUGGESTIONS = [
  "What topics have I explored most?",
  "Summarize my key interests",
  "What did I learn recently?",
  "Connections between my ideas?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [memoryCount, setMemoryCount] = useState(0);
  const [hasAI, setHasAI] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load stats & conversations on mount
  useEffect(() => {
    fetch("/api/v1/stats")
      .then((r) => r.json())
      .then((d) => setMemoryCount(d.totalMemories || 0))
      .catch(() => {});
    checkApiKey().then((d) => setHasAI(d.hasApiKey));
    refreshHistory();
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

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

    setInput("");
    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: query },
    ];
    setMessages(newMessages);
    setLoading(true);

    try {
      const searchRes = await fetch(
        `/api/v1/search?q=${encodeURIComponent(query)}&limit=8`
      );
      if (!searchRes.ok) throw new Error("Search failed");
      const { results = [] } = await searchRes.json();

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
            })),
          },
        ];
        setMessages(updated);
        setLoading(false);
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
          })),
        },
      ];
      setMessages(withPlaceholder);

      for await (const chunk of streamChat(ragMessages)) {
        fullResponse += chunk;
        setMessages((prev) => {
          const u = [...prev];
          u[u.length - 1] = { ...u[u.length - 1], content: fullResponse };
          return u;
        });
      }
    } catch (err: any) {
      toast.error(err.message);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const activeConversations = conversations.filter(
    (c) => c.messages.length > 0
  );

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
          {activeConversations.length > 0 && (
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className={cn(
                "flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-all active:scale-[0.96]",
                historyOpen
                  ? "text-violet-300 bg-violet-500/10"
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
          onClick={() => setHistoryOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="absolute top-0 right-0 h-full w-[280px] sm:w-[320px] bg-[#111113] border-l border-white/[0.06] shadow-2xl shadow-black/60 animate-in slide-in-from-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <h3 className="text-[14px] font-semibold">Chat History</h3>
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
                  onClick={() => setHistoryOpen(false)}
                  className="p-1.5 hover:bg-white/[0.06] rounded-lg"
                >
                  <X className="w-4 h-4 text-zinc-500" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto h-[calc(100%-52px)] py-2 px-2">
              {activeConversations.length === 0 ? (
                <p className="text-center text-[12px] text-zinc-600 py-8">
                  No conversations yet
                </p>
              ) : (
                <div className="space-y-0.5">
                  {activeConversations.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleLoadConversation(c.id)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-xl transition-all group flex items-start gap-2.5",
                        conversationId === c.id
                          ? "bg-violet-500/10 border border-violet-500/20"
                          : "hover:bg-white/[0.04] border border-transparent"
                      )}
                    >
                      <MessageSquare
                        className={cn(
                          "w-3.5 h-3.5 shrink-0 mt-0.5",
                          conversationId === c.id
                            ? "text-violet-400"
                            : "text-zinc-600"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-[13px] truncate",
                            conversationId === c.id
                              ? "text-white font-medium"
                              : "text-zinc-400"
                          )}
                        >
                          {c.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-2.5 h-2.5 text-zinc-700" />
                          <span className="text-[10px] text-zinc-600">
                            {formatRelativeTime(c.updatedAt)}
                          </span>
                          <span className="text-[10px] text-zinc-700">
                            · {c.messages.length} msg
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteConversation(c.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-500/10 transition-all shrink-0"
                      >
                        <Trash2 className="w-3 h-3 text-zinc-600 hover:text-red-400" />
                      </button>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Messages Area ═══ */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center h-full px-6 pb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5 text-violet-400" />
            </div>
            <h2 className="text-[15px] font-medium text-zinc-300 mb-1">
              Ask your mind
            </h2>
            <p className="text-[12px] text-zinc-600 mb-6">
              {memoryCount > 0 ? (
                `Search across ${memoryCount.toLocaleString()} memories`
              ) : (
                <Link
                  href="/app/import"
                  className="text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Import knowledge to start →
                </Link>
              )}
            </p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-left text-[12px] leading-snug p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] text-zinc-500 transition-all active:scale-[0.97]"
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Recent conversations quick-access */}
            {activeConversations.length > 0 && (
              <div className="mt-8 w-full max-w-xs">
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.08em] mb-2 px-1">
                  Recent conversations
                </p>
                <div className="space-y-1">
                  {activeConversations.slice(0, 3).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleLoadConversation(c.id)}
                      className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] transition-all active:scale-[0.98]"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
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
                className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Brain className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                )}
                <div
                  className={`max-w-[82%] ${
                    msg.role === "user"
                      ? "rounded-[20px] rounded-br-md bg-violet-600 text-white px-4 py-2.5"
                      : "rounded-[20px] rounded-bl-md bg-white/[0.04] border border-white/[0.06] px-4 py-2.5"
                  }`}
                >
                  <div className="text-[13px] leading-[1.6]">
                    {msg.content ? (
                      <ChatMarkdown content={msg.content} />
                    ) : loading && i === messages.length - 1 ? (
                      <span className="flex items-center gap-2 text-zinc-500">
                        <span className="flex gap-1">
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"
                            style={{ animationDelay: "0ms" }}
                          />
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"
                            style={{ animationDelay: "150ms" }}
                          />
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"
                            style={{ animationDelay: "300ms" }}
                          />
                        </span>
                      </span>
                    ) : (
                      ""
                    )}
                  </div>
                  {msg.sources &&
                    msg.sources.length > 0 &&
                    msg.content && (
                      <div className="mt-2 pt-2 border-t border-white/[0.06]">
                        <div className="flex flex-wrap gap-1">
                          {msg.sources.slice(0, 3).map((s, j) => (
                            <span
                              key={j}
                              className="text-[10px] px-2 py-[3px] rounded-full bg-white/[0.06] text-zinc-400"
                            >
                              {s.title.slice(0, 20)}
                              {s.title.length > 20 ? "…" : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-xl bg-violet-600/20 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-violet-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ Input Bar ═══ */}
      <div className="border-t border-white/[0.04] bg-[#0a0a0b] px-3 py-2">
        <div className="max-w-2xl mx-auto flex items-end gap-2">
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
              className="w-full resize-none rounded-2xl bg-white/[0.05] border border-white/[0.08] px-4 py-2.5 text-[14px] placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500/30 focus:border-violet-500/30 transition-all max-h-[120px]"
            />
          </div>
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-full bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:hover:bg-violet-600 flex items-center justify-center transition-all shrink-0 active:scale-90"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <ArrowUp className="w-4 h-4 text-white" />
            )}
          </button>
        </div>
      </div>
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
