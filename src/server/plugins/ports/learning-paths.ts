/**
 * Learning Paths — Portable logic module
 * 
 * Extracted from the route for convergence with codex runtime.
 * Handles: path CRUD, node progress tracking, prompt builders.
 * AI calling injected — will use Codex's shared ai-client.ts.
 */

import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────

export interface PathResource {
  title: string;
  type: 'article' | 'video' | 'book' | 'exercise' | 'tool';
  url?: string;
}

export interface PathNode {
  id: string;
  title: string;
  description: string;
  type: 'concept' | 'practice' | 'project' | 'reading' | 'milestone';
  depth: 'beginner' | 'intermediate' | 'advanced';
  estimatedMinutes: number;
  completed: boolean;
  completedAt?: string;
  note?: string;
  resources: PathResource[];
  dependencies: string[];
  relatedMemoryIds: string[];
  relatedMemoryTitles: string[];
}

export interface LearningPath {
  id: string;
  topic: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'mixed';
  estimatedHours: number;
  nodes: PathNode[];
  progress: number;
  existingKnowledge: { title: string; preview: string; sourceType: string }[];
  createdAt: string;
  updatedAt: string;
}

const PLUGIN_SLUG = 'learning-paths';
const MAX_PATHS = 20;

// ─── Storage ──────────────────────────────────────────────────

