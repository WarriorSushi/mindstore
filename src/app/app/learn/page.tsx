"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Brain, User, Loader2, Sparkles, CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { chatCompletion, getApiKey } from "@/lib/openai";
import { db, type Memory } from "@/lib/db";
import { generateEmbedding } from "@/lib/openai";

interface Message {
  role: "user" | "assistant";
  content: string;
  factsLearned?: string[];
}

interface LearnedFact {
  key: string;
  value: string;
  category: string;
}

const INTERVIEW_TOPICS = [
  { id: "intro", label: "Who you are", icon: "👤", prompt: "Start by getting to know the basics: their name, what they do, where they live, their background." },
  { id: "work", label: "Work & projects", icon: "💼", prompt: "Ask about their current work, projects, professional goals, skills, and career journey." },
  { id: "interests", label: "Interests & passions", icon: "🎯", prompt: "Explore their hobbies, interests, things they're curious about, what they read or watch." },
  { id: "thinking", label: "How you think", icon: "🧠", prompt: "Understand their decision-making style, values, what motivates them, pet peeves, strong opinions." },
  { id: "goals", label: "Goals & dreams", icon: "🚀", prompt: "Ask about short-term and long-term goals, dreams, what success looks like to them." },
  { id: "relationships", label: "People & connections", icon: "👥", prompt: "Learn about important people in their life, communities they're part of, how they collaborate." },
  { id: "freeform", label: "Tell me anything", icon: "✨", prompt: "Open-ended conversation. Let the user share whatever they want you to know about them." },
];

const SYSTEM_PROMPT = `You are MindStore's AI interviewer. Your job is to learn about this person through natural conversation. You're warm, curious, and genuinely interested.

RULES:
1. Ask ONE question at a time. Never multiple questions.
2. React to their answers naturally before asking the next question. Show you're listening.
3. Go deeper on interesting things they mention. Follow the thread.
4. After each of their responses, internally extract key facts (you'll be asked to list them).
5. Keep it conversational, not interrogative. Like a great first date, not a job interview.
6. After 3-4 exchanges on a subtopic, you can gently pivot to explore something new.
7. If they give a short answer, ask a follow-up. If they give a long one, acknowledge the depth.

CURRENT TOPIC FOCUS: {topic}

At the end of each response, on a new line, output extracted facts in this exact format:
[FACTS]
key: value | category
[/FACTS]

Categories: preference, trait, goal, knowledge, relationship, habit, background, opinion
Example:
[FACTS]
favorite_language: TypeScript | preference  
works_at: AltCorp | background
morning_person: yes, wakes at 6am | habit
[/FACTS]

If no new facts were revealed, omit the FACTS block entirely.`;

function parseFacts(content: string): { cleanContent: string; facts: LearnedFact[] } {
  const factsMatch = content.match(/\[FACTS\]([\s\S]*?)\[\/FACTS\]/);
  const cleanContent = content.replace(/\[FACTS\][\s\S]*?\[\/FACTS\]/, "").trim();
  
  if (!factsMatch) return { cleanContent, facts: [] };
  
  const facts: LearnedFact[] = [];
  const lines = factsMatch[1].trim().split("\n");
  for (const line of lines) {
    const match = line.match(/^(.+?):\s*(.+?)\s*\|\s*(.+)$/);
    if (match) {
      facts.push({ key: match[1].trim(), value: match[2].trim(), category: match[3].trim() });
    }
  }
  return { cleanContent, facts };
}

