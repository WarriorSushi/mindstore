"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Brain, User, Plus, Upload, Key,
  ChevronsDown, Search, Lightbulb, TrendingUp,
  MessageSquare, RotateCcw, Copy, Check, Swords,
} from "lucide-react";
import { streamChat, checkApiKey } from "@/lib/openai";
import { ChatMarkdown } from "@/components/ChatMarkdown";
import { openMemoryDrawer } from "@/components/MemoryDrawer";
import { NoAIBanner } from "@/components/ErrorBoundary";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/lib/use-page-title";
import { track } from "@/lib/analytics";
import {
  ChatSidebar,
  ChatInput,
  AssistantMessageActions,
  UserMessageActions,
  SourceCards,
  ModelSwitcher,
  ThinkingIndicator,
  PulsingDots,
} from "@/components/chat";
import {
  type ChatMessage,
  type Conversation,
  getConversations,
  getConversation,
  createConversation,
  saveConversation,
  deleteConversation,
} from "@/lib/chat-history";

/* ─── Suggestion prompts for empty state ─── */
const SUGGESTION_GROUPS = [
  {
    icon: Search,
    color: "text-teal-400 bg-teal-500/10",
    items: [
      "What topics have I explored most?",
      "Summarize my key interests",
    ],
  },
  {
    icon: Lightbulb,
    color: "text-sky-400 bg-sky-500/10",
    items: [
      "What did I learn recently?",
      "Connections between my ideas?",
    ],
  },
  {
    icon: TrendingUp,
    color: "text-teal-300 bg-teal-400/10",
    items: [
      "How have my ideas evolved?",
      "What patterns do you see?",
    ],
  },
];

/* ─── Greeting based on time ─── */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Late night thinking";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Late night thinking";
}

/* ─── Generate follow-up suggestions after a response ─── */
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
              "Generate exactly 3 short follow-up questions a user might ask next, based on the conversation. Each question should be concise (under 10 words), curious, and explore different angles. Return ONLY a JSON array of 3 strings, nothing else.",
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

    const match = full.match(/\[[\s\S]*?\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((q: unknown) => typeof q === "string" && (q as string).trim().length > 0)
      .slice(0, 3);
  } catch {
    return [];
  }
}

/* ═══════════════════════════════════════════════════════════
 *  ChatPage — premium chat experience with sidebar + chat
 * ═══════════════════════════════════════════════════════════ */
