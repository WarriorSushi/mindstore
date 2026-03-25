/**
 * Learning Path Generator — Portable logic for structured learning plans
 *
 * Extracted from: src/app/api/v1/plugins/learning-paths/route.ts
 * Pure functions — no HTTP, no NextRequest/NextResponse.
 * AI calling injected via parameter (use shared ai-caller.ts).
 *
 * Key features:
 *   - Generate structured learning curricula from a topic + existing knowledge
 *   - Track progress per-node with completion status + notes
 *   - Suggest learning topics based on user's memory corpus
 *   - Link path nodes to related existing memories
 */

// ─── Types ───────────────────────────────────────────────────

export type NodeType = 'concept' | 'practice' | 'project' | 'reading' | 'milestone';
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'mixed';

export interface PathResource {
  title: string;
  type: 'article' | 'video' | 'book' | 'exercise' | 'tool';
  url?: string;
}

export interface PathNode {
  id: string;
  title: string;
  description: string;
  type: NodeType;
  depth: 'beginner' | 'intermediate' | 'advanced';
  estimatedMinutes: number;
  completed: boolean;
  completedAt?: string;
  note?: string;
  resources: PathResource[];
  dependencies: string[]; // IDs of prerequisite nodes
  relatedMemoryIds: string[];
  relatedMemoryTitles: string[];
}

export interface ExistingKnowledge {
  id?: string;
  title: string;
  preview: string;
  sourceType: string;
  content?: string; // longer text for node matching
}

