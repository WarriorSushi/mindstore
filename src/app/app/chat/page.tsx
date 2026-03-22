"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Brain, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getApiKey, streamChat } from "@/lib/openai";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; type: string; score: number }[];
}

const SUGGESTIONS = [
  "What topics have I explored the most?",
  "What did I learn about recently?",
  "Summarize my key interests and patterns",
  "What connections exist between my different areas of knowledge?",
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

    const apiKey = getApiKey();
    if (!apiKey) {
      toast.error("No API key set. Go to Dashboard to add one.");
      return;
    }

    if (memoryCount === 0) {
      toast.error("No memories yet! Import some knowledge first.");
      return;
    }

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: query }]);
    setLoading(true);

    try {
      // Search via server API (triple-layer fusion)
      const searchRes = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}&limit=8`, {
        headers: { 'x-openai-key': apiKey },
      });
      
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

      // Build RAG prompt
      const context = results
        .map((r: any, i: number) => `[${i + 1}] Source: "${r.sourceTitle}" (${r.sourceType}, ${new Date(r.createdAt).toLocaleDateString()})\n${r.content}`)
        .join('\n\n---\n\n');

      const ragMessages = [
        {
          role: 'system',
          content: `You are Mindstore, a personal knowledge assistant. You answer questions based ONLY on the user's own knowledge stored in their personal database. 

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

      for await (const chunk of streamChat(ragMessages, apiKey)) {
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
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-4">
        <h1 className="text-3xl font-bold">Ask Your Mind</h1>
        <p className="text-zinc-400 mt-1">
          {memoryCount > 0
            ? `Searching across ${memoryCount.toLocaleString()} memories`
            : "Import some knowledge first to start asking questions"}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Sparkles className="w-12 h-12 text-violet-400/30 mb-4" />
            <h3 className="text-lg font-medium text-zinc-400 mb-6">What would you like to know?</h3>
            <div className="grid sm:grid-cols-2 gap-3 max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-left text-sm p-3 rounded-lg border border-zinc-800 hover:border-violet-500/30 hover:bg-zinc-900 transition-colors text-zinc-400"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                <Brain className="w-4 h-4 text-violet-400" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-900 border border-zinc-800"
              }`}
            >
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content || (loading && i === messages.length - 1 ? "Thinking..." : "")}</div>
              {msg.sources && msg.sources.length > 0 && msg.content && (
                <div className="mt-3 pt-3 border-t border-zinc-700/50">
                  <p className="text-xs text-zinc-500 mb-1">Sources:</p>
                  <div className="flex flex-wrap gap-1">
                    {msg.sources.slice(0, 5).map((s, j) => (
                      <span key={j} className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                        {s.title.slice(0, 30)}{s.title.length > 30 ? "..." : ""} ({Math.round(s.score * 100)}%)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-zinc-400" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800 pt-4">
        <div className="flex gap-2">
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
            className="bg-zinc-900 border-zinc-800 resize-none min-h-[44px] max-h-32"
          />
          <Button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            size="icon"
            className="bg-violet-600 hover:bg-violet-500 h-[44px] w-[44px] shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
