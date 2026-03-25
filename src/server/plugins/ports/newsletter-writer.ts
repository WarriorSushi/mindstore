import { sql } from "drizzle-orm";
import { callTextPrompt, getTextGenerationConfig } from "@/server/ai-client";
import { db } from "@/server/db";
import { generateEmbeddings } from "@/server/embeddings";
import { retrieve } from "@/server/retrieval";
import {
  createPluginScopedId,
  ensurePluginInstalled,
  getPluginConfig,
  parseJsonValue,
  savePluginConfig,
} from "@/server/plugins/ports/plugin-config";

const PLUGIN_SLUG = "newsletter-writer";

const TONES: Record<string, string> = {
  professional: "Polished and authoritative. Clear headings, concise paragraphs, actionable insights.",
  casual: "Warm and conversational. Personal, approachable, and human.",
  witty: "Sharp and clever with light personality.",
};

export interface NewsletterSection {
  id: string;
  type: "intro" | "topic" | "highlight" | "quicklinks" | "reflection" | "outro";
  title: string;
  content: string;
  sourceCount: number;
}

export interface Newsletter {
  id: string;
  title: string;
  subject: string;
  period: string;
  periodDays: number;
  tone: string;
  sections: NewsletterSection[];
  wordCount: number;
  sourceCount: number;
  topicsCovered: string[];
  status: "draft" | "polishing" | "ready";
  createdAt: string;
  updatedAt: string;
}

export interface NewsletterSummary {
  id: string;
  title: string;
  subject: string;
  period: string;
  periodDays: number;
  tone: string;
  sectionCount: number;
  wordCount: number;
  sourceCount: number;
  topicsCovered: string[];
  status: Newsletter["status"];
  createdAt: string;
  updatedAt: string;
}

export interface NewsletterSuggestion {
  title: string;
  subject: string;
  topics: string[];
  pitch: string;
}

interface NewsletterPluginConfig {
  newsletters: Newsletter[];
}

export async function ensureNewsletterWriterInstalled() {
  await ensurePluginInstalled(PLUGIN_SLUG);
}

export async function listNewsletters(): Promise<NewsletterSummary[]> {
  const config = await getNewsletterConfig();
  return [...config.newsletters]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((newsletter) => ({
      id: newsletter.id,
      title: newsletter.title,
      subject: newsletter.subject,
      period: newsletter.period,
      periodDays: newsletter.periodDays,
      tone: newsletter.tone,
      sectionCount: newsletter.sections.length,
      wordCount: newsletter.wordCount,
      sourceCount: newsletter.sourceCount,
      topicsCovered: newsletter.topicsCovered,
      status: newsletter.status,
      createdAt: newsletter.createdAt,
      updatedAt: newsletter.updatedAt,
    }));
}

export async function getNewsletter(id: string): Promise<Newsletter | null> {
  const config = await getNewsletterConfig();
  return config.newsletters.find((newsletter) => newsletter.id === id) || null;
}

export async function suggestNewsletters(userId: string, periodDays: number) {
  const aiConfig = await requireNewsletterAIConfig();
  const sinceDate = getDateNDaysAgo(periodDays);
  const memories = await db.execute(sql`
    SELECT id, source_title, content, source_type
    FROM memories
    WHERE user_id = ${userId}::uuid AND created_at >= ${sinceDate}::timestamp
    ORDER BY created_at DESC
    LIMIT 50
  `) as Array<{ id: string; source_title?: string | null; content?: string | null; source_type?: string | null }>;

  if (!memories.length) {
    return {
      suggestions: [] as NewsletterSuggestion[],
      memoryCount: 0,
      period: getPeriodLabel(periodDays),
    };
  }

  const knowledgeSummary = memories
    .map((memory) => `[${memory.source_type || "note"}] ${memory.source_title || "(untitled)"}: ${(memory.content || "").slice(0, 200)}`)
    .join("\n");

  const response = await callTextPrompt(
    aiConfig,
    `I added ${memories.length} items to my knowledge base in the last ${periodDays} days. Here they are:

${knowledgeSummary}

Suggest 3 newsletter theme ideas I could write about. For each:
1. A catchy title
2. An email subject line under 60 characters
3. The main topics it would cover
4. A one-line pitch

Return ONLY a JSON array: [{ "title": string, "subject": string, "topics": string[], "pitch": string }]`,
    "You are a newsletter editor helping someone turn recent learning into compelling personal digests.",
    { temperature: 0.5, maxTokens: 2048 },
  );

  if (!response) {
    throw new Error("AI suggestion failed");
  }

  const suggestions = parseJsonValue<NewsletterSuggestion[]>(response);
  return {
    suggestions: Array.isArray(suggestions) ? suggestions.slice(0, 3) : [],
    memoryCount: memories.length,
    period: getPeriodLabel(periodDays),
  };
}

