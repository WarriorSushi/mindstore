"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Brain, User, Sparkles, BookOpen, PenLine, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { streamChat } from "@/lib/openai";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; type: string; score: number }[];
  saved?: boolean; // Whether this was saved as a memory
  factsLearned?: string[];
}

type ChatMode = "ask" | "tell";

const ASK_SUGGESTIONS = [
  "What topics have I explored the most?",
  "What did I learn about recently?",
  "Summarize my key interests and patterns",
  "What connections exist between my different areas of knowledge?",
];

const TELL_SUGGESTIONS = [
  "I just had an interesting idea about...",
  "Today I learned that...",
  "I've been thinking about...",
  "Something I want to remember:",
];

const TELL_SYSTEM_PROMPT = `You are MindStore, a warm and curious personal knowledge companion. The user is sharing thoughts, ideas, and information with you. Your job is to:

1. Acknowledge what they shared with genuine interest
2. Ask a thoughtful follow-up question to learn more (ONE question only)
3. Make connections to things they've shared before if relevant
4. Extract key facts from what they said

Keep responses SHORT (2-3 sentences + question). Be warm, not formal.

At the end of your response, extract facts in this format:
[FACTS]
fact_key: fact_value | category
[/FACTS]

Categories: preference, trait, goal, knowledge, relationship, habit, background, opinion, idea, experience
If no clear facts, omit the FACTS block.`;

