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

const PLUGIN_SLUG = "blog-draft";

const STYLES = {
  technical: "Technical deep-dive with code examples, architecture diagrams, and precise terminology",
  casual: "Relaxed, first-person narrative with personality and warmth",
  storytelling: "Narrative arc with a hook, clear tension, and a strong takeaway",
  tutorial: "Step-by-step guide with practical instructions and examples",
  opinion: "Thoughtful perspective piece with a clear thesis and counterpoints",
} as const;

const TONES = {
  professional: "Clear, authoritative, and polished",
  conversational: "Warm, approachable, and personal",
  academic: "Formal, rigorous, and carefully reasoned",
  witty: "Sharp, clever, and engaging without becoming silly",
} as const;

export interface BlogDraft {
  id: string;
  title: string;
  topic: string;
  style: string;
  tone: string;
  content: string;
  outline: string[];
  wordCount: number;
  sourceMemoryIds: string[];
  sourceCount: number;
  status: "draft" | "refining" | "ready";
  createdAt: string;
  updatedAt: string;
}

export interface BlogDraftSummary extends Omit<BlogDraft, "content" | "outline" | "sourceMemoryIds"> {
  preview: string;
}

export interface BlogTopicSuggestion {
  title: string;
  description: string;
  readingTime: number;
  style: string;
}

interface BlogPluginConfig {
  drafts: BlogDraft[];
}

export async function ensureBlogDraftInstalled() {
  await ensurePluginInstalled(PLUGIN_SLUG);
}

export async function listBlogDrafts(): Promise<BlogDraftSummary[]> {
  const config = await getBlogDraftConfig();
  return [...config.drafts]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((draft) => ({
      id: draft.id,
      title: draft.title,
      topic: draft.topic,
      style: draft.style,
      tone: draft.tone,
      wordCount: draft.wordCount,
      sourceCount: draft.sourceCount,
      status: draft.status,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      preview: draft.content.slice(0, 200),
    }));
}

export async function getBlogDraft(id: string): Promise<BlogDraft | null> {
  const config = await getBlogDraftConfig();
  return config.drafts.find((draft) => draft.id === id) || null;
}

export async function suggestBlogTopics(userId: string): Promise<BlogTopicSuggestion[]> {
  const aiConfig = await requireBlogAIConfig();
  const memories = await db.execute(sql`
    SELECT source_title, content
    FROM memories
    WHERE user_id = ${userId}::uuid
    ORDER BY created_at DESC
    LIMIT 30
  `) as Array<{ source_title?: string | null; content?: string | null }>;

  if (!memories.length) {
    return [];
  }

  const knowledgeSummary = memories
    .map((memory) => `- ${memory.source_title || "(untitled)"}: ${(memory.content || "").slice(0, 150)}`)
    .join("\n");

  const response = await callTextPrompt(
    aiConfig,
    `Based on these knowledge fragments from my personal knowledge base, suggest 8 specific blog post topics I could write about. For each topic, provide:
1. A compelling title
2. A one-line description of the angle
3. An estimated reading time in minutes
4. A style suggestion (technical/casual/storytelling/tutorial/opinion)

My knowledge includes:
${knowledgeSummary}

Return ONLY a JSON array with objects: { "title": string, "description": string, "readingTime": number, "style": string }`,
    "You are a blog strategist. Suggest topics where the writer has real authority because the ideas come from their own knowledge base.",
    { temperature: 0.4, maxTokens: 2048 },
  );

  if (!response) {
    throw new Error("AI generation failed");
  }

  const topics = parseJsonValue<BlogTopicSuggestion[]>(response);
  return Array.isArray(topics) ? topics.slice(0, 8) : [];
}