export async function generateNewsletter(
  userId: string,
  input: {
    title?: string;
    subject?: string;
    periodDays?: number;
    tone?: string;
    focusTopics?: string[];
    customPrompt?: string;
  },
) {
  const periodDays = Math.min(Math.max(input.periodDays ?? 7, 1), 90);
  const tone = input.tone || "casual";
  const sinceDate = getDateNDaysAgo(periodDays);
  const recentMemories = await db.execute(sql`
    SELECT id, source_title, content, source_type, created_at
    FROM memories
    WHERE user_id = ${userId}::uuid AND created_at >= ${sinceDate}::timestamp
    ORDER BY created_at DESC
    LIMIT 60
  `) as Array<{
    id: string;
    source_title?: string | null;
    content?: string | null;
    source_type?: string | null;
    created_at?: Date | string | null;
  }>;

  if (!recentMemories.length) {
    throw new Error(`No memories found in the last ${periodDays} days. Import some content first or try a longer timeframe.`);
  }

  const topicMemories: Array<{
    id: string;
    source_title?: string | null;
    content?: string | null;
    source_type?: string | null;
  }> = [];

  for (const topic of (input.focusTopics || []).slice(0, 4)) {
    const embedding = await embedNewsletterQuery(topic);
    const results = await retrieve(topic, embedding, { userId, limit: 5 });
    for (const result of results) {
      topicMemories.push({
        id: result.memoryId,
        source_title: result.sourceTitle,
        content: result.content,
        source_type: result.sourceType,
      });
    }
  }

  const seen = new Set<string>();
  const allMemories = [...recentMemories, ...topicMemories].filter((memory) => {
    if (seen.has(memory.id)) {
      return false;
    }
    seen.add(memory.id);
    return true;
  });

  const knowledgeContext = allMemories
    .slice(0, 40)
    .map((memory, index) => `[${index + 1}] (${memory.source_type || "note"}) ${memory.source_title || "(untitled)"}:\n${(memory.content || "").slice(0, 600)}`)
    .join("\n\n---\n\n");

  const aiConfig = await requireNewsletterAIConfig();
  const period = getPeriodLabel(periodDays);
  const title = input.title || "This Week in My Mind";
  const subject = input.subject || `What I learned - ${period}`;

  const response = await callTextPrompt(
    aiConfig,
    `Create a newsletter issue:
Title: "${title}"
Subject: "${subject}"
Period: ${period} (last ${periodDays} days)
${input.focusTopics?.length ? `Focus topics: ${input.focusTopics.join(", ")}` : ""}
${input.customPrompt ? `Additional instructions: ${input.customPrompt}` : ""}

Sources from my knowledge base (${allMemories.length} items):
${knowledgeContext}

Generate a newsletter with:
1. intro
2. 2-4 topic sections
3. 1 highlight section
4. 1 quicklinks section
5. outro

Return ONLY a JSON array:
[{
  "type": "intro|topic|highlight|quicklinks|outro",
  "title": "Section title",
  "content": "Markdown content",
  "sourceCount": number
}]`,
    `You are a strong newsletter writer. Use only the provided knowledge. Make the digest feel personal, thoughtful, and clearly structured. ${TONES[tone] || TONES.casual}`,
    { temperature: 0.7, maxTokens: 8192 },
  );

  if (!response) {
    throw new Error("AI generation failed");
  }

  let sections: NewsletterSection[] = [];
  let topicsCovered: string[] = [];
  try {
    const parsed = parseJsonValue<Array<Partial<NewsletterSection>>>(response);
    sections = parsed.map((section) => ({
      id: createPluginScopedId("sec"),
      type: normalizeNewsletterSectionType(section.type),
      title: section.title || "Untitled Section",
      content: section.content || "",
      sourceCount: typeof section.sourceCount === "number" ? section.sourceCount : 0,
    }));
    topicsCovered = sections.filter((section) => section.type === "topic").map((section) => section.title);
  } catch {
    sections = [{
      id: createPluginScopedId("sec"),
      type: "topic",
      title: "This Week's Digest",
      content: response,
      sourceCount: allMemories.length,
    }];
    topicsCovered = ["General Digest"];
  }

  const newsletter: Newsletter = {
    id: createPluginScopedId("nl"),
    title,
    subject,
    period,
    periodDays,
    tone,
    sections,
    wordCount: sections.reduce((sum, section) => sum + section.content.split(/\s+/).filter(Boolean).length, 0),
    sourceCount: allMemories.length,
    topicsCovered,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const config = await getNewsletterConfig();
  config.newsletters.unshift(newsletter);
  config.newsletters = config.newsletters.slice(0, 20);
  await saveNewsletterConfig(config);
  return newsletter;
}

export async function updateNewsletter(input: {
  id: string;
  title?: string;
  subject?: string;
  sectionId?: string;
  content?: string;
  status?: Newsletter["status"];
}) {
  const config = await getNewsletterConfig();
  const newsletter = config.newsletters.find((entry) => entry.id === input.id);
  if (!newsletter) {
    throw new Error("Newsletter not found");
  }

  if (typeof input.title === "string") {
    newsletter.title = input.title;
  }
  if (typeof input.subject === "string") {
    newsletter.subject = input.subject;
  }
  if (input.status) {
    newsletter.status = input.status;
  }
  if (input.sectionId && typeof input.content === "string") {
    const section = newsletter.sections.find((entry) => entry.id === input.sectionId);
    if (!section) {
      throw new Error("Section not found");
    }
    section.content = input.content;
  }

  newsletter.wordCount = newsletter.sections.reduce((sum, section) => sum + section.content.split(/\s+/).filter(Boolean).length, 0);
  newsletter.updatedAt = new Date().toISOString();

  await saveNewsletterConfig(config);
  return newsletter;
}

export async function refineNewsletterSection(input: { id: string; sectionId: string; instruction: string }) {
  const instruction = input.instruction.trim();
  if (!instruction) {
    throw new Error("Instruction required");
  }

  const newsletter = await getNewsletter(input.id);
  if (!newsletter) {
    throw new Error("Newsletter not found");
  }
  const section = newsletter.sections.find((entry) => entry.id === input.sectionId);
  if (!section) {
    throw new Error("Section not found");
  }

  const aiConfig = await requireNewsletterAIConfig();
  const refined = await callTextPrompt(
    aiConfig,
    `Here is a newsletter section titled "${section.title}":

---
${section.content}
---

Refinement instruction: ${instruction}

Return ONLY the refined version in markdown.`,
    "You are a newsletter editor. Keep the same angle and tone, but improve the writing and clarity.",
    { temperature: 0.5, maxTokens: 4096 },
  );

  if (!refined) {
    throw new Error("Refinement failed");
  }

  return refined;
}

export async function deleteNewsletter(id: string) {
  const config = await getNewsletterConfig();
  const nextNewsletters = config.newsletters.filter((newsletter) => newsletter.id !== id);
  if (nextNewsletters.length === config.newsletters.length) {
    throw new Error("Newsletter not found");
  }

  await saveNewsletterConfig({ newsletters: nextNewsletters });
  return { success: true };
}

export function getPeriodLabel(days: number) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const format = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${format(start)}-${format(end)}, ${end.getFullYear()}`;
}

function getDateNDaysAgo(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function normalizeNewsletterSectionType(value: unknown): NewsletterSection["type"] {
  if (value === "intro" || value === "topic" || value === "highlight" || value === "quicklinks" || value === "reflection" || value === "outro") {
    return value;
  }
  return "topic";
}

async function getNewsletterConfig() {
  return getPluginConfig<NewsletterPluginConfig>(PLUGIN_SLUG, { newsletters: [] });
}

async function saveNewsletterConfig(config: NewsletterPluginConfig) {
  await savePluginConfig(PLUGIN_SLUG, config);
}

async function requireNewsletterAIConfig() {
  const aiConfig = await getTextGenerationConfig({
    openai: "gpt-4o-mini",
    openrouter: "anthropic/claude-3.5-haiku",
    gemini: "gemini-2.0-flash-lite",
    ollama: "llama3.2",
    custom: "default",
  });
  if (!aiConfig) {
    throw new Error("No AI provider configured");
  }
  return aiConfig;
}

async function embedNewsletterQuery(query: string) {
  try {
    const embeddings = await generateEmbeddings([query]);
    return embeddings?.[0] || null;
  } catch {
    return null;
  }
}

