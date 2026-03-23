"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Brain, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { streamChat } from "@/lib/openai";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; type: string; score: number }[];
}

const SUGGESTIONS = [
  "What topics have I explored the most?",
  "What did I learn about recently?",
  "Summarize my key interests",
  "What connections exist between my ideas?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [memoryCount, setMemoryCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch('/api/v1/stats').then(r => r.json()).then(data => setMemoryCount(data.totalMemories || 0)).catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const query = (text || input).trim();
    if (!query || loading) return;

    if (memoryCount === 0) {
      toast.error("No memories yet! Import some knowledge first.");
      return;
    }

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: query }]);
    setLoading(true);

    try {
      const searchRes = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}&limit=8`);
      if (!searchRes.ok) throw new Error('Search failed');
      const searchData = await searchRes.json();
      const results = searchData.results || [];

      if (results.length === 0) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "I couldn't find anything relevant in your knowledge base. Try importing more content or rephrasing your question." },
        ]);
        setLoading(false);
        return;
      }

      const context = results
        .map((r: any, i: number) => `[${i + 1}] Source: "${r.sourceTitle}" (${r.sourceType}, ${new Date(r.createdAt).toLocaleDateString()})\n${r.content}`)
        .join('\n\n---\n\n');

      const ragMessages = [
        {
          role: 'system',
          content: `You are MindStore, a personal knowledge assistant. You answer questions based ONLY on the user's own knowledge stored in their personal database. 

When answering:
- Synthesize information across multiple sources when relevant
- Always cite your sources using [1], [2], etc.
- If the knowledge base doesn't contain relevant information, say so honestly
- Be concise but thorough
- Highlight connections between different pieces of knowledge the user might not have noticed`,
        },
        {
          role: 'user',
          content: `Here is relevant context from my personal knowledge base:\n\n${context}\n\n---\n\nMy question: ${query}`,
        },
      ];

      let fullResponse = "";

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "",
          sources: results.map((r: any) => ({
            title: r.sourceTitle || '',
            type: r.sourceType,
            score: r.score,
          })),
        },
      ]);

      for await (const chunk of streamChat(ragMessages)) {
        fullResponse += chunk;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: fullResponse,
          };
          return updated;
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

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] md:h-[calc(100vh-3rem)]">
      {/* Header */}
      <div className="mb-3 md:mb-4">
        <h1 className="text-xl md:text-3xl font-bold">Ask Your Mind</h1>
        <p className="text-zinc-400 text-xs md:text-sm mt-0.5">
          {memoryCount > 0
            ? `Searching across ${memoryCount.toLocaleString()} memories`
            : "Import some knowledge first to start asking questions"}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 md:space-y-4 pb-3 -mx-1 px-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Sparkles className="w-10 h-10 text-violet-400/30 mb-3" />
            <h3 className="text-base font-medium text-zinc-400 mb-5">What would you like to know?</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-left text-xs p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-violet-500/20 transition-all text-zinc-400 active:scale-[0.98]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Brain className="w-3.5 h-3.5 text-violet-400" />
              </div>
            )}
            <div
              className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
                msg.role === "user"
                  ? "bg-violet-600 text-white"
                  : "bg-white/[0.04] border border-white/[0.06]"
              }`}
            >
              <div className="whitespace-pre-wrap text-[13px] leading-relaxed">
                {msg.content || (loading && i === messages.length - 1 ? (
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-xs">Thinking...</span>
                  </div>
                ) : "")}
              </div>
              {msg.sources && msg.sources.length > 0 && msg.content && (
                <div className="mt-2.5 pt-2 border-t border-white/[0.06]">
                  <p className="text-[10px] text-zinc-500 mb-1">Sources:</p>
                  <div className="flex flex-wrap gap-1">
                    {msg.sources.slice(0, 4).map((s, j) => (
                      <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-400">
                        {s.title.slice(0, 24)}{s.title.length > 24 ? "…" : ""} ({Math.round(s.score * 100)}%)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5 text-zinc-400" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/[0.06] pt-3">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            placeholder="Ask your mind anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            className="bg-white/[0.04] border-white/[0.06] resize-none min-h-[42px] max-h-28 text-sm rounded-xl"
          />
          <Button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            size="icon"
            className="bg-violet-600 hover:bg-violet-500 h-[42px] w-[42px] shrink-0 rounded-xl"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
