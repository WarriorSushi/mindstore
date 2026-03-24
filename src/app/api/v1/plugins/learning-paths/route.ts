import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { retrieve } from '@/server/retrieval';
import { generateEmbeddings } from '@/server/embeddings';
import { sql } from 'drizzle-orm';

/**
 * Learning Path Generator Plugin
 *
 * Creates structured learning plans based on your knowledge gaps and interests.
 * Uses AI to analyze what you know, identify gaps, and suggest a curriculum.
 *
 * GET  ?action=list              — List all saved learning paths
 * GET  ?action=get&id=           — Get a single learning path
 * GET  ?action=suggestions       — Get AI-suggested topics to explore
 * POST ?action=generate          — Generate a new learning path for a topic
 * POST ?action=update-progress   — Mark a node as complete/incomplete
 * POST ?action=delete&id=        — Delete a learning path
 * POST ?action=add-note          — Add a personal note to a path node
 */

const PLUGIN_SLUG = 'learning-paths';

// ─── Types ───────────────────────────────────────────────────

interface PathNode {
  id: string;
  title: string;
  description: string;
  type: 'concept' | 'practice' | 'project' | 'reading' | 'milestone';
  depth: 'beginner' | 'intermediate' | 'advanced';
  estimatedMinutes: number;
  completed: boolean;
  completedAt?: string;
  note?: string;
  resources: { title: string; type: 'article' | 'video' | 'book' | 'exercise' | 'tool'; url?: string }[];
  dependencies: string[]; // IDs of prerequisite nodes
  relatedMemoryIds: string[];
  relatedMemoryTitles: string[];
}

interface LearningPath {
  id: string;
  topic: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'mixed';
  estimatedHours: number;
  nodes: PathNode[];
  progress: number; // 0-100
  existingKnowledge: { title: string; preview: string; sourceType: string }[];
  createdAt: string;
  updatedAt: string;
}

// ─── Auto-install ────────────────────────────────────────────