export interface LearningPath {
  id: string;
  topic: string;
  description: string;
  difficulty: DifficultyLevel;
  estimatedHours: number;
  nodes: PathNode[];
  progress: number; // 0-100
  existingKnowledge: { title: string; preview: string; sourceType: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface LearningPathSummary {
  id: string;
  topic: string;
  description: string;
  difficulty: DifficultyLevel;
  estimatedHours: number;
  nodeCount: number;
  completedNodes: number;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface LearningTopicSuggestion {
  topic: string;
  reason: string;
  difficulty: DifficultyLevel;
  estimatedHours: number;
}

// ─── Constants ───────────────────────────────────────────────

export const MAX_PATHS = 20;
export const MAX_NODES_PER_PATH = 20;

// ─── ID Generation ───────────────────────────────────────────

export function generatePathId(): string {
  return `path-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Summarize ───────────────────────────────────────────────

/**
 * Convert full learning paths to lightweight summaries.
 */
export function summarizePaths(paths: LearningPath[]): LearningPathSummary[] {
  return paths.map(p => ({
    id: p.id,
    topic: p.topic,
    description: p.description,
    difficulty: p.difficulty,
    estimatedHours: p.estimatedHours,
    nodeCount: p.nodes.length,
    completedNodes: p.nodes.filter(n => n.completed).length,
    progress: p.progress,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
}

// ─── Progress Tracking ───────────────────────────────────────

/**
 * Update node completion status and recalculate path progress.
 * Mutates the path in place.
 */
export function updateNodeProgress(
  path: LearningPath,
  nodeId: string,
  completed: boolean
): PathNode {
  const node = path.nodes.find(n => n.id === nodeId);
  if (!node) throw new Error(`Node not found: ${nodeId}`);

  node.completed = completed;
  node.completedAt = completed ? new Date().toISOString() : undefined;

  // Recalculate progress
  const completedCount = path.nodes.filter(n => n.completed).length;
  path.progress = Math.round((completedCount / path.nodes.length) * 100);
  path.updatedAt = new Date().toISOString();

  return node;
}

/**
 * Add a personal note to a path node.
 * Mutates the path in place.
 */
export function addNodeNote(
  path: LearningPath,
  nodeId: string,
  note: string
): PathNode {
  const node = path.nodes.find(n => n.id === nodeId);
  if (!node) throw new Error(`Node not found: ${nodeId}`);

  node.note = note || '';
  path.updatedAt = new Date().toISOString();

  return node;
}

// ─── AI Prompt Builders ──────────────────────────────────────

/**
 * Build the AI prompt for generating a learning path.
 * Returns { system, prompt } — caller passes them to their AI caller.
 */
export function buildPathGenerationPrompt(
  topic: string,
  existingKnowledge: ExistingKnowledge[],
  userContext?: string
): { system: string; prompt: string } {
  const knowledgeContext = existingKnowledge.length > 0
    ? `\n\nThe user already has ${existingKnowledge.length} related memories:\n` +
      existingKnowledge.map(m => `- "${m.title}": ${m.preview}`).join('\n')
    : '\n\nThe user has NO existing knowledge about this topic — start from scratch.';

  const additionalContext = userContext ? `\n\nUser's additional context: ${userContext}` : '';

  const system = 'You are an expert curriculum designer. Create practical, well-structured learning paths that build knowledge progressively. Be specific — avoid vague advice. Every node should teach something concrete and testable.';

  const prompt = `Create a structured learning path for: "${topic}"${additionalContext}${knowledgeContext}

Design a learning curriculum with 8-15 nodes. Each node is a specific learning step.

Rules:
- If user already knows something, mark prerequisite nodes as things they can skip or review briefly
- Include a mix of: concept (theory), practice (hands-on), project (build something), reading (study material), milestone (checkpoint)
- Order nodes logically — later nodes depend on earlier ones
- Estimate realistic minutes for each node (15-120 min range)
- Suggest 1-3 specific resources per node (real books, tools, websites — not made up URLs)
- Nodes at beginning should be simpler, progressively harder

Return ONLY valid JSON (no markdown fences):
{
  "description": "One sentence description of what you'll learn",
  "difficulty": "beginner|intermediate|advanced|mixed",
  "nodes": [
    {
      "id": "node-1",
      "title": "Node title",
      "description": "What you'll learn and why it matters. 2-3 sentences.",
      "type": "concept|practice|project|reading|milestone",
      "depth": "beginner|intermediate|advanced",
      "estimatedMinutes": 30,
      "dependencies": [],
      "resources": [{"title": "Resource name", "type": "article|video|book|exercise|tool"}]
    }
  ]
}`;

  return { system, prompt };
}

/**
 * Build the AI prompt for topic suggestions based on recent memories.
 */
export function buildLearningPathSuggestionPrompt(
  memoryContext: string
): { system: string; prompt: string } {
  const system = 'You are a curriculum designer. Suggest highly specific, practical learning paths — not vague categories. Each topic should be learnable in 2-20 hours.';

  const prompt = `Based on this person's recent knowledge and memories, suggest 6 learning topics they'd benefit from. Consider what they already know and what logical next steps would deepen or broaden their expertise.

Recent memories:
${memoryContext}

Return ONLY a JSON array: [{"topic": "specific topic", "reason": "why this is valuable for them", "difficulty": "beginner|intermediate|advanced", "estimatedHours": number}]
No markdown fences. JSON only.`;

  return { system, prompt };
}

// ─── AI Response Parsers ─────────────────────────────────────

/**
 * Parse AI response into a LearningPath object.
 * Returns null if parsing fails.
 */
export function parseLearningPath(
  aiResponse: string,
  topic: string,
  existingKnowledge: ExistingKnowledge[]
): LearningPath | null {
  let parsed: any;
  try {
    const cleaned = aiResponse.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }

  const pathId = generatePathId();

  const nodes: PathNode[] = (parsed.nodes || []).slice(0, MAX_NODES_PER_PATH).map((n: any, i: number) => ({
    id: n.id || `node-${i + 1}`,
    title: n.title || `Step ${i + 1}`,
    description: n.description || '',
    type: n.type || 'concept',
    depth: n.depth || 'beginner',
    estimatedMinutes: n.estimatedMinutes || 30,
    completed: false,
    note: '',
    resources: (n.resources || []).map((r: any) => ({
      title: r.title || 'Resource',
      type: r.type || 'article',
      url: r.url,
    })),
    dependencies: n.dependencies || [],
    relatedMemoryIds: [] as string[],
    relatedMemoryTitles: [] as string[],
  }));

  // Link related memories to nodes via keyword matching
  for (const node of nodes) {
    const related = existingKnowledge.filter(m => {
      const nodeWord = node.title.toLowerCase().split(' ')[0];
      const memWord = m.title.toLowerCase().split(' ')[0];
      const memContent = (m.content || m.preview || '').toLowerCase();
      return memContent.includes(nodeWord) || node.title.toLowerCase().includes(memWord);
    });
    node.relatedMemoryIds = related.filter(r => r.id).map(r => r.id!).slice(0, 3);
    node.relatedMemoryTitles = related.map(r => r.title).slice(0, 3);
  }

  const totalMinutes = nodes.reduce((s, n) => s + n.estimatedMinutes, 0);

  return {
    id: pathId,
    topic,
    description: parsed.description || `Learning path for ${topic}`,
    difficulty: parsed.difficulty || 'mixed',
    estimatedHours: Math.round(totalMinutes / 60 * 10) / 10,
    nodes,
    progress: 0,
    existingKnowledge: existingKnowledge.map(m => ({
      title: m.title,
      preview: m.preview,
      sourceType: m.sourceType,
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Parse AI response into topic suggestions.
 * Returns empty array if parsing fails.
 */
export function parseSuggestions(aiResponse: string): LearningTopicSuggestion[] {
  try {
    const cleaned = aiResponse.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const suggestions = JSON.parse(cleaned);
    if (!Array.isArray(suggestions)) return [];
    return suggestions.slice(0, 6).map((s: any) => ({
      topic: String(s.topic || ''),
      reason: String(s.reason || ''),
      difficulty: s.difficulty || 'intermediate',
      estimatedHours: Number(s.estimatedHours) || 5,
    }));
  } catch {
    return [];
  }
}
