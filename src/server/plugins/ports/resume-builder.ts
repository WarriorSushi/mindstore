import { sql } from "drizzle-orm";
import { callTextPrompt, getTextGenerationConfig } from "@/server/ai-client";
import { db } from "@/server/db";
import { generateEmbeddings } from "@/server/embeddings";
import { retrieve } from "@/server/retrieval";
import {
  createPluginScopedId,
  ensurePluginInstalled,
  getPluginConfig,
  savePluginConfig,
} from "@/server/plugins/ports/plugin-config";

const PLUGIN_SLUG = "resume-builder";
const MAX_RESUMES = 10;

export interface ResumeSection {
  id: string;
  type: "header" | "summary" | "experience" | "education" | "skills" | "projects" | "certifications" | "languages" | "interests" | "custom";
  title: string;
  content: string;
  visible: boolean;
  order: number;
}

export interface Resume {
  id: string;
  title: string;
  targetRole: string;
  template: string;
  sections: ResumeSection[];
  sourceMemoryIds: string[];
  sourceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeSummary {
  id: string;
  title: string;
  targetRole: string;
  template: string;
  sectionCount: number;
  sourceCount: number;
  createdAt: string;
  updatedAt: string;
  preview: string;
}

export interface ResumeTemplate {
  id: string;
  name: string;
  description: string;
  sections: string[];
}

interface ResumePluginConfig {
  resumes: Resume[];
}

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  {
    id: "modern",
    name: "Modern",
    description: "Clean, minimal layout with strong typography. Best for tech roles.",
    sections: ["header", "summary", "experience", "skills", "projects", "education"],
  },
  {
    id: "classic",
    name: "Classic",
    description: "Traditional chronological format. Universally accepted.",
    sections: ["header", "summary", "experience", "education", "skills", "certifications"],
  },
  {
    id: "creative",
    name: "Creative",
    description: "Projects-first layout for portfolio-driven roles.",
    sections: ["header", "summary", "projects", "experience", "skills", "interests"],
  },
  {
    id: "executive",
    name: "Executive",
    description: "Leadership-focused with achievements and impact metrics.",
    sections: ["header", "summary", "experience", "certifications", "education", "languages"],
  },
];

const SECTION_DEFAULTS: Record<string, { title: string; type: ResumeSection["type"] }> = {
  header: { title: "Contact Information", type: "header" },
  summary: { title: "Professional Summary", type: "summary" },
  experience: { title: "Work Experience", type: "experience" },
  education: { title: "Education", type: "education" },
  skills: { title: "Technical Skills", type: "skills" },
  projects: { title: "Projects", type: "projects" },
  certifications: { title: "Certifications & Awards", type: "certifications" },
  languages: { title: "Languages", type: "languages" },
  interests: { title: "Interests", type: "interests" },
};

export async function ensureResumeBuilderInstalled() {
  await ensurePluginInstalled(PLUGIN_SLUG);
}

export async function listResumes(): Promise<ResumeSummary[]> {
  const config = await getResumeConfig();
  return config.resumes.map((resume) => ({
    id: resume.id,
    title: resume.title,
    targetRole: resume.targetRole,
    template: resume.template,
    sectionCount: resume.sections.filter((section) => section.visible).length,
    sourceCount: resume.sourceCount,
    createdAt: resume.createdAt,
    updatedAt: resume.updatedAt,
    preview: resume.sections.find((section) => section.type === "summary")?.content.slice(0, 150) || "",
  }));
}

export async function getResume(id: string): Promise<Resume | null> {
  const config = await getResumeConfig();
  return config.resumes.find((resume) => resume.id === id) || null;
}

