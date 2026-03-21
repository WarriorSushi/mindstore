"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Brain, User, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { semanticSearch } from "@/lib/search";
import { chatCompletion, getApiKey } from "@/lib/openai";
import { db } from "@/lib/db";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; score: number; snippet: string }[];
}

const SUGGESTED_QUESTIONS = [
  "What are the main topics I've discussed?",
  "Summarize my key ideas and insights",
  "What decisions have I made recently?",
  "What problems was I trying to solve?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [memoryCount, setMemoryCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    db.memories.count().then(setMemoryCount);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend(query?: string) {
    const q = query || input.trim();
    if (!q || loading) return;

    if (!getApiKey()) {
      setMessages(prev => [...prev, { role: "user", content: q }, { role: "assistant", content: "Please set your OpenAI API key in Settings first." }]);
      return;
    }

    setInput("");
    const userMsg: ChatMessage = { role: "user", content: q };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // Semantic search
      const results = await semanticSearch(q, 10);

      const sources = results.map(r => ({
        title: r.sourceTitle,
        score: r.score,
        snippet: r.content.slice(0, 150),
      }));

      // Build context
      const context = results
        .map((r, i) => `[Source ${i + 1}: "${r.sourceTitle}" (${r.source}, ${new Date(r.timestamp).toLocaleDateString()})]\n${r.content}`)
        .join("\n\n---\n\n");

      const systemPrompt = `You are Mindstore, a personal knowledge assistant. You answer questions based ONLY on the user's own stored knowledge provided below. Always cite your sources using the format [Source: "title"]. If the provided context doesn't contain relevant information, say so honestly.

User's Knowledge Context:
${context || "No relevant memories found."}`;

      const chatHistory = messages.map(m => ({ role: m.role, content: m.content }));
      chatHistory.push({ role: "user" as const, content: q });

      const assistantMsg: ChatMessage = { role: "assistant", content: "", sources };
      setMessages(prev => [...prev, assistantMsg]);

      await chatCompletion(
        systemPrompt,
        chatHistory,
        (chunk) => {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { ...assistantMsg, content: chunk };
            return updated;
          });
        }
      );
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}` },
      ]);
    }

    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border/50 px-6 py-3 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Chat with your knowledge</h1>
          <p className="text-xs text-muted-foreground">{memoryCount} memories indexed</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto px-6" ref={scrollRef}>
        <div className="max-w-2xl mx-auto py-6 space-y-6">
          {messages.length === 0 && (
            <motion.div
              className="text-center py-20 space-y-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Brain className="w-12 h-12 mx-auto text-muted-foreground" />
              <div>
                <h2 className="text-xl font-semibold mb-2">Ask your knowledge anything</h2>
                <p className="text-sm text-muted-foreground">Your question will be matched against your stored memories using semantic search.</p>
              </div>
              {memoryCount > 0 && (
                <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
                  {SUGGESTED_QUESTIONS.map(q => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                    >
                      <Sparkles className="w-3 h-3 inline mr-1" />
                      {q}
                    </button>
                  ))}
                </div>
              )}
              {memoryCount === 0 && (
                <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
                  <AlertCircle className="w-4 h-4" />
                  Import some knowledge first to start chatting.
                </div>
              )}
            </motion.div>
          )}

          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3 items-start"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-primary/20" : "bg-muted"}`}>
                  {msg.role === "user" ? <User className="w-3.5 h-3.5" /> : <Brain className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="text-sm whitespace-pre-wrap break-words">{msg.content || (loading && i === messages.length - 1 ? <Loader2 className="w-4 h-4 animate-spin" /> : null)}</div>
                  {msg.sources && msg.sources.length > 0 && msg.content && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {msg.sources.slice(0, 5).map((s, j) => (
                        <Badge key={j} variant="secondary" className="text-[10px] font-normal">
                          📎 {s.title} ({Math.round(s.score * 100)}%)
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border/50 px-6 py-4 shrink-0">
        <div className="max-w-2xl mx-auto relative">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your knowledge anything..."
            className="pr-12 min-h-[48px] max-h-[120px] resize-none"
            rows={1}
          />
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-2 bottom-2 h-8 w-8"
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
