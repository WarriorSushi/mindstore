"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Brain, User, Sparkles, ArrowUp } from "lucide-react";
import { streamChat, checkApiKey } from "@/lib/openai";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; type: string; score: number }[];
}

const SUGGESTIONS = [
  "What topics have I explored most?",
  "Summarize my key interests",
  "What did I learn recently?",
  "Connections between my ideas?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [memoryCount, setMemoryCount] = useState(0);
  const [hasAI, setHasAI] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch('/api/v1/stats').then(r => r.json()).then(d => setMemoryCount(d.totalMemories || 0)).catch(() => {});
    checkApiKey().then(d => setHasAI(d.hasApiKey));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const handleSend = async (text?: string) => {
    const query = (text || input).trim();
    if (!query || loading) return;
    if (memoryCount === 0) { toast.error("Import some knowledge first"); return; }

    setInput("");
    setMessages(prev => [...prev, { role: "user", content: query }]);
    setLoading(true);

    try {
      const searchRes = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}&limit=8`);
      if (!searchRes.ok) throw new Error('Search failed');
      const { results = [] } = await searchRes.json();

      if (results.length === 0) {
        setMessages(prev => [...prev, { role: "assistant", content: "I couldn't find anything relevant in your knowledge base. Try importing more content or rephrasing your question." }]);
        setLoading(false);
        return;
      }

      // If no AI provider configured, show search results directly
      if (!hasAI) {
        const searchResponse = results.map((r: any, i: number) =>
          `**[${i + 1}] ${r.sourceTitle || 'Untitled'}** _(${r.sourceType})_\n${r.content}`
        ).join('\n\n---\n\n');

        setMessages(prev => [...prev, {
          role: "assistant",
          content: `Here's what I found in your knowledge base:\n\n${searchResponse}\n\n_💡 Connect an AI provider in Settings for synthesized answers._`,
          sources: results.map((r: any) => ({ title: r.sourceTitle || '', type: r.sourceType, score: r.score })),
        }]);
        setLoading(false);
        return;
      }

      const context = results.map((r: any, i: number) =>
        `[${i + 1}] "${r.sourceTitle}" (${r.sourceType})\n${r.content}`
      ).join('\n\n---\n\n');

      const ragMessages = [
        { role: 'system', content: `You are MindStore, a personal knowledge assistant. Answer based ONLY on the user's stored knowledge. Cite sources as [1], [2]. Be concise. Highlight unexpected connections.` },
        { role: 'user', content: `Context from my knowledge base:\n\n${context}\n\n---\n\nQuestion: ${query}` },
      ];

      let fullResponse = "";
      setMessages(prev => [...prev, {
        role: "assistant", content: "",
        sources: results.map((r: any) => ({ title: r.sourceTitle || '', type: r.sourceType, score: r.score })),
      }]);

      for await (const chunk of streamChat(ragMessages)) {
        fullResponse += chunk;
        setMessages(prev => {
          const u = [...prev];
          u[u.length - 1] = { ...u[u.length - 1], content: fullResponse };
          return u;
        });
      }
    } catch (err: any) {
      toast.error(err.message);
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center h-full px-6 pb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5 text-violet-400" />
            </div>
            <h2 className="text-[15px] font-medium text-zinc-300 mb-1">Ask your mind</h2>
            <p className="text-[12px] text-zinc-600 mb-6">
              {memoryCount > 0 ? `Search across ${memoryCount.toLocaleString()} memories` : "Import knowledge to start"}
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
          </div>
        ) : (
          /* Message List */
          <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Brain className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                )}
                <div className={`max-w-[82%] ${
                  msg.role === "user"
                    ? "rounded-[20px] rounded-br-md bg-violet-600 text-white px-4 py-2.5"
                    : "rounded-[20px] rounded-bl-md bg-white/[0.04] border border-white/[0.06] px-4 py-2.5"
                }`}>
                  <div className="text-[13px] leading-[1.6] whitespace-pre-wrap">
                    {msg.content || (loading && i === messages.length - 1 ? (
                      <span className="flex items-center gap-2 text-zinc-500">
                        <span className="flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </span>
                      </span>
                    ) : "")}
                  </div>
                  {msg.sources && msg.sources.length > 0 && msg.content && (
                    <div className="mt-2 pt-2 border-t border-white/[0.06]">
                      <div className="flex flex-wrap gap-1">
                        {msg.sources.slice(0, 3).map((s, j) => (
                          <span key={j} className="text-[10px] px-2 py-[3px] rounded-full bg-white/[0.06] text-zinc-400">
                            {s.title.slice(0, 20)}{s.title.length > 20 ? "…" : ""}
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

      {/* Input Bar — sticky to bottom */}
      <div className="border-t border-white/[0.04] bg-[#0a0a0b] px-3 py-2.5 safe-bottom">
        <div className="max-w-2xl mx-auto flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="Ask anything…"
              rows={1}
              className="w-full resize-none rounded-2xl bg-white/[0.05] border border-white/[0.08] px-4 py-2.5 text-[14px] placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500/30 focus:border-violet-500/30 transition-all max-h-[120px]"
            />
          </div>
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="w-9 h-9 rounded-full bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:hover:bg-violet-600 flex items-center justify-center transition-all shrink-0 active:scale-90 mb-[3px]"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <ArrowUp className="w-4 h-4 text-white" />}
          </button>
        </div>
      </div>
    </div>
  );
}