export async function getLearningPaths(): Promise<LearningPath[]> {
  try {
    const rows = await db.execute(sql`SELECT config FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
    const config = (rows as any[])?.[0]?.config;
    if (!config) return [];
    const parsed = typeof config === 'string' ? JSON.parse(config) : config;
    return parsed.paths || [];
  } catch { return []; }
}

export async function saveLearningPaths(paths: LearningPath[]): Promise<void> {
  const trimmed = paths.length > MAX_PATHS ? paths.slice(0, MAX_PATHS) : paths;
  await db.execute(sql`
    UPDATE plugins SET config = ${JSON.stringify({ paths: trimmed })}::jsonb, updated_at = NOW()
    WHERE slug = ${PLUGIN_SLUG}
  `);
}

export async function getPathById(id: string): Promise<LearningPath | null> {
  const paths = await getLearningPaths();
  return paths.find(p => p.id === id) || null;
}

export async function deletePath(id: string): Promise<void> {
  const paths = await getLearningPaths();
  const idx = paths.findIndex(p => p.id === id);
  if (idx === -1) throw new Error('Path not found');
  paths.splice(idx, 1);
  await saveLearningPaths(paths);
}

// ─── Progress Tracking ───────────────────────────────────────

export async function updateNodeProgress(
  pathId: string,
  nodeId: string,
  completed: boolean,
): Promise<LearningPath> {
  const paths = await getLearningPaths();
  const path = paths.find(p => p.id === pathId);
  if (!path) throw new Error('Path not found');

  const node = path.nodes.find(n => n.id === nodeId);
  if (!node) throw new Error('Node not found');

  node.completed = completed;
  node.completedAt = completed ? new Date().toISOString() : undefined;

  const completedCount = path.nodes.filter(n => n.completed).length;
  path.progress = Math.round((completedCount / path.nodes.length) * 100);
  path.updatedAt = new Date().toISOString();

  await saveLearningPaths(paths);
  return path;
}

export async function addNodeNote(
  pathId: string,
  nodeId: string,
  note: string,
): Promise<LearningPath> {
  const paths = await getLearningPaths();
  const path = paths.find(p => p.id === pathId);
  if (!path) throw new Error('Path not found');

  const node = path.nodes.find(n => n.id === nodeId);
  if (!node) throw new Error('Node not found');

  node.note = note || '';
  path.updatedAt = new Date().toISOString();

  await saveLearningPaths(paths);
  return path;
}

// ─── Path Creation ────────────────────────────────────────────

export function generatePathId(): string {
  return `path-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createPathFromAI(
  topic: string,
  parsed: { description?: string; difficulty?: string; nodes?: any[] },
  existingKnowledge: { id: string; title: string; preview: string; sourceType: string; content: string }[],
): LearningPath {
  const nodes: PathNode[] = (parsed.nodes || []).map((n: any, i: number) => ({
    id: n.id || `node-${i + 1}`,
    title: n.title || `Step ${i + 1}`,
    description: n.description || '',
    type: n.type || 'concept',
    depth: n.depth || 'beginner',
    estimatedMinutes: n.estimatedMinutes || 30,
    completed: false,
    note: '',
    resources: (n.resources || []).map((r: any) => ({
      title: r.title || 'Resource', type: r.type || 'article', url: r.url,
    })),
    dependencies: n.dependencies || [],
    relatedMemoryIds: [],
    relatedMemoryTitles: [],
  }));

  // Link related memories
  for (const node of nodes) {
    const related = existingKnowledge.filter(m =>
      m.content.toLowerCase().includes(node.title.toLowerCase().split(' ')[0]!) ||
      node.title.toLowerCase().includes(m.title.toLowerCase().split(' ')[0]!)
    );
    node.relatedMemoryIds = related.map(r => r.id).slice(0, 3);
    node.relatedMemoryTitles = related.map(r => r.title).slice(0, 3);
  }

  const totalMinutes = nodes.reduce((s, n) => s + n.estimatedMinutes, 0);

  return {
    id: generatePathId(),
    topic,
    description: parsed.description || `Learning path for ${topic}`,
    difficulty: (parsed.difficulty as LearningPath['difficulty']) || 'mixed',
    estimatedHours: Math.round(totalMinutes / 60 * 10) / 10,
    nodes, progress: 0,
    existingKnowledge: existingKnowledge.map(m => ({ title: m.title, preview: m.preview, sourceType: m.sourceType })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── Prompt Builders ──────────────────────────────────────────

export function buildGeneratePrompt(
  topic: string,
  knowledgeContext: string,
  additionalContext?: string,
): { system: string; prompt: string } {
  return {
    system: 'You are an expert curriculum designer. Create practical, well-structured learning paths that build knowledge progressively. Be specific — avoid vague advice.',
    prompt: `Create a structured learning path for: "${topic}"${additionalContext ? `\n\nUser context: ${additionalContext}` : ''}${knowledgeContext}

Design a curriculum with 8-15 nodes. Rules:
- Mix of: concept (theory), practice (hands-on), project (build), reading (study), milestone (checkpoint)
- Order logically — later nodes depend on earlier ones
- Estimate realistic minutes (15-120 per node)
- Suggest 1-3 specific resources per node
- Progressive difficulty

Return ONLY valid JSON:
{
  "description": "One sentence description",
  "difficulty": "beginner|intermediate|advanced|mixed",
  "nodes": [
    {
      "id": "node-1",
      "title": "Node title",
      "description": "What you'll learn. 2-3 sentences.",
      "type": "concept|practice|project|reading|milestone",
      "depth": "beginner|intermediate|advanced",
      "estimatedMinutes": 30,
      "dependencies": [],
      "resources": [{"title": "Resource name", "type": "article|video|book|exercise|tool"}]
    }
  ]
}`,
  };
}

export function buildSuggestionPrompt(memoryContext: string): { system: string; prompt: string } {
  return {
    system: 'You are a curriculum designer. Suggest highly specific, practical learning paths — not vague categories.',
    prompt: `Based on this person's recent knowledge, suggest 6 learning topics they'd benefit from.

Recent memories:
${memoryContext}

Return ONLY a JSON array: [{"topic": "specific topic", "reason": "why valuable", "difficulty": "beginner|intermediate|advanced", "estimatedHours": number}]`,
  };
}

// ─── Search Queries ───────────────────────────────────────────

export function getLearningSearchQueries(topic: string): string[] {
  return [topic, `${topic} fundamentals`, `${topic} advanced`];
}