function parseFacts(content: string): { cleanContent: string; facts: { key: string; value: string; category: string }[] } {
  const factsMatch = content.match(/\[FACTS\]([\s\S]*?)\[\/FACTS\]/);
  const cleanContent = content.replace(/\[FACTS\][\s\S]*?\[\/FACTS\]/, "").trim();
  
  if (!factsMatch) return { cleanContent, facts: [] };
  
  const facts: { key: string; value: string; category: string }[] = [];
  const lines = factsMatch[1].trim().split("\n");
  for (const line of lines) {
    const match = line.match(/^(.+?):\s*(.+?)\s*\|\s*(.+)$/);
    if (match) {
      facts.push({ key: match[1].trim(), value: match[2].trim(), category: match[3].trim() });
    }
  }
  return { cleanContent, facts };
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [memoryCount, setMemoryCount] = useState(0);
  const [mode, setMode] = useState<ChatMode>("ask");
  const [totalLearned, setTotalLearned] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch('/api/v1/stats').then(r => r.json()).then(data => setMemoryCount(data.totalMemories || 0)).catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save extracted facts as memories
  const saveFacts = async (facts: { key: string; value: string; category: string }[]) => {
    for (const fact of facts) {
      try {
        await fetch('/api/v1/memories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `${fact.key}: ${fact.value}`,
            sourceType: 'text',
            sourceId: `chat-${fact.category}`,
            sourceTitle: `Learned: ${fact.key}`,
            metadata: { category: fact.category, type: 'learned-fact', key: fact.key, value: fact.value },
          }),
        });
        setTotalLearned(prev => prev + 1);
        setMemoryCount(prev => prev + 1);
      } catch (e) {
        console.error("Failed to save fact:", e);
      }
    }
  };

  // Save raw user input as a thought/note memory
  const saveThought = async (content: string) => {
    try {
      await fetch('/api/v1/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documents: [{
            title: `Thought — ${new Date().toLocaleDateString()}`,
            content,
            sourceType: 'text',
          }],
        }),
      });
      setMemoryCount(prev => prev + 1);
      return true;
    } catch {
      return false;
    }
  };

  const handleSend = async (text?: string) => {
    const query = (text || input).trim();
    if (!query || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: query }]);
    setLoading(true);

    if (mode === "tell") {
      await handleTellMode(query);
    } else {
      await handleAskMode(query);
    }
  };

  const handleTellMode = async (query: string) => {
    try {
      // Save the user's message as a memory immediately
      const saved = await saveThought(query);

      // Build chat history for context
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      
      // Also search for related existing memories to make connections
      let context = "";
      try {
        const searchRes = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}&limit=3`);
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const results = searchData.results || [];
          if (results.length > 0) {
            context = "\n\nRelated things the user has shared before:\n" + 
              results.map((r: any) => `- "${r.sourceTitle}": ${r.content.slice(0, 150)}`).join('\n');
          }
        }
      } catch { /* search is optional enhancement */ }

      const chatMessages = [
        { role: 'system', content: TELL_SYSTEM_PROMPT + context },
        ...history,
        { role: 'user', content: query },
      ];

      let fullResponse = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "", saved: true }]);

      for await (const chunk of streamChat(chatMessages)) {
        fullResponse += chunk;
        const { cleanContent } = parseFacts(fullResponse);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: cleanContent,
            saved: true,
          };
          return updated;
        });
      }

      // Extract and save facts
      const { cleanContent, facts } = parseFacts(fullResponse);
      if (facts.length > 0) {
        await saveFacts(facts);
      }

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: cleanContent,
          saved,
          factsLearned: facts.map(f => `${f.key}: ${f.value}`),
        };
        return updated;
      });

      if (saved) {
        toast.success("Saved to your mind ✨");
      }
    } catch (err: any) {
      // Even if AI fails, the thought was saved
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Got it! I've saved that to your memory. (AI response unavailable — check your API key in Settings.)", saved: true },
      ]);
      toast.success("Saved to your mind ✨");
    } finally {
      setLoading(false);
    }
  };

  const handleAskMode = async (query: string) => {
    try {
      // Search via server API (triple-layer fusion)
      const searchRes = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}&limit=8`);
      
      if (!searchRes.ok) throw new Error('Search failed');
      const searchData = await searchRes.json();
      const results = searchData.results || [];

      if (results.length === 0) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "I couldn't find anything relevant in your knowledge base. Try importing more content or switch to \"Tell\" mode to share new information!" },
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

  const suggestions = mode === "ask" ? ASK_SUGGESTIONS : TELL_SUGGESTIONS;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-4">
        <h1 className="text-3xl font-bold">
          {mode === "ask" ? "Ask Your Mind" : "Tell MindStore"}
        </h1>
        <p className="text-zinc-400 mt-1">
          {mode === "ask"
            ? memoryCount > 0
              ? `Searching across ${memoryCount.toLocaleString()} memories`
              : "Import some knowledge first to start asking questions"
            : `Share your thoughts — I'll remember everything${totalLearned > 0 ? ` (${totalLearned} facts learned this session)` : ""}`
          }
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-1 mb-4 bg-zinc-900 p-1 rounded-lg w-fit">
        <button
          onClick={() => setMode("ask")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            mode === "ask"
              ? "bg-violet-600 text-white"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Ask
        </button>
        <button
          onClick={() => setMode("tell")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            mode === "tell"
              ? "bg-emerald-600 text-white"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <PenLine className="w-4 h-4" />
          Tell
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Sparkles className="w-12 h-12 text-violet-400/30 mb-4" />
            <h3 className="text-lg font-medium text-zinc-400 mb-2">
              {mode === "ask" ? "What would you like to know?" : "What's on your mind?"}
            </h3>
            <p className="text-sm text-zinc-500 mb-6 max-w-md">
              {mode === "ask"
                ? "Ask questions about your imported knowledge — I'll find answers across all your sources."
                : "Share thoughts, ideas, or anything you want to remember. I'll save it and learn about you along the way."
              }
            </p>
            <div className="grid sm:grid-cols-2 gap-3 max-w-lg">
              {suggestions.map((s) => (
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
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                mode === "tell" ? "bg-emerald-500/10" : "bg-violet-500/10"
              }`}>
                <Brain className={`w-4 h-4 ${mode === "tell" ? "text-emerald-400" : "text-violet-400"}`} />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 ${
                msg.role === "user"
                  ? mode === "tell" ? "bg-emerald-600 text-white" : "bg-violet-600 text-white"
                  : "bg-zinc-900 border border-zinc-800"
              }`}
            >
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content || (loading && i === messages.length - 1 ? "Thinking..." : "")}</div>
              
              {/* Saved indicator */}
              {msg.saved && msg.role === "assistant" && msg.content && (
                <div className="mt-2 flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />
                  Saved to memory
                </div>
              )}

              {/* Facts learned */}
              {msg.factsLearned && msg.factsLearned.length > 0 && (
                <div className="mt-2 pt-2 border-t border-zinc-700/50">
                  <p className="text-xs text-zinc-500 mb-1">Learned:</p>
                  <div className="flex flex-wrap gap-1">
                    {msg.factsLearned.map((f, j) => (
                      <span key={j} className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sources (ask mode) */}
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
            placeholder={mode === "ask" ? "Ask your mind anything..." : "Share a thought, idea, or anything on your mind..."}
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
            className={`h-[44px] w-[44px] shrink-0 ${
              mode === "tell" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-violet-600 hover:bg-violet-500"
            }`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