export default function ChatPage() {
  usePageTitle("Chat");

  /* ─── State ─── */
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [memoryCount, setMemoryCount] = useState(0);
  const [hasAI, setHasAI] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [chatProvider, setChatProvider] = useState<string>("auto");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const autoSentRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const followUpAbortRef = useRef<AbortController | null>(null);

  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const isNearBottomRef = useRef(true);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [followUpsLoading, setFollowUpsLoading] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [thinkingStep, setThinkingStep] = useState<"searching" | "found" | "generating" | null>(null);
  const [searchResultCount, setSearchResultCount] = useState(0);
  const [highlightedCitation, setHighlightedCitation] = useState<{ msgIndex: number; sourceIndex: number } | null>(null);
  const [copiedChat, setCopiedChat] = useState(false);
  const [devilMode, setDevilMode] = useState(false);

  /* ─── Init: load stats, AI config, history ─── */
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

  /* ─── Listen for Command Palette events ─── */
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Auto-send from ?q= param ─── */
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !autoSentRef.current && memoryCount > 0) {
      autoSentRef.current = true;
      const url = new URL(window.location.href);
      url.searchParams.delete("q");
      window.history.replaceState(null, "", url.toString());
      setTimeout(() => handleSend(q), 200);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, memoryCount]);

  /* ─── Auto-scroll on new messages ─── */
  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  /* ─── Scroll position detection ─── */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onScroll() {
      if (!el) return;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      isNearBottomRef.current = nearBottom;
      setShowScrollBtn(!nearBottom && messages.length > 0);
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [messages.length]);

  /* ─── Persist messages on change ─── */
  useEffect(() => {
    if (!conversationId || messages.length === 0) return;
    const t = setTimeout(() => {
      saveConversation(conversationId, messages);
      refreshHistory();
    }, 300);
    return () => clearTimeout(t);
  }, [messages, conversationId]);

  /* ─── Keyboard shortcuts: ⌘+N for new chat, Escape to close mobile sidebar ─── */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // ⌘+N or Ctrl+N → new chat
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        handleNewChat();
      }
      // Escape → close mobile sidebar
      if (e.key === "Escape" && mobileSidebarOpen) {
        setMobileSidebarOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileSidebarOpen]);

  /* ─── Initial sidebar state: collapsed on mobile ─── */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    if (mq.matches) {
      setSidebarCollapsed(true);
    }
    function onChange(e: MediaQueryListEvent) {
      if (e.matches) setSidebarCollapsed(true);
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  function refreshHistory() {
    setConversations(getConversations());
  }

  /* ─── Chat actions ─── */
  function handleNewChat() {
    setMessages([]);
    setConversationId(null);
    setFollowUps([]);
    setFollowUpsLoading(false);
    setThinkingStep(null);
    setSearchResultCount(0);
    setMobileSidebarOpen(false);
    if (followUpAbortRef.current) followUpAbortRef.current.abort();
  }

  function handleLoadConversation(id: string) {
    const convo = getConversation(id);
    if (!convo) return;
    setConversationId(id);
    setMessages(convo.messages);
    setMobileSidebarOpen(false);
    setFollowUps([]);
  }

  const handleSend = async (text?: string) => {
    const query = (text || input).trim();
    if (!query || loading) return;
    if (memoryCount === 0) {
      toast.error("Import some knowledge first");
      return;
    }
    track.aiQuery(chatProvider || 'auto');
    if (devilMode) track.devilAdvocate();

    let cid = conversationId;
    if (!cid) {
      cid = createConversation();
      setConversationId(cid);
    }

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

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const searchRes = await fetch(
        `/api/v1/search?q=${encodeURIComponent(query)}&limit=8`,
        { signal: abortController.signal },
      );
      if (!searchRes.ok) throw new Error("Search failed");
      const { results = [] } = await searchRes.json();
      setSearchResultCount(results.length);
      if (results.length > 0) {
        setThinkingStep("found");
        await new Promise((r) => setTimeout(r, 600));
      } else {
        setThinkingStep(null);
      }

      if (results.length === 0) {
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content:
              "I couldn't find anything relevant in your knowledge base. Try importing more content or rephrasing your question.",
          },
        ]);
        setLoading(false);
        setThinkingStep(null);
        abortRef.current = null;
        return;
      }

      if (!hasAI) {
        const searchResponse = results
          .map(
            (r: any, i: number) =>
              `[${i + 1}] ${r.sourceTitle || "Untitled"} (${r.sourceType})\n${r.content}`,
          )
          .join("\n\n");
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: `Found ${results.length} relevant memories:\n\n${searchResponse}\n\nConnect an AI provider in Settings for synthesized answers.`,
            sources: results.map((r: any) => ({
              title: r.sourceTitle || "",
              type: r.sourceType,
              score: r.score,
              id: r.memoryId || r.id || "",
              preview: (r.content || "").slice(0, 120).replace(/\n/g, " ").trim(),
              content: r.content || "",
            })),
          },
        ]);
        setLoading(false);
        setThinkingStep(null);
        abortRef.current = null;
        return;
      }

      const context = results
        .map(
          (r: any, i: number) =>
            `[${i + 1}] "${r.sourceTitle}" (${r.sourceType})\n${r.content}`,
        )
        .join("\n\n---\n\n");

      const ragMessages = [
        {
          role: "system",
          content: devilMode
            ? `You are the Devil's Advocate for MindStore. Your job is to challenge the user's stated beliefs, assumptions, and conclusions using ONLY evidence found in their own knowledge base.

Rules:
- Find contradictions, counterevidence, and overlooked nuances in the provided context
- Point out where the user's sources disagree with each other
- Highlight evidence that challenges the user's premise
- Do NOT make up facts — work only from the provided context
- Be direct but not dismissive — this is steel-manning the opposition
- Use citations [1], [2] etc. for each challenge
- Open with the strongest counterpoint first
- End with a genuine question that the user should sit with`
            : "You are MindStore, a personal knowledge assistant. Answer based ONLY on the user's stored knowledge. Cite sources as [1], [2]. Be concise. Highlight unexpected connections.",
        },
        {
          role: "user",
          content: devilMode
            ? `Context from my knowledge base:\n\n${context}\n\n---\n\nChallenge my assumption or belief in this statement/question: ${query}`
            : `Context from my knowledge base:\n\n${context}\n\n---\n\nQuestion: ${query}`,
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

      // Generate follow-up suggestions
      if (fullResponse.length > 20) {
        setFollowUpsLoading(true);
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
        setThinking(false);
        setThinkingStep(null);
        setFollowUps([]);
        setFollowUpsLoading(false);
        if (followUpAbortRef.current) followUpAbortRef.current.abort();
        setMessages((prev) => {
          const u = [...prev];
          const last = u[u.length - 1];
          if (last && last.role === "assistant" && !last.content) {
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

  const handleStop = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
  }, []);

  const handleRegenerateAt = useCallback(
    (messageIndex: number) => {
      const userMsg = messages
        .slice(0, messageIndex)
        .reverse()
        .find((m) => m.role === "user");
      if (!userMsg) return;
      setMessages((prev) => prev.slice(0, messageIndex));
      setTimeout(() => handleSend(userMsg.content), 50);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages],
  );

  const handleRegenerate = useCallback(() => {
    if (loading || messages.length < 2) return;
    const lastUserIdx = messages
      .map((m, i) => ({ role: m.role, i }))
      .filter((x) => x.role === "user")
      .pop();
    if (!lastUserIdx) return;
    const query = messages[lastUserIdx.i].content;
    setMessages(messages.slice(0, lastUserIdx.i));
    setFollowUps([]);
    setFollowUpsLoading(false);
    if (followUpAbortRef.current) followUpAbortRef.current.abort();
    setTimeout(() => handleSend(query), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, messages]);

  const handleDeleteMessage = useCallback(
    (index: number) => {
      setMessages((prev) => prev.filter((_, i) => i !== index));
    },
    [],
  );

  const handleCopyConversation = useCallback(() => {
    if (messages.length === 0) return;
    const md = messages
      .map((m) => `${m.role === "user" ? "**You**" : "**MindStore**"}:\n${m.content}`)
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(md).then(() => {
      setCopiedChat(true);
      setTimeout(() => setCopiedChat(false), 1500);
      toast.success("Conversation copied");
    });
  }, [messages]);

  const activeConversations = conversations.filter((c) => c.messages.length > 0);

  /* ═══════════════════════════════════════════
   *  RENDER
   * ═══════════════════════════════════════════ */
  return (
    <div className="flex h-full overflow-hidden">
      {/* ─── Mobile sidebar overlay ─── */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-[60] md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="absolute top-0 left-0 h-full animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <ChatSidebar
              conversations={conversations}
              activeId={conversationId}
              collapsed={false}
              onToggle={() => setMobileSidebarOpen(false)}
              onNewChat={handleNewChat}
              onLoadConversation={handleLoadConversation}
              onRefreshHistory={refreshHistory}
            />
          </div>
        </div>
      )}

      {/* ─── Desktop sidebar ─── */}
      <div className="hidden md:block shrink-0">
        <ChatSidebar
          conversations={conversations}
          activeId={conversationId}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((p) => !p)}
          onNewChat={handleNewChat}
          onLoadConversation={handleLoadConversation}
          onRefreshHistory={refreshHistory}
        />
      </div>

      {/* ─── Main chat area ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ═══ Header ═══ */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] shrink-0 bg-[#0a0a0b]/80 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[13px] font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all active:scale-[0.97]"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New chat</span>
            </button>
            {/* Memory count badge */}
            {memoryCount > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-[11px] text-zinc-500">
                <Brain className="w-3 h-3 text-teal-500/70" />
                <span className="tabular-nums">{memoryCount.toLocaleString()}</span>
                <span className="text-zinc-600">memories</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Devil's Advocate toggle */}
            {hasAI && memoryCount > 0 && (
              <button
                onClick={() => setDevilMode((p) => !p)}
                title={devilMode ? "Devil's Advocate mode ON — click to disable" : "Enable Devil's Advocate mode — challenge your own beliefs"}
                className={cn(
                  "flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-[13px] font-medium transition-all active:scale-[0.97]",
                  devilMode
                    ? "bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]",
                )}
              >
                <Swords className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {devilMode ? "Devil's Advocate" : "Devil's Advocate"}
                </span>
              </button>
            )}
            {messages.length > 0 && (
              <button
                onClick={handleCopyConversation}
                className="flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-[13px] font-medium text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all active:scale-[0.97]"
                title="Copy conversation"
              >
                {copiedChat ? (
                  <Check className="w-4 h-4 text-teal-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* ═══ Devil's Advocate active banner ═══ */}
        {devilMode && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-amber-500/20 bg-amber-500/[0.05] shrink-0">
            <Swords className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[12px] text-amber-400/80 leading-snug">
              <strong className="text-amber-300">Devil&apos;s Advocate</strong> — I&apos;ll challenge your beliefs using your own knowledge. Ask a statement, assumption, or claim.
            </span>
          </div>
        )}

        {/* ═══ Messages area ═══ */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth">
          {messages.length === 0 ? (
            /* ─── Empty state ─── */
            <div className="flex flex-col items-center justify-center h-full px-6 pb-8">
              {memoryCount === 0 && !hasAI ? (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-teal-500/[0.08] flex items-center justify-center mb-4 ring-1 ring-teal-500/10">
                    <MessageSquare className="w-6 h-6 text-teal-400/80" />
                  </div>
                  <h2 className="text-[18px] font-semibold text-zinc-200 mb-1.5 tracking-[-0.02em]">
                    Chat with your knowledge
                  </h2>
                  <p className="text-[14px] text-zinc-500 max-w-xs text-center leading-relaxed mb-8">
                    Import your conversations and connect an AI provider to start asking questions.
                  </p>
                  <div className="flex items-center gap-3">
                    <Link
                      href="/app/import"
                      className="h-10 px-5 rounded-xl bg-teal-600 hover:bg-teal-500 text-[13px] font-medium text-white transition-all active:scale-[0.97] flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Import data
                    </Link>
                    <Link
                      href="/app/settings"
                      className="h-10 px-5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-[13px] text-zinc-400 font-medium transition-all active:scale-[0.97] flex items-center gap-2"
                    >
                      <Key className="w-4 h-4" />
                      Connect AI
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-teal-500/[0.08] flex items-center justify-center mb-4 ring-1 ring-teal-500/10">
                    <Brain className="w-6 h-6 text-teal-400/80" />
                  </div>
                  <h2 className="text-[18px] font-semibold text-zinc-200 mb-1 tracking-[-0.02em]">
                    {getGreeting()}
                  </h2>
                  <p className="text-[14px] text-zinc-500 mb-8">
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

                  {!hasAI && memoryCount > 0 && (
                    <div className="w-full max-w-sm mb-6">
                      <NoAIBanner />
                    </div>
                  )}

                  {/* Suggestion prompts */}
                  <div className="w-full max-w-lg grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {SUGGESTION_GROUPS.flatMap((group) =>
                      group.items.map((s) => (
                        <button
                          key={s}
                          onClick={() => handleSend(s)}
                          className={cn(
                            "text-left text-[13px] leading-snug px-4 py-3 rounded-2xl transition-all active:scale-[0.98]",
                            "flex items-center gap-3",
                            "border border-white/[0.06]",
                            "bg-white/[0.02] hover:bg-white/[0.05]",
                            "text-zinc-400 hover:text-zinc-200",
                          )}
                        >
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${group.color.split(" ").slice(1).join(" ")}`}
                          >
                            <group.icon className={`w-4 h-4 ${group.color.split(" ")[0]}`} />
                          </div>
                          <span>{s}</span>
                        </button>
                      )),
                    )}
                  </div>

                  {/* Recent conversations quick-access */}
                  {activeConversations.length > 0 && (
                    <div className="mt-8 w-full max-w-sm">
                      <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.08em] mb-2 px-1">
                        {activeConversations.some((c) => c.pinned)
                          ? "Pinned & recent"
                          : "Recent conversations"}
                      </p>
                      <div className="space-y-1">
                        {activeConversations.slice(0, 3).map((c) => (
                          <button
                            key={c.id}
                            onClick={() => handleLoadConversation(c.id)}
                            className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] transition-all active:scale-[0.98]"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                            <span className="text-[13px] text-zinc-400 truncate flex-1">
                              {c.title}
                            </span>
                            <span className="text-[11px] text-zinc-700 shrink-0">
                              {formatRelativeTime(c.updatedAt)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            /* ─── Message list ─── */
            <div className="px-4 py-6 space-y-6 max-w-2xl mx-auto">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex gap-3 group/msg animate-in fade-in slide-in-from-bottom-2 duration-300",
                    msg.role === "user" ? "justify-end" : "",
                  )}
                  style={{ animationDelay: `${Math.min(i * 30, 150)}ms`, animationFillMode: "backwards" }}
                >
                  {/* AI avatar */}
                  {msg.role === "assistant" && (
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ring-1 transition-colors",
                      devilMode
                        ? "bg-amber-500/[0.10] ring-amber-500/15"
                        : "bg-teal-500/[0.08] ring-teal-500/10",
                    )}>
                      {devilMode
                        ? <Swords className="w-4 h-4 text-amber-400" />
                        : <Brain className="w-4 h-4 text-teal-400" />}
                    </div>
                  )}

                  <div className="relative max-w-[85%] sm:max-w-[80%] min-w-0">
                    {/* Message bubble */}
                    <div
                      className={cn(
                        "overflow-hidden",
                        msg.role === "user"
                          ? "rounded-2xl rounded-br-lg bg-teal-900/10 border border-teal-500/10 text-zinc-100 px-4 py-3"
                          : "rounded-2xl rounded-bl-lg bg-zinc-900 border border-white/[0.06] px-4 py-3",
                      )}
                    >
                      <div className="text-[14px] leading-[1.7] break-words [overflow-wrap:anywhere]">
                        {msg.content ? (
                          <ChatMarkdown
                            content={msg.content}
                            {...(msg.role === "assistant" && msg.sources?.length
                              ? {
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
                                }
                              : {})}
                          />
                        ) : loading && i === messages.length - 1 ? (
                          <PulsingDots />
                        ) : (
                          ""
                        )}
                      </div>
                    </div>

                    {/* Source citations */}
                    {msg.role === "assistant" &&
                      msg.sources &&
                      msg.sources.length > 0 &&
                      msg.content && (
                        <div className="mt-2">
                          <SourceCards
                            sources={msg.sources}
                            highlightedIndex={
                              highlightedCitation?.msgIndex === i
                                ? highlightedCitation.sourceIndex
                                : null
                            }
                          />
                        </div>
                      )}

                    {/* Action buttons */}
                    {msg.content &&
                      (msg.role === "assistant" ? (
                        <AssistantMessageActions
                          content={msg.content}
                          question={
                            messages
                              .slice(0, i)
                              .reverse()
                              .find((m) => m.role === "user")?.content || ""
                          }
                          onRegenerate={!loading ? () => handleRegenerateAt(i) : undefined}
                          onDelete={() => handleDeleteMessage(i)}
                        />
                      ) : (
                        <UserMessageActions
                          content={msg.content}
                          onDelete={() => handleDeleteMessage(i)}
                        />
                      ))}
                  </div>

                  {/* User avatar */}
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-xl bg-teal-600/20 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-teal-300" />
                    </div>
                  )}
                </div>
              ))}

              {/* Thinking indicator */}
              {loading &&
                messages.length > 0 &&
                messages[messages.length - 1]?.role === "user" && (
                  <div className="flex gap-3 animate-in fade-in duration-300">
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ring-1 transition-colors",
                      devilMode
                        ? "bg-amber-500/[0.10] ring-amber-500/15"
                        : "bg-teal-500/[0.08] ring-teal-500/10",
                    )}>
                      {devilMode
                        ? <Swords className="w-4 h-4 text-amber-400" />
                        : <Brain className="w-4 h-4 text-teal-400" />}
                    </div>
                    <div className="rounded-2xl rounded-bl-lg bg-zinc-900 border border-white/[0.06] px-4 py-3">
                      <ThinkingIndicator
                        step={thinkingStep}
                        searchResultCount={searchResultCount}
                      />
                    </div>
                  </div>
                )}

              {/* Follow-up suggestions */}
              {!loading &&
                messages.length >= 2 &&
                messages[messages.length - 1]?.role === "assistant" && (
                  <div className="flex gap-2 flex-wrap pl-11">
                    {followUpsLoading ? (
                      <div className="flex items-center gap-1.5 h-8 px-3 rounded-full border border-white/[0.06] bg-white/[0.02]">
                        <PulsingDots label="Thinking of follow-ups…" />
                      </div>
                    ) : followUps.length > 0 ? (
                      followUps.map((fu, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setFollowUps([]);
                            handleSend(fu);
                          }}
                          className="text-left text-[13px] leading-snug px-4 py-2 rounded-full border border-teal-500/15 bg-teal-500/[0.06] text-teal-300 hover:bg-teal-500/[0.12] hover:border-teal-500/25 transition-all active:scale-[0.97] max-w-[280px] truncate"
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

        {/* ═══ Scroll to bottom FAB ═══ */}
        {showScrollBtn && (
          <div className="relative">
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
              <button
                onClick={scrollToBottom}
                className="flex items-center gap-1.5 h-9 px-4 rounded-full bg-[#18181b] border border-white/[0.1] shadow-xl shadow-black/50 text-[13px] font-medium text-zinc-400 hover:text-white hover:bg-[#222225] hover:border-white/[0.15] transition-all active:scale-[0.95] backdrop-blur-sm"
              >
                <ChevronsDown className="w-4 h-4" />
                <span className="hidden sm:inline">New messages</span>
              </button>
            </div>
          </div>
        )}

        {/* ═══ Input area ═══ */}
        <div className="border-t border-white/[0.06] bg-[#0a0a0b] px-4 py-3 shrink-0">
          <div className="max-w-2xl mx-auto">
            {/* Regenerate button */}
            {!loading &&
              messages.length >= 2 &&
              messages[messages.length - 1]?.role === "assistant" && (
                <div className="flex justify-center mb-2">
                  <button
                    onClick={handleRegenerate}
                    className="flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[12px] font-medium text-zinc-500 hover:text-zinc-300 border border-white/[0.06] hover:bg-white/[0.06] transition-all active:scale-[0.95]"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Regenerate
                  </button>
                </div>
              )}

            <ChatInput
              value={input}
              onChange={setInput}
              onSend={handleSend}
              onStop={handleStop}
              loading={loading}
              disabled={memoryCount === 0 && !hasAI}
            />

            {/* Model switcher */}
            <div className="flex items-center justify-between mt-1 px-1">
              <ModelSwitcher
                provider={chatProvider}
                selectedModel={selectedModel}
                onModelChange={(m) => setSelectedModel(m)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Utility ─── */
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