async function ensurePluginInstalled() {
  try {
    const existing = await db.execute(sql`SELECT id FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
    if ((existing as any[]).length === 0) {
      await db.execute(sql`
        INSERT INTO plugins (slug, name, description, type, status, icon, category)
        VALUES (
          ${PLUGIN_SLUG},
          'Learning Path Generator',
          'Structured learning plans based on your knowledge gaps. AI-designed curriculum from what you already know.',
          'extension',
          'active',
          'Route',
          'action'
        )
      `);
    }
  } catch {}
}

// ─── AI Config ───────────────────────────────────────────────

interface AIConfig {
  type: 'openai-compatible' | 'gemini' | 'ollama';
  url: string;
  key?: string;
  model: string;
  extraHeaders?: Record<string, string>;
}

function getAIConfig(config: Record<string, string>): AIConfig | null {
  const preferred = config.chat_provider;
  const openaiKey = config.openai_api_key || process.env.OPENAI_API_KEY;
  const geminiKey = config.gemini_api_key || process.env.GEMINI_API_KEY;
  const ollamaUrl = config.ollama_url || process.env.OLLAMA_URL;
  const openrouterKey = config.openrouter_api_key || process.env.OPENROUTER_API_KEY;
  const customKey = config.custom_api_key;
  const customUrl = config.custom_api_url;
  const customModel = config.custom_api_model;

  if (preferred === 'openrouter' && openrouterKey) {
    return { type: 'openai-compatible', url: 'https://openrouter.ai/api/v1/chat/completions', key: openrouterKey, model: 'anthropic/claude-3.5-haiku', extraHeaders: { 'HTTP-Referer': 'https://mindstore.app', 'X-Title': 'MindStore' } };
  }
  if (preferred === 'custom' && customKey && customUrl) {
    return { type: 'openai-compatible', url: customUrl, key: customKey, model: customModel || 'default' };
  }
  if (preferred === 'gemini' && geminiKey) {
    return { type: 'gemini', url: '', key: geminiKey, model: 'gemini-2.0-flash' };
  }
  if (preferred === 'openai' && openaiKey) {
    return { type: 'openai-compatible', url: 'https://api.openai.com/v1/chat/completions', key: openaiKey, model: 'gpt-4o-mini' };
  }
  if (preferred === 'ollama' && ollamaUrl) {
    return { type: 'ollama', url: ollamaUrl, model: 'llama3.2' };
  }

  if (geminiKey) return { type: 'gemini', url: '', key: geminiKey, model: 'gemini-2.0-flash' };
  if (openaiKey) return { type: 'openai-compatible', url: 'https://api.openai.com/v1/chat/completions', key: openaiKey, model: 'gpt-4o-mini' };
  if (openrouterKey) return { type: 'openai-compatible', url: 'https://openrouter.ai/api/v1/chat/completions', key: openrouterKey, model: 'anthropic/claude-3.5-haiku', extraHeaders: { 'HTTP-Referer': 'https://mindstore.app', 'X-Title': 'MindStore' } };
  if (customKey && customUrl) return { type: 'openai-compatible', url: customUrl, key: customKey, model: customModel || 'default' };
  if (ollamaUrl) return { type: 'ollama', url: ollamaUrl, model: 'llama3.2' };
  return null;
}

async function callAI(aiConfig: AIConfig, prompt: string, system: string, maxTokens = 4096): Promise<string | null> {
  try {
    if (aiConfig.type === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${aiConfig.model}:generateContent?key=${aiConfig.key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: maxTokens },
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }

    if (aiConfig.type === 'ollama') {
      const url = `${aiConfig.url}/api/chat`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
          stream: false,
          options: { temperature: 0.5, num_predict: maxTokens },
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.message?.content || null;
    }

    // OpenAI-compatible (OpenAI, OpenRouter, Custom)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(aiConfig.key ? { Authorization: `Bearer ${aiConfig.key}` } : {}),
      ...(aiConfig.extraHeaders || {}),
    };
    const res = await fetch(aiConfig.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: maxTokens,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('[learning-paths] AI call failed:', err);
    return null;
  }
}

// ─── Config/Storage helpers ──────────────────────────────────

async function getPluginConfig(): Promise<{ paths: LearningPath[] }> {
  try {
    const rows = await db.execute(sql`SELECT config FROM plugins WHERE slug = ${PLUGIN_SLUG} LIMIT 1`);
    const row = (rows as any[])[0];
    if (row?.config && typeof row.config === 'object') {
      return { paths: (row.config as any).paths || [] };
    }
  } catch {}
  return { paths: [] };
}

async function savePluginConfig(config: { paths: LearningPath[] }) {
  await db.execute(sql`
    UPDATE plugins SET config = ${JSON.stringify(config)}::jsonb WHERE slug = ${PLUGIN_SLUG}
  `);
}

async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.execute(sql`SELECT key, value FROM settings`);
  const config: Record<string, string> = {};
  for (const row of rows as any[]) config[row.key] = row.value;
  return config;
}

// ─── GET Handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensurePluginInstalled();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'list';

    if (action === 'list') {
      const { paths } = await getPluginConfig();
      const summaries = paths.map(p => ({
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
      return NextResponse.json({ paths: summaries });
    }

    if (action === 'get') {
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const { paths } = await getPluginConfig();
      const path = paths.find(p => p.id === id);
      if (!path) return NextResponse.json({ error: 'Path not found' }, { status: 404 });
      return NextResponse.json({ path });
    }

    if (action === 'suggestions') {
      // Get top topics from user's knowledge to suggest learning paths
      const settings = await getSettings();
      const aiConfig = getAIConfig(settings);
      if (!aiConfig) return NextResponse.json({ error: 'No AI provider configured' }, { status: 400 });

      // Sample recent memories to understand interests
      const recentMemories = await db.execute(sql`
        SELECT source_title, content, source_type
        FROM memories
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 30
      `);

      const memoryContext = (recentMemories as any[])
        .map(m => `[${m.source_type}] ${m.source_title}: ${(m.content || '').slice(0, 150)}`)
        .join('\n');

      const text = await callAI(
        aiConfig,
        `Based on this person's recent knowledge and memories, suggest 6 learning topics they'd benefit from. Consider what they already know and what logical next steps would deepen or broaden their expertise.

Recent memories:
${memoryContext}

Return ONLY a JSON array: [{"topic": "specific topic", "reason": "why this is valuable for them", "difficulty": "beginner|intermediate|advanced", "estimatedHours": number}]
No markdown fences. JSON only.`,
        'You are a curriculum designer. Suggest highly specific, practical learning paths — not vague categories. Each topic should be learnable in 2-20 hours.',
        2048,
      );

      if (!text) return NextResponse.json({ suggestions: [] });

      try {
        const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        const suggestions = JSON.parse(cleaned);
        return NextResponse.json({ suggestions: Array.isArray(suggestions) ? suggestions.slice(0, 6) : [] });
      } catch {
        return NextResponse.json({ suggestions: [] });
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('[learning-paths] GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST Handler ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensurePluginInstalled();
    const body = await req.json();
    const action = body.action;

    if (action === 'generate') {
      const { topic, context } = body;
      if (!topic) return NextResponse.json({ error: 'Missing topic' }, { status: 400 });

      const settings = await getSettings();
      const aiConfig = getAIConfig(settings);
      if (!aiConfig) return NextResponse.json({ error: 'No AI provider configured' }, { status: 400 });

      // 1. Search existing knowledge about this topic
      let existingKnowledge: { id: string; title: string; preview: string; sourceType: string; content: string }[] = [];
      try {
        const searchQueries = [topic, `${topic} fundamentals`, `${topic} advanced`];
        const allResults: any[] = [];
        for (const q of searchQueries) {
          let embedding: number[] | null = null;
          try {
            const embeddings = await generateEmbeddings([q]);
            if (embeddings && embeddings.length > 0) embedding = embeddings[0];
          } catch { /* fallback to text search */ }
          const results = await retrieve(q, embedding, { userId, limit: 10 });
          allResults.push(...results);
        }
        // Dedup by id
        const seen = new Set<string>();
        for (const r of allResults) {
          if (!seen.has(r.id)) {
            seen.add(r.id);
            existingKnowledge.push({
              id: r.id,
              title: r.sourceTitle || r.source_title || 'Untitled',
              preview: (r.content || '').slice(0, 200),
              sourceType: r.sourceType || r.source_type || 'unknown',
              content: (r.content || '').slice(0, 500),
            });
          }
        }
        existingKnowledge = existingKnowledge.slice(0, 15);
      } catch (err) {
        console.warn('[learning-paths] Search failed:', err);
      }

      // 2. Build context about what they already know
      const knowledgeContext = existingKnowledge.length > 0
        ? `\n\nThe user already has ${existingKnowledge.length} related memories:\n` +
          existingKnowledge.map(m => `- "${m.title}": ${m.preview}`).join('\n')
        : '\n\nThe user has NO existing knowledge about this topic — start from scratch.';

      const additionalContext = context ? `\n\nUser's additional context: ${context}` : '';

      // 3. Generate learning path via AI
      const text = await callAI(
        aiConfig,
        `Create a structured learning path for: "${topic}"${additionalContext}${knowledgeContext}

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
}`,
        'You are an expert curriculum designer. Create practical, well-structured learning paths that build knowledge progressively. Be specific — avoid vague advice. Every node should teach something concrete and testable.',
        6144,
      );

      if (!text) return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });

      // Parse
      let parsed: any;
      try {
        const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
      }

      // Build learning path
      const pathId = `path-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
          title: r.title || 'Resource',
          type: r.type || 'article',
          url: r.url,
        })),
        dependencies: n.dependencies || [],
        relatedMemoryIds: [],
        relatedMemoryTitles: [],
      }));

      // Link related memories to nodes
      for (const node of nodes) {
        const related = existingKnowledge.filter(m =>
          m.content.toLowerCase().includes(node.title.toLowerCase().split(' ')[0]) ||
          node.title.toLowerCase().includes(m.title.toLowerCase().split(' ')[0])
        );
        node.relatedMemoryIds = related.map(r => r.id).slice(0, 3);
        node.relatedMemoryTitles = related.map(r => r.title).slice(0, 3);
      }

      const totalMinutes = nodes.reduce((s, n) => s + n.estimatedMinutes, 0);

      const learningPath: LearningPath = {
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

      // Save
      const { paths } = await getPluginConfig();
      paths.unshift(learningPath);
      // Keep max 20 paths
      if (paths.length > 20) paths.length = 20;
      await savePluginConfig({ paths });

      return NextResponse.json({ path: learningPath });
    }

    if (action === 'update-progress') {
      const { pathId, nodeId, completed } = body;
      if (!pathId || !nodeId) return NextResponse.json({ error: 'Missing pathId or nodeId' }, { status: 400 });

      const { paths } = await getPluginConfig();
      const path = paths.find(p => p.id === pathId);
      if (!path) return NextResponse.json({ error: 'Path not found' }, { status: 404 });

      const node = path.nodes.find(n => n.id === nodeId);
      if (!node) return NextResponse.json({ error: 'Node not found' }, { status: 404 });

      node.completed = completed !== false;
      node.completedAt = node.completed ? new Date().toISOString() : undefined;

      // Recalculate progress
      const completedCount = path.nodes.filter(n => n.completed).length;
      path.progress = Math.round((completedCount / path.nodes.length) * 100);
      path.updatedAt = new Date().toISOString();

      await savePluginConfig({ paths });
      return NextResponse.json({ path });
    }

    if (action === 'add-note') {
      const { pathId, nodeId, note } = body;
      if (!pathId || !nodeId) return NextResponse.json({ error: 'Missing pathId or nodeId' }, { status: 400 });

      const { paths } = await getPluginConfig();
      const path = paths.find(p => p.id === pathId);
      if (!path) return NextResponse.json({ error: 'Path not found' }, { status: 404 });

      const node = path.nodes.find(n => n.id === nodeId);
      if (!node) return NextResponse.json({ error: 'Node not found' }, { status: 404 });

      node.note = note || '';
      path.updatedAt = new Date().toISOString();

      await savePluginConfig({ paths });
      return NextResponse.json({ path });
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

      const { paths } = await getPluginConfig();
      const idx = paths.findIndex(p => p.id === id);
      if (idx === -1) return NextResponse.json({ error: 'Path not found' }, { status: 404 });

      paths.splice(idx, 1);
      await savePluginConfig({ paths });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('[learning-paths] POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