export async function generateResume(
  userId: string,
  input: { targetRole: string; template?: string; additionalContext?: string },
) {
  const targetRole = input.targetRole.trim();
  if (!targetRole) {
    throw new Error("Target role required");
  }

  const config = await getResumeConfig();
  if (config.resumes.length >= MAX_RESUMES) {
    throw new Error(`Maximum ${MAX_RESUMES} resumes. Delete one to create new.`);
  }

  const template = RESUME_TEMPLATES.find((entry) => entry.id === (input.template || "modern")) || RESUME_TEMPLATES[0]!;
  const memories = await searchProfessionalMemories(targetRole, userId);
  if (!memories.length) {
    throw new Error("No relevant memories found. Import some professional content first.");
  }

  const aiConfig = await requireResumeAIConfig();
  const userFacts = memories.find((memory) => memory.id === "__user_facts__")?.content || "";
  const memoryContext = memories
    .filter((memory) => memory.id !== "__user_facts__")
    .map((memory, index) => `[Memory ${index + 1}: ${memory.title}]\n${memory.content}`)
    .join("\n\n---\n\n");

  const response = await callTextPrompt(
    aiConfig,
    `Generate a professional resume for: ${targetRole}

Template: ${template.name} (${template.description})
${userFacts ? `\nUser profile facts:\n${userFacts}\n` : ""}
Memories to extract from:
${memoryContext}
${input.additionalContext?.trim() ? `\nAdditional context:\n${input.additionalContext.trim()}\n` : ""}

Return ONLY valid JSON:
{
  "sections": [
    ${template.sections.map((section) => {
      const defaults = SECTION_DEFAULTS[section] || { title: section, type: "custom" };
      return `{ "type": "${defaults.type}", "title": "${defaults.title}", "content": "markdown" }`;
    }).join(",\n    ")}
  ]
}

Guidelines:
- Use strong action verbs.
- Quantify achievements when supported by the memories.
- Tailor the language to ${targetRole}.
- Use markdown bullet lists when helpful.
- If information is missing, write a clear [TODO: ...] placeholder instead of inventing facts.`,
    "You are an expert resume writer. Create ATS-friendly, honest, and compelling resume sections using only the information in the provided memories.",
    { temperature: 0.3, maxTokens: 6000 },
  );

  if (!response) {
    throw new Error("AI generation failed. Try again.");
  }

  const parsed = JSON.parse(extractJsonObject(response));
  const sections: ResumeSection[] = Array.isArray(parsed.sections)
    ? parsed.sections.map((section: Record<string, unknown>, index: number) => ({
      id: createPluginScopedId("sec"),
      type: normalizeResumeSectionType(section.type),
      title: typeof section.title === "string" ? section.title : "Section",
      content: typeof section.content === "string" ? section.content : "",
      visible: true,
      order: index,
    }))
    : [];

  const sourceMemoryIds = memories.filter((memory) => memory.id !== "__user_facts__").map((memory) => memory.id);
  const resume: Resume = {
    id: createPluginScopedId("res"),
    title: `${targetRole} Resume`,
    targetRole,
    template: template.id,
    sections,
    sourceMemoryIds,
    sourceCount: sourceMemoryIds.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  config.resumes.unshift(resume);
  await saveResumeConfig(config);
  return resume;
}

export async function updateResume(input: {
  id: string;
  sectionId?: string;
  content?: string;
  title?: string;
  visible?: boolean;
  resumeTitle?: string;
  targetRole?: string;
}) {
  const config = await getResumeConfig();
  const resume = config.resumes.find((entry) => entry.id === input.id);
  if (!resume) {
    throw new Error("Resume not found");
  }

  if (input.sectionId) {
    const section = resume.sections.find((entry) => entry.id === input.sectionId);
    if (!section) {
      throw new Error("Section not found");
    }
    if (typeof input.content === "string") {
      section.content = input.content;
    }
    if (typeof input.title === "string") {
      section.title = input.title;
    }
    if (typeof input.visible === "boolean") {
      section.visible = input.visible;
    }
  }

  if (typeof input.resumeTitle === "string") {
    resume.title = input.resumeTitle;
  }
  if (typeof input.targetRole === "string") {
    resume.targetRole = input.targetRole;
  }

  resume.updatedAt = new Date().toISOString();
  await saveResumeConfig(config);
  return resume;
}

export async function refineResumeSection(input: { id: string; sectionId: string; instruction?: string }) {
  const resume = await getResume(input.id);
  if (!resume) {
    throw new Error("Resume not found");
  }
  const section = resume.sections.find((entry) => entry.id === input.sectionId);
  if (!section) {
    throw new Error("Section not found");
  }

  const aiConfig = await requireResumeAIConfig();
  const refined = await callTextPrompt(
    aiConfig,
    `Target role: ${resume.targetRole}

Section: ${section.title}
Current content:
${section.content}

${input.instruction?.trim() ? `Instruction: ${input.instruction.trim()}` : "Make it more impactful with stronger action verbs, metrics, and concise language."}

Return ONLY the refined markdown content.`,
    "You are an expert resume writer. Strengthen clarity, impact, and ATS-friendliness without inventing facts.",
    { temperature: 0.3, maxTokens: 3000 },
  );

  if (!refined) {
    throw new Error("AI refinement failed");
  }

  return refined.trim();
}

export async function addResumeSection(input: { id: string; title?: string; type?: ResumeSection["type"] }) {
  const config = await getResumeConfig();
  const resume = config.resumes.find((entry) => entry.id === input.id);
  if (!resume) {
    throw new Error("Resume not found");
  }

  const section: ResumeSection = {
    id: createPluginScopedId("sec"),
    type: input.type || "custom",
    title: input.title || "Custom Section",
    content: "",
    visible: true,
    order: resume.sections.length,
  };

  resume.sections.push(section);
  resume.updatedAt = new Date().toISOString();
  await saveResumeConfig(config);
  return { section, resume };
}

export async function reorderResumeSections(input: { id: string; sectionIds: string[] }) {
  const config = await getResumeConfig();
  const resume = config.resumes.find((entry) => entry.id === input.id);
  if (!resume) {
    throw new Error("Resume not found");
  }

  const reordered: ResumeSection[] = [];
  for (const id of input.sectionIds) {
    const section = resume.sections.find((entry) => entry.id === id);
    if (section) {
      section.order = reordered.length;
      reordered.push(section);
    }
  }
  for (const section of resume.sections) {
    if (!reordered.some((entry) => entry.id === section.id)) {
      section.order = reordered.length;
      reordered.push(section);
    }
  }

  resume.sections = reordered;
  resume.updatedAt = new Date().toISOString();
  await saveResumeConfig(config);
  return resume;
}

export async function deleteResume(id: string) {
  const config = await getResumeConfig();
  const nextResumes = config.resumes.filter((resume) => resume.id !== id);
  if (nextResumes.length === config.resumes.length) {
    throw new Error("Resume not found");
  }
  await saveResumeConfig({ resumes: nextResumes });
  return { success: true };
}

async function searchProfessionalMemories(targetRole: string, userId: string) {
  const queries = [
    `professional experience work ${targetRole}`,
    "skills technologies tools programming languages",
    "education degree university certification course",
    "projects built achievements accomplishments portfolio",
    "work history career job role responsibilities",
  ];

  const allResults = new Map<string, { id: string; title: string; content: string }>();
  for (const query of queries) {
    try {
      const embedding = await embedResumeQuery(query);
      const results = await retrieve(query, embedding, { userId, limit: 8 });
      for (const result of results) {
        if (!allResults.has(result.memoryId)) {
          allResults.set(result.memoryId, {
            id: result.memoryId,
            title: result.sourceTitle || "Untitled",
            content: result.content.slice(0, 2000),
          });
        }
      }
    } catch {
      // ignore query failure
    }
  }

  try {
    const facts = await db.execute(sql`SELECT fact, category FROM user_facts ORDER BY confidence DESC LIMIT 20`) as Array<{ fact?: string; category?: string }>;
    if (facts.length) {
      allResults.set("__user_facts__", {
        id: "__user_facts__",
        title: "User Profile Facts",
        content: facts.map((fact) => `[${fact.category || "general"}] ${fact.fact || ""}`).join("\n"),
      });
    }
  } catch {
    // user_facts may not exist
  }

  return Array.from(allResults.values()).slice(0, 30);
}

async function getResumeConfig() {
  return getPluginConfig<ResumePluginConfig>(PLUGIN_SLUG, { resumes: [] });
}

async function saveResumeConfig(config: ResumePluginConfig) {
  await savePluginConfig(PLUGIN_SLUG, config);
}

async function requireResumeAIConfig() {
  const aiConfig = await getTextGenerationConfig({
    openai: "gpt-4o-mini",
    openrouter: "anthropic/claude-3.5-haiku",
    gemini: "gemini-2.0-flash-lite",
    ollama: "llama3.2",
    custom: "default",
  });
  if (!aiConfig) {
    throw new Error("No AI provider configured. Go to Settings.");
  }
  return aiConfig;
}

async function embedResumeQuery(query: string) {
  try {
    const embeddings = await generateEmbeddings([query]);
    return embeddings?.[0] || null;
  } catch {
    return null;
  }
}

function extractJsonObject(value: string) {
  const match = value.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Failed to parse AI response. Try again.");
  }
  return match[0];
}

function normalizeResumeSectionType(value: unknown): ResumeSection["type"] {
  if (
    value === "header"
    || value === "summary"
    || value === "experience"
    || value === "education"
    || value === "skills"
    || value === "projects"
    || value === "certifications"
    || value === "languages"
    || value === "interests"
    || value === "custom"
  ) {
    return value;
  }
  return "custom";
}

