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

const PLUGIN_SLUG = "learning-paths";

export interface LearningPathResource {
  title: string;
  type: "article" | "video" | "book" | "exercise" | "tool";
  url?: string;
}

export interface LearningPathNode {
  id: string;
  title: string;
  description: string;
  type: "concept" | "practice" | "project" | "reading" | "milestone";
  depth: "beginner" | "intermediate" | "advanced";
  estimatedMinutes: number;
  completed: boolean;
  completedAt?: string;
  note?: string;
  resources: LearningPathResource[];
  dependencies: string[];
  relatedMemoryIds: string[];
  relatedMemoryTitles: string[];
}

export interface LearningPath {
  id: string;
  topic: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced" | "mixed";
  estimatedHours: number;
  nodes: LearningPathNode[];
  progress: number;
  existingKnowledge: Array<{ title: string; preview: string; sourceType: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface LearningPathSummary {
  id: string;
  topic: string;
  description: string;
  difficulty: LearningPath["difficulty"];
  estimatedHours: number;
  nodeCount: number;
  completedNodes: number;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface LearningPathSuggestion {
  topic: string;
  reason: string;
  difficulty: LearningPath["difficulty"];
  estimatedHours: number;
}

interface LearningPathsConfig {
  paths: LearningPath[];
}

export async function ensureLearningPathsInstalled() {
  await ensurePluginInstalled(PLUGIN_SLUG);
}

export async function listLearningPaths(): Promise<LearningPathSummary[]> {
  const config = await getLearningPathsConfig();
  return config.paths.map((path) => ({
    id: path.id,
    topic: path.topic,
    description: path.description,
    difficulty: path.difficulty,
    estimatedHours: path.estimatedHours,
    nodeCount: path.nodes.length,
    completedNodes: path.nodes.filter((node) => node.completed).length,
    progress: path.progress,
    createdAt: path.createdAt,
    updatedAt: path.updatedAt,
  }));
}

export async function getLearningPath(id: string): Promise<LearningPath | null> {
  const config = await getLearningPathsConfig();
  return config.paths.find((path) => path.id === id) || null;
}

export async function suggestLearningTopics(userId: string) {
  const aiConfig = await requireLearningAIConfig();
  const embedding = await embedLearningQuery("recent learning interests");
  const results = await retrieve("recent learning interests", embedding, { userId, limit: 30 });
  const knowledgeContext = results
    .map((result) => `[${result.sourceType}] ${result.sourceTitle || "Untitled"}: ${result.content.slice(0, 150)}`)
    .join("\n");

  const response = await callTextPrompt(
    aiConfig,
    `Based on this person's recent knowledge and memories, suggest 6 learning topics they'd benefit from.

Recent memories:
${knowledgeContext}

Return ONLY a JSON array:
[{"topic": "specific topic", "reason": "why this is valuable", "difficulty": "beginner|intermediate|advanced", "estimatedHours": number}]`,
    "You are a curriculum designer. Suggest highly specific, practical learning paths rather than vague categories.",
    { temperature: 0.5, maxTokens: 2048 },
  );

  if (!response) {
    return [] as LearningPathSuggestion[];
  }

  try {
    const suggestions = parseJsonValue<LearningPathSuggestion[]>(response);
    return Array.isArray(suggestions) ? suggestions.slice(0, 6) : [];
  } catch {
    return [] as LearningPathSuggestion[];
  }
}

export async function generateLearningPath(
  userId: string,
  input: { topic: string; context?: string },
) {
  const topic = input.topic.trim();
  if (!topic) {
    throw new Error("Missing topic");
  }

  const aiConfig = await requireLearningAIConfig();
  const searchQueries = [topic, `${topic} fundamentals`, `${topic} advanced`];
  const allResults: Awaited<ReturnType<typeof retrieve>> = [];
  const seen = new Set<string>();

  for (const query of searchQueries) {
    const embedding = await embedLearningQuery(query);
    const results = await retrieve(query, embedding, { userId, limit: 10 });
    for (const result of results) {
      if (!seen.has(result.memoryId)) {
        seen.add(result.memoryId);
        allResults.push(result);
      }
    }
  }

  const existingKnowledge = allResults.slice(0, 15).map((result) => ({
    id: result.memoryId,
    title: result.sourceTitle || "Untitled",
    preview: result.content.slice(0, 200),
    sourceType: result.sourceType,
    content: result.content.slice(0, 500),
  }));

  const knowledgeContext = existingKnowledge.length
    ? `The user already has ${existingKnowledge.length} related memories:\n${existingKnowledge.map((memory) => `- "${memory.title}": ${memory.preview}`).join("\n")}`
    : "The user has no existing knowledge about this topic. Start from scratch.";

  const response = await callTextPrompt(
    aiConfig,
    `Create a structured learning path for: "${topic}"
${input.context?.trim() ? `\nUser context: ${input.context.trim()}` : ""}

${knowledgeContext}

Design a learning curriculum with 8-15 nodes.

Rules:
- If the user already knows something, mark early nodes as reviewable or skippable.
- Include a mix of concept, practice, project, reading, and milestone nodes.
- Order nodes logically with dependencies.
- Estimate realistic minutes per node (15-120).
- Suggest 1-3 specific resources per node when possible.

Return ONLY valid JSON:
{
  "description": "one sentence description",
  "difficulty": "beginner|intermediate|advanced|mixed",
  "nodes": [
    {
      "id": "node-1",
      "title": "Node title",
      "description": "What this step covers",
      "type": "concept|practice|project|reading|milestone",
      "depth": "beginner|intermediate|advanced",
      "estimatedMinutes": 30,
      "dependencies": [],
      "resources": [{"title": "Resource name", "type": "article|video|book|exercise|tool"}]
    }
  ]
}`,
    "You are an expert curriculum designer. Create practical, progressive learning paths with concrete steps.",
    { temperature: 0.5, maxTokens: 6144 },
  );

  if (!response) {
    throw new Error("AI generation failed");
  }

  const parsed = parseJsonValue<{
    description?: string;
    difficulty?: LearningPath["difficulty"];
    nodes?: Array<Partial<LearningPathNode>>;
  }>(response);

  const nodes: LearningPathNode[] = (parsed.nodes || []).map((node, index) => ({
    id: typeof node.id === "string" ? node.id : `node-${index + 1}`,
    title: typeof node.title === "string" ? node.title : `Step ${index + 1}`,
    description: typeof node.description === "string" ? node.description : "",
    type: normalizeLearningNodeType(node.type),
    depth: normalizeLearningDepth(node.depth),
    estimatedMinutes: typeof node.estimatedMinutes === "number" ? node.estimatedMinutes : 30,
    completed: false,
    resources: Array.isArray(node.resources)
      ? node.resources.map((resource) => ({
        title: typeof resource?.title === "string" ? resource.title : "Resource",
        type: normalizeLearningResourceType(resource?.type),
        url: typeof resource?.url === "string" ? resource.url : undefined,
      }))
      : [],
    dependencies: Array.isArray(node.dependencies) ? node.dependencies.map(String) : [],
    relatedMemoryIds: [],
    relatedMemoryTitles: [],
  }));

  for (const node of nodes) {
    const related = existingKnowledge.filter((memory) =>
      memory.content.toLowerCase().includes(node.title.toLowerCase().split(" ")[0] || "")
      || node.title.toLowerCase().includes(memory.title.toLowerCase().split(" ")[0] || ""),
    );
    node.relatedMemoryIds = related.map((memory) => memory.id).slice(0, 3);
    node.relatedMemoryTitles = related.map((memory) => memory.title).slice(0, 3);
  }

  const totalMinutes = nodes.reduce((sum, node) => sum + node.estimatedMinutes, 0);
  const path: LearningPath = {
    id: createPluginScopedId("path"),
    topic,
    description: parsed.description || `Learning path for ${topic}`,
    difficulty: normalizeLearningDifficulty(parsed.difficulty),
    estimatedHours: Math.round((totalMinutes / 60) * 10) / 10,
    nodes,
    progress: 0,
    existingKnowledge: existingKnowledge.map((memory) => ({
      title: memory.title,
      preview: memory.preview,
      sourceType: memory.sourceType,
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const config = await getLearningPathsConfig();
  config.paths.unshift(path);
  config.paths = config.paths.slice(0, 20);
  await saveLearningPathsConfig(config);
  return path;
}

export async function updateLearningPathProgress(input: { pathId: string; nodeId: string; completed: boolean }) {
  const config = await getLearningPathsConfig();
  const path = config.paths.find((entry) => entry.id === input.pathId);
  if (!path) {
    throw new Error("Path not found");
  }
  const node = path.nodes.find((entry) => entry.id === input.nodeId);
  if (!node) {
    throw new Error("Node not found");
  }

  node.completed = input.completed;
  node.completedAt = input.completed ? new Date().toISOString() : undefined;
  path.progress = computeLearningPathProgress(path.nodes);
  path.updatedAt = new Date().toISOString();

  await saveLearningPathsConfig(config);
  return path;
}

export async function addLearningPathNote(input: { pathId: string; nodeId: string; note: string }) {
  const config = await getLearningPathsConfig();
  const path = config.paths.find((entry) => entry.id === input.pathId);
  if (!path) {
    throw new Error("Path not found");
  }
  const node = path.nodes.find((entry) => entry.id === input.nodeId);
  if (!node) {
    throw new Error("Node not found");
  }

  node.note = input.note || "";
  path.updatedAt = new Date().toISOString();
  await saveLearningPathsConfig(config);
  return path;
}

export async function deleteLearningPath(id: string) {
  const config = await getLearningPathsConfig();
  const nextPaths = config.paths.filter((path) => path.id !== id);
  if (nextPaths.length === config.paths.length) {
    throw new Error("Path not found");
  }
  await saveLearningPathsConfig({ paths: nextPaths });
  return { success: true };
}

export function computeLearningPathProgress(nodes: LearningPathNode[]) {
  if (!nodes.length) {
    return 0;
  }
  const completedCount = nodes.filter((node) => node.completed).length;
  return Math.round((completedCount / nodes.length) * 100);
}

async function getLearningPathsConfig() {
  return getPluginConfig<LearningPathsConfig>(PLUGIN_SLUG, { paths: [] });
}

async function saveLearningPathsConfig(config: LearningPathsConfig) {
  await savePluginConfig(PLUGIN_SLUG, config);
}

async function requireLearningAIConfig() {
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

async function embedLearningQuery(query: string) {
  try {
    const embeddings = await generateEmbeddings([query]);
    return embeddings?.[0] || null;
  } catch {
    return null;
  }
}

export function normalizeLearningDifficulty(value: unknown): LearningPath["difficulty"] {
  if (value === "beginner" || value === "intermediate" || value === "advanced" || value === "mixed") {
    return value;
  }
  return "mixed";
}

export function normalizeLearningNodeType(value: unknown): LearningPathNode["type"] {
  if (value === "concept" || value === "practice" || value === "project" || value === "reading" || value === "milestone") {
    return value;
  }
  return "concept";
}

export function normalizeLearningDepth(value: unknown): LearningPathNode["depth"] {
  if (value === "beginner" || value === "intermediate" || value === "advanced") {
    return value;
  }
  return "beginner";
}

export function normalizeLearningResourceType(value: unknown): LearningPathResource["type"] {
  if (value === "article" || value === "video" || value === "book" || value === "exercise" || value === "tool") {
    return value;
  }
  return "article";
}