export default function LearnPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [allFacts, setAllFacts] = useState<LearnedFact[]>([]);
  const [factsSaved, setFactsSaved] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Load saved facts count
  useEffect(() => {
    db.memories.where("source").equals("interview").count().then(setFactsSaved);
  }, []);

  const saveFact = useCallback(async (fact: LearnedFact) => {
    try {
      const content = `${fact.key}: ${fact.value}`;
      const apiKey = getApiKey();
      let embedding: number[] = [];
      if (apiKey) {
        embedding = await generateEmbedding(content);
      }
      
      await db.memories.add({
        id: `fact-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        content,
        embedding,
        source: "text" as const,
        sourceId: `interview-${fact.category}`,
        sourceTitle: `Learned: ${fact.key}`,
        timestamp: new Date(),
        importedAt: new Date(),
        metadata: { category: fact.category, type: "learned-fact", key: fact.key, value: fact.value },
      });
      setFactsSaved(prev => prev + 1);
    } catch (e) {
      console.error("Failed to save fact:", e);
    }
  }, []);

  async function startInterview(topicId: string) {
    setSelectedTopic(topicId);
    setMessages([]);
    setAllFacts([]);
    setLoading(true);

    const topic = INTERVIEW_TOPICS.find(t => t.id === topicId)!;
    const systemMsg = SYSTEM_PROMPT.replace("{topic}", topic.prompt);

    try {
      let response = "";
      const assistantMsg: Message = { role: "assistant", content: "" };
      setMessages([assistantMsg]);

      await chatCompletion(
        systemMsg,
        [{ role: "user", content: `Start the conversation about: ${topic.label}. Ask your first question.` }],
        (chunk) => {
          response = chunk;
          const { cleanContent } = parseFacts(response);
          setMessages([{ ...assistantMsg, content: cleanContent }]);
        }
      );

      const { cleanContent } = parseFacts(response);
      setMessages([{ role: "assistant", content: cleanContent }]);
    } catch (err) {
      setMessages([{ role: "assistant", content: `Error starting interview: ${err instanceof Error ? err.message : "Unknown error"}` }]);
    }
    setLoading(false);
  }

  async function handleSend() {
    const q = input.trim();
    if (!q || loading || !selectedTopic) return;

    setInput("");
    const userMsg: Message = { role: "user", content: q };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const topic = INTERVIEW_TOPICS.find(t => t.id === selectedTopic)!;
    const systemMsg = SYSTEM_PROMPT.replace("{topic}", topic.prompt);
    
    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

    try {
      let response = "";
      const assistantMsg: Message = { role: "assistant", content: "" };
      setMessages(prev => [...prev, assistantMsg]);

      await chatCompletion(systemMsg, history, (chunk) => {
        response = chunk;
        const { cleanContent } = parseFacts(response);
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...assistantMsg, content: cleanContent };
          return updated;
        });
      });

      const { cleanContent, facts } = parseFacts(response);
      
      // Save facts
      for (const fact of facts) {
        await saveFact(fact);
      }
      setAllFacts(prev => [...prev, ...facts]);

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: cleanContent,
          factsLearned: facts.map(f => `${f.key}: ${f.value}`),
        };
        return updated;
      });
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

  // Topic selection screen
  if (!selectedTopic) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-border/50 px-6 py-3 shrink-0">
          <h1 className="text-lg font-semibold">Teach MindStore about you</h1>
          <p className="text-xs text-muted-foreground">
            Have a conversation so MindStore can learn who you are. {factsSaved > 0 && `${factsSaved} facts learned so far.`}
          </p>
        </div>
        <div className="flex-1 overflow-auto px-6 py-8">
          <div className="max-w-2xl mx-auto">
            <motion.div
              className="text-center mb-8"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Sparkles className="w-10 h-10 mx-auto text-primary mb-3" />
              <h2 className="text-xl font-semibold mb-2">What should we talk about?</h2>
              <p className="text-sm text-muted-foreground">Pick a topic. The AI will interview you naturally — no forms, just conversation.</p>
            </motion.div>

            {!getApiKey() && (
              <motion.div
                className="mb-6 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 text-sm text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                ⚠️ Set your OpenAI API key in <a href="/app/settings" className="underline">Settings</a> first.
              </motion.div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              {INTERVIEW_TOPICS.map((topic, i) => (
                <motion.button
                  key={topic.id}
                  onClick={() => getApiKey() && startInterview(topic.id)}
                  className="p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-card hover:border-primary/30 transition-all text-left group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  disabled={!getApiKey()}
                >
                  <span className="text-2xl mb-2 block">{topic.icon}</span>
                  <span className="font-medium text-sm group-hover:text-primary transition-colors">{topic.label}</span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Interview chat screen
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border/50 px-6 py-3 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <span>{INTERVIEW_TOPICS.find(t => t.id === selectedTopic)?.icon}</span>
            {INTERVIEW_TOPICS.find(t => t.id === selectedTopic)?.label}
          </h1>
          <p className="text-xs text-muted-foreground">
            {allFacts.length} facts learned in this session
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedTopic(null)} className="gap-1 text-xs">
            <RotateCcw className="w-3 h-3" /> New Topic
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6" ref={scrollRef}>
        <div className="max-w-2xl mx-auto py-6 space-y-6">
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
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {msg.content || (loading && i === messages.length - 1 ? <Loader2 className="w-4 h-4 animate-spin" /> : null)}
                  </div>
                  {msg.factsLearned && msg.factsLearned.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {msg.factsLearned.map((fact, j) => (
                        <Badge key={j} variant="secondary" className="text-[10px] font-normal gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5 text-green-500" />
                          {fact}
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

      <div className="border-t border-border/50 px-6 py-4 shrink-0">
        <div className="max-w-2xl mx-auto relative">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell me about yourself..."
            className="pr-12 min-h-[48px] max-h-[120px] resize-none"
            rows={1}
          />
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-2 bottom-2 h-8 w-8"
            onClick={handleSend}
            disabled={!input.trim() || loading}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
