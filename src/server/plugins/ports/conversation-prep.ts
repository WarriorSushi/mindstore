import { callTextPrompt, getTextGenerationConfig } from "@/server/ai-client";
import { generateEmbeddings } from "@/server/embeddings";
import { retrieve } from "@/server/retrieval";
import {
  createPluginScopedId,
  ensurePluginInstalled,
  getPluginConfig,
  parseJsonValue,
  savePluginConfig,
} from "@/server/plugins/ports/plugin-config";

const PLUGIN_SLUG = "conversation-prep";

export interface BriefingSection {
  title: string;
  icon: string;
  items: string[];
}

export interface Briefing {
  id: string;
  subject: string;
  type: "person" | "topic" | "company" | "project";
  context?: string;
  sections: BriefingSection[];
  sourceCount: number;
  sourceMemoryIds: string[];
  createdAt: string;
}

export interface BriefingSummary {
  id: string;
  subject: string;
  type: Briefing["type"];
  context?: string;
  sectionCount: number;
  sourceCount: number;
  createdAt: string;
  preview: string;
}

interface ConversationPrepConfig {
  briefings: Briefing[];
}

export async function ensureConversationPrepInstalled() {
  await ensurePluginInstalled(PLUGIN_SLUG);
}

export async function listBriefings(): Promise<BriefingSummary[]> {
  const config = await getConversationPrepConfig();
  return [...config.briefings]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((briefing) => ({
      id: briefing.id,
      subject: briefing.subject,
      type: briefing.type,
      context: briefing.context,
      sectionCount: briefing.sections.length,
      sourceCount: briefing.sourceCount,
      createdAt: briefing.createdAt,
      preview: briefing.sections[0]?.items?.[0]?.slice(0, 120) || "",
    }));
}

export async function getBriefing(id: string): Promise<Briefing | null> {
  const config = await getConversationPrepConfig();
  return config.briefings.find((briefing) => briefing.id === id) || null;
}