export async function generateBlogDraft(
  userId: string,
  input: { topic: string; style?: string; tone?: string; targetLength?: number },
) {
  const topic = input.topic.trim();
  if (!topic) {
    throw new Error("Topic required");
  }

  const style = input.style || "casual";
  const tone = input.tone || "conversational";
  const targetLength = Math.min(Math.max(input.targetLength ?? 1200, 400), 3200);

  const embedding = await embedQuery(topic);
  const memories = await retrieve(topic, embedding, { userId, limit: 15 });
  if (!memories.length) {
    throw new Error("No relevant memories found for this topic. Try a different angle or add more knowledge first.");
  }

  const knowledgeContext = memories
    .map((memory, index) => {
      const title = memory.sourceTitle || `(memory ${index + 1})`;
      return `[Source ${index + 1}] ${title}:\n${memory.content.slice(0, 800)}`;
    })
    .join("\n\n---\n\n");

  const aiConfig = await requireBlogAIConfig();

  const outlineResponse = await callTextPrompt(
    aiConfig,
    `Create a blog post outline for the topic: "${topic}"

Writing style: ${STYLES[style as keyof typeof STYLES] || style}
Tone: ${TONES[tone as keyof typeof TONES] || tone}
Target length: ~${targetLength} words

Author knowledge:
${knowledgeContext}

Create an outline with 4-7 sections.
Return ONLY a JSON array of section headings.`,
    "You are a professional blog editor who creates strong, specific outlines from a writer's real knowledge. Do not invent sources or facts.",
    { temperature: 0.3, maxTokens: 1024 },
  );

  let outline = ["Introduction", "Main Points", "Key Insights", "Conclusion"];
  if (outlineResponse) {
    try {
      const parsed = parseJsonValue<string[]>(outlineResponse);
      if (Array.isArray(parsed) && parsed.length) {
        outline = parsed.slice(0, 7);
      }
    } catch {
      // keep fallback outline
    }
  }

  const content = await callTextPrompt(
    aiConfig,
    `Write a complete blog post about: "${topic}"

Style: ${STYLES[style as keyof typeof STYLES] || style}
Tone: ${TONES[tone as keyof typeof TONES] || tone}
Outline:
${outline.map((section, index) => `${index + 1}. ${section}`).join("\n")}

Use only the following knowledge:
${knowledgeContext}

Write the full blog post in markdown. Start with the title as a # heading.`,
    `You are a strong long-form writer.
Rules:
- Write only from the provided knowledge. Never invent facts, quotes, citations, or examples.
- Use markdown headings and clean structure.
- Keep the requested tone and style.
- Include a strong opening and a clear closing takeaway.
- Target approximately ${targetLength} words.
- Do not add meta-commentary about "the sources" or "the research".`,
    { temperature: 0.7, maxTokens: 8192 },
  );

  if (!content) {
    throw new Error("AI generation failed");
  }

  const titleMatch = content.match(/^#\s+(.+)$/m);
  const draft: BlogDraft = {
    id: createPluginScopedId("bd"),
    title: titleMatch?.[1]?.trim() || topic,
    topic,
    style,
    tone,
    content,
    outline,
    wordCount: content.split(/\s+/).filter(Boolean).length,
    sourceMemoryIds: memories.map((memory) => memory.memoryId).filter(Boolean),
    sourceCount: memories.length,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const config = await getBlogDraftConfig();
  config.drafts.unshift(draft);
  await saveBlogDraftConfig(config);
  return draft;
}

export async function saveBlogDraft(input: {
  id: string;
  content?: string;
  title?: string;
  status?: BlogDraft["status"];
}) {
  const config = await getBlogDraftConfig();
  const draft = config.drafts.find((entry) => entry.id === input.id);
  if (!draft) {
    throw new Error("Draft not found");
  }

  if (typeof input.content === "string") {
    draft.content = input.content;
    draft.wordCount = input.content.split(/\s+/).filter(Boolean).length;
  }
  if (typeof input.title === "string") {
    draft.title = input.title;
  }
  if (input.status) {
    draft.status = input.status;
  }
  draft.updatedAt = new Date().toISOString();

  await saveBlogDraftConfig(config);
  return draft;
}

export async function refineBlogDraft(input: { id: string; instruction: string; selection?: string }) {
  const instruction = input.instruction.trim();
  if (!instruction) {
    throw new Error("Instruction required");
  }

  const draft = await getBlogDraft(input.id);
  if (!draft) {
    throw new Error("Draft not found");
  }

  const aiConfig = await requireBlogAIConfig();
  const scope = input.selection?.trim()
    ? `Here is a section from a blog post:\n\n---\n${input.selection.trim()}\n---`
    : `Here is a complete blog post:\n\n---\n${draft.content}\n---`;

  const refined = await callTextPrompt(
    aiConfig,
    `${scope}

Instruction: ${instruction}

Return ONLY the refined content in markdown.`,
    "You are a sharp editor. Keep the writer's meaning, improve clarity and flow, and return only the refined text.",
    { temperature: 0.5, maxTokens: 8192 },
  );

  if (!refined) {
    throw new Error("Refinement failed");
  }

  return refined;
}

export async function deleteBlogDraft(id: string) {
  const config = await getBlogDraftConfig();
  const nextDrafts = config.drafts.filter((draft) => draft.id !== id);
  if (nextDrafts.length === config.drafts.length) {
    throw new Error("Draft not found");
  }

  await saveBlogDraftConfig({ drafts: nextDrafts });
  return { success: true };
}

export async function exportBlogDraft(id: string, format: "markdown" | "html" = "markdown") {
  const draft = await getBlogDraft(id);
  if (!draft) {
    throw new Error("Draft not found");
  }

  if (format === "markdown") {
    return {
      content: `---\ntitle: "${draft.title.replace(/"/g, '\\"')}"\ndate: ${draft.createdAt.slice(0, 10)}\ndraft: true\ntags: []\n---\n\n${draft.content}`,
      filename: `${slugify(draft.title)}.md`,
      format,
    };
  }

  return {
    content: renderBlogHtml(draft),
    filename: `${slugify(draft.title)}.html`,
    format,
  };
}

export function renderBlogHtml(draft: Pick<BlogDraft, "title" | "content">) {
  let html = draft.content;
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
  html = html.replace(/\n\n/g, "</p><p>");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${draft.title}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 680px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; line-height: 1.7; }
    h1 { font-size: 2.2rem; margin-bottom: 0.5rem; letter-spacing: -0.02em; }
    h2 { font-size: 1.5rem; margin-top: 2.5rem; letter-spacing: -0.01em; }
    h3 { font-size: 1.2rem; margin-top: 2rem; }
    blockquote { border-left: 3px solid #14b8a6; padding-left: 1rem; margin-left: 0; color: #555; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    pre { background: #f4f4f4; padding: 16px; border-radius: 8px; overflow-x: auto; }
    a { color: #14b8a6; }
  </style>
</head>
<body>
<p>${html}</p>
</body>
</html>`;
}

async function getBlogDraftConfig() {
  return getPluginConfig<BlogPluginConfig>(PLUGIN_SLUG, { drafts: [] });
}

async function saveBlogDraftConfig(config: BlogPluginConfig) {
  await savePluginConfig(PLUGIN_SLUG, config);
}

async function requireBlogAIConfig() {
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

async function embedQuery(query: string) {
  try {
    const embeddings = await generateEmbeddings([query]);
    return embeddings?.[0] || null;
  } catch {
    return null;
  }
}

export function slugify(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "blog-draft";
}