export async function prepareBriefing(
  userId: string,
  input: { subject: string; type?: Briefing["type"]; context?: string },
) {
  const subject = input.subject.trim();
  if (!subject) {
    throw new Error("Subject required");
  }

  const type = input.type || "topic";
  const context = input.context?.trim() || "";
  const queries = buildConversationSearchQueries(subject, type, context);
  const allResults: Awaited<ReturnType<typeof retrieve>> = [];
  const seen = new Set<string>();

  for (const query of queries.slice(0, 5)) {
    const embedding = await embedConversationQuery(query);
    const results = await retrieve(query, embedding, { userId, limit: 8 });
    for (const result of results) {
      if (!seen.has(result.memoryId)) {
        seen.add(result.memoryId);
        allResults.push(result);
      }
    }
  }

  if (!allResults.length) {
    throw new Error(`No relevant memories found about "${subject}". Try adding more knowledge first, or check the spelling.`);
  }

  const topResults = allResults
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  const knowledgeContext = topResults
    .map((memory, index) => {
      const date = memory.createdAt
        ? new Date(memory.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "unknown date";
      return `[Source ${index + 1} | ${memory.sourceType} | ${date}] ${memory.sourceTitle || "(untitled)"}:\n${memory.content.slice(0, 600)}`;
    })
    .join("\n\n---\n\n");

  const aiConfig = await requireConversationAIConfig();
  const typeLabel = type === "person" ? "person" : type === "company" ? "company/organization" : type === "project" ? "project" : "topic";
  const response = await callTextPrompt(
    aiConfig,
    `Prepare a comprehensive briefing about this ${typeLabel}: "${subject}"
${context ? `\nMeeting context: ${context}` : ""}

Here is everything from my knowledge base related to this ${typeLabel}:
${knowledgeContext}

Create a structured briefing with these sections when relevant:
1. Overview
2. Key Facts
3. History & Timeline
4. Related Topics
5. Talking Points
6. Questions to Ask
7. Preparation Notes

Return ONLY a JSON object:
{
  "sections": [
    { "title": "Section Title", "icon": "icon-name", "items": ["Item 1"] }
  ]
}`,
    "You are an executive assistant. Use only the provided knowledge. Be specific, concrete, and honest about gaps.",
    { temperature: 0.4, maxTokens: 4096 },
  );

  if (!response) {
    throw new Error("AI generation failed");
  }

  let sections: BriefingSection[] = [];
  try {
    const parsed = parseJsonValue<{ sections?: BriefingSection[] }>(response);
    sections = Array.isArray(parsed.sections) ? parsed.sections.filter((section) => Array.isArray(section.items) && section.items.length) : [];
  } catch {
    sections = [{
      title: "Briefing",
      icon: "User",
      items: [response.slice(0, 2000)],
    }];
  }

  if (!sections.length) {
    throw new Error("Could not generate a meaningful briefing from available knowledge");
  }

  const briefing: Briefing = {
    id: createPluginScopedId("bp"),
    subject,
    type,
    context: context || undefined,
    sections,
    sourceCount: topResults.length,
    sourceMemoryIds: topResults.map((result) => result.memoryId),
    createdAt: new Date().toISOString(),
  };

  const config = await getConversationPrepConfig();
  config.briefings.unshift(briefing);
  config.briefings = config.briefings.slice(0, 50);
  await saveConversationPrepConfig(config);
  return briefing;
}

export async function answerBriefingFollowUp(
  userId: string,
  input: { id: string; question: string },
) {
  const question = input.question.trim();
  if (!question) {
    throw new Error("Question required");
  }

  const briefing = await getBriefing(input.id);
  if (!briefing) {
    throw new Error("Briefing not found");
  }

  const embedding = await embedConversationQuery(`${briefing.subject} ${question}`);
  const results = await retrieve(`${briefing.subject} ${question}`, embedding, { userId, limit: 10 });
  const knowledgeContext = results
    .map((memory, index) => `[${index + 1}] ${memory.sourceTitle || "(untitled)"}: ${memory.content.slice(0, 500)}`)
    .join("\n\n");
  const briefingContext = briefing.sections
    .map((section) => `${section.title}:\n${section.items.map((item) => `- ${item}`).join("\n")}`)
    .join("\n\n");

  const aiConfig = await requireConversationAIConfig();
  const answer = await callTextPrompt(
    aiConfig,
    `Previous briefing about "${briefing.subject}":
${briefingContext}

Additional knowledge:
${knowledgeContext}

Follow-up question: ${question}

Answer concisely and specifically. If the answer is not in the sources, say so.`,
    "You are an executive assistant answering a follow-up question. Use only the supplied information.",
    { temperature: 0.3, maxTokens: 1024 },
  );

  if (!answer) {
    throw new Error("Failed to generate answer");
  }

  return answer;
}

export async function deleteBriefing(id: string) {
  const config = await getConversationPrepConfig();
  const nextBriefings = config.briefings.filter((briefing) => briefing.id !== id);
  if (nextBriefings.length === config.briefings.length) {
    throw new Error("Briefing not found");
  }

  await saveConversationPrepConfig({ briefings: nextBriefings });
  return { success: true };
}

export function buildConversationSearchQueries(
  subject: string,
  type: Briefing["type"],
  context?: string,
) {
  const queries = [subject];
  if (context) {
    queries.push(`${subject} ${context}`);
  }

  if (type === "person") {
    queries.push(`${subject} conversation`, `${subject} meeting notes`, `${subject} project`);
  } else if (type === "company") {
    queries.push(`${subject} business`, `${subject} product`, `${subject} partnership`);
  } else if (type === "project") {
    queries.push(`${subject} status`, `${subject} issues`, `${subject} decisions`);
  } else {
    queries.push(`${subject} notes`, `${subject} insights`);
  }

  return queries;
}

async function getConversationPrepConfig() {
  return getPluginConfig<ConversationPrepConfig>(PLUGIN_SLUG, { briefings: [] });
}

async function saveConversationPrepConfig(config: ConversationPrepConfig) {
  await savePluginConfig(PLUGIN_SLUG, config);
}

async function requireConversationAIConfig() {
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

async function embedConversationQuery(query: string) {
  try {
    const embeddings = await generateEmbeddings([query]);
    return embeddings?.[0] || null;
  } catch {
    return null;
  }
}

